import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send, ShieldCheck, ShieldAlert, Wrench, FileText } from "lucide-react";
import { sendTestMessage, resetTestConversation, type TestToolCall } from "../../lib/adminApi";

interface Msg {
  role: "user" | "assistant";
  text: string;
  attachments?: string[];
  tools?: TestToolCall[];
}

const SESSION_KEY = "eco_admin_test_session";

function nuevaSesion(): string {
  const id = "admin-test-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

function sesionActual(): string {
  return localStorage.getItem(SESSION_KEY) || nuevaSesion();
}

const SALUDO: Msg = {
  role: "assistant",
  text: "¡Hola! Soy ECO, asesor de EcoViva. ¿En qué te puedo ayudar?",
};

// Herramientas que en modo seguro NO tocan GoHighLevel. El resto (consultar
// lotes, calcular financiamiento, ver cupos del calendario) corren de verdad
// siempre: son de solo lectura y simularlas volvería inútil la prueba.
const SIMULADAS = new Set(["upsert_contacto", "agendar_visita"]);

export default function BotTester() {
  const [messages, setMessages] = useState<Msg[]>([SALUDO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modo seguro: probar el bot no debería llenar el CRM de contactos falsos ni
  // ocupar cupos reales del calendario. Se puede apagar para una prueba de
  // punta a punta consciente.
  const [seguro, setSeguro] = useState(true);
  const [reiniciando, setReiniciando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(sesionActual());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const enviar = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const data = await sendTestMessage({
        message: text,
        sessionId: sessionId.current,
        simulate: seguro,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
          attachments: data.attachments,
          tools: data.tools,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [input, loading, seguro]);

  async function reiniciar() {
    if (reiniciando) return;
    setReiniciando(true);
    setError(null);
    try {
      // Borrar la conversación vieja es lo que hace que ECO empiece de cero:
      // sin esto el agente recuerda todo el hilo anterior.
      await resetTestConversation(sessionId.current);
    } catch (e) {
      setError(`No se pudo borrar la conversación anterior: ${(e as Error).message}`);
    } finally {
      sessionId.current = nuevaSesion();
      setMessages([SALUDO]);
      setAbierto(null);
      setReiniciando(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Probar el bot</h2>
          <p className="text-sm text-slate-500">
            Conversá con ECO igual que un cliente. Usa el prompt y los lotes que están guardados
            ahora, aunque el bot esté apagado en el sitio.
          </p>
        </div>
        <button
          onClick={reiniciar}
          disabled={reiniciando}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        >
          <RotateCcw size={15} />
          {reiniciando ? "Reiniciando…" : "Nueva conversación"}
        </button>
      </header>

      <button
        onClick={() => setSeguro((s) => !s)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
          seguro
            ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70"
            : "border-amber-300 bg-amber-50 hover:bg-amber-100/70"
        }`}
      >
        {seguro ? (
          <ShieldCheck size={20} className="shrink-0 text-emerald-700" />
        ) : (
          <ShieldAlert size={20} className="shrink-0 text-amber-700" />
        )}
        <span className="flex-1">
          <span
            className={`block text-sm font-semibold ${seguro ? "text-emerald-900" : "text-amber-900"}`}
          >
            {seguro ? "Modo seguro activado" : "Modo real — escribe en el CRM"}
          </span>
          <span className={`block text-xs ${seguro ? "text-emerald-700" : "text-amber-800"}`}>
            {seguro
              ? "Guardar contacto y agendar visita se simulan: no se crean contactos en GoHighLevel ni citas en el calendario."
              : "Si ECO agenda, la cita y el contacto se crean de verdad. Usalo solo para una prueba de punta a punta."}
          </span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            seguro ? "bg-emerald-600" : "bg-amber-500"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              seguro ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-900 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400 text-xs font-bold text-slate-900">
            ECO
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold text-white">ECO · EcoViva</span>
            <span className="block text-[11px] text-slate-400">
              Sesión de prueba · {sessionId.current.slice(-6)}
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {m.text}
              </div>

              {m.attachments?.map((url, j) => (
                <a
                  key={j}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <FileText size={14} /> Folleto adjunto (PDF)
                </a>
              ))}

              {/* Qué hizo el agente por debajo: la parte que no se ve en el
                  widget y es justo lo que hay que revisar al probar. */}
              {m.tools?.map((t, j) => {
                const clave = `${i}-${j}`;
                const simulada = seguro && SIMULADAS.has(t.name);
                return (
                  <div key={clave} className="w-full max-w-[85%]">
                    <button
                      onClick={() => setAbierto(abierto === clave ? null : clave)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100"
                    >
                      <Wrench size={12} />
                      <code className="font-mono">{t.name}</code>
                      {simulada && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                          simulada
                        </span>
                      )}
                    </button>
                    {abierto === clave && (
                      <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
{`entrada: ${JSON.stringify(t.input, null, 2)}

resultado: ${t.result}`}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {loading && (
            <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
              ECO está escribiendo…
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-white p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
            placeholder="Escribí como si fueras un cliente…"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            onClick={enviar}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
