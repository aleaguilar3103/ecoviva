import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import BrandMark from "../admin/BrandMark";

interface Props {
  title?: string;
  subtitle?: string;
}

export default function LoginCard({
  title = "EcoViva",
  subtitle = "Panel de administración",
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setError("Correo o contraseña incorrectos.");
    } finally {
      // finally, no solo tras el await: si algo lanza una excepción inesperada,
      // igual queremos que los botones se vuelvan a habilitar.
      setLoading(false);
    }
  }

  async function onRecuperar() {
    const correo = email.trim();
    // Limpiamos ambos avisos al entrar, no solo el que vamos a usar: si quedó el
    // aviso verde de un pedido anterior y ahora el correo está vacío, no puede
    // convivir con el error rojo nuevo.
    setError(null);
    setAviso(null);
    if (!correo) {
      setError("Escribí tu correo primero.");
      return;
    }
    setLoading(true);
    try {
      // El origen sale de window.location (el dominio que sirvió la página), no de
      // un valor fijo: en el navegador nadie puede falsificarlo para la sesión de
      // otra persona, a diferencia del header Origin en una petición de servidor
      // (por eso api/admin/users.ts sí evita derivar el destino de ahí). Fijar el
      // dominio de producción a mano rompería "olvidé mi contraseña" en local y en
      // los previews de Vercel. El control real es la lista de redirects permitidos
      // de Supabase, que ya incluye producción, www, localhost:5173 y ecoviva-*.vercel.app.
      const { error } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/crear-contrasena`,
      });
      // El mensaje no distingue si la cuenta existe: eso revelaría quién tiene acceso.
      setAviso(
        error
          ? "No se pudo enviar el correo. Probá de nuevo en un minuto."
          : "Si esa cuenta existe, te llegó un correo para crear tu contraseña.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-lg shadow-emerald-900/5 ring-1 ring-slate-200/80 p-7"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            {aviso && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={onRecuperar}
              disabled={loading}
              className="w-full text-center text-xs text-slate-500 underline underline-offset-2 transition hover:text-emerald-700 disabled:opacity-60"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          EcoViva Desarrollos · acceso restringido
        </p>
      </div>
    </div>
  );
}
