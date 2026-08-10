import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getMe } from "../../lib/adminApi";
import BrandMark from "../admin/BrandMark";

const MINIMO = 10;

type Estado = "cargando" | "sin-enlace" | "listo" | "guardando";

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
      setEstado((e) => (e === "cargando" ? "listo" : e));
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
    const { error: errorGuardado } = await supabase.auth.updateUser({ password: p1 });
    if (errorGuardado) {
      setEstado("listo");
      setError(errorGuardado.message);
      return;
    }

    // Ya está autenticada. A dónde va depende del rol, que no viaja en el JWT.
    try {
      const yo = await getMe();
      navigate(yo.role === "admin" ? "/admin" : "/guia-vendedores", { replace: true });
    } catch {
      navigate("/guia-vendedores", { replace: true });
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
