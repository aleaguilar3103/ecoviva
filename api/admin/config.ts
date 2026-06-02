import { supabaseAdmin, requireAdmin } from "../_lib/supabase.js";
import { getBotConfig, invalidateBotConfigCache } from "../_lib/eco/config.js";

// /api/admin/config — configuración del bot (panel admin). Requiere admin.
//   GET    → { bot_enabled, system_prompt, prompt_is_custom }
//   PATCH  body: { bot_enabled?, system_prompt? } → guarda y devuelve la config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const admin = await requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      const cfg = await getBotConfig(db);
      return res.status(200).json({
        bot_enabled: cfg.botEnabled,
        system_prompt: cfg.systemPrompt,
        prompt_is_custom: cfg.promptIsCustom,
      });
    }

    if (req.method === "PATCH") {
      const body = (req.body ?? {}) as { bot_enabled?: boolean; system_prompt?: string };
      const updates: Record<string, unknown> = { id: 1, updated_by: admin };
      if (typeof body.bot_enabled === "boolean") updates.bot_enabled = body.bot_enabled;
      if (typeof body.system_prompt === "string") {
        updates.system_prompt = body.system_prompt.trim() || null;
      }

      const { error } = await db.from("bot_config").upsert(updates, { onConflict: "id" });
      if (error) return res.status(500).json({ error: error.message });

      invalidateBotConfigCache();
      const cfg = await getBotConfig(db);
      return res.status(200).json({
        bot_enabled: cfg.botEnabled,
        system_prompt: cfg.systemPrompt,
        prompt_is_custom: cfg.promptIsCustom,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("admin/config error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
