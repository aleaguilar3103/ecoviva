import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getMe } from "../../lib/adminApi";
import BrandMark from "../admin/BrandMark";

const MINIMO = 10;

// "listo-sin-destino": la contraseña ya se guardó (con sesión abierta), pero
// no pudimos resolver el rol para decidir a dónde mandar a la persona.
type Estado = "cargando" | "sin-enlace" | "listo" | "guardando" | "listo-sin-destino";

// Supabase devuelve el error de auth en inglés y con redacción interna de la
// librería (ej. "New password should be different from the old password" o
// "Auth session missing!"). No expone códigos estables para estos casos, así que
// se detecta por contenido del mensaje, en minúsculas, y se traduce a español.
// Cualquier otro caso cae en un mensaje genérico — nunca mostramos el original.
function traducirErrorGuardado(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("different from the old password")) {
    return "Esa es tu contraseña actual. Elegí una distinta.";
  }
  if (m.includes("session missing") || m.includes("session expired") || m.includes("session not found")) {
    return "Se venció el enlace mientras llenabas el formulario. Pedí uno nuevo.";
  }
  return "No pudimos guardar la contraseña. Probá de nuevo.";
}

// Ruta /crear-contrasena. La usan dos flujos con el mismo mecanismo: la
// invitación a un usuario nuevo y el "olvidé mi contraseña".
//
// supabase-js tiene detectSessionInUrl activo, así que el token que viene en el
// hash del enlace ya abre sesión al montar la página. Por eso al terminar la
// persona queda logueada sin escribir la contraseña otra vez.
export default function CreatePasswordPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [correoReenvio, setCorreoReenvio] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    // Margen antes de declarar muerto el enlace: procesar el hash es asíncrono y
    // getSession() puede resolver antes de que termine.
    const reloj = setTimeout(() => {
      if (vivo) setEstado((e) => (e === "cargando" ? "sin-enlace" : e));
    }, 3000);

    const marcarListo = () => {
      clearTimeout(reloj);
      // Corrige también "sin-enlace": si el temporizador ganó la carrera (dispositivo
      // lento, latencia alta), la sesión puede confirmarse después y no queremos dejar
      // a la persona mirando un "el enlace venció" que es mentira. Lo único que no se
      // pisa es "guardando" (envío en curso) y "listo-sin-destino" (la contraseña ya
      // se guardó; un evento de auth tardío no debe borrar esa pantalla de éxito).
      setEstado((e) => (e === "guardando" || e === "listo-sin-destino" ? e : "listo"));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo && sesion) marcarListo();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (vivo && data.session) marcarListo();
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (p1.length < MINIMO) {
      setError(`La contraseña necesita al menos ${MINIMO} caracteres.`);
      return;
    }
    if (p1 !== p2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setEstado("guardando");
    try {
      const { error: errorGuardado } = await supabase.auth.updateUser({ password: p1 });
      if (errorGuardado) {
        setEstado("listo");
        setError(traducirErrorGuardado(errorGuardado.message));
        return;
      }
    } catch {
      // Blindaje: si updateUser revienta con una excepción en vez de devolver
      // { error }, igual hay que sacar a la persona de "guardando" — si no, el
      // botón queda trabado en "Guardando…" para siempre.
      setEstado("listo");
      setError("No pudimos guardar la contraseña. Probá de nuevo.");
      return;
    }

    // Ya está autenticada y la contraseña YA quedó guardada — eso es irreversible
    // desde acá. A dónde va depende del rol, que no viaja en el JWT. Si getMe falla
    // no adivinamos destino (podría mandar a un admin a la guía sin aviso): mostramos
    // una pantalla de éxito explícita con las dos rutas posibles.
    try {
      const yo = await getMe();
      navigate(yo.role === "admin" ? "/admin" : "/guia-vendedores", { replace: true });
    } catch (err) {
      console.error("Contraseña guardada, pero /api/me falló al resolver el rol", err);
      setEstado("listo-sin-destino");
    }
  }

  async function onPedirOtro() {
    const correo = correoReenvio.trim();
    if (!correo) {
      setError("Escribí tu correo.");
      return;
    }
    setError(null);
    const { error: errorEnvio } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/crear-contrasena`,
    });
    setAviso(
      errorEnvio
        ? "No se pudo enviar el correo. Probá de nuevo en un minuto."
        : "Si esa cuenta existe, te llegó un enlace nuevo.",
    );
  }

  const marco = (contenido: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">EcoViva</h1>
          <p className="text-sm text-slate-500">Creá tu contraseña</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg shadow-emerald-900/5 ring-1 ring-slate-200/80 p-7">
          {contenido}
        </div>
      </div>
    </div>
  );

  if (estado === "cargando") {
    return marco(
      <div className="flex justify-center py-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>,
    );
  }

  if (estado === "sin-enlace") {
    return marco(
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Este enlace venció o ya se usó. Pedí uno nuevo con tu correo.
        </p>
        <input
          type="email"
          autoComplete="email"
          value={correoReenvio}
          onChange={(e) => setCorreoReenvio(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {aviso && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>
        )}
        <button
          type="button"
          onClick={onPedirOtro}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          Enviarme un enlace nuevo
        </button>
      </div>,
    );
  }

  if (estado === "listo-sin-destino") {
    return marco(
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-600">
          Guardamos tu contraseña y ya tenés la sesión abierta. No pudimos saber a dónde
          mandarte — elegí una opción:
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin", { replace: true })}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            Ir al panel
          </button>
          <button
            type="button"
            onClick={() => navigate("/guia-vendedores", { replace: true })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver la guía
          </button>
        </div>
      </div>,
    );
  }

  return marco(
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <p className="mt-1.5 text-xs text-slate-400">Mínimo {MINIMO} caracteres.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Repetila</label>
        <input
          type="password"
          autoComplete="new-password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={estado === "guardando"}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {estado === "guardando" ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>,
  );
}
