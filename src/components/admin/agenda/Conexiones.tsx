import { useState } from "react";
import { ChevronDown, Check, Copy, Send, CalendarDays } from "lucide-react";
import { horaCorta, mmss } from "./fechas";

function Panel({
  titulo,
  resumen,
  children,
  icono,
}: {
  titulo: string;
  resumen: string;
  children: React.ReactNode;
  icono: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          {icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">{titulo}</span>
          <span className="block truncate text-xs text-slate-500">{resumen}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}

function Pasos({ titulo, pasos }: { titulo: string; pasos: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-700">{titulo}</p>
      <ol className="mt-1.5 space-y-1">
        {pasos.map((p, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-slate-600">
            <span className="grid h-4 w-4 shrink-0 translate-y-0.5 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Conexiones({
  feedUrl,
  rotandoFeed,
  onRotarFeed,
  vinculado,
  codigoGenerado,
  segundosCodigo,
  generandoTelegram,
  desvinculandoTelegram,
  onPedirCodigo,
  onDesvincular,
}: {
  feedUrl: string | null;
  rotandoFeed: boolean;
  onRotarFeed: () => void;
  vinculado: boolean | null;
  codigoGenerado: { codigo: string; expira: string } | null;
  segundosCodigo: number | null;
  generandoTelegram: boolean;
  desvinculandoTelegram: boolean;
  onPedirCodigo: () => void;
  onDesvincular: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles (permiso denegado o contexto inseguro): el campo de
      // abajo queda igual para seleccionar y copiar a mano. No es un error
      // que valga la pena mostrarle a nadie.
    }
  }

  return (
    <div className="space-y-3">
      {vinculado !== null && (
        <Panel
          icono={<Send className="h-4 w-4" />}
          titulo="Telegram"
          resumen={
            vinculado ? "Conectado — podés agendar desde el chat" : "Sin conectar"
          }
        >
          {vinculado ? (
            <>
              <p className="text-[13px] leading-relaxed text-slate-600">
                Esta cuenta ya está vinculada. Podés agendar, mover y cancelar citas
                escribiéndole a <strong>@EcovivacrBot</strong> desde tu celular, en
                lenguaje normal — «agendame a Ana el jueves a las 3 en la Llanada».
              </p>
              <button
                type="button"
                disabled={desvinculandoTelegram}
                onClick={onDesvincular}
                className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                {desvinculandoTelegram ? "Desvinculando…" : "Desvincular"}
              </button>
            </>
          ) : codigoGenerado ? (
            <>
              <Pasos
                titulo="Terminá de conectarlo"
                pasos={[
                  "Abrí Telegram y buscá @EcovivacrBot.",
                  "Tocá Empezar (o mandale /start).",
                  "Mandale este mensaje, con el código incluido:",
                ]}
              />
              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-600">
                /vincular
                <span className="mt-1 block font-mono text-2xl font-bold tracking-[0.15em] text-slate-900">
                  {codigoGenerado.codigo}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copiar(`/vincular ${codigoGenerado.codigo}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? "Copiado" : "Copiar mensaje"}
                </button>
                <button
                  type="button"
                  disabled={generandoTelegram}
                  onClick={onPedirCodigo}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {generandoTelegram ? "Generando…" : "Generar código nuevo"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {segundosCodigo !== null && segundosCodigo > 0 ? (
                  <>
                    Sirve por {mmss(segundosCodigo)} más (hasta las{" "}
                    {horaCorta(codigoGenerado.expira)}).
                  </>
                ) : (
                  "Este código ya venció — generá uno nuevo."
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-slate-600">
                Conectá tu Telegram para manejar la agenda desde el celular, hablándole al
                bot <strong>@EcovivacrBot</strong> en lenguaje normal. También es por donde
                te llegan los avisos cuando la otra persona mueve algo.
              </p>
              <button
                type="button"
                disabled={generandoTelegram}
                onClick={onPedirCodigo}
                className="mt-3 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {generandoTelegram ? "Generando…" : "Conectar Telegram"}
              </button>
            </>
          )}
        </Panel>
      )}

      {feedUrl && (
        <Panel
          icono={<CalendarDays className="h-4 w-4" />}
          titulo="Ver la agenda en tu calendario"
          resumen="Suscribí el iPhone o Google Calendar"
        >
          <p className="text-[13px] leading-relaxed text-slate-600">
            Suscribiéndote, las citas aparecen solas en el calendario del teléfono y se
            actualizan cuando cambian. Se hace <strong>una sola vez</strong>.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copiar(feedUrl)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Enlace copiado" : "Copiar enlace"}
            </button>
            <button
              type="button"
              disabled={rotandoFeed}
              onClick={onRotarFeed}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {rotandoFeed ? "Generando…" : "Generar enlace nuevo"}
            </button>
          </div>

          <Pasos
            titulo="En el iPhone"
            pasos={[
              "Copiá el enlace con el botón de arriba.",
              "Ajustes → Aplicaciones → Calendario → Cuentas.",
              "Añadir cuenta → Otra → Añadir calendario suscrito.",
              "Pegá el enlace y tocá Siguiente, después Guardar.",
            ]}
          />

          <Pasos
            titulo="En Google Calendar"
            pasos={[
              "Desde una computadora, entrá a calendar.google.com.",
              "En «Otros calendarios», tocá + y elegí «Desde URL».",
              "Pegá el enlace y añadí el calendario.",
              "Ojo: Google puede tardar horas en reflejar los cambios; el iPhone es bastante más rápido.",
            ]}
          />

          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            <strong>Tratá este enlace como una contraseña.</strong> Quien lo tenga ve todas
            las citas —nombres, teléfonos y notas internas— sin iniciar sesión. Si se te
            escapa, generá uno nuevo: el viejo deja de servir al toque.
          </p>

          <input
            readOnly
            value={feedUrl}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500"
          />
        </Panel>
      )}
    </div>
  );
}
