// Publicación de carruseles en Instagram (API de Instagram con Facebook Login).
//
// Mismo mecanismo que Sunday Racer (proyecto Motos, lib/instagram/publicar.ts):
// un contenedor por imagen, el contenedor del carrusel con el texto y media_publish.
// El token es el del usuario del sistema del Business Manager, que ya tiene asignado
// el Instagram @ecovivacr. Con la app en modo Desarrollo, lo que se publica en
// Instagram SÍ lo ve el público (en Facebook no: por eso Facebook queda afuera).
//
// Las imágenes tienen que ser JPEG en una URL pública (bucket "redes" de Supabase).
// Probado el 29-oct-2026: 1440 × 1920 (3:4) queda FINISHED sin problemas.

export const GRAPH = "https://graph.facebook.com/v26.0";

export function instagramConfigurado(): boolean {
  return Boolean(process.env.META_IG_USER_ID && process.env.META_ACCESS_TOKEN);
}

async function graph<T>(ruta: string, params: Record<string, string>, metodo: "GET" | "POST" = "POST"): Promise<T> {
  const p = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN ?? "" });
  const res =
    metodo === "POST"
      ? await fetch(`${GRAPH}/${ruta}`, { method: "POST", body: p })
      : await fetch(`${GRAPH}/${ruta}?${p}`);
  const r = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || r.error) throw new Error(`Meta ${ruta.split("?")[0]}: ${r.error?.message ?? `HTTP ${res.status}`}`);
  return r;
}

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** IN_PROGRESS, FINISHED, PUBLISHED, ERROR o EXPIRED. */
export async function estadoContenedor(creationId: string): Promise<string> {
  const { status_code } = await graph<{ status_code: string }>(creationId, { fields: "status_code" }, "GET");
  return status_code;
}

/**
 * Crea los contenedores (uno por imagen + el del carrusel con el texto). No publica.
 * Devuelve el id del contenedor del carrusel para guardarlo ANTES de publicar.
 */
export async function crearCarrusel(o: { imagenes: string[]; caption: string }): Promise<string> {
  const ig = process.env.META_IG_USER_ID ?? "";
  if (o.imagenes.length < 2 || o.imagenes.length > 10) {
    throw new Error(`Un carrusel lleva de 2 a 10 imágenes (este tiene ${o.imagenes.length}).`);
  }
  const hijos: string[] = [];
  for (const url of o.imagenes) {
    const h = await graph<{ id: string }>(`${ig}/media`, { image_url: url, is_carousel_item: "true" });
    hijos.push(h.id);
  }
  const carrusel = await graph<{ id: string }>(`${ig}/media`, {
    media_type: "CAROUSEL",
    children: hijos.join(","),
    caption: o.caption,
    // Etiqueta "Hecho con IA" de Instagram: apagada por defecto porque las láminas
    // ya dicen "Imagen ilustrativa" donde corresponde. Se prende con IG_ETIQUETA_IA=1.
    ...(process.env.IG_ETIQUETA_IA === "1" ? { is_ai_generated: "true" } : {}),
  });
  return carrusel.id;
}

/**
 * Espera a que el contenedor quede FINISHED, como mucho `maxMs`. Devuelve el último
 * estado visto: el que llama decide si publica o deja la fila para la próxima corrida.
 */
export async function esperarContenedor(creationId: string, maxMs = 30_000, pasoMs = 5_000): Promise<string> {
  const limite = Date.now() + maxMs;
  let estado = await estadoContenedor(creationId);
  while (estado === "IN_PROGRESS" && Date.now() + pasoMs <= limite) {
    await dormir(pasoMs);
    estado = await estadoContenedor(creationId);
  }
  return estado;
}

/** Publica un contenedor ya procesado y busca el enlace público. */
export async function publicarContenedor(creationId: string): Promise<{ id: string; permalink: string | null }> {
  const ig = process.env.META_IG_USER_ID ?? "";
  const publicado = await graph<{ id: string }>(`${ig}/media_publish`, { creation_id: creationId });
  const { permalink } = await graph<{ permalink?: string }>(publicado.id, { fields: "permalink" }, "GET").catch(
    () => ({ permalink: undefined }),
  );
  return { id: publicado.id, permalink: permalink ?? null };
}
