import { supabaseAdmin, requireAdmin } from "../_lib/supabase.js";
import { tomarYPublicar, type PostRedes } from "../_lib/redes/cola.js";
import { instagramConfigurado } from "../_lib/redes/instagram.js";
import * as instagram from "../_lib/redes/instagram.js";

// /api/admin/redes — calendario de contenido (panel → Redes). Requiere admin.
//   GET    ?desde=ISO&hasta=ISO → { posts, instagram: boolean }
//   PATCH  { id, caption?, titulo?, programado_para?, estado?: "programado"|"pausado" }
//          No se puede editar lo publicado ni lo que se está publicando.
//          Pasar a "programado" (reanudar o reintentar) limpia el contador de fallas.
//   POST   { id, accion: "publicar_ya" } → lo publica ahora mismo (hasta ~45 s).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const admin = await requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    if (req.method === "GET") {
      const { desde, hasta } = (req.query ?? {}) as { desde?: string; hasta?: string };
      let q = db.from("redes_posts").select("*").order("programado_para", { ascending: true });
      if (desde) q = q.gte("programado_para", desde);
      if (hasta) q = q.lt("programado_para", hasta);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ posts: data ?? [], instagram: instagramConfigurado() });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return res.status(400).json({ error: "Falta el id" });
    const { data: actual, error: errLeer } = await db.from("redes_posts").select("*").eq("id", id).maybeSingle();
    if (errLeer) return res.status(500).json({ error: errLeer.message });
    if (!actual) return res.status(404).json({ error: "No existe ese post" });
    const post = actual as PostRedes;

    if (post.estado === "publicado" || post.estado === "publicando") {
      return res.status(409).json({ error: "Ese post ya se publicó o se está publicando; no se puede cambiar." });
    }

    if (req.method === "PATCH") {
      const cambios: Record<string, unknown> = { updated_by: admin };
      if (typeof body.caption === "string") {
        if (body.caption.length > 2200) return res.status(400).json({ error: "Instagram acepta hasta 2.200 caracteres." });
        cambios.caption = body.caption;
        cambios.ig_creation_id = null; // el contenedor viejo lleva el texto anterior
      }
      if (typeof body.titulo === "string" && body.titulo.trim()) cambios.titulo = body.titulo.trim();
      if (typeof body.programado_para === "string") {
        const f = new Date(body.programado_para);
        if (Number.isNaN(f.getTime())) return res.status(400).json({ error: "Fecha inválida" });
        cambios.programado_para = f.toISOString();
      }
      if (body.estado === "pausado" || body.estado === "programado") {
        cambios.estado = body.estado;
        if (body.estado === "programado") {
          cambios.intentos = 0;
          cambios.error = null;
        }
      }
      const { data, error } = await db
        .from("redes_posts")
        .update(cambios)
        .eq("id", id)
        .in("estado", ["programado", "pausado", "error"])
        .select("*")
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(409).json({ error: "El post cambió mientras lo editabas; recargá." });
      return res.status(200).json({ post: data });
    }

    if (req.method === "POST" && body.accion === "publicar_ya") {
      if (!instagramConfigurado()) return res.status(503).json({ error: "Instagram no está configurado en el servidor." });
      const { data: lista, error } = await db
        .from("redes_posts")
        .update({ estado: "programado", programado_para: new Date().toISOString(), intentos: 0, error: null, updated_by: admin })
        .eq("id", id)
        .in("estado", ["programado", "pausado", "error"])
        .select("*")
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!lista) return res.status(409).json({ error: "El post cambió mientras tanto; recargá." });
      const r = await tomarYPublicar(db, lista as PostRedes, instagram);
      if (!r) return res.status(409).json({ error: "Otra corrida lo está publicando en este momento." });
      const { data: final } = await db.from("redes_posts").select("*").eq("id", id).maybeSingle();
      return res.status(200).json({ resultado: r, post: final });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("admin/redes error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
