import { runAgent } from "./_lib/eco/agent.js";
import { getBotConfig } from "./_lib/eco/config.js";
import { supabaseAdmin, requireAdmin } from "./_lib/supabase.js";

// Prefijo obligatorio de las sesiones del banco de pruebas del panel. Sirve de
// candado: nunca se puede probar (ni borrar) encima de una conversación real de
// un cliente, aunque alguien mande a mano el sessionId de otra persona.
const TEST_PREFIX = "admin-test-";

// /api/chat — endpoint del widget web.
// POST { message: string, sessionId: string, contact?: {name,email,phone} }
//
// Modo prueba del panel admin (misma función para no sumar otra serverless):
// POST { mode: "admin-test", message, sessionId: "admin-test-…", simulate? }
//   con Authorization: Bearer <JWT de admin>. Ignora el interruptor de apagado
//   del bot (justamente sirve para probar antes de encenderlo) y devuelve la
//   auditoría de herramientas usadas en el turno.
// DELETE { mode: "admin-test", sessionId } → borra la conversación de prueba.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const body = (req.body ?? {}) as {
    message?: string;
    sessionId?: string;
    contact?: { name?: string; email?: string; phone?: string };
    mode?: string;
    simulate?: boolean;
  };
  const esPrueba = body.mode === "admin-test";

  if (esPrueba) {
    if (!(await requireAdmin(req))) return res.status(401).json({ error: "No autorizado" });
    if (!body.sessionId?.startsWith(TEST_PREFIX)) {
      return res.status(400).json({ error: "sessionId de prueba inválido" });
    }
  }

  if (req.method === "DELETE") {
    if (!esPrueba) return res.status(405).json({ error: "Method not allowed" });
    try {
      // Los mensajes cuelgan de la conversación con ON DELETE CASCADE.
      const { error } = await supabaseAdmin()
        .from("conversations")
        .delete()
        .eq("external_id", body.sessionId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("chat delete error", e);
      return res.status(500).json({ error: (e as Error).message });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Faltan message o sessionId" });
  }

  // Si el bot está apagado desde el panel, respondemos cortésmente sin invocar al agente.
  // En el banco de pruebas no aplica: se prueba justamente para decidir si encenderlo.
  if (!esPrueba) {
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
  }

  try {
    const result = await runAgent({
      channel: "web",
      externalId: body.sessionId,
      userMessage: body.message,
      contactSeed: body.contact,
      simulate: esPrueba ? body.simulate !== false : false,
    });
    // La auditoría de tools solo sale por el modo prueba: el widget público no
    // tiene por qué ver los internos del agente.
    if (esPrueba) return res.status(200).json(result);
    return res.status(200).json({
      reply: result.reply,
      conversationId: result.conversationId,
      attachments: result.attachments,
    });
  } catch (e) {
    console.error("chat error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
