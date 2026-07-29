import { getFreeSlots } from "./_lib/ghl.js";

// /api/slots?date=YYYY-MM-DD
// Disponibilidad REAL del calendario de GHL — la misma fuente que usa ECO.
// Antes esto salía de una lista fija de 7 horas en el frontend + un candado en
// Redis, que no sabía de las citas de ECO, ni de las que agenda el equipo a
// mano, ni de vacaciones. Ofrecía horas en las que nadie estaba disponible.

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

  // Costa Rica = UTC-6 fijo (sin horario de verano): el día local va de las
  // 06:00Z de ese día a las 06:00Z del siguiente.
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 6, 0, 0);
  const endMs = Date.UTC(y, m - 1, d + 1, 6, 0, 0) - 1;

  try {
    const byDate = await getFreeSlots({ startMs, endMs });
    const raw = byDate[date]?.slots ?? [];

    // GHL devuelve ISO con offset local ("2026-07-30T07:30:00-06:00").
    // Leemos la hora del string tal cual para no reconvertir zonas horarias.
    const slots = raw.map((iso) => {
      const hora = iso.slice(11, 16); // "07:30"
      return { iso, hora, display: horaLegible(hora) };
    });

    return res.status(200).json({ slots });
  } catch (err) {
    console.error("[slots] no se pudo leer la disponibilidad de GHL:", err);
    // Sin invento: si no sabemos la disponibilidad real, no ofrecemos horarios
    // falsos. El lead ya quedó capturado en el paso 1 (ver /api/lead), así que
    // un fallo aquí no lo pierde.
    return res.status(503).json({ error: "calendar_unavailable" });
  }
}

// "07:30" -> "7:30 AM" | "14:00" -> "2:00 PM"
function horaLegible(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}
