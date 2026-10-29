import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, Pause, Play, Send, Pencil, X, Images, Instagram } from "lucide-react";
import {
  getPostsRedes,
  actualizarPostRedes,
  publicarPostRedesYa,
  type PostRedes,
  type EstadoPostRedes,
} from "../../../lib/adminApi";
import CalendarioMes from "../agenda/CalendarioMes";
import { claveDiaCR, hoyCR, fechaDesdeClave, isoDesdeLocalCR, localCRDesdeIso, fechaLarga, diaLargo } from "../agenda/fechas";

// Calendario de contenido de Instagram. Cada carrusel programado sale solo a su
// hora (pg_cron llama a /api/cron/redes cada 15 minutos). Desde acá se pausa,
// se mueve de fecha, se edita el texto o se publica en el momento.

const ESTADOS: Record<EstadoPostRedes, { label: string; clase: string }> = {
  programado: { label: "Programado", clase: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pausado: { label: "Pausado", clase: "bg-slate-100 text-slate-600 ring-slate-200" },
  publicando: { label: "Publicando…", clase: "bg-amber-50 text-amber-700 ring-amber-200" },
  publicado: { label: "Publicado", clase: "bg-sky-50 text-sky-700 ring-sky-200" },
  error: { label: "Error", clase: "bg-red-50 text-red-700 ring-red-200" },
};

const editable = (p: PostRedes) => p.estado === "programado" || p.estado === "pausado" || p.estado === "error";

export default function RedesManager() {
  const [posts, setPosts] = useState<PostRedes[]>([]);
  const [igListo, setIgListo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [ancla, setAncla] = useState<Date>(() => fechaDesdeClave(hoyCR()));
  const [dia, setDia] = useState<string | null>(null);

  const [editando, setEditando] = useState<PostRedes | null>(null);
  const [caption, setCaption] = useState("");
  const [cuando, setCuando] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await getPostsRedes();
      setPosts(r.posts);
      setIgListo(r.instagram);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const conteo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      const k = claveDiaCR(p.programado_para);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [posts]);

  const mesClave = ancla.toISOString().slice(0, 7);
  const visibles = useMemo(
    () =>
      posts.filter((p) => {
        const k = claveDiaCR(p.programado_para);
        return dia ? k === dia : k.startsWith(mesClave);
      }),
    [posts, dia, mesClave],
  );

  const ahora = Date.now();
  const proximo = posts.find((p) => p.estado === "programado" && new Date(p.programado_para).getTime() >= ahora - 15 * 60_000);
  const publicados = posts.filter((p) => p.estado === "publicado").length;
  const pendientes = posts.filter((p) => p.estado === "programado").length;

  function reemplazar(p: PostRedes) {
    setPosts((xs) => xs.map((x) => (x.id === p.id ? p : x)));
  }

  async function cambiarEstado(p: PostRedes, estado: "programado" | "pausado") {
    setOcupado(p.id);
    setAviso(null);
    try {
      const r = await actualizarPostRedes(p.id, { estado });
      reemplazar(r.post);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function publicarYa(p: PostRedes) {
    setConfirmarId(null);
    setOcupado(p.id);
    setAviso(null);
    try {
      const r = await publicarPostRedesYa(p.id);
      reemplazar(r.post);
      const res = r.resultado.resultado;
      setAviso(
        res === "publicado"
          ? `«${p.titulo}» ya está en Instagram.`
          : res === "procesando"
            ? "Instagram sigue procesando las imágenes; sale en la próxima vuelta (máximo 15 minutos)."
            : `No salió: ${r.resultado.error ?? "error desconocido"}`,
      );
    } catch (e) {
      setAviso((e as Error).message);
      cargar();
    } finally {
      setOcupado(null);
    }
  }

  function abrirEditor(p: PostRedes) {
    setEditando(p);
    setCaption(p.caption);
    setCuando(localCRDesdeIso(p.programado_para));
  }

  async function guardar() {
    if (!editando) return;
    setGuardando(true);
    try {
      const cambios: Parameters<typeof actualizarPostRedes>[1] = {};
      if (caption !== editando.caption) cambios.caption = caption;
      const iso = isoDesdeLocalCR(cuando);
      if (iso !== new Date(editando.programado_para).toISOString()) cambios.programado_para = iso;
      if (Object.keys(cambios).length) {
        const r = await actualizarPostRedes(editando.id, cambios);
        reemplazar(r.post);
      }
      setEditando(null);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Calendario de redes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Instagram @ecovivacr · cada carrusel programado se publica solo a su hora.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1 ${
              igListo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"
            }`}
          >
            <Instagram className="h-3.5 w-3.5" />
            {igListo ? "Instagram conectado" : "Instagram sin configurar"}
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 ring-1 ring-slate-200">
            {pendientes} programados · {publicados} publicados
          </span>
        </div>
      </div>

      {proximo && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
          <span className="font-semibold">Próximo:</span> {proximo.titulo} ·{" "}
          <span className="capitalize">{fechaLarga(proximo.programado_para)}</span>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <CalendarioMes
            ancla={ancla}
            seleccionado={dia ?? ""}
            conteoPorDia={conteo}
            onElegirDia={(k) => setDia((d) => (d === k ? null : k))}
            onCambiarMes={(d) => {
              setAncla(d);
              setDia(null);
            }}
          />
          {dia && (
            <button
              type="button"
              onClick={() => setDia(null)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Ver todo el mes
            </button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500">
            {dia ? <span className="capitalize">{diaLargo(dia)}</span> : "Todo el mes"} · {visibles.length}{" "}
            {visibles.length === 1 ? "carrusel" : "carruseles"}
          </p>

          {cargando && <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />}
          {!cargando && visibles.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No hay carruseles programados {dia ? "este día" : "este mes"}.
            </div>
          )}

          {visibles.map((p) => {
            const est = ESTADOS[p.estado];
            const atrasado = p.estado === "programado" && new Date(p.programado_para).getTime() < ahora - 20 * 60_000;
            return (
              <article key={p.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="relative w-20 shrink-0 sm:w-24">
                  {p.imagenes[0] && (
                    <img
                      src={p.imagenes[0]}
                      alt=""
                      loading="lazy"
                      className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200"
                    />
                  )}
                  <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Images className="h-3 w-3" />
                    {p.imagenes.length}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${est.clase}`}>{est.label}</span>
                    {atrasado && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        Atrasado
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 font-semibold text-slate-900">{p.titulo}</h3>
                  <p className="text-sm capitalize text-slate-500">{fechaLarga(p.programado_para)}</p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{p.caption}</p>
                  {p.estado === "error" && p.error && <p className="mt-1.5 text-xs text-red-600">{p.error}</p>}
                  {p.estado === "programado" && p.error && (
                    <p className="mt-1.5 text-xs text-amber-700">Falló un intento ({p.error}); se reintenta solo.</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.estado === "publicado" && p.ig_permalink && (
                      <a
                        href={p.ig_permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-4 w-4" /> Ver en Instagram
                      </a>
                    )}
                    {editable(p) && (
                      <>
                        <button
                          type="button"
                          onClick={() => abrirEditor(p)}
                          disabled={ocupado === p.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                        {p.estado === "programado" ? (
                          <button
                            type="button"
                            onClick={() => cambiarEstado(p, "pausado")}
                            disabled={ocupado === p.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Pause className="h-4 w-4" /> Pausar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cambiarEstado(p, "programado")}
                            disabled={ocupado === p.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Play className="h-4 w-4" /> {p.estado === "error" ? "Reintentar" : "Reanudar"}
                          </button>
                        )}
                        {confirmarId === p.id ? (
                          <button
                            type="button"
                            onClick={() => publicarYa(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                          >
                            <Send className="h-4 w-4" /> Confirmar: publicar ahora
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmarId(p.id)}
                            disabled={ocupado === p.id || !igListo}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" /> {ocupado === p.id ? "Publicando…" : "Publicar ya"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Dialog.Root open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900">{editando?.titulo}</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">Texto y fecha de publicación.</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            {editando && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {editando.imagenes.map((src, i) => (
                  <img key={src} src={src} alt={`Lámina ${i + 1}`} className="aspect-[3/4] w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ))}
              </div>
            )}

            <label htmlFor="redes-cuando" className="text-sm font-medium text-slate-700">
              Fecha y hora (Costa Rica)
            </label>
            <input
              id="redes-cuando"
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className="mt-1 mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />

            <div className="flex items-baseline justify-between">
              <label htmlFor="redes-caption" className="text-sm font-medium text-slate-700">
                Texto de la publicación
              </label>
              <span className={`text-xs ${caption.length > 2200 ? "text-red-600" : "text-slate-400"}`}>{caption.length} / 2.200</span>
            </div>
            <textarea
              id="redes-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={12}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</Dialog.Close>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || caption.length > 2200 || !cuando}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
