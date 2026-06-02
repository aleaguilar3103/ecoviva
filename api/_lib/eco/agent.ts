import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../supabase.js";
import { getBotConfig } from "./config.js";
import { TOOLS, executeTool, type ConversationRow, type ToolContext } from "./tools.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const KEEP_RECENT = 12; // mensajes recientes que SIEMPRE van en crudo
const MAX_RAW = 24; // si los mensajes sin resumir superan esto, se pliega el resumen rodante
const MAX_TOOL_LOOPS = 8;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface RunInput {
  channel: "web" | "whatsapp";
  userMessage: string;
  externalId?: string; // sesión del widget web
  ghlContactId?: string; // WhatsApp
  ghlConversationId?: string;
  contactSeed?: { name?: string; email?: string; phone?: string };
}

export interface RunResult {
  reply: string;
  conversationId: string;
  attachments: string[];
}

async function findOrCreateConversation(input: RunInput): Promise<ConversationRow> {
  const db = supabaseAdmin();
  let row: ConversationRow | null = null;

  if (input.ghlContactId) {
    const { data } = await db
      .from("conversations")
      .select("*")
      .eq("ghl_contact_id", input.ghlContactId)
      .maybeSingle();
    row = data as ConversationRow | null;
  } else if (input.externalId) {
    const { data } = await db
      .from("conversations")
      .select("*")
      .eq("external_id", input.externalId)
      .maybeSingle();
    row = data as ConversationRow | null;
  }

  if (!row) {
    const { data, error } = await db
      .from("conversations")
      .insert({
        channel: input.channel,
        ghl_contact_id: input.ghlContactId ?? null,
        ghl_conversation_id: input.ghlConversationId ?? null,
        external_id: input.externalId ?? null,
        contact_name: input.contactSeed?.name ?? null,
        contact_email: input.contactSeed?.email ?? null,
        contact_phone: input.contactSeed?.phone ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`No se pudo crear conversación: ${error.message}`);
    row = data as ConversationRow;
  }
  return row;
}

// Carga los mensajes que aún NO están resumidos (posteriores a `offset`), en
// orden cronológico. Lo anterior vive en el resumen rodante (memoria larga).
// Con offset 0 (sin resumen todavía) traemos los más recientes, por si la
// conversación ya era larga antes de existir el resumen.
async function loadHistory(
  conversationId: string,
  offset: number
): Promise<Anthropic.MessageParam[]> {
  const db = supabaseAdmin();
  const base = db
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"]);
  if (offset > 0) {
    const { data } = await base
      .order("created_at", { ascending: true })
      .range(offset, offset + MAX_RAW + 10);
    return (data || [])
      .filter((r) => r.content)
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
  }
  const { data } = await base
    .order("created_at", { ascending: false })
    .limit(MAX_RAW + 10);
  return (data || [])
    .reverse()
    .filter((r) => r.content)
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
}

// Pliega los mensajes viejos en el resumen rodante. Si falla, conserva el previo
// (nunca rompe la respuesta al cliente).
async function rollUpSummary(
  prevSummary: string,
  rows: { role: string; content: string }[]
): Promise<string> {
  if (!rows.length) return prevSummary;
  const convoText = rows
    .map((r) => `${r.role === "user" ? "Cliente" : "ECO"}: ${r.content}`)
    .join("\n");
  try {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        "Mantenés un resumen breve y útil de una conversación de ventas de lotes (EcoViva) como memoria de largo plazo del asesor. Devolvé SOLO el resumen actualizado, en español, en prosa corta (máximo ~8 líneas), sin viñetas ni encabezados. Capturá: quién es el lead y sus datos (nombre, teléfono, correo si los dio), proyecto e interés, presupuesto y preferencias, qué se le ofreció o envió (folletos, precios), estado de la visita/cita, y pendientes. Conservá lo importante del resumen previo.",
      messages: [
        {
          role: "user",
          content: `Resumen actual:\n${prevSummary || "(vacío)"}\n\nNuevos mensajes a incorporar:\n${convoText}\n\nDevolvé el resumen actualizado y completo.`,
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || prevSummary;
  } catch {
    return prevSummary;
  }
}

export async function runAgent(input: RunInput): Promise<RunResult> {
  const db = supabaseAdmin();
  const { systemPrompt } = await getBotConfig(db);
  const convo = await findOrCreateConversation(input);

  const patchConvo: ToolContext["patchConvo"] = async (fields) => {
    Object.assign(convo, fields);
    await db.from("conversations").update(fields).eq("id", convo.id);
  };
  const ctx: ToolContext = { db, convo, patchConvo, attachments: [] };

  // Si el canal nos dio datos del contacto (WhatsApp/CRM trae nombre, teléfono y
  // a veces correo) y la conversación aún no los tiene, los sembramos: así las
  // tools de guardado/agenda tienen respaldo y no se duplican contactos.
  if (input.contactSeed) {
    const patch: Record<string, string> = {};
    if (!convo.contact_name && input.contactSeed.name) patch.contact_name = input.contactSeed.name;
    if (!convo.contact_email && input.contactSeed.email) patch.contact_email = input.contactSeed.email;
    if (!convo.contact_phone && input.contactSeed.phone) patch.contact_phone = input.contactSeed.phone;
    if (Object.keys(patch).length) await patchConvo(patch);
  }

  // Memoria de largo plazo: resumen rodante guardado en conversations.memory.
  const mem = (convo.memory && typeof convo.memory === "object"
    ? (convo.memory as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const summary = typeof mem.summary === "string" ? mem.summary : "";
  const summaryCount = typeof mem.summary_count === "number" ? mem.summary_count : 0;

  const history = await loadHistory(convo.id, summaryCount);
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: input.userMessage },
  ];

  // Persistir mensaje del usuario
  await db.from("messages").insert({
    conversation_id: convo.id,
    role: "user",
    content: input.userMessage,
  });

  let finalText = "";
  const toolAudit: { name: string; input: unknown; result: string }[] = [];

  const now = new Date();
  const crNow = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  // Fecha ISO en zona de Costa Rica (en-CA → "YYYY-MM-DD"). Imprescindible para
  // que el agente pase fechas con el AÑO correcto a las tools de calendario;
  // sin el año, el modelo asume uno de su entrenamiento (pasado) y GHL no
  // devuelve cupos para fechas pasadas.
  const crISODate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Datos que ya tenemos del contacto: el agente debe usarlos y NO volver a
  // pedir lo que ya sabe. El nombre se confirma si parece real; si es basura
  // (ej. "Dios es grande"), ahí sí se pide.
  const seed = {
    name: convo.contact_name || input.contactSeed?.name || undefined,
    phone: convo.contact_phone || input.contactSeed?.phone || undefined,
    email: convo.contact_email || input.contactSeed?.email || undefined,
  };
  let contactNote = "";
  if (seed.name || seed.phone || seed.email) {
    const have: string[] = [];
    if (seed.name) have.push(`nombre "${seed.name}"`);
    if (seed.phone) have.push(`teléfono ${seed.phone}`);
    if (seed.email) have.push(`correo ${seed.email}`);
    contactNote =
      ` Datos que YA tenés de este contacto (de WhatsApp/CRM): ${have.join(", ")}. ` +
      `Usalos a tu favor y NO vuelvas a pedir lo que ya tenés. Para agendar: si el nombre parece un nombre real de persona, ` +
      `confirmalo en vez de preguntarlo (ej. "¿La agendo a nombre de Alejandro y con este mismo número del que me escribe?"). ` +
      `Solo si el nombre NO parece de persona (ej. "Dios es grande", un apodo, una empresa, o está vacío) pedí el nombre correcto. ` +
      `El número de WhatsApp ya sirve como teléfono. Pedí únicamente lo que falte (normalmente solo el correo). ` +
      `Si ya tenés nombre, teléfono y correo, no preguntés nada: confirmá en una línea y agendá.`;
  }

  // Bloques de system: prompt (cacheado) + resumen de largo plazo (si hay) + contexto del día.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  ];
  if (summary) {
    systemBlocks.push({
      type: "text",
      text: `Resumen de lo conversado antes con este cliente (memoria de largo plazo; los mensajes recientes van aparte abajo): ${summary}`,
    });
  }
  systemBlocks.push({
    type: "text",
    text: `Hoy es ${crISODate} (${crNow} en Costa Rica). Cuando llames a herramientas de calendario (consultar_horarios_disponibles, agendar_visita), las fechas SIEMPRE van en formato YYYY-MM-DD usando el año actual (${crISODate.slice(0, 4)}); nunca uses un año anterior ni una fecha pasada. Si la persona saluda, saludá según la hora (buenos días / buenas tardes / buenas noches), siempre corto.${contactNote}`,
  });

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemBlocks,
      tools: TOOLS.map((t, idx) =>
        idx === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t
      ) as Anthropic.Tool[],
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks = resp.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (textBlocks.length) finalText = textBlocks.map((b) => b.text).join("\n").trim();

    if (resp.stop_reason !== "tool_use" || !toolUses.length) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let out: string;
      try {
        out = await executeTool(tu.name, tu.input as Record<string, unknown>, ctx);
      } catch (e) {
        out = `Error ejecutando ${tu.name}: ${(e as Error).message}`;
      }
      toolAudit.push({ name: tu.name, input: tu.input, result: out });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  // Persistir respuesta final + auditoría de tools
  await db.from("messages").insert({
    conversation_id: convo.id,
    role: "assistant",
    content: finalText,
    tool_calls: toolAudit.length ? toolAudit : null,
  });
  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convo.id);

  // Resumen rodante: si se acumularon muchos mensajes sin resumir, plegamos los
  // más viejos al resumen y dejamos los KEEP_RECENT más nuevos en crudo.
  try {
    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convo.id)
      .in("role", ["user", "assistant"]);
    const total = count ?? 0;
    if (total - summaryCount > MAX_RAW) {
      const foldUpTo = total - KEEP_RECENT; // resumimos hasta acá (exclusivo)
      const { data: foldRows } = await db
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convo.id)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: true })
        .range(summaryCount, foldUpTo - 1);
      const rows = (foldRows || []).filter((r) => r.content) as {
        role: string;
        content: string;
      }[];
      const newSummary = await rollUpSummary(summary, rows);
      await patchConvo({ memory: { ...mem, summary: newSummary, summary_count: foldUpTo } });
    }
  } catch (e) {
    console.error("eco summary roll error", e);
  }

  return {
    reply: finalText || "Disculpá, no logré procesar eso. ¿Lo intentamos de nuevo?",
    conversationId: convo.id,
    attachments: ctx.attachments,
  };
}
