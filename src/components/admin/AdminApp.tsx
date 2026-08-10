import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient";
import { getMe } from "../../lib/adminApi";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Tener sesión ya no equivale a poder ver el panel: un vendedor se autentica
  // igual pero no entra acá. El rol no viaja en el JWT, hay que preguntarlo.
  const [acceso, setAcceso] = useState<"cargando" | "admin" | "denegado">("cargando");

  useEffect(() => {
    if (!session) {
      setAcceso("cargando");
      return;
    }
    let vivo = true;
    getMe()
      .then((yo) => vivo && setAcceso(yo.role === "admin" ? "admin" : "denegado"))
      .catch(() => vivo && setAcceso("denegado"));
    return () => {
      vivo = false;
    };
  }, [session]);

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center text-slate-700">
          <h1 className="text-xl font-semibold mb-2">Panel no configurado</h1>
          <p className="text-sm">
            Faltan las variables <code>VITE_SUPABASE_URL</code> y{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> en el entorno de build.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (acceso === "cargando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (acceso === "denegado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Tu cuenta no tiene acceso al panel
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Si buscabas la guía de venta, está acá.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="/guia-vendedores"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Ir a la guía
            </a>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard session={session} />;
}
