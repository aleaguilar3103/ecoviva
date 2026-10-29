/**
 * Descarga todos los archivos que viven en el almacenamiento de GoHighLevel antes de que la
 * cuenta se borre: imágenes y videos del sitio, la biblioteca de medios de la subcuenta y los
 * adjuntos que aparecen en el respaldo (conversaciones, formularios, campos personalizados).
 *
 *   node scripts/ghl-archivos.mjs backups/ghl/<fecha>
 *
 * Deja los archivos en <respaldo>/archivos/ y un mapa url → archivo en
 * <respaldo>/archivos/_mapa.json, para poder reemplazar las URLs por las nuevas.
 * Solo lee de GHL. La carpeta backups/ está en .gitignore: hay cédulas y firmas reales.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const respaldo = process.argv[2];
if (!respaldo || !existsSync(respaldo)) {
  console.error("Uso: node scripts/ghl-archivos.mjs backups/ghl/<fecha>");
  process.exit(1);
}

// .env.local manda sobre el shell (ver scripts/ghl-backup.mjs: el shell exporta un token viejo).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const DOMINIOS = /https?:\/\/(?:storage\.googleapis\.com\/msgsndr|assets\.cdn\.filesafe\.space|images\.leadconnectorhq\.com|msgsndr-private\.storage\.googleapis\.com|firebasestorage\.googleapis\.com\/v0\/b\/highlevel)[^\s"'<>)\]\\]*/g;

const destino = join(respaldo, "archivos");
mkdirSync(destino, { recursive: true });
const urls = new Map(); // url → origen

function recolectar(texto, origen) {
  for (const u of texto.match(DOMINIOS) ?? []) {
    const limpia = u.replace(/[.,;]+$/, "");
    if (!urls.has(limpia)) urls.set(limpia, origen);
  }
}

// 1) Código del sitio y del API.
function recorrer(dir) {
  for (const f of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "backups", "marketing", ".vercel"].includes(f)) continue;
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) recorrer(p);
    else if (/\.(tsx?|jsx?|mjs|cjs|html|css|json|md)$/.test(f) && s.size < 5_000_000) recolectar(readFileSync(p, "utf8"), `codigo:${p}`);
  }
}
for (const d of ["src", "api", "public", "content", "docs", "scripts"]) if (existsSync(d)) recorrer(d);
recolectar(readFileSync("index.html", "utf8"), "codigo:index.html");

// 2) Todo el respaldo JSON (adjuntos de mensajes, formularios, campos personalizados, etc.).
for (const f of readdirSync(respaldo)) {
  if (f.endsWith(".json")) recolectar(readFileSync(join(respaldo, f), "utf8"), `respaldo:${f}`);
}

// 3) La biblioteca de medios de la subcuenta.
async function api(ruta) {
  const r = await fetch(`https://services.leadconnectorhq.com${ruta}`, {
    headers: { Authorization: `Bearer ${env.GHL_PRIVATE_INTEGRATION_TOKEN}`, Version: "2021-07-28", Accept: "application/json", "User-Agent": UA },
  });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const medios = [];
try {
  for (let offset = 0; offset < 20000; offset += 100) {
    const r = await api(`/medias/files?altId=${env.GHL_LOCATION_ID}&altType=location&type=file&sortBy=createdAt&sortOrder=asc&limit=100&offset=${offset}`);
    const files = r.files ?? [];
    medios.push(...files);
    for (const m of files) if (m.url) urls.set(m.url, `medios:${m.name ?? m._id}`);
    if (files.length < 100) break;
  }
  writeFileSync(join(respaldo, "medias.json"), JSON.stringify(medios, null, 1));
  console.log(`Biblioteca de medios: ${medios.length} archivos`);
} catch (e) {
  console.log(`Biblioteca de medios: no se pudo listar (${e.message})`);
}

console.log(`URLs a descargar: ${urls.size}`);

// 4) Descarga (4 a la vez), con nombre estable por hash de la URL.
const mapa = existsSync(join(destino, "_mapa.json")) ? JSON.parse(readFileSync(join(destino, "_mapa.json"), "utf8")) : {};
const pendientes = [...urls.entries()].filter(([u]) => !mapa[u]?.archivo);
let ok = 0, fallas = 0;
async function bajar([url, origen]) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const tipo = r.headers.get("content-type") ?? "";
    let ext = extname(new URL(url).pathname).toLowerCase().slice(0, 6);
    if (!ext) ext = tipo.includes("png") ? ".png" : tipo.includes("jpeg") ? ".jpg" : tipo.includes("pdf") ? ".pdf" : tipo.includes("mp4") ? ".mp4" : ".bin";
    const nombre = createHash("sha1").update(url).digest("hex").slice(0, 16) + ext;
    writeFileSync(join(destino, nombre), buf);
    mapa[url] = { archivo: nombre, bytes: buf.length, tipo, origen };
    ok++;
  } catch (e) {
    mapa[url] = { error: String(e.message ?? e), origen };
    fallas++;
  }
}
for (let i = 0; i < pendientes.length; i += 4) {
  await Promise.all(pendientes.slice(i, i + 4).map(bajar));
  if ((i / 4) % 25 === 0) {
    writeFileSync(join(destino, "_mapa.json"), JSON.stringify(mapa, null, 1));
    console.log(`  ${Math.min(i + 4, pendientes.length)}/${pendientes.length}`);
  }
}
writeFileSync(join(destino, "_mapa.json"), JSON.stringify(mapa, null, 1));
const total = Object.values(mapa).filter((m) => m.archivo).reduce((s, m) => s + m.bytes, 0);
console.log(`Listo: ${ok} descargados, ${fallas} con error, ${(total / 1e6).toFixed(1)} MB en ${destino}`);
