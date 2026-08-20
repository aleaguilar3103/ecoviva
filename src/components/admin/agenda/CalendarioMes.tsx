import { ChevronLeft, ChevronRight } from "lucide-react";
import { grillaDelMes, mesLargo, hoyCR } from "./fechas";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

export default function CalendarioMes({
  ancla,
  seleccionado,
  conteoPorDia,
  onElegirDia,
  onCambiarMes,
}: {
  ancla: Date;
  seleccionado: string;
  /** clave "YYYY-MM-DD" → cuántas citas activas hay ese día */
  conteoPorDia: Map<string, number>;
  onElegirDia: (clave: string) => void;
  onCambiarMes: (nueva: Date) => void;
}) {
  const dias = grillaDelMes(ancla);
  const hoy = hoyCR();

  const mover = (delta: number) =>
    onCambiarMes(new Date(Date.UTC(ancla.getUTCFullYear(), ancla.getUTCMonth() + delta, 1, 12)));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => mover(-1)}
          aria-label="Mes anterior"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-slate-900">{mesLargo(ancla)}</p>
        <button
          type="button"
          onClick={() => mover(1)}
          aria-label="Mes siguiente"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[11px] font-medium text-slate-400">
            {d}
          </div>
        ))}

        {dias.map((d) => {
          const cuantas = conteoPorDia.get(d.clave) ?? 0;
          const elegido = d.clave === seleccionado;
          const esHoy = d.clave === hoy;

          return (
            <button
              key={d.clave}
              type="button"
              onClick={() => onElegirDia(d.clave)}
              // Alto fijo y ancho completo: en el teléfono el dedo necesita
              // blanco alrededor, no una celda de tabla.
              className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-sm transition ${
                elegido
                  ? "bg-emerald-700 font-semibold text-white"
                  : esHoy
                    ? "bg-emerald-50 font-semibold text-emerald-800"
                    : d.delMes
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{d.numero}</span>
              {/* El punto es la única señal de "acá hay algo". Va debajo del
                  número y no como color de fondo, para que se distinga del
                  día elegido y del día de hoy sin depender de tres tonos de
                  verde que en una pantalla al sol no se diferencian. */}
              {cuantas > 0 && (
                <span
                  className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                    elegido ? "bg-white" : "bg-emerald-600"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
