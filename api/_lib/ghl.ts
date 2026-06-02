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

// Envía un mensaje por el canal indicado (respuesta del agente en WhatsApp/SMS).
export async function sendMessage(opts: {
  contactId: string;
  message: string;
  type?: string; // "WhatsApp" | "SMS" | "Live_Chat" ...
  conversationId?: string;
}) {
  return ghlFetch("/conversations/messages", {
    version: "2021-04-15",
    method: "POST",
    body: {
      type: opts.type || "WhatsApp",
      contactId: opts.contactId,
      message: opts.message,
      conversationId: opts.conversationId,
    },
  });
}
