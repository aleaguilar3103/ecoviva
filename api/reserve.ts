import { CF, updateContactCustomFields, addTags, bookAppointment } from "./_lib/ghl.js";
import { capturarLead, fechaLegibleES } from "./_lib/funnel.js";

// /api/reserve — paso 2 del funnel: agenda la cita REAL en el calendario de GHL.
//
// Antes esto apartaba el horario en Upstash Redis y le pasaba el lead a n8n.
// Ese diseño tenía dos fallas: Redis no sabía de las citas de ECO ni de las que
// agenda el equipo a mano (se ofrecían horas ocupadas), y si Redis fallaba la
// función devolvía 500 ANTES de entregar el lead, así que el prospecto se perdía.
// Ahora GHL es la única fuente de verdad, igual que para ECO.
//
// Regla que no se rompe: el lead nunca se pierde. El contacto se guarda primero;
// si el agendamiento falla después, queda etiquetado para seguimiento manual.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    contactId?: string;
    nombre?: string;
    apellido?: string;
    telefono?: string;
    correo?: string;
    proyecto?: string;
    presupuesto?: string;
    fecha?: string;
    slotIso?: string;
    hora?: string;
  };

  const { fecha, slotIso } = body;
  if (!fecha || !slotIso) {
    return res.status(400).json({ error: "Faltan fecha o slotIso" });
  }
  // slotIso viene tal cual de /api/slots (ISO con offset de CR).
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}$/.test(slotIso)) {
    return res.status(400).json({ error: "slotIso inválido" });
  }

  // 1) El contacto primero. Si el paso 1 ya lo creó reusamos ese id.
  let contactId = body.contactId;
  if (!contactId) {
    try {
      contactId = await capturarLead(body);
    } catch (err) {
      console.error("[reserve] no se pudo guardar el contacto en GHL:", err);
      return res.status(502).json({ error: "crm_unavailable" });
    }
  }

  // 2) Datos de la cita en el contacto. Secundario: si falla, seguimos.
  const fechaLeg = fechaLegibleES(fecha);
  const horaLeg = body.hora || slotIso.slice(11, 16);
  try {
    await updateContactCustomFields(contactId, [
      { id: CF.fechaVisita, value: fecha },
      { id: CF.fechaLegible, value: fechaLeg },
      { id: CF.horaCita, value: horaLeg },
    ]);
  } catch (err) {
    console.error("[reserve] no se pudieron guardar los datos de la cita:", err);
  }

  // 3) La cita real en el calendario.
  const proyecto = body.proyecto || "EcoViva";
  const nombre = [body.nombre, body.apellido].filter(Boolean).join(" ") || "Lead";
  try {
    await bookAppointment({
      contactId,
      startTime: slotIso,
      title: `Visita ${proyecto} — ${nombre}`,
    });
  } catch (err) {
    console.error("[reserve] no se pudo agendar la cita:", err);
    // El lead YA está en GHL. Lo marcamos para que alguien lo agende a mano
    // en vez de dejarlo pasar como si nada.
    try {
      await addTags(contactId, ["cita-fallida"]);
    } catch {
      /* la etiqueta es lo de menos: el contacto ya existe */
    }
    // El horario pudo habérselo ganado otra persona entre que cargó la página
    // y confirmó. Que reintente con la lista fresca.
    return res.status(409).json({ error: "slot_unavailable", contactId });
  }

  return res.status(200).json({ ok: true, contactId });
}
