import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCitas,
  crearCita,
  actualizarCita,
  cancelarCita,
  reenviarCorreo,
  getLots,
  getFeedUrl,
  rotarFeedToken,
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

// I2: el rango que trae getCitas (-7d..+90d) y el orden ascendente hacen que
// las citas pasadas aparezcan primero, arriba de todo, bajo "Próximas
// citas". Antes no había forma de distinguirlas de una cita futura: mismo
// estilo, mismos botones de Editar/Cancelar activos. Un clic en Cancelar ahí
// mandaba "Tu cita fue cancelada" por una visita que el cliente ya hizo.
// `estado === "completada"` es lo normal (el cron ya la cerró); el chequeo
// por hora cubre la ventana entre que la cita pasó y que el cron corre.
//
// N3: la comparación es contra la hora de FIN (inicio + duración), no la de
// inicio. Con la hora de inicio, una visita de 60 minutos que arranca a las
// 10:00 quedaba marcada "Pasada" —y sin Editar ni Cancelar— desde las
// 10:01, cuando la cita todavía está en curso. Mover o cancelar una cita
// que acaba de empezar es legítimo y común (el cliente avisa que se
// atrasó, o que no llega); el servidor ya lo permite mientras el cron no la
// haya marcado "completada".
export function esPasadaOCompletada(c: CitaRow): boolean {
  const fin = new Date(c.inicio).getTime() + c.duracion_min * 60_000;
  return c.estado === "completada" || fin < Date.now();
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
  // Id de la cita que se está cancelando ahora mismo (o null si ninguna). Un
  // doble clic manda un segundo correo de cancelación real al cliente, así
  // que el botón se deshabilita mientras la petición está en vuelo — mismo
  // patrón que `guardando` para el botón de "Guardar".
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  // Mismo patrón que cancelandoId: evita un doble reenvío real por un doble
  // clic mientras la petición está en vuelo.
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  // URL de suscripción del calendario (.ics). null mientras carga o si falló:
  // en ese caso simplemente no se muestra el bloque, no es un error bloqueante.
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [rotandoFeed, setRotandoFeed] = useState(false);

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
    getFeedUrl()
      .then((r) => setFeedUrl(r.url))
      .catch(() => setFeedUrl(null));
  }, [recargar]);

  async function rotarFeed() {
    if (!confirm("La URL actual dejará de funcionar. ¿Seguir?")) return;
    setRotandoFeed(true);
    try {
      const r = await rotarFeedToken();
      setFeedUrl(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la URL nueva.");
    } finally {
      setRotandoFeed(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      // El PATCH exige el formulario completo, no acepta cambios parciales:
      // por eso se manda `form` entero tanto al crear como al editar.
      const r = editando ? await actualizarCita(editando, form) : await crearCita(form);
      const avisos: string[] = ["Guardada."];
      if (r.choque) avisos.push("Ojo: ya tenías algo a esa hora.");
      // "no_aplica" no es un fallo: significa que el cambio no tocó hora ni
      // lugar, así que no había nada visible que avisarle al cliente.
      if (r.correo === "fallo") avisos.push("El correo al cliente NO salió — avisale por otro medio.");
      setAviso(avisos.join(" "));
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
    setCancelandoId(c.id);
    try {
      const r = await cancelarCita(c.id);
      if (r.correo === "fallo") {
        setAviso("Cancelada. El correo al cliente NO salió — avisale por otro medio.");
      }
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la cita.");
    } finally {
      setCancelandoId(null);
    }
  }

  // I3: reenvía la confirmación cuando el correo original falló (o el
  // cliente dice que no le llegó). No toca la fila ni la secuencia — es
  // literalmente el mismo correo, de nuevo.
  async function reenviar(c: CitaRow) {
    setError(null);
    setAviso(null);
    setReenviandoId(c.id);
    try {
      const r = await reenviarCorreo(c.id);
      setAviso(r.correo === "enviado" ? "Correo reenviado." : "El reenvío tampoco salió — avisale por otro medio.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reenviar el correo.");
    } finally {
      setReenviandoId(null);
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

          {feedUrl && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-700">Ver la agenda en tu celular</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Suscribí esta URL en tu calendario. Es de solo lectura y puede tardar en
                refrescar — para cambios al instante, usá el panel.
              </p>
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                Ojo: tratá este enlace como una contraseña. Quien lo tenga ve todas tus
                citas —nombres, teléfonos y notas internas— sin necesidad de iniciar
                sesión. Si se te llega a escapar, generá una URL nueva: la vieja deja de
                servir al toque.
              </p>
              <input
                readOnly
                value={feedUrl}
                onFocus={(e) => e.target.select()}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(feedUrl)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  disabled={rotandoFeed}
                  onClick={rotarFeed}
                  className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                >
                  {rotandoFeed ? "Generando…" : "Generar URL nueva"}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="space-y-3">
          {/* I2: "Próximas citas" mentía — el rango trae también lo pasado y
              lo completado, y aparece primero por el orden ascendente. */}
          <h2 className="text-base font-semibold text-slate-900">Citas</h2>

          {cargando ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : citas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
              No hay citas en el rango.
            </div>
          ) : (
            citas.map((c) => {
              const pasada = esPasadaOCompletada(c);
              return (
                <div
                  key={c.id}
                  className={
                    "rounded-xl border p-4 shadow-sm " +
                    (pasada ? "border-slate-100 bg-slate-50 opacity-70" : "border-slate-200 bg-white")
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{c.cliente_nombre}</p>
                        {pasada && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            {c.estado === "completada" ? "Completada" : "Pasada"}
                          </span>
                        )}
                      </div>
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
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {/* N2: I2 escondió Editar/Cancelar sobre una cita
                          pasada o completada porque no hay nada que
                          reagendar ni cancelar en una visita que ya ocurrió.
                          "Reenviar correo" es la misma clase de operación —
                          manda "Tu cita quedó agendada" con un .ics de fecha
                          pasada— así que va bajo el mismo guard. */}
                      {!pasada && (
                        <>
                          <button
                            type="button"
                            onClick={() => reenviar(c)}
                            disabled={reenviandoId === c.id}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {reenviandoId === c.id ? "Reenviando…" : "Reenviar correo"}
                          </button>
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
                            disabled={cancelandoId === c.id}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            {cancelandoId === c.id ? "Cancelando…" : "Cancelar"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
