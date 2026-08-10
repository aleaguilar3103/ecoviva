import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient";
import { getGuiaHtml } from "../../lib/adminApi";
import LoginCard from "../auth/LoginCard";

// Ruta /guia-vendedores. No aparece en ningún menú: el enlace se comparte a mano.
// El HTML llega de /api/guia-vendedores, que valida el JWT — nunca se publica
// como archivo estático.
export default function GuiaVendedores() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setCargandoSesion(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHtml(null);
      return;
    }
    let vivo = true;
    setError(null);
    getGuiaHtml()
      .then((h) => vivo && setHtml(h))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudo cargar la guía."));
    return () => {
      vivo = false;
    };
  }, [session]);

  const spinner = (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
    </div>
  );

  if (cargandoSesion) return spinner;

  if (!session) {
    return <LoginCard title="Guía de venta" subtitle="Iniciá sesión para verla" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">No pudimos abrir la guía</h1>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  if (!html) return spinner;

  // El iframe aísla el CSS de la guía del de Tailwind.
  // Se omite allow-same-origin a propósito: junto con allow-scripts, el documento
  // enmarcado podría leer el localStorage de este origen y con él el token de
  // sesión. El botón "Copiar" de la guía tiene su propio respaldo con
  // document.execCommand si la API de portapapeles queda bloqueada.
  return (
    <iframe
      title="Guía de venta · Lomas de la Llanada"
      srcDoc={html}
      sandbox="allow-scripts allow-popups"
      allow="clipboard-write"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
