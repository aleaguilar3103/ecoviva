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
  // Se incrementa para volver a disparar el efecto de abajo sin duplicar la
  // lógica de consulta: "Reintentar" solo necesita cambiar esta dependencia
  // (mismo patrón que AdminApp.tsx).
  const [intento, setIntento] = useState(0);

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
    // También borra el HTML de un intento anterior: si no, un cuerpo vacío del
    // reintento se confundiría con el spinner de carga (ver chequeo de abajo).
    setHtml(null);
    getGuiaHtml()
      .then((h) => {
        if (!vivo) return;
        // Un 200 con cuerpo vacío no es "todavía cargando": es un fallo del
        // backend que hay que mostrar, no un spinner infinito.
        if (h) setHtml(h);
        else setError("La guía llegó vacía. Probá de nuevo.");
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudo cargar la guía."));
    return () => {
      vivo = false;
    };
  }, [session, intento]);

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

  if (!html) return spinner;

  // El iframe aísla el CSS de la guía del de Tailwind.
  // Se omite allow-same-origin a propósito: junto con allow-scripts, el documento
  // enmarcado podría leer el localStorage de este origen y con él el token de
  // sesión. Por eso el srcDoc es de origen opaco, y un origen opaco nunca es un
  // contexto seguro: navigator.clipboard queda undefined siempre ahí, no a
  // veces. No se declara allow="clipboard-write" porque no habría nada que
  // habilitar. El botón "Copiar" de la guía corre siempre por su respaldo con
  // document.execCommand — no es un camino de excepción, es el único camino.
  return (
    <iframe
      title="Guía de venta · Lomas de la Llanada"
      srcDoc={html}
      sandbox="allow-scripts allow-popups"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
