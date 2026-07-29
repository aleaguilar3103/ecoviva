// Lógica compartida entre /api/lead (paso 1: datos de contacto) y
// /api/reserve (paso 2: agendar la cita) del funnel web.

import { CF, upsertContact, addTags } from "./ghl.js";

export const LEAD_TAG = process.env.GHL_LEAD_TAG || "Leads 2026";

export interface FunnelContact {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  correo?: string;
  proyecto?: string;
  presupuesto?: string;
}

// GHL deduplica por teléfono/correo, pero solo si el teléfono viene en E.164.
// El funnel arma "+506 8888 8888" con espacios: hay que limpiarlo o se crean
// contactos duplicados.
export function normalizarTelefono(raw?: string): string | undefined {
  if (!raw) return undefined;
  const soloDigitos = raw.replace(/[^\d+]/g, "");
  if (!soloDigitos) return undefined;
  return soloDigitos.startsWith("+") ? soloDigitos : `+${soloDigitos}`;
}

// Crea o actualiza el contacto en GHL y le pone la etiqueta de lead.
// Devuelve el contactId. Replica lo que hacía el flujo de n8n
// (ver docs/eco-agente-maestro.md) para que web y ECO escriban igual.
export async function capturarLead(data: FunnelContact): Promise<string> {
  const customFields: { id: string; value: string }[] = [];
  if (data.proyecto) customFields.push({ id: CF.proyecto, value: data.proyecto });
  if (data.presupuesto) customFields.push({ id: CF.presupuesto, value: data.presupuesto });

  const contactId = await upsertContact({
    firstName: data.nombre,
    lastName: data.apellido,
    email: data.correo,
    phone: normalizarTelefono(data.telefono),
    customFields,
  });

  // addTags por separado (aditivo). Mandarlas en el upsert puede sobrescribir
  // las etiquetas que ya tenga el contacto.
  try {
    await addTags(contactId, [LEAD_TAG]);
  } catch (err) {
    // La etiqueta es secundaria; el contacto ya quedó guardado.
    console.error("[funnel] no se pudo etiquetar el contacto:", err);
  }

  return contactId;
}

// Costa Rica = UTC-6 fijo (sin horario de verano).
export function fechaLegibleES(fecha: string): string {
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [y, mo, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const dia = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    timeZone: "America/Costa_Rica",
  }).format(dt);
  return `${dia} ${d} de ${MESES[mo - 1]} de ${y}`;
}
