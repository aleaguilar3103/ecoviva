import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../supabase.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { TOOLS, executeTool, type ConversationRow, type ToolContext } from "./tools.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_HISTORY = 20;
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

async function loadHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);
  const rows = (data || []).reverse();
  return rows
    .filter((r) => r.content)
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
}

export async function runAgent(input: RunInput): Promise<RunResult> {
  const db = supabaseAdmin();
  const convo = await findOrCreateConversation(input);

  const patchConvo: ToolContext["patchConvo"] = async (fields) => {
    Object.assign(convo, fields);
    await db.from("conversations").update(fields).eq("id", convo.id);
  };
  const ctx: ToolContext = { db, convo, patchConvo };

  const history = await loadHistory(convo.id);
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

  const crNow = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `Hora actual en Costa Rica: ${crNow}. Si la persona saluda, saludá según la hora (buenos días / buenas tardes / buenas noches), siempre corto.`,
        },
      ],
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

  return { reply: finalText || "Disculpá, no logré procesar eso. ¿Lo intentamos de nuevo?", conversationId: convo.id };
}
