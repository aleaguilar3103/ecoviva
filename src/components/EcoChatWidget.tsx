import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";

const GREEN = "#74CE52";
const DARK = "#0f2e1b";

interface Msg {
  role: "user" | "assistant";
  text: string;
  attachments?: string[];
}

function getSessionId(): string {
  let id = localStorage.getItem("eco_chat_session");
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
    localStorage.setItem("eco_chat_session", id);
  }
  return id;
}

export default function EcoChatWidget() {
  const locale = (typeof localStorage !== "undefined" && localStorage.getItem("ecoviva_locale")) || "es";
  const isEN = locale === "en";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: isEN
        ? "Hi! I'm ECO, EcoViva's advisor. How can I help you today?"
        : "¡Hola! Soy ECO, asesor de EcoViva. ¿En qué te puedo ayudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(typeof window !== "undefined" ? getSessionId() : "");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId.current }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply || (isEN ? "Sorry, something went wrong." : "Disculpá, algo salió mal."),
          attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: isEN ? "Connection error. Try again." : "Error de conexión. Probá de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, isEN]);

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9998,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: GREEN,
          color: DARK,
          border: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {open ? <X size={26} /> : <MessageCircle size={28} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              bottom: 96,
              right: 24,
              zIndex: 9999,
              width: "min(380px, calc(100vw - 32px))",
              height: "min(560px, calc(100vh - 140px))",
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ background: DARK, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: GREEN, color: DARK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                ECO
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>ECO · EcoViva</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {isEN ? "Online" : "En línea"}
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, background: "#f6f8f5", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    background: m.role === "user" ? GREEN : "#fff",
                    color: m.role === "user" ? DARK : "#1a1a1a",
                    border: m.role === "user" ? "none" : "1px solid #e5e9e3",
                  }}
                >
                  {m.text}
                  {m.attachments?.map((url, j) => (
                    <a
                      key={j}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "#f0f6ee",
                        border: "1px solid #d7e6d2",
                        color: DARK,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      📄 {isEN ? "Project brochure (PDF)" : "Folleto del proyecto (PDF)"}
                    </a>
                  ))}
                </div>
              ))}
              {loading && (
                <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 14, background: "#fff", border: "1px solid #e5e9e3", color: "#888", fontSize: 14 }}>
                  …
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #eee", background: "#fff" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={isEN ? "Type a message…" : "Escribí un mensaje…"}
                style={{ flex: 1, border: "1px solid #ddd", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none" }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                style={{ width: 42, height: 42, borderRadius: 12, background: GREEN, color: DARK, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}
              >
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
