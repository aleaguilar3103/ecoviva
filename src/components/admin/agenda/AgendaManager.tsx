import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  getCitas,
  crearCita,
  actualizarCita,
  cancelarCita,
  reenviarCorreo,
  getLots,
  getFeedUrl,
  rotarFeedToken,
  getEstadoTelegram,
  generarCodigoTelegram,
  desvincularTelegram,
  type CitaRow,
  type NuevaCita,
  type Lot,
} from "../../../lib/adminApi";
import CalendarioMes from "./CalendarioMes";
import CitasDelDia from "./CitasDelDia";
import HojaCita, { LUGARES } from "./HojaCita";
import Conexiones from "./Conexiones";
import { claveDiaCR, hoyCR, fechaDesdeClave, isoDesdeLocalCR } from "./fechas";

const VACIA: NuevaCita = {
  cliente_nombre: "",
  cliente_email: "",
  cliente_telefono: "",
  inicio: "",
  lugar: LUGARES[0],
  lote_id: null,
  notas: "",
};

export default function AgendaManager() {
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [lotes, setLotes] = useState<Lot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Día elegido en el calendario y mes que se está mirando. Arrancan en hoy.
  const [dia, setDia] = useState<string>(() => hoyCR());
  const [ancla, setAncla] = useState<Date>(() => fechaDesdeClave(hoyCR()));

  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<NuevaCita>(VACIA);
  const [guardando, setGuardando] = useState(false);

  // Un doble clic manda un segundo correo real al cliente, así que el botón se
  // deshabilita mientras la petición está en vuelo.
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [rotandoFeed, setRotandoFeed] = useState(false);

  // Si la cuenta ya está vinculada con Telegram. null mientras carga o si falló
  // la consulta — en ese caso el bloque no se muestra, no es bloqueante.
  //
  // IMPORTANTE: este GET nunca debe generar ni guardar un código — generar algo
  // en cada montaje acuñaría una credencial de 10 minutos cada vez que alguien
  // abre la pestaña, sin que nadie la pidiera. (Ver telegram-link.ts.)
  const [vinculado, setVinculado] = useState<boolean | null>(null);
  const [codigoGenerado, setCodigoGenerado] = useState<{ codigo: string; expira: string } | null>(
    null,
  );
  const [generandoTelegram, setGenerandoTelegram] = useState(false);
  const [desvinculandoTelegram, setDesvinculandoTelegram] = useState(false);
  const [segundosCodigo, setSegundosCodigo] = useState<number | null>(null);

  // Ventana fija: una semana atrás hasta tres meses adelante.
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
    getEstadoTelegram()
      .then((r) => setVinculado(r.vinculado))
      .catch(() => setVinculado(null));
  }, [recargar]);

  // Cuenta regresiva del código: se recalcula cada segundo contra `expira`, no
  // con un contador que arranca en 600 y baja — así no se desincroniza si la
  // pestaña estuvo en segundo plano un rato.
  useEffect(() => {
    if (!codigoGenerado) {
      setSegundosCodigo(null);
      return;
    }
    const calcular = () =>
      Math.max(0, Math.round((new Date(codigoGenerado.expira).getTime() - Date.now()) / 1000));
    setSegundosCodigo(calcular());
    const id = setInterval(() => setSegundosCodigo(calcular()), 1000);
    return () => clearInterval(id);
  }, [codigoGenerado]);

  // Cuántas citas activas hay por día, para los puntos del calendario. Las
  // canceladas no cuentan: un punto en un día donde lo único que hubo se
  // canceló haría buscar algo que no está.
  const conteoPorDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of citas) {
      if (c.estado === "cancelada") continue;
      const k = claveDiaCR(c.inicio);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [citas]);

  const citasDelDia = useMemo(
    () =>
      citas
        .filter((c) => claveDiaCR(c.inicio) === dia)
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [citas, dia],
  );

  function abrirNueva() {
    setEditando(null);
    setError(null);
    setAviso(null);
    // Se precarga el día que está mirando, a las 10 a.m. — que es cuando más
    // se agenda. Si eligió otro día en el calendario, la cita nace ahí y no
    // hay que volver a escribir la fecha.
    setForm({ ...VACIA, inicio: isoDesdeLocalCR(`${dia}T10:00`) });
    setHojaAbierta(true);
  }

  function abrirEdicion(c: CitaRow) {
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
    setHojaAbierta(true);
  }

  function cerrarHoja() {
    setHojaAbierta(false);
    setEditando(null);
    setForm(VACIA);
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
      const avisos: string[] = [editando ? "Cita actualizada." : "Cita creada."];
      if (r.choque) avisos.push("Ojo: ya tenías algo a esa hora.");
      // "no_aplica" no es un fallo: significa que el cambio no tocó hora ni
      // lugar, así que no había nada visible que avisarle al cliente.
      if (r.correo === "fallo") avisos.push("El correo al cliente NO salió — avisale por otro medio.");
      setAviso(avisos.join(" "));
      // Saltar al día de la cita guardada: si la movió a otra fecha, que la
      // vea donde quedó y no en el día vacío del que salió.
      if (form.inicio) {
        const k = claveDiaCR(form.inicio);
        setDia(k);
        setAncla(fechaDesdeClave(k));
      }
      cerrarHoja();
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la cita.");
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(c: CitaRow) {
    if (!confirm(`¿Cancelar la cita de ${c.cliente_nombre}? Se le manda un correo avisándole.`)) return;
    setError(null);
    setAviso(null);
    setCancelandoId(c.id);
    try {
      const r = await cancelarCita(c.id);
      setAviso(
        r.correo === "fallo"
          ? "Cancelada. El correo al cliente NO salió — avisale por otro medio."
          : "Cita cancelada.",
      );
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la cita.");
    } finally {
      setCancelandoId(null);
    }
  }

  // Reenvía la confirmación cuando el correo original falló (o el cliente dice
  // que no le llegó). No toca la fila ni la secuencia — es el mismo correo.
  async function reenviar(c: CitaRow) {
    setError(null);
    setAviso(null);
    setReenviandoId(c.id);
    try {
      const r = await reenviarCorreo(c.id);
      setAviso(
        r.correo === "enviado"
          ? "Correo reenviado."
          : "El reenvío tampoco salió — avisale por otro medio.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reenviar el correo.");
    } finally {
      setReenviandoId(null);
    }
  }

  async function rotarFeed() {
    if (!confirm("El enlace actual dejará de funcionar y hay que volver a suscribir el calendario. ¿Seguir?"))
      return;
    setRotandoFeed(true);
    try {
      const r = await rotarFeedToken();
      setFeedUrl(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el enlace nuevo.");
    } finally {
      setRotandoFeed(false);
    }
  }

  async function pedirCodigoTelegram() {
    setGenerandoTelegram(true);
    try {
      setCodigoGenerado(await generarCodigoTelegram());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el código.");
    } finally {
      setGenerandoTelegram(false);
    }
  }

  async function desvincularTelegramClick() {
    if (
      !confirm(
        "¿Desvincular esta cuenta de Telegram? Vas a dejar de poder manejar la agenda desde el celular hasta que la vincules de nuevo.",
      )
    ) {
      return;
    }
    setDesvinculandoTelegram(true);
    try {
      await desvincularTelegram();
      setVinculado(false);
      setCodigoGenerado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desvincular.");
    } finally {
      setDesvinculandoTelegram(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">Visitas, oficina y notaría.</p>
        </div>
        {/* En escritorio el botón vive acá; en el teléfono además hay uno
            flotante abajo, al alcance del pulgar. */}
        <button
          type="button"
          onClick={abrirNueva}
          className="hidden items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nueva cita
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {aviso && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
        <div className="space-y-3">
          <CalendarioMes
            ancla={ancla}
            seleccionado={dia}
            conteoPorDia={conteoPorDia}
            onElegirDia={setDia}
            onCambiarMes={setAncla}
          />
          <div className="hidden lg:block">
            <Conexiones
              feedUrl={feedUrl}
              rotandoFeed={rotandoFeed}
              onRotarFeed={rotarFeed}
              vinculado={vinculado}
              codigoGenerado={codigoGenerado}
              segundosCodigo={segundosCodigo}
              generandoTelegram={generandoTelegram}
              desvinculandoTelegram={desvinculandoTelegram}
              onPedirCodigo={pedirCodigoTelegram}
              onDesvincular={desvincularTelegramClick}
            />
          </div>
        </div>

        <div className="space-y-5">
          {cargando ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Cargando la agenda…
            </p>
          ) : (
            <CitasDelDia
              dia={dia}
              citas={citasDelDia}
              lotes={lotes}
              cancelandoId={cancelandoId}
              reenviandoId={reenviandoId}
              onNueva={abrirNueva}
              onEditar={abrirEdicion}
              onCancelar={cancelar}
              onReenviar={reenviar}
            />
          )}

          <div className="lg:hidden">
            <Conexiones
              feedUrl={feedUrl}
              rotandoFeed={rotandoFeed}
              onRotarFeed={rotarFeed}
              vinculado={vinculado}
              codigoGenerado={codigoGenerado}
              segundosCodigo={segundosCodigo}
              generandoTelegram={generandoTelegram}
              desvinculandoTelegram={desvinculandoTelegram}
              onPedirCodigo={pedirCodigoTelegram}
              onDesvincular={desvincularTelegramClick}
            />
          </div>
        </div>
      </div>

      {/* Botón flotante, solo en teléfono. Va sobre la barra de gestos del
          iPhone (safe-area) para que no quede tapado. */}
      <button
        type="button"
        onClick={abrirNueva}
        aria-label="Nueva cita"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 transition active:scale-95 sm:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <HojaCita
        abierta={hojaAbierta}
        editando={editando}
        form={form}
        lotes={lotes}
        guardando={guardando}
        onCambiar={setForm}
        onGuardar={guardar}
        onCerrar={cerrarHoja}
      />
    </div>
  );
}
