import { runAgent } from "./_lib/eco/agent.js";
import { getBotConfig } from "./_lib/eco/config.js";
import { supabaseAdmin } from "./_lib/supabase.js";

// /api/chat — endpoint del widget web.
// POST { message: string, sessionId: string, contact?: {name,email,phone} }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = (req.body ?? {}) as {
    message?: string;
    sessionId?: string;
    contact?: { name?: string; email?: string; phone?: string };
  };
  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Faltan message o sessionId" });
  }

  // Si el bot está apagado desde el panel, respondemos cortésmente sin invocar al agente.
  try {
    const { botEnabled } = await getBotConfig(supabaseAdmin());
    if (!botEnabled) {
      return res.status(200).json({
        reply:
          "Gracias por escribir. En este momento el asistente no está disponible; un asesor le contactará pronto. También puede llamarnos al +506 8414 2111.",
        disabled: true,
      });
    }
  } catch (e) {
    console.error("chat bot_config error", e);
  }

  try {
    const result = await runAgent({
      channel: "web",
      externalId: body.sessionId,
      userMessage: body.message,
      contactSeed: body.contact,
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error("chat error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
