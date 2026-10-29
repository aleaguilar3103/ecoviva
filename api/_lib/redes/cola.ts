import type { SupabaseClient } from "@supabase/supabase-js";
import * as instagram from "./instagram.js";

// Cola de publicación de redes (tabla redes_posts). La corre /api/cron/redes cada
// 15 minutos y el botón "Publicar ya" del panel.
//
// Reglas:
//  - Una corrida publica como mucho UNA fila (la más vieja que ya tocaba): un
//    carrusel tarda entre 20 y 45 s y la función tiene 60 s.
//  - Lo atrasado más de 36 h no sale solo: si el sistema estuvo caído no queremos
//    que publique cinco carruseles seguidos. Queda "programado" y el panel lo
//    marca como vencido para que alguien le ponga fecha nueva o lo publique ya.
//  - Bloqueo: la fila pasa de "programado" a "publicando" con un UPDATE
//    condicional. Si otra corrida ya la tomó, esta no la toca.
//  - Sin duplicados: ig_creation_id se guarda antes de media_publish; un
//    reintento revisa ese contenedor antes de crear otro.
//  - 3 fallas → "error" con el mensaje a la vista en el panel.

export const MAX_INTENTOS = 3;
export const VENTANA_ATRASO_MS = 36 * 3600_000;
const TRABADO_MS = 10 * 60_000;

export type EstadoPost = "programado" | "pausado" | "publicando" | "publicado" | "error";

export interface PostRedes {
  id: string;
  slug: string;
  titulo: string;
  proyecto: string;
  plataformas: string[];
  caption: string;
  imagenes: string[];
  programado_para: string;
  estado: EstadoPost;
  intentos: number;
  error: string | null;
  ig_creation_id: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  publicado_en: string | null;
  updated_at: string;
}

export type ApiInstagram = Pick<
  typeof instagram,
  "crearCarrusel" | "esperarContenedor" | "estadoContenedor" | "publicarContenedor"
>;

export type Resultado =
  | { slug: string; resultado: "publicado"; permalink: string | null }
  | { slug: string; resultado: "procesando" }
  | { slug: string; resultado: "fallo"; error: string; intentos: number; agotado: boolean };

/** UPDATE condicional: solo si la fila sigue en alguno de `desde`. Devuelve si cambió. */
async function mover(
  db: SupabaseClient,
  id: string,
  cambios: Partial<PostRedes>,
  desde: EstadoPost[],
): Promise<boolean> {
  const { data, error } = await db.from("redes_posts").update(cambios).eq("id", id).in("estado", desde).select("id");
  if (error) throw new Error(`redes_posts: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Publica una fila que YA está en "publicando" (bloqueada por quien llama).
 * Nunca tira: los errores quedan en la fila.
 */
export async function publicarPost(db: SupabaseClient, post: PostRedes, ig: ApiInstagram): Promise<Resultado> {
  try {
    let creationId = post.ig_creation_id;

    if (creationId) {
      const estado = await ig.estadoContenedor(creationId).catch(() => "ERROR");
      if (estado === "PUBLISHED") {
        await mover(db, post.id, { estado: "publicado", publicado_en: new Date().toISOString(), error: null }, ["publicando"]);
        return { slug: post.slug, resultado: "publicado", permalink: post.ig_permalink };
      }
      if (estado !== "FINISHED" && estado !== "IN_PROGRESS") creationId = null;
    }

    if (!creationId) {
      creationId = await ig.crearCarrusel({ imagenes: post.imagenes, caption: post.caption });
      await mover(db, post.id, { ig_creation_id: creationId }, ["publicando"]);
    }

    const estado = await ig.esperarContenedor(creationId);
    if (estado === "IN_PROGRESS") {
      // Instagram sigue procesando: se suelta la fila con el contenedor guardado y la
      // próxima corrida lo publica sin crear otro.
      await mover(db, post.id, { estado: "programado" }, ["publicando"]);
      return { slug: post.slug, resultado: "procesando" };
    }
    if (estado !== "FINISHED") throw new Error(`Instagram dejó el carrusel en ${estado}`);

    const r = await ig.publicarContenedor(creationId);
    await mover(
      db,
      post.id,
      {
        estado: "publicado",
        publicado_en: new Date().toISOString(),
        ig_media_id: r.id,
        ig_permalink: r.permalink,
        error: null,
      },
      ["publicando"],
    );
    return { slug: post.slug, resultado: "publicado", permalink: r.permalink };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    const intentos = post.intentos + 1;
    const agotado = intentos >= MAX_INTENTOS;
    await mover(db, post.id, { estado: agotado ? "error" : "programado", intentos, error: msg }, ["publicando"]).catch(
      (err) => console.error("[redes] no se pudo registrar la falla", err),
    );
    return { slug: post.slug, resultado: "fallo", error: msg, intentos, agotado };
  }
}

/** Toma la fila (programado → publicando) y la publica. null si otra corrida la tenía. */
export async function tomarYPublicar(db: SupabaseClient, post: PostRedes, ig: ApiInstagram): Promise<Resultado | null> {
  if (!(await mover(db, post.id, { estado: "publicando" }, ["programado"]))) return null;
  return publicarPost(db, post, ig);
}

/** Lo que quedó en "publicando" porque una función se cortó vuelve a "programado". */
export async function rescatarTrabados(db: SupabaseClient, ahora: Date): Promise<number> {
  const limite = new Date(ahora.getTime() - TRABADO_MS).toISOString();
  const { data, error } = await db
    .from("redes_posts")
    .update({ estado: "programado" })
    .eq("estado", "publicando")
    .lt("updated_at", limite)
    .select("id");
  if (error) throw new Error(`redes_posts: ${error.message}`);
  return data?.length ?? 0;
}

/** Una corrida del cron: rescata trabados y publica la fila más vieja que ya tocaba. */
export async function correrCola(
  db: SupabaseClient,
  ahora: Date,
  ig: ApiInstagram = instagram,
): Promise<{ rescatados: number; publicacion: Resultado | null }> {
  const rescatados = await rescatarTrabados(db, ahora);
  const desde = new Date(ahora.getTime() - VENTANA_ATRASO_MS).toISOString();
  const { data, error } = await db
    .from("redes_posts")
    .select("*")
    .eq("estado", "programado")
    .contains("plataformas", ["instagram"])
    .lte("programado_para", ahora.toISOString())
    .gte("programado_para", desde)
    .order("programado_para", { ascending: true })
    .limit(1);
  if (error) throw new Error(`redes_posts: ${error.message}`);
  const post = (data?.[0] as PostRedes | undefined) ?? null;
  if (!post) return { rescatados, publicacion: null };
  return { rescatados, publicacion: await tomarYPublicar(db, post, ig) };
}
