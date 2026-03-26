import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ALL_SLOT_KEYS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date } = req.query as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Missing or invalid date parameter (expected YYYY-MM-DD)" });
  }

  try {
    const keys = ALL_SLOT_KEYS.map((k) => `slot:${date}:${k}`);
    const results = await redis.mget(...(keys as [string, ...string[]]));
    const booked = ALL_SLOT_KEYS.filter((_, i) => results[i] !== null);
    return res.status(200).json({ booked });
  } catch {
    return res.status(500).json({ error: "Failed to query slot availability" });
  }
}
