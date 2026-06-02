import { waitUntil } from "@vercel/functions";
import { runAgent } from "../_lib/eco/agent.js";
import { getBotConfig } from "../_lib/eco/config.js";
import { getContact, getLastInboundMessage, sendMessage } from "../_lib/ghl.js";
import { supabaseAdmin } from "../_lib/supabase.js";

// /api/ghl/webhook — recibe mensajes ENTRANTES desde GHL (WhatsApp y otros canales)
// y responde por el mismo canal usando la API de GHL.
//
// - Registra cada payload crudo en webhook_events (inspección).
// - Si el contacto tiene el tag "stop bot", el flujo muere (no corre el agente).
// - Responde con una espera aleatoria (15–45s) para sentirse humano; el envío se
//   hace en segundo plano (waitUntil) para no bloquear el webhook de GHL.

const STOP_TAG = (process.env.GHL_STOP_TAG || "stop bot").toLowerCase().replace(/[\s_-]/g, "");
const DELAY_MIN_MS = 15_000;
const DELAY_MAX_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (t: string) => t.toLowerCase().trim().replace(/[\s_-]/g, "");

function tieneStopTag(tagsField: unknown): boolean {
  let tags: string[] = [];
  if (Array.isArray(tagsField)) tags = tagsField.map(String);
  else if (typeof tagsField === "string") tags = tagsField.split(",");
  return tags.map(norm).includes(STOP_TAG);
}

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

  // Kill switch global: si el bot está apagado desde el panel, no respondemos.
  try {
    const { botEnabled } = await getBotConfig(supabaseAdmin());
    if (!botEnabled) return res.status(200).json({ ok: true, skipped: "bot_disabled" });
  } catch (e) {
    console.error("webhook bot_config error", e);
  }

  // Kill switch: si el contacto tiene el tag "stop bot", el flujo muere aquí.
  if (tieneStopTag(b.tags)) {
    return res.status(200).json({ ok: true, skipped: "stop_bot_tag" });
  }

  // Solo respondemos a mensajes entrantes
  if (direction && String(direction).toLowerCase() === "outbound") {
    return res.status(200).json({ ok: true, skipped: "outbound" });
  }

  // Sin contactId no hay forma de responder ni de consultar a GHL.
  if (!contactId) {
    return res.status(200).json({
      ok: true,
      logged: true,
      note: "Payload capturado en webhook_events. Falta contactId.",
    });
  }

  // Espera aleatoria humana (15–45s) + respuesta, en segundo plano.
  const delayMs = DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1));
  waitUntil(
    (async () => {
      try {
        await sleep(delayMs);

        // Respaldo "get last message" (como en n8n): si el webhook llegó sin texto,
        // le pedimos a GHL el último mensaje ENTRANTE del contacto. Solo responde si
        // ese es el mensaje más reciente (si ya hay un saliente después, no hace nada).
        let text = message;
        let convId = conversationId;
        if (!text) {
          const last = await getLastInboundMessage(contactId);
          if (last) {
            text = last.message;
            convId = convId || last.conversationId;
          }
        }
        if (!text) {
          console.warn("ghl webhook: sin texto en payload ni mensaje entrante pendiente", contactId);
          return;
        }

        // Datos que ya tenemos del contacto (nombre/correo/teléfono): así el
        // agente confirma en vez de preguntar lo que ya sabe.
        const known = await getContact(contactId);

        const { reply, attachments } = await runAgent({
          channel: "whatsapp",
          ghlContactId: contactId,
          ghlConversationId: convId,
          userMessage: text,
          contactSeed: known
            ? { name: known.name, email: known.email, phone: known.phone }
            : undefined,
        });
        await sendMessage({ contactId, message: reply, type: messageType, conversationId: convId, attachments });
      } catch (e) {
        console.error("ghl webhook bg error", e);
      }
    })()
  );

  // Respondemos a GHL de inmediato para no bloquear el workflow.
  return res.status(200).json({ ok: true, queued: true, delayMs });
}
