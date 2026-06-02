import { runAgent } from "../_lib/eco/agent.js";
import { sendMessage } from "../_lib/ghl.js";
import { supabaseAdmin } from "../_lib/supabase.js";

// /api/ghl/webhook — recibe mensajes ENTRANTES desde GHL (WhatsApp y otros canales)
// y responde por el mismo canal usando la API de GHL.
//
// Registra cada payload crudo en la tabla webhook_events (para inspección: texto,
// imágenes, audio, canal). Configurar en GHL un Workflow con trigger "Customer
// Replied / Inbound Message" → Custom Webhook (POST) hacia aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 1) Log crudo (best-effort) — redacta headers sensibles
  try {
    const headers = { ...(req.headers || {}) };
    delete headers.authorization;
    delete headers.Authorization;
    delete headers.cookie;
    await supabaseAdmin().from("webhook_events").insert({
      source: "ghl",
      headers,
      query: req.query ?? null,
      body: req.body ?? null,
    });
  } catch (e) {
    console.error("webhook log error", e);
  }

  // Verificación opcional de secreto
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.query?.token !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const b = (req.body ?? {}) as Record<string, any>;
  const contactId: string | undefined = b.contact_id || b.contactId || b.contact?.id;
  // GHL manda `message` como objeto { body, type } (no string)
  const msg = b.message;
  const message: string | undefined =
    typeof msg === "string" ? msg : msg?.body || b.body || b.messageBody || b.text;
  const conversationId: string | undefined =
    b.conversationId || b.conversation_id || msg?.conversationId;
  const messageType = "WhatsApp"; // canal de respuesta
  const direction: string | undefined = b.direction || msg?.direction;
  const attachments =
    (msg && (msg.attachments || msg.media)) ||
    b.attachments ||
    b.attachmentUrls ||
    b.attachment ||
    b.mediaUrl ||
    null;

  // Solo respondemos a mensajes entrantes
  if (direction && String(direction).toLowerCase() === "outbound") {
    return res.status(200).json({ ok: true, skipped: "outbound" });
  }

  // Durante la captura: si no hay texto/contacto, igual ya quedó registrado para inspección.
  if (!contactId || !message) {
    return res.status(200).json({
      ok: true,
      logged: true,
      note: "Payload capturado en webhook_events. Falta contactId o message de texto.",
      hasAttachments: !!attachments,
    });
  }

  try {
    const { reply } = await runAgent({
      channel: "whatsapp",
      ghlContactId: contactId,
      ghlConversationId: conversationId,
      userMessage: message,
    });
    await sendMessage({ contactId, message: reply, type: messageType, conversationId });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ghl webhook error", e);
    return res.status(200).json({ ok: false, error: (e as Error).message });
  }
}
