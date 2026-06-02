import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "../_lib/supabase.js";

// /api/admin/prompt-assistant — asistente de Claude para editar el prompt de ECO.
// Requiere admin. POST body:
//   { mode: "generate", instruction, currentPrompt }
//     → { block }  Redacta un bloque de texto (reglas/datos) en el estilo de ECO.
//   { mode: "inject", block, currentPrompt }
//     → { prompt }  Devuelve el prompt COMPLETO con el bloque colocado donde mejor corresponda.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

function textOf(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await requireAdmin(req))) return res.status(401).json({ error: "No autorizado" });

  const body = (req.body ?? {}) as {
    mode?: "generate" | "inject";
    instruction?: string;
    block?: string;
    currentPrompt?: string;
  };
  const mode = body.mode;
  const currentPrompt = (body.currentPrompt || "").trim();

  if (mode !== "generate" && mode !== "inject") {
    return res.status(400).json({ error: "mode debe ser 'generate' o 'inject'" });
  }

  try {
    if (mode === "generate") {
      const instruction = (body.instruction || "").trim();
      if (!instruction) return res.status(400).json({ error: "Falta instruction" });

      const resp = await client().messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `Sos un asistente que ayuda a redactar partes del PROMPT DE SISTEMA de "ECO", el asesor de ventas por WhatsApp/chat de EcoViva Desarrollos (lotes en Costa Rica).

Tu tarea: a partir de lo que pide el administrador, redactar UN BLOQUE de texto listo para pegar dentro del prompt. Reglas:
- Escribí en español, en el mismo estilo del prompt: instrucciones claras y concisas para el modelo, en segunda persona ("usá", "no inventés", "preguntá").
- NO devuelvas el prompt completo, SOLO el bloque nuevo (1 a 8 líneas normalmente).
- No agregues encabezados de markdown nuevos a menos que el bloque sea una sección entera. Si es una regla suelta, devolvé solo la(s) línea(s) de la regla.
- No inventes datos de negocio (precios, teléfonos) que no estén en lo que pide el admin.
- Respondé ÚNICAMENTE con el bloque de texto, sin explicaciones, sin comillas, sin "Aquí tienes:".`,
        messages: [
          {
            role: "user",
            content: `PROMPT ACTUAL (contexto, NO lo repitas):\n"""\n${currentPrompt}\n"""\n\nLo que quiero agregar/decir:\n${instruction}`,
          },
        ],
      });

      return res.status(200).json({ block: textOf(resp) });
    }

    // mode === "inject"
    const block = (body.block || "").trim();
    if (!block) return res.status(400).json({ error: "Falta block" });
    if (!currentPrompt) return res.status(400).json({ error: "Falta currentPrompt" });

    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `Sos un editor del PROMPT DE SISTEMA de "ECO" (asesor de EcoViva). Te dan el prompt completo y un BLOQUE nuevo. Tu trabajo: insertar el bloque en el lugar MÁS adecuado del prompt (en la sección temática que corresponda: tono, datos oficiales, reglas, etc.), integrándolo con naturalidad.

Reglas estrictas:
- Devolvé el PROMPT COMPLETO ya editado, nada más. Sin explicaciones, sin comillas, sin markdown de cierre.
- NO borres ni reescribas el contenido existente; solo insertá el bloque (podés ajustar mínimamente la redacción del bloque para que encaje, p. ej. viñetas/formato consistentes).
- Conservá el formato, los encabezados (#) y el orden del prompt original.
- Si el bloque ya está esencialmente presente, devolvé el prompt sin duplicarlo.`,
      messages: [
        {
          role: "user",
          content: `PROMPT COMPLETO ACTUAL:\n"""\n${currentPrompt}\n"""\n\nBLOQUE A INSERTAR:\n"""\n${block}\n"""\n\nDevolvé el prompt completo con el bloque ya integrado en el mejor lugar.`,
        },
      ],
    });

    return res.status(200).json({ prompt: textOf(resp) });
  } catch (e) {
    console.error("admin/prompt-assistant error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
