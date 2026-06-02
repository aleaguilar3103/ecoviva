// Cliente REST de GoHighLevel (LeadConnector API v2).
// Reemplaza el flujo de n8n: upsert de contacto, custom fields, tags,
// disponibilidad de calendario y agendamiento de citas, y envío de mensajes.

const BASE = "https://services.leadconnectorhq.com";

function token(): string {
  const t = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  if (!t) throw new Error("Falta GHL_PRIVATE_INTEGRATION_TOKEN");
  return t;
}
export function locationId(): string {
  return process.env.GHL_LOCATION_ID || "uLX0pzqaYQx8jI6PxNTT";
}
export function calendarId(): string {
  return process.env.GHL_CALENDAR_ID || "wMbDKSJh3px5ZYucw5pP";
}

// Custom field IDs (de la subcuenta EcoViva)
export const CF = {
  proyecto: "NhbY1rHi2BnUuNLcgja7",
  presupuesto: "ybxUuZZpWJHdIVvtdcQb",
  fechaVisita: "dNJDX0Uyhwz4Jeg4nrT3",
  fechaLegible: "dzbFsoxfGA2aVjd4ScsA",
  horaCita: "MXfzhnoWkBr3fgiVu6rl",
} as const;

// Custom field IDs del survey "Aplicación de Financiamiento" (/survey).
export const SURVEY_CF = {
  tipoId: "RXXNG2fNEO80ycjsYbvM", // SINGLE_OPTIONS: Nacional / Extranjero
  numeroId: "WenhxdnejuE5NjJeD7wD", // NUMERICAL
  casaHabitacion: "OQpCw1kLHLKkcKGmRaZ5", // RADIO: Propia. / Gratuita. / Alquilada.
  ubicacionResidencia: "dSBHObhEIpx6o2BnUkJY", // RADIO: Rural. / Urbana.
  poseeInmuebles: "3wMWP6OISePYMx7V1xrp", // RADIO: Si. / No.
  poseeVehiculo: "AxlHDqwdVxP9WlvDKYot", // RADIO: Si. / No.
  estadoCivil: "j6Td6h9ZkvuBEqnxnrMm", // SINGLE_OPTIONS
  gradoAcademico: "XoiHc9WCp3IMuBh2ACYZ", // SINGLE_OPTIONS
  dependientes: "sx7qtq83GvU9z6oNrosP", // SINGLE_OPTIONS
  poseeDeudas: "Wb6SI8N6KLt6Hcd0JrCG", // RADIO: Si. / No.
  pensionado: "wT1zs4pqFSjrHL4wg3FF", // RADIO: Si. / No.
  tarjetasCredito: "yVS6uAyGVLbx48AC15rr", // RADIO: Si. / No.
  sugef: "fnAw0KtRXxYgx6oylhoS", // RADIO: Si. / No.
  cedulaFrontal: "oeMZqHqYsgiGnZZFbLW1", // FILE_UPLOAD
  cedulaPosterior: "Osi32CkDQeWBjc37W4uL", // FILE_UPLOAD
  firma: "grvoqumQ6HxDkN8z39r6", // SIGNATURE
} as const;

async function ghlFetch(
  path: string,
  opts: { method?: string; body?: unknown; version?: string; query?: Record<string, string> } = {}
) {
  const version = opts.version || "2021-07-28";
  const url = new URL(BASE + path);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      Version: version,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GHL ${res.status} ${path}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json as Record<string, unknown>;
}

export interface UpsertContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string; // formato E.164 con código de país (+506…)
  customFields?: { id: string; value: string }[];
  tags?: string[];
}

// Crea o actualiza un contacto. Devuelve el id del contacto.
export async function upsertContact(input: UpsertContactInput): Promise<string> {
  const body: Record<string, unknown> = {
    locationId: locationId(),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
  };
  if (input.customFields?.length) body.customFields = input.customFields;
  if (input.tags?.length) body.tags = input.tags;
  const json = await ghlFetch("/contacts/upsert", { method: "POST", body });
  const contact = (json.contact || json) as Record<string, unknown>;
  return String(contact.id);
}

// Trae los datos actuales del contacto (nombre/correo/teléfono) para que el
// agente use lo que YA tiene y no lo vuelva a pedir. Devuelve null si falla.
export async function getContact(contactId: string): Promise<{
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
} | null> {
  try {
    const json = await ghlFetch(`/contacts/${contactId}`);
    const c = (json.contact || json) as Record<string, unknown>;
    if (!c || typeof c !== "object") return null;
    const firstName = (c.firstName as string) || undefined;
    const lastName = (c.lastName as string) || undefined;
    const name =
      (c.name as string) || [firstName, lastName].filter(Boolean).join(" ") || undefined;
    return {
      firstName,
      lastName,
      name,
      email: (c.email as string) || undefined,
      phone: (c.phone as string) || undefined,
    };
  } catch {
    return null;
  }
}

