import { supabaseAdmin, isAuthorizedAdmin } from "./_lib/supabase";

// /api/lots
//   GET  ?project=&section=&status=&onlyAvailable=true&minSize=&maxSize=  → lista de lotes
//   PATCH (admin)  body: { id, ...campos }  → actualiza un lote (estado, precio, etc.)
//   POST  (admin)  body: { ...lote }        → crea un lote
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { project, section, status, onlyAvailable, minSize, maxSize } = req.query as Record<
      string,
      string | undefined
    >;
    let q = db.from("lots").select("*").order("lot_number", { ascending: true });
    if (project) q = q.eq("project", project);
    if (section) q = q.eq("section", section);
    if (status) q = q.eq("status", status);
    if (onlyAvailable === "true") q = q.eq("status", "available");
    if (minSize) q = q.gte("size_m2", Number(minSize));
    if (maxSize) q = q.lte("size_m2", Number(maxSize));

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ lots: data });
  }

  // ── A partir de aquí, solo administración ──
  if (req.method === "PATCH" || req.method === "POST" || req.method === "DELETE") {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  if (req.method === "PATCH") {
    const { id, ...updates } = body as { id?: string; [k: string]: unknown };
    if (!id) return res.status(400).json({ error: "Falta id" });
    // No permitir tocar columnas generadas/derivadas
    delete (updates as Record<string, unknown>).price_total;
    delete (updates as Record<string, unknown>).created_at;
    const { data, error } = await db.from("lots").update(updates).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ lot: data });
  }

  if (req.method === "POST") {
    const { data, error } = await db.from("lots").insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ lot: data });
  }

  if (req.method === "DELETE") {
    const { id } = body as { id?: string };
    if (!id) return res.status(400).json({ error: "Falta id" });
    const { error } = await db.from("lots").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
