import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body ?? {};
  // slotKey is only needed for Redis — strip it from the n8n payload
  // fecha stays in webhookPayload so n8n receives the appointment date
  const { slotKey, ...webhookPayload } = body as {
    slotKey?: string;
    [key: string]: unknown;
  };
  const fecha = webhookPayload.fecha as string | undefined;

  if (!fecha || !slotKey) {
    return res.status(400).json({ error: "Missing fecha or slotKey" });
  }

  // TTL = seconds until midnight of the appointment day (local Costa Rica time, UTC-6)
  // Using UTC midnight + offset to approximate; for simplicity we use UTC midnight of next day
  const [y, m, d] = fecha.split("-").map(Number);
  const midnight = new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0)); // UTC 06:00 = CR midnight (UTC-6)
  const ttl = Math.floor((midnight.getTime() - Date.now()) / 1000);

  if (ttl <= 0) {
    return res.status(400).json({ error: "Cannot book slots for past dates" });
  }

  const key = `slot:${fecha}:${slotKey}`;

  // Atomic: only set if key does not already exist
  let result: string | null;
  try {
    result = await redis.set(key, "booked", { nx: true, ex: ttl });
  } catch {
    return res.status(500).json({ error: "Failed to reserve slot" });
  }

  if (result === null) {
    // Another user already claimed this slot
    return res.status(409).json({ error: "slot_taken" });
  }

  // Slot reserved — call n8n webhook (awaited so serverless doesn't terminate early)
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
    } catch {
      // Don't fail the reservation if the webhook call fails
    }
  }

  return res.status(200).json({ ok: true });
}
