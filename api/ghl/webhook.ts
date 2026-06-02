import { runAgent } from "../_lib/eco/agent.js";
import { sendMessage } from "../_lib/ghl.js";

// /api/ghl/webhook — recibe mensajes ENTRANTES desde GHL (WhatsApp y otros canales)
// y responde por el mismo canal usando la API de GHL.
//
// Configurar en GHL un Workflow con trigger "Customer Replied / Inbound Message"
// que haga POST aquí con un Custom Webhook. Payload esperado (campos flexibles):
//   { contactId, message|body, conversationId?, messageType?, direction? }
// Opcional: proteger con ?token=<WEBHOOK_SECRET>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verificación opcional de secreto
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.query?.token !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const b = (req.body ?? {}) as Record<string, any>;
  const contactId: string | undefined = b.contactId || b.contact_id || b.contact?.id;
  const message: string | undefined = b.message || b.body || b.messageBody || b.text;
  const conversationId: string | undefined = b.conversationId || b.conversation_id;
  const messageType: string = b.messageType || b.type || "WhatsApp";
  const direction: string | undefined = b.direction;

  // Solo respondemos a mensajes entrantes
  if (direction && String(direction).toLowerCase() === "outbound") {
    return res.status(200).json({ ok: true, skipped: "outbound" });
  }
  if (!contactId || !message) {
    return res.status(400).json({ error: "Faltan contactId o message" });
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
    // Responder 200 para que GHL no reintente en loop; logueamos el error.
    return res.status(200).json({ ok: false, error: (e as Error).message });
  }
}