// Actualiza un contacto EXISTENTE por su id (no hace match por correo/teléfono,
// así que nunca crea un duplicado). Solo manda los campos definidos.
export async function updateContact(
  contactId: string,
  fields: { firstName?: string; lastName?: string; email?: string; phone?: string }
) {
  const body: Record<string, unknown> = {};
  if (fields.firstName !== undefined) body.firstName = fields.firstName;
  if (fields.lastName !== undefined) body.lastName = fields.lastName;
  if (fields.email !== undefined) body.email = fields.email;
  if (fields.phone !== undefined) body.phone = fields.phone;
  return ghlFetch(`/contacts/${contactId}`, { method: "PUT", body });
}

export async function updateContactCustomFields(
  contactId: string,
  customFields: { id: string; value: string }[]
) {
  return ghlFetch(`/contacts/${contactId}`, {
    method: "PUT",
    body: { customFields },
  });
}

export async function addTags(contactId: string, tags: string[]) {
  return ghlFetch(`/contacts/${contactId}/tags`, { method: "POST", body: { tags } });
}

// Agrega una nota al contacto (queda visible en su timeline de GHL).
export async function addNote(contactId: string, body: string) {
  return ghlFetch(`/contacts/${contactId}/notes`, { method: "POST", body: { body } });
}

// Disponibilidad real del calendario para un rango (epoch ms).
// Devuelve un objeto { "YYYY-MM-DD": { slots: ["2026-06-10T08:00:00-06:00", ...] } }
export async function getFreeSlots(opts: {
  startMs: number;
  endMs: number;
  timezone?: string;
}): Promise<Record<string, { slots: string[] }>> {
  const json = await ghlFetch(`/calendars/${calendarId()}/free-slots`, {
    version: "2021-04-15",
    query: {
      startDate: String(opts.startMs),
      endDate: String(opts.endMs),
      timezone: opts.timezone || process.env.ECO_TIMEZONE || "America/Costa_Rica",
    },
  });
  // GHL devuelve las fechas como llaves de primer nivel (+ a veces "traceId")
  const out: Record<string, { slots: string[] }> = {};
  for (const [k, v] of Object.entries(json)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === "object") {
      out[k] = { slots: ((v as Record<string, unknown>).slots as string[]) || [] };
    }
  }
  return out;
}

// Agenda una cita. startTime en ISO con offset (-06:00).
export async function bookAppointment(opts: {
  contactId: string;
  startTime: string;
  title?: string;
}) {
  return ghlFetch("/calendars/events/appointments", {
    version: "2021-04-15",
    method: "POST",
    body: {
      calendarId: calendarId(),
      locationId: locationId(),
      contactId: opts.contactId,
      startTime: opts.startTime,
      title: opts.title,
    },
  });
}

// Último mensaje ENTRANTE de texto del contacto. Respaldo para cuando el webhook
// de GHL se dispara "vacío" (sin body): replica el nodo "get last message" que se
// usaba en n8n. Buscamos la conversación más reciente del contacto y revisamos su
// último mensaje.
//
// Anti-loop: solo devolvemos algo si el mensaje MÁS RECIENTE de la conversación es
// entrante. Si el más reciente es saliente, significa que ya respondimos y no hay
// nada pendiente → devolvemos null (no re-respondemos).
export async function getLastInboundMessage(
  contactId: string
): Promise<{ message: string; conversationId: string } | null> {
  const search = await ghlFetch("/conversations/search", {
    version: "2021-04-15",
    query: {
      locationId: locationId(),
      contactId,
      sortBy: "last_message_date",
      sort: "desc",
      limit: "1",
    },
  });
  const convos = ((search.conversations as unknown[]) || []) as Record<string, unknown>[];
  const convo = convos[0];
  if (!convo?.id) return null;
  const conversationId = String(convo.id);

  const msgs = await ghlFetch(`/conversations/${conversationId}/messages`, {
    version: "2021-04-15",
    query: { limit: "20" },
  });
  // Forma de la respuesta: { messages: { messages: [...newest first...] } }
  const container = (msgs.messages as Record<string, unknown>) || {};
  const list = ((container.messages as unknown[]) || []) as Record<string, unknown>[];
  const newest = list[0];
  if (!newest) return null;

  // Si el último mensaje no es entrante, ya fue respondido → nada pendiente.
  if (String(newest.direction || "").toLowerCase() !== "inbound") return null;

  const body = typeof newest.body === "string" ? newest.body.trim() : "";
  if (!body) return null; // último entrante sin texto (ej. imagen/audio): no lo manejamos acá

  return { message: body, conversationId };
}

// Envía un mensaje por el canal indicado (respuesta del agente en WhatsApp/SMS).
// `attachments` es un arreglo de URLs públicas (PDF, imágenes…) que GHL entrega
// como adjuntos en WhatsApp.
export async function sendMessage(opts: {
  contactId: string;
  message: string;
  type?: string; // "WhatsApp" | "SMS" | "Live_Chat" ...
  conversationId?: string;
  attachments?: string[];
}) {
  const body: Record<string, unknown> = {
    type: opts.type || "WhatsApp",
    contactId: opts.contactId,
    message: opts.message,
    conversationId: opts.conversationId,
  };
  if (opts.attachments?.length) body.attachments = opts.attachments;
  return ghlFetch("/conversations/messages", {
    version: "2021-04-15",
    method: "POST",
    body,
  });
}
