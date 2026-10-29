// Sube carruseles al calendario de redes (panel → Redes).
//
//   node scripts/redes-subir.mjs <calendario.json>
//
// calendario.json es una lista de posts:
//   [{ "slug": "01-el-rio-transparente", "titulo": "…", "caption": "…",
//      "programado_para": "2026-10-29T18:00:00.000Z", "carpeta": "/ruta/a/las/laminas" }]
//
// Las láminas de cada carpeta (JPEG, en orden alfabético) se suben al bucket público
// "redes" en <slug>/<nombre>.jpg y la fila se crea o se actualiza por slug. Lo que ya
// se publicó o se está publicando NO se toca. Instagram pide JPEG de hasta 1440 px de
// ancho: las láminas deben venir ya en 1440 × 1920.
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function env(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const linea = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(`${nombre}=`));
  return linea?.slice(nombre.length + 1).trim().replace(/^["']|["']$/g, "");
}

const archivo = process.argv[2];
if (!archivo) {
  console.error("Uso: node scripts/redes-subir.mjs <calendario.json>");
  process.exit(1);
}

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const posts = JSON.parse(readFileSync(archivo, "utf8"));

for (const p of posts) {
  const { data: actual } = await db.from("redes_posts").select("estado").eq("slug", p.slug).maybeSingle();
  if (actual && (actual.estado === "publicado" || actual.estado === "publicando")) {
    console.log(`= ${p.slug}: ya ${actual.estado}, no se toca`);
    continue;
  }

  const laminas = readdirSync(p.carpeta).filter((f) => f.toLowerCase().endsWith(".jpg")).sort();
  if (laminas.length < 2 || laminas.length > 10) throw new Error(`${p.slug}: un carrusel lleva de 2 a 10 láminas (hay ${laminas.length})`);

  const imagenes = [];
  for (const f of laminas) {
    const ruta = `${p.slug}/${f}`;
    const { error } = await db.storage
      .from("redes")
      .upload(ruta, readFileSync(join(p.carpeta, f)), { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
    if (error) throw new Error(`${ruta}: ${error.message}`);
    imagenes.push(db.storage.from("redes").getPublicUrl(ruta).data.publicUrl);
  }

  const fila = {
    slug: p.slug,
    titulo: p.titulo,
    caption: p.caption,
    imagenes,
    programado_para: p.programado_para,
    proyecto: p.proyecto ?? "rio_celeste",
    plataformas: p.plataformas ?? ["instagram"],
    ig_creation_id: null,
    updated_by: "scripts/redes-subir",
  };
  const { error } = await db.from("redes_posts").upsert(fila, { onConflict: "slug" });
  if (error) throw new Error(`${p.slug}: ${error.message}`);
  console.log(`✓ ${p.slug}: ${imagenes.length} láminas · ${p.programado_para}`);
}
