import { useEffect, useState } from "react";
import {
  getConfig,
  patchConfig,
  generateBlock,
  injectBlock,
  type BotConfig,
} from "../../lib/adminApi";

export default function BotPromptManager() {
  const [cfg, setCfg] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // prompt
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // bot toggle
  const [togglingBot, setTogglingBot] = useState(false);

  // asistente IA
  const [instruction, setInstruction] = useState("");
  const [block, setBlock] = useState("");
  const [generating, setGenerating] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      setDraft(c.system_prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBot() {
    if (!cfg) return;
    setTogglingBot(true);
    setError(null);
    const next = !cfg.bot_enabled;
    try {
      const c = await patchConfig({ bot_enabled: next });
      setCfg(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTogglingBot(false);
    }
  }

  async function savePrompt() {
    setSavingPrompt(true);
    setError(null);
    setNotice(null);
    try {
      const c = await patchConfig({ system_prompt: draft });
      setCfg(c);
      setDraft(c.system_prompt);
      setEditing(false);
      setNotice("Prompt guardado. ECO ya usa la versión nueva.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPrompt(false);
    }
  }

  async function onGenerate() {
    if (!instruction.trim()) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const { block } = await generateBlock(instruction.trim(), draft);
      setBlock(block);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function onInject() {
    if (!block.trim()) return;
    setInjecting(true);
    setError(null);
    setNotice(null);
    try {
      const { prompt } = await injectBlock(block.trim(), draft);
      setDraft(prompt);
      setEditing(true);
      setNotice(
        "Bloque inyectado en el lugar sugerido. Revisá el prompt resaltado abajo y tocá «Guardar» para aplicarlo."
      );
      setBlock("");
      setInstruction("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInjecting(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Cargando…</div>;
  if (!cfg) return <div className="text-red-600 text-sm">{error || "No se pudo cargar la configuración."}</div>;

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bot & Prompt</h1>
        <p className="text-sm text-slate-500">Controlá a ECO y su comportamiento.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">
          {notice}
        </div>
      )}

      {/* Interruptor del bot */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Estado del bot (ECO)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {cfg.bot_enabled
                ? "Encendido: ECO responde en WhatsApp y el chat web."
                : "Apagado: ECO no responde en ningún canal."}
            </p>
          </div>
          <button
            onClick={toggleBot}
            disabled={togglingBot}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              cfg.bot_enabled ? "bg-emerald-600" : "bg-slate-300"
            } disabled:opacity-60`}
            aria-pressed={cfg.bot_enabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                cfg.bot_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Editor de prompt */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-slate-900">Prompt de ECO</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {cfg.prompt_is_custom
                ? "Personalizado desde el panel."
                : "Usando el prompt por defecto del sistema."}
            </p>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDraft(cfg.system_prompt);
                  setEditing(false);
                  setNotice(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={savePrompt}
                disabled={savingPrompt}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {savingPrompt ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          readOnly={!editing}
          rows={18}
          className={`${field} font-mono text-xs leading-relaxed ${
            editing ? "bg-white ring-1 ring-emerald-200" : "bg-slate-50 text-slate-600"
          }`}
        />
      </section>

      {/* Asistente de IA */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Asistente de prompt (IA)</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-3">
          Escribí lo que querés agregar o cambiar. La IA redacta el bloque en el estilo de ECO y,
          con «Inyectar bloque», lo coloca en la parte del prompt que mejor corresponde.
        </p>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="Ej: agregá que si preguntan por mascotas, en Río Celeste sí se permiten."
          className={field}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={onGenerate}
            disabled={generating || !instruction.trim()}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {generating ? "Generando…" : "Generar con IA"}
          </button>
        </div>

        {block && (
          <div className="mt-4">
            <label className="text-sm text-slate-600">Bloque generado (editable):</label>
            <textarea
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              rows={6}
              className={`${field} mt-1 font-mono text-xs`}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setBlock("")}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Descartar
              </button>
              <button
                onClick={onInject}
                disabled={injecting}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {injecting ? "Inyectando…" : "Inyectar bloque"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
