import { useEffect, useMemo, useState } from "react";
import {
  getLots,
  updateLot,
  createLot,
  deleteLot,
  type Lot,
} from "../../lib/adminApi";

const PROJECTS: { id: Lot["project"]; label: string; currency: Lot["currency"] }[] = [
  { id: "rio_celeste", label: "Oasis Río Celeste", currency: "USD" },
  { id: "llanada", label: "Lomas de la Llanada", currency: "CRC" },
];

const STATUS: { value: Lot["status"]; label: string; cls: string; dot: string }[] = [
  { value: "available", label: "Disponible", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  { value: "reserved", label: "Reservado", cls: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  { value: "sold", label: "Vendido", cls: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  { value: "not_available", label: "No disponible", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
];

const SECTION_LABEL: Record<string, string> = {
  general: "General",
  bloque_1: "Bloque 1",
  frente_a_calle: "Frente a calle",
};

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LotsManager() {
  const [project, setProject] = useState<Lot["project"]>("rio_celeste");
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lot | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const currency = PROJECTS.find((p) => p.id === project)!.currency;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { lots } = await getLots(project);
      setLots(lots);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function changeStatus(lot: Lot, status: Lot["status"]) {
    setSavingId(lot.id);
    const prev = lots;
    setLots((ls) => ls.map((l) => (l.id === lot.id ? { ...l, status } : l)));
    try {
      await updateLot(lot.id, { status });
    } catch (e) {
      setLots(prev);
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const grouped = useMemo(() => {
    const by: Record<string, Lot[]> = {};
    for (const l of lots) (by[l.section] ||= []).push(l);
    return Object.entries(by);
  }, [lots]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of lots) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [lots]);

  const total = lots.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Lotes</h1>
          <p className="text-sm text-slate-500">Inventario y estado por proyecto.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          <span className="text-base leading-none">+</span> Agregar lote
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 w-fit shadow-sm">
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProject(p.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              project === p.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-2xl font-semibold text-slate-900">{total}</div>
          <div className="text-xs text-slate-500">Total</div>
        </div>
        {STATUS.map((s) => (
          <div key={s.value} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900">{counts[s.value] || 0}</span>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            </div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Cargando lotes…</div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          No hay lotes en este proyecto todavía.
        </div>
      ) : (
        grouped.map(([section, sectionLots]) => (
          <div key={section} className="mb-8">
            {grouped.length > 1 && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                {SECTION_LABEL[section] || section}
                <span className="ml-2 font-normal normal-case text-slate-400">· {sectionLots.length}</span>
              </h3>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Lote</th>
                    <th className="px-4 py-3 font-medium text-right">m²</th>
                    <th className="px-4 py-3 font-medium text-right">Precio/m²</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sectionLots.map((lot) => (
                    <tr
                      key={lot.id}
                      className={`transition hover:bg-slate-50/70 ${savingId === lot.id ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        #{lot.lot_number}
                        {lot.requires_prima && (
                          <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            prima {lot.prima_pct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {Number(lot.size_m2).toLocaleString("es-CR")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {fmt(Number(lot.price_per_m2), lot.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">
                        {fmt(Number(lot.price_total), lot.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lot.status}
                          onChange={(e) => changeStatus(lot, e.target.value as Lot["status"])}
                          className={`text-xs font-medium rounded-md border px-2 py-1 outline-none cursor-pointer ${
                            STATUS.find((s) => s.value === lot.status)?.cls
                          }`}
                        >
                          {STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(lot)}
                          className="rounded-md px-2.5 py-1 text-sm font-medium text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {editing && (
        <LotEditor
          lot={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onDeleted={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {creating && (
        <LotEditor
          lot={null}
          project={project}
          currency={currency}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function LotEditor({
  lot,
  project,
  currency,
  onClose,
  onSaved,
  onDeleted,
}: {
  lot: Lot | null;
  project?: Lot["project"];
  currency: Lot["currency"];
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isNew = !lot;
  const [form, setForm] = useState({
    project: lot?.project || project || "rio_celeste",
    section: lot?.section || (project === "llanada" ? "bloque_1" : "general"),
    lot_number: lot?.lot_number ?? 0,
    size_m2: lot?.size_m2 ?? 0,
    price_per_m2: lot?.price_per_m2 ?? 0,
    status: lot?.status || ("available" as Lot["status"]),
    requires_prima: lot?.requires_prima ?? false,
    prima_pct: lot?.prima_pct ?? 0,
    has_view: lot?.has_view ?? false,
    plano_visado_url: lot?.plano_visado_url ?? "",
    notes: lot?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        lot_number: Number(form.lot_number),
        size_m2: Number(form.size_m2),
        price_per_m2: Number(form.price_per_m2),
        prima_pct: Number(form.prima_pct),
        currency,
        plano_visado_url: form.plano_visado_url || null,
        notes: form.notes || null,
      };
      if (isNew) await createLot(payload);
      else await updateLot(lot!.id, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!lot || !confirm(`¿Borrar el lote #${lot.lot_number}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      await deleteLot(lot.id);
      onDeleted?.();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const sections =
    form.project === "llanada"
      ? [
          { v: "bloque_1", l: "Bloque 1" },
          { v: "frente_a_calle", l: "Frente a calle" },
        ]
      : [{ v: "general", l: "General" }];

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400";
  const labelText = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isNew ? "Nuevo lote" : `Editar lote #${lot!.lot_number}`}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isNew && (
            <div>
              <label className={labelText}>Sección</label>
              <select className={field} value={form.section} onChange={(e) => set("section", e.target.value as Lot["section"])}>
                {sections.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelText}># Lote</label>
              <input type="number" className={field} value={form.lot_number} onChange={(e) => set("lot_number", e.target.value as never)} disabled={!isNew} />
            </div>
            <div>
              <label className={labelText}>Tamaño (m²)</label>
              <input type="number" step="0.01" className={field} value={form.size_m2} onChange={(e) => set("size_m2", e.target.value as never)} />
            </div>
            <div>
              <label className={labelText}>Precio/m² ({currency})</label>
              <input type="number" step="0.01" className={field} value={form.price_per_m2} onChange={(e) => set("price_per_m2", e.target.value as never)} />
            </div>
            <div>
              <label className={labelText}>Estado</label>
              <select className={field} value={form.status} onChange={(e) => set("status", e.target.value as Lot["status"])}>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Opciones (prima / vista) */}
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-slate-700">Requiere prima</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={form.requires_prima}
                onChange={(e) => set("requires_prima", e.target.checked)}
              />
            </label>
            {form.requires_prima && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <label className="text-sm text-slate-600" htmlFor="prima_pct">Prima (%)</label>
                <input
                  id="prima_pct"
                  type="number"
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-right outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  value={form.prima_pct}
                  onChange={(e) => set("prima_pct", e.target.value as never)}
                />
              </div>
            )}
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-slate-700">Tiene vista</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={!!form.has_view}
                onChange={(e) => set("has_view", e.target.checked)}
              />
            </label>
          </div>

          <div>
            <label className={labelText}>Plano visado (URL)</label>
            <input type="url" className={field} value={form.plano_visado_url} onChange={(e) => set("plano_visado_url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className={labelText}>Notas</label>
            <textarea className={field} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          {!isNew ? (
            <button onClick={remove} disabled={saving} className="text-sm font-medium text-red-600 transition hover:text-red-700">
              Borrar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
