// Script de prueba: genera los folletos PDF localmente para inspección visual.
// Uso: npx tsx --env-file=.env.local scripts/gen-brochure.ts
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { buildBrochure } from "../api/_lib/eco/brochure.js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const combos: Array<[string, "es" | "en"]> = [
  ["rio_celeste", "es"],
  ["rio_celeste", "en"],
  ["llanada", "es"],
  ["llanada", "en"],
];

for (const [proj, lang] of combos) {
  const { data, error } = await db.from("lots").select("*").eq("project", proj).order("lot_number");
  if (error) { console.error(proj, error.message); continue; }
  const t0 = Date.now();
  const bytes = await buildBrochure(proj, lang, data as any);
  const out = `/tmp/brochure-${proj}-${lang}.pdf`;
  writeFileSync(out, bytes);
  console.log(`✓ ${out}  (${(data as any).length} lotes, ${bytes.length} bytes, ${Date.now() - t0}ms)`);
}
process.exit(0);
