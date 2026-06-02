import type { SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "./prompt.js";

// Configuración viva del bot (interruptor on/off + system prompt editable).
// Vive en la tabla bot_config (fila id=1). Si la tabla/fila no existe o el
// system_prompt está vacío, se usa el SYSTEM_PROMPT del código como respaldo.

export interface BotConfig {
  botEnabled: boolean;
  systemPrompt: string;
  promptIsCustom: boolean; // true si el prompt viene de la BD (no del código)
}

// Cache muy corta en memoria para no pegarle a la BD en cada mensaje.
let _cache: { value: BotConfig; at: number } | null = null;
const TTL_MS = 5_000;

export async function getBotConfig(db: SupabaseClient): Promise<BotConfig> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.value;

  let botEnabled = true;
  let dbPrompt: string | null = null;
  try {
    const { data } = await db
      .from("bot_config")
      .select("bot_enabled, system_prompt")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      botEnabled = data.bot_enabled !== false;
      dbPrompt = (data.system_prompt as string | null) || null;
    }
  } catch {
    // Si la tabla aún no existe, respaldo: bot encendido + prompt de código.
  }

  const trimmed = dbPrompt?.trim();
  const value: BotConfig = {
    botEnabled,
    systemPrompt: trimmed && trimmed.length > 0 ? trimmed : SYSTEM_PROMPT,
    promptIsCustom: Boolean(trimmed && trimmed.length > 0),
  };
  _cache = { value, at: Date.now() };
  return value;
}

export function invalidateBotConfigCache(): void {
  _cache = null;
}
