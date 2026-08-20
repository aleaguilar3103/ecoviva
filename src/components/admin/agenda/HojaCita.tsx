import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { NuevaCita, Lot } from "../../../lib/adminApi";
import { localCRDesdeIso, isoDesdeLocalCR } from "./fechas";

export const LUGARES = [
  "Visita Lomas de la Llanada",
  "Visita Río Celeste",
  "Oficina",
  "Videollamada",
  "Notaría",
];

const field =
  "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const labelText = "block text-xs font-medium text-slate-600 mb-1.5";

export default function HojaCita({
  abierta,
  editando,
  form,
  lotes,
  guardando,
  onCambiar,
  onGuardar,
  onCerrar,
}: {
  abierta: boolean;
  editando: string | null;
  form: NuevaCita;
  lotes: Lot[];
  guardando: boolean;
  onCambiar: (f: NuevaCita) => void;
  onGuardar: (e: React.FormEvent) => void;
  onCerrar: () => void;
}) {
  const etiquetaLote = (l: Lot) =>
    `${l.project === "llanada" ? "Llanada" : "Río Celeste"} · Lote ${l.lot_number}${l.lot_suffix ?? ""}`;

  return (
    <Dialog.Root open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
        {/* En el teléfono ocupa casi toda la pantalla y sube desde abajo; en
            escritorio queda como una tarjeta centrada. Es la misma hoja: no
            hay dos diseños que mantener. */}
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-2xl focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-2xl"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {editando ? "Mover o editar cita" : "Nueva cita"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={onGuardar} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div>
              <label className={labelText}>Nombre del cliente</label>
              <input
                className={field}
                required
                value={form.cliente_nombre}
                onChange={(e) => onCambiar({ ...form, cliente_nombre: e.target.value })}
              />
            </div>

            <div>
              <label className={labelText}>Correo del cliente</label>
              {/* type="email" le da al teléfono el teclado con @ y valida el
                  formato antes de mandar. El servidor lo revalida igual. */}
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                className={field}
                required
                value={form.cliente_email}
                onChange={(e) => onCambiar({ ...form, cliente_email: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Acá le llega la invitación de calendario y los recordatorios.
              </p>
            </div>

            <div>
              <label className={labelText}>Teléfono (opcional)</label>
              <input
                type="tel"
                inputMode="tel"
                className={field}
                value={form.cliente_telefono ?? ""}
                onChange={(e) => onCambiar({ ...form, cliente_telefono: e.target.value })}
              />
            </div>

            <div>
              <label className={labelText}>Fecha y hora</label>
              <input
                type="datetime-local"
                className={field}
                required
                value={form.inicio ? localCRDesdeIso(form.inicio) : ""}
                onChange={(e) =>
                  onCambiar({
                    ...form,
                    inicio: e.target.value ? isoDesdeLocalCR(e.target.value) : "",
                  })
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">Hora de Costa Rica.</p>
            </div>

            <div>
              <label className={labelText}>Lugar</label>
              <select
                className={field}
                value={form.lugar}
                onChange={(e) => onCambiar({ ...form, lugar: e.target.value })}
              >
                {LUGARES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelText}>Lote de interés (opcional)</label>
              <select
                className={field}
                value={form.lote_id ?? ""}
                onChange={(e) => onCambiar({ ...form, lote_id: e.target.value || null })}
              >
                <option value="">Sin lote</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {etiquetaLote(l)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelText}>Notas internas (opcional)</label>
              <textarea
                className={`${field} min-h-[80px]`}
                value={form.notas ?? ""}
                onChange={(e) => onCambiar({ ...form, notas: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Solo para ustedes. El cliente nunca las ve.
              </p>
            </div>
          </form>

          {/* Los botones viven fuera del área que hace scroll: en el teléfono,
              con el teclado abierto, "Guardar" tiene que seguir alcanzable sin
              tener que bajar hasta el final del formulario. */}
          <div className="flex gap-2 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              onClick={onGuardar}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear cita"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
