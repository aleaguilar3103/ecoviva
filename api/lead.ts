import { capturarLead } from "./_lib/funnel.js";

// /api/lead — paso 1 del funnel (nombre, teléfono, correo, proyecto, presupuesto).
//
// Guarda el contacto en GHL APENAS lo tenemos, sin esperar a que elija fecha.
// Antes el lead solo existía si completaba el paso 2 y el agendamiento salía
// bien; quien abandonaba en el calendario se perdía por completo.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    correo?: string;
    proyecto?: string;
    presupuesto?: string;
  };

  if (!body.correo && !body.telefono) {
    return res.status(400).json({ error: "Se requiere correo o teléfono" });
  }

  try {
    const contactId = await capturarLead(body);
    return res.status(200).json({ contactId });
  } catch (err) {
    console.error("[lead] no se pudo guardar el contacto en GHL:", err);
    // El frontend sigue al paso 2 igual: /api/reserve vuelve a intentar el
    // upsert, así que un fallo aquí no bloquea al prospecto.
    return res.status(502).json({ error: "crm_unavailable" });
  }
}
