import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCitas,
  crearCita,
  actualizarCita,
  cancelarCita,
  getLots,
  type CitaRow,
  type NuevaCita,
  type Lot,
} from "../../lib/adminApi";

const LUGARES = [
  "Visita Lomas de la Llanada",
  "Visita Río Celeste",
  "Oficina",
  "Videollamada",
  "Notaría",
];

// Costa Rica es UTC−6 fijo (sin horario de verano). El <input type="datetime-local">
// trabaja en la hora local del navegador, que puede no ser la de Costa Rica si
// alguien viaja o el equipo tiene otro huso. Se convierte explícitamente en
// ambos sentidos para que la cita quede siempre guardada en hora tica, sin
// depender de dónde esté sentada la persona que la carga.
const OFFSET_CR_MS = -6 * 60 * 60_000;

// valor = "2026-09-01T10:30" tal como lo entrega el input, interpretado como
// hora de Costa Rica (no como hora local del navegador).
function isoDesdeLocalCR(valor: string): string {
  const [fecha, hora] = valor.split("T");
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_CR_MS).toISOString();
}

// Inverso: de un ISO guardado a la cadena "YYYY-MM-DDTHH:mm" en hora de Costa
// Rica, que es lo que el input datetime-local espera recibir como value.
function localCRDesdeIso(iso: string): string {
  const d = new Date(new Date(iso).getTime() + OFFSET_CR_MS);
  return d.toISOString().slice(0, 16);
}

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(iso));
}

const VACIA: NuevaCita = {
  cliente_nombre: "",
  cliente_email: "",
  cliente_telefono: "",
  inicio: "",
  lugar: LUGARES[0],
  lote_id: null,
  notas: "",
};

const field =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const labelText = "block text-xs font-medium text-slate-600 mb-1";

export default function AgendaManager() {
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [lotes, setLotes] = useState<Lot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<NuevaCita>(VACIA);
  const [guardando, setGuardando] = useState(false);

  // Ventana fija: una semana atrás (para ver lo recién pasado) hasta tres
  // meses adelante. No hay selector de rango en esta tarea, es lo suficiente
  // para agendar, revisar y editar sin scroll infinito.
  const rango = useMemo(() => {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const hasta = new Date(Date.now() + 90 * 24 * 60 * 60_000);
    return { desde, hasta };
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { citas } = await getCitas(rango.desde, rango.hasta);
      setCitas(citas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la agenda.");
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    recargar();
    getLots()
      .then((r) => setLotes(r.lots))
      .catch(() => setLotes([]));
  }, [recargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      // El PATCH exige el formulario completo, no acepta cambios parciales:
      // por eso se manda `form` entero tanto al crear como al editar.
      const r = editando ? await actualizarCita(editando, form) : await crearCita(form);
      setAviso(r.choque ? "Guardada. Ojo: ya tenías algo a esa hora." : "Guardada.");
      setForm(VACIA);
      setEditando(null);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la cita.");
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(c: CitaRow) {
    if (!confirm(`¿Cancelar la cita de ${c.cliente_nombre}?`)) return;
    setError(null);
    setAviso(null);
    try {
      await cancelarCita(c.id);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la cita.");
    }
  }

  function editar(c: CitaRow) {
    setEditando(c.id);
    setError(null);
    setAviso(null);
    setForm({
      cliente_nombre: c.cliente_nombre,
      cliente_email: c.cliente_email,
      cliente_telefono: c.cliente_telefono ?? "",
      inicio: c.inicio,
      lugar: c.lugar,
      lote_id: c.lote_id,
      notas: c.notas ?? "",
    });
  }

  function cancelarEdicion() {
    setEditando(null);
    setForm(VACIA);
  }

  const etiquetaLote = (l: Lot) =>
    `${l.project === "llanada" ? "Llanada" : "Río Celeste"} · Lote ${l.lot_number}${l.lot_suffix ?? ""}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Agenda</h1>
        <p className="text-sm text-slate-500">Citas con clientes: visitas, oficina, notaría.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {aviso && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={guardar}
          className="h-fit space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80"
        >
          <h2 className="text-base font-semibold text-slate-900">
            {editando ? "Editar cita" : "Nueva cita"}
          </h2>

          <div>
            <label className={labelText}>Nombre del cliente</label>
            <input
              required
              placeholder="Nombre completo"
              value={form.cliente_nombre}
              onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
              className={field}
            />
          </div>

          <div>
            <label className={labelText}>Correo del cliente</label>
            <input
              required
              type="email"
              placeholder="correo@ejemplo.com"
              value={form.cliente_email}
              onChange={(e) => setForm({ ...form, cliente_email: e.target.value })}
              className={field}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Sin correo no hay invitación de calendario ni recordatorios.
            </p>
          </div>

          <div>
            <label className={labelText}>Teléfono (opcional)</label>
            <input
              placeholder="8888-8888"
              value={form.cliente_telefono ?? ""}
              onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
              className={field}
            />
          </div>

          <div>
            <label className={labelText}>Fecha y hora (Costa Rica)</label>
            <input
              required
              type="datetime-local"
              value={form.inicio ? localCRDesdeIso(form.inicio) : ""}
              onChange={(e) => setForm({ ...form, inicio: isoDesdeLocalCR(e.target.value) })}
              className={field}
            />
          </div>

          <div>
            <label className={labelText}>Lugar</label>
            <select
              value={form.lugar}
              onChange={(e) => setForm({ ...form, lugar: e.target.value })}
              className={field}
            >
              {LUGARES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelText}>Lote de interés (opcional)</label>
            <select
              value={form.lote_id ?? ""}
              onChange={(e) => setForm({ ...form, lote_id: e.target.value || null })}
              className={field}
            >
              <option value="">Sin lote de interés</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {etiquetaLote(l)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelText}>Notas internas (el cliente nunca las ve)</label>
            <textarea
              rows={3}
              value={form.notas ?? ""}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className={field}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agendar"}
            </button>
            {editando && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Próximas citas</h2>

          {cargando ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : citas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
              No hay citas en el rango.
            </div>
          ) : (
            citas.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{c.cliente_nombre}</p>
                    <p className="text-sm text-slate-600 first-letter:uppercase">
                      {fechaLarga(c.inicio)}
                    </p>
                    <p className="text-xs text-slate-500">{c.lugar}</p>
                    <p className="text-xs text-slate-400">{c.cliente_email}</p>
                    {c.notas && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        {c.notas}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => editar(c)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelar(c)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
