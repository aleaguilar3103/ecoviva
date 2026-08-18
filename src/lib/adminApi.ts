import { supabase } from "./supabaseClient";

// Helper para llamar a los endpoints de /api con el token de admin (JWT de Supabase).
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no-JSON */
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

// ── Lotes ──
export interface Lot {
  id: string;
  project: "rio_celeste" | "llanada";
  section: "general" | "bloque_1" | "frente_a_calle";
  lot_number: number;
  lot_suffix: string | null;   // 'A'/'B' si el lote está subdividido — la etiqueta es número+sufijo
  size_m2: number;
  price_per_m2: number;
  currency: "USD" | "CRC";
  price_total: number;
  status: "available" | "reserved" | "sold" | "not_available";
  has_view: boolean | null;
  requires_prima: boolean;
  prima_pct: number;
  plano_visado_url: string | null;
  notes: string | null;
  updated_at: string;
}

export function getLots(project?: string): Promise<{ lots: Lot[] }> {
  const q = project ? `?project=${project}` : "";
  return request<{ lots: Lot[] }>(`/api/lots${q}`);
}

export function updateLot(id: string, updates: Partial<Lot>): Promise<{ lot: Lot }> {
  return request<{ lot: Lot }>(`/api/lots`, {
    method: "PATCH",
    body: JSON.stringify({ id, ...updates }),
  });
}

export function createLot(lot: Partial<Lot>): Promise<{ lot: Lot }> {
  return request<{ lot: Lot }>(`/api/lots`, { method: "POST", body: JSON.stringify(lot) });
}

export function deleteLot(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/lots`, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

// ── Config del bot ──
export interface BotConfig {
  bot_enabled: boolean;
  system_prompt: string;
  prompt_is_custom: boolean;
}

export function getConfig(): Promise<BotConfig> {
  return request<BotConfig>(`/api/admin/config`);
}

export function patchConfig(updates: Partial<Pick<BotConfig, "bot_enabled" | "system_prompt">>): Promise<BotConfig> {
  return request<BotConfig>(`/api/admin/config`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ── Asistente de prompt (Claude) ──
export function generateBlock(instruction: string, currentPrompt: string): Promise<{ block: string }> {
  return request<{ block: string }>(`/api/admin/prompt-assistant`, {
    method: "POST",
    body: JSON.stringify({ mode: "generate", instruction, currentPrompt }),
  });
}

export function injectBlock(block: string, currentPrompt: string): Promise<{ prompt: string }> {
  return request<{ prompt: string }>(`/api/admin/prompt-assistant`, {
    method: "POST",
    body: JSON.stringify({ mode: "inject", block, currentPrompt }),
  });
}

// ── Banco de pruebas del bot ──
// Conversa con ECO exactamente por donde entra un cliente real (/api/chat),
// pero con `mode: "admin-test"`: ignora el interruptor de apagado y devuelve
// qué herramientas usó el agente. Con `simulate` en true (por defecto en el
// panel) las tools que escriben en el CRM no tocan GoHighLevel.
export interface TestToolCall {
  name: string;
  input: unknown;
  result: string;
}

export interface TestReply {
  reply: string;
  conversationId: string;
  attachments: string[];
  tools: TestToolCall[];
}

export function sendTestMessage(input: {
  message: string;
  sessionId: string;
  simulate: boolean;
}): Promise<TestReply> {
  return request<TestReply>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ ...input, mode: "admin-test" }),
  });
}

export function resetTestConversation(sessionId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/chat", {
    method: "DELETE",
    body: JSON.stringify({ sessionId, mode: "admin-test" }),
  });
}

// ── Identidad ──
export type AppRole = "admin" | "vendedor";

export function getMe(): Promise<{ email: string; role: AppRole }> {
  return request<{ email: string; role: AppRole }>("/api/me");
}

// ── Usuarios ──
export interface AppUserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  status: "active" | "disabled";
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

// Solo el listado cruza la fila contra auth.users para saber si la persona entró
// alguna vez. POST y PATCH devuelven la fila cruda.
export type AppUser = AppUserRow & { last_sign_in_at: string | null };

export function getUsers(): Promise<{ users: AppUser[] }> {
  return request<{ users: AppUser[] }>("/api/admin/users");
}

// Sirve para invitar y para reenviar el acceso: el backend detecta cuál es.
export function inviteUser(input: {
  email: string;
  full_name?: string;
  role: AppRole;
}): Promise<{ user: AppUserRow; resent: boolean }> {
  return request<{ user: AppUserRow; resent: boolean }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  user_id: string,
  updates: { role?: AppRole; status?: "active" | "disabled" },
): Promise<{ user: AppUserRow }> {
  return request<{ user: AppUserRow }>("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ user_id, ...updates }),
  });
}

export function deleteUser(user_id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/admin/users", {
    method: "DELETE",
    body: JSON.stringify({ user_id }),
  });
}

// ── Guía de vendedores ──
// No usa request(): el endpoint devuelve HTML, no JSON.
// Error con acceso denegado: distinto de un fallo de red o un 500 pasajero
// porque no es transitorio — reintentar nunca va a servir. El componente lo
// usa para no ofrecer un botón "Reintentar" que no puede funcionar nunca.
export class GuiaAccesoDenegadoError extends Error {}

export async function getGuiaHtml(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/guia-vendedores", { headers: await authHeaders() });
  } catch {
    // fetch() rechaza (no responde con un status) cuando no hay conexión o
    // falla el DNS, y el mensaje nativo del navegador queda en inglés crudo
    // ("Failed to fetch", "NetworkError..."). Lo traducimos acá porque el
    // llamador solo espera Error.message en español.
    throw new Error("No pudimos conectarnos. Revisá tu conexión.");
  }
  if (!res.ok) {
    if (res.status === 401) throw new GuiaAccesoDenegadoError("Tu cuenta no tiene acceso a la guía.");
    throw new Error(`No se pudo cargar la guía (${res.status}).`);
  }
  return res.text();
}
