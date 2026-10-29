// Corre la cola de redes desde esta máquina (lo mismo que hace /api/cron/redes).
//
//   npx tsx scripts/redes-correr.mts            → publica lo que ya tocaba (una fila)
//   npx tsx scripts/redes-correr.mts --ensayo   → arma los contenedores del próximo
//                                                 post SIN publicar ni tocar la base
//
// Útil cuando el deploy no está disponible o para probar. Lee .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { correrCola } = await import("../api/_lib/redes/cola.js");
const ig = await import("../api/_lib/redes/instagram.js");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

if (process.argv.includes("--ensayo")) {
  const { data } = await db
    .from("redes_posts")
    .select("slug, caption, imagenes, programado_para")
    .eq("estado", "programado")
    .order("programado_para", { ascending: true })
    .limit(1);
  const p = data?.[0];
  if (!p) throw new Error("No hay posts programados");
  console.log(`Ensayo con ${p.slug} (${p.imagenes.length} láminas, programado ${p.programado_para})`);
  const id = await ig.crearCarrusel({ imagenes: p.imagenes, caption: p.caption });
  console.log("Contenedor:", id, "→", await ig.esperarContenedor(id, 60_000));
  console.log("No se publicó nada (el contenedor vence solo en 24 h).");
} else {
  console.log(JSON.stringify(await correrCola(db, new Date()), null, 2));
}
