// Capa de tracking: empuja eventos al dataLayer de GTM.
// GTM enruta cada evento a GA4 (todos) y a Meta vía Adsmurai OneTag (solo los de conversión).
//
// Los datos de cliente (email, phone, nombre) se envían en claro al dataLayer;
// Adsmurai/Meta los hashea (SHA-256) del lado del tag/servidor para advanced matching.
// El `event_id` viaja con cada conversión para deduplicar navegador + servidor en Meta.

type DataLayerPayload = Record<string, unknown> & { event: string };

function getDataLayer(): Record<string, unknown>[] | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  return w.dataLayer;
}

/** Empuja un evento al dataLayer. No-op en SSR. */
export function pushToDataLayer(payload: DataLayerPayload): void {
  getDataLayer()?.push(payload);
}

/** ID único por evento para deduplicar navegador + servidor (CAPI) en Meta. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/** email normalizado para matching (minúsculas + trim). */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** nombre normalizado para matching (minúsculas + trim, sin espacios extremos). */
export const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * Teléfono normalizado a solo dígitos con código de país.
 * Si viene un número local de 8 dígitos (Costa Rica), antepone el código país.
 */
export function normalizePhone(raw: string, defaultCountry = "506"): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 8 ? defaultCountry + digits : digits;
}

// ─── Eventos de conversión (helpers semánticos) ──────────────────────────────

export interface LeadUserData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

/** Reserva de visita confirmada → Meta `Schedule` + GA4 `appointment_booked`. */
export function trackAppointmentBooked(
  user: LeadUserData,
  extra: { proyecto: string; presupuesto?: string },
): void {
  pushToDataLayer({
    event: "appointment_booked",
    event_id: newEventId(),
    email: normalizeEmail(user.email),
    phone: normalizePhone(user.phone),
    first_name: normalizeName(user.firstName),
    last_name: normalizeName(user.lastName),
    proyecto: extra.proyecto,
    ...(extra.presupuesto ? { presupuesto: extra.presupuesto } : {}),
  });
}

/** Solicitud de financiamiento enviada → Meta `Lead` + GA4 `generate_lead`. */
export function trackLead(user: LeadUserData, extra?: { formType?: string }): void {
  pushToDataLayer({
    event: "generate_lead",
    event_id: newEventId(),
    email: normalizeEmail(user.email),
    phone: normalizePhone(user.phone),
    first_name: normalizeName(user.firstName),
    last_name: normalizeName(user.lastName),
    form_type: extra?.formType ?? "financiamiento",
  });
}

/** Vista de proyecto → Meta `ViewContent` + GA4 `view_content` (audiencias de retargeting). */
export function trackViewContent(proyecto: string): void {
  pushToDataLayer({
    event: "view_content",
    event_id: newEventId(),
    content_name: proyecto,
    content_type: "proyecto",
  });
}
