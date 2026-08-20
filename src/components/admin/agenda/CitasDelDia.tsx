import { CalendarPlus, Mail, Phone, MapPin, StickyNote } from "lucide-react";
import type { CitaRow, Lot } from "../../../lib/adminApi";
import { soloHora, diaLargo, esPasadaOCompletada } from "./fechas";

export default function CitasDelDia({
  dia,
  citas,
  lotes,
  cancelandoId,
  reenviandoId,
  onNueva,
  onEditar,
  onCancelar,
  onReenviar,
}: {
  dia: string;
  citas: CitaRow[];
  lotes: Lot[];
  cancelandoId: string | null;
  reenviandoId: string | null;
  onNueva: () => void;
  onEditar: (c: CitaRow) => void;
  onCancelar: (c: CitaRow) => void;
  onReenviar: (c: CitaRow) => void;
}) {
  const etiquetaLote = (id: string | null) => {
    if (!id) return null;
    const l = lotes.find((x) => x.id === id);
    if (!l) return null;
    return `${l.project === "llanada" ? "Llanada" : "Río Celeste"} · Lote ${l.lot_number}${l.lot_suffix ?? ""}`;
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{diaLargo(dia)}</h2>

      {citas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">No hay citas este día.</p>
          <button
            type="button"
            onClick={onNueva}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            <CalendarPlus className="h-4 w-4" />
            Agendar acá
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {citas.map((c) => {
            const pasada = esPasadaOCompletada(c);
            const cancelada = c.estado === "cancelada";
            const lote = etiquetaLote(c.lote_id);
            // Una cita cancelada o ya pasada no se puede mover ni volver a
            // cancelar: los dos caminos mandan correo real al cliente.
            const editable = !pasada && !cancelada;

            return (
              <li
                key={c.id}
                className={`rounded-2xl border bg-white p-4 ${
                  cancelada ? "border-slate-200 opacity-60" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-none text-slate-900">
                      {soloHora(c.inicio)}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-medium text-slate-800">
                      {c.cliente_nombre}
                    </p>
                  </div>
                  {(cancelada || pasada) && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        cancelada ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {cancelada ? "Cancelada" : "Pasada"}
                    </span>
                  )}
                </div>

                <dl className="mt-3 space-y-1.5 text-[13px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {c.lugar}
                      {lote && <span className="text-slate-400"> · {lote}</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <a href={`mailto:${c.cliente_email}`} className="truncate hover:text-slate-900">
                      {c.cliente_email}
                    </a>
                  </div>
                  {c.cliente_telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {/* En el teléfono esto marca de verdad — es lo que uno
                          quiere hacer cuando el cliente no aparece. */}
                      <a href={`tel:${c.cliente_telefono}`} className="hover:text-slate-900">
                        {c.cliente_telefono}
                      </a>
                    </div>
                  )}
                  {c.notas && (
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-slate-400" />
                      {/* Notas internas: el cliente NUNCA las ve (el correo se
                          arma con un subconjunto que las excluye). */}
                      <span className="whitespace-pre-wrap text-slate-500">{c.notas}</span>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {editable && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditar(c)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Mover o editar
                      </button>
                      <button
                        type="button"
                        disabled={cancelandoId === c.id}
                        onClick={() => onCancelar(c)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {cancelandoId === c.id ? "Cancelando…" : "Cancelar"}
                      </button>
                    </>
                  )}
                  {!cancelada && (
                    <button
                      type="button"
                      disabled={reenviandoId === c.id}
                      onClick={() => onReenviar(c)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {reenviandoId === c.id ? "Reenviando…" : "Reenviar correo"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
