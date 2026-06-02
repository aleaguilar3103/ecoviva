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
