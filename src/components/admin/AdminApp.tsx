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
  //
  // "error" es distinto de "denegado": un 500 pasajero o un corte de red no
  // significa que la cuenta no tenga permiso, solo que no se pudo comprobrar.
  // Confundirlos deja a un admin real varado en la pantalla de "sin acceso"
  // sin más salida que cerrar sesión.
  const [acceso, setAcceso] = useState<"cargando" | "admin" | "denegado" | "error">("cargando");
  // Bandera de la agenda privada: viaja en la misma respuesta de getMe(), así
  // que no amerita una segunda llamada. Por defecto false hasta que se resuelva.
  const [tieneAgenda, setTieneAgenda] = useState(false);
  // Se incrementa para volver a disparar el efecto de abajo sin duplicar la
  // lógica de consulta: "Reintentar" solo necesita cambiar esta dependencia.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!session) {
      setAcceso("cargando");
      return;
    }
    let vivo = true;
    setAcceso("cargando");
    getMe()
      .then((yo) => {
        if (!vivo) return;
        setTieneAgenda(yo.agenda === true);
        setAcceso(yo.role === "admin" ? "admin" : "denegado");
      })
      .catch((e) => {
        console.error("AdminApp: no se pudo verificar el rol", e);
        if (vivo) setAcceso("error");
      });
    return () => {
      vivo = false;
    };
  }, [session, intento]);

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

  if (acceso === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            No pudimos verificar tu acceso
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Puede ser un problema pasajero de conexión. Probá de nuevo.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setIntento((n) => n + 1)}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Reintentar
            </button>
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

  return <AdminDashboard session={session} tieneAgenda={tieneAgenda} />;
}
