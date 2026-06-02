import { runAgent } from "./_lib/eco/agent.js";

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
