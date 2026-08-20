import { useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import LotsManager from "./LotsManager";
import BotPromptManager from "./BotPromptManager";
import BotTester from "./BotTester";
import UsersManager from "./UsersManager";
import AgendaManager from "./agenda/AgendaManager";
import BrandMark from "./BrandMark";

type Tab = "lotes" | "bot" | "probar" | "usuarios" | "agenda";

export default function AdminDashboard({
  session,
  tieneAgenda,
}: {
  session: Session;
  tieneAgenda: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // La sección vive en la URL, no en useState. Antes era estado en memoria, y
  // el teléfono descarta la pestaña cuando uno sale del navegador: al volver,
  // React arrancaba de cero y siempre caía en Lotes, sin importar dónde
  // estuvieras. Con la sección en la dirección, recargar deja a la persona
  // donde estaba, el botón "atrás" funciona, y se puede guardar /admin/agenda
  // como acceso directo en la pantalla de inicio.
  const actual = (location.pathname.split("/")[2] ?? "") as Tab | "";

  // La pestaña se esconde para quien no tiene la bandera, pero eso es comodidad
  // visual, no seguridad: la API revalida el permiso en el servidor.
  const tabs: { id: Tab; label: string }[] = [
    { id: "lotes", label: "Lotes" },
    ...(tieneAgenda ? [{ id: "agenda" as Tab, label: "Agenda" }] : []),
    { id: "bot", label: "Bot & Prompt" },
    { id: "probar", label: "Probar bot" },
    { id: "usuarios", label: "Usuarios" },
  ];

  const email = session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";
  const etiquetaActual = tabs.find((t) => t.id === actual)?.label ?? "Panel";

  function ir(id: Tab) {
    navigate(`/admin/${id}`);
    setMenuAbierto(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* En el teléfono el hamburguesa reemplaza la grilla de cinco
                botones que antes se comía el alto de la pantalla. */}
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <BrandMark className="hidden h-9 w-9 shrink-0 sm:block" />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-semibold text-slate-900">
                <span className="sm:hidden">{etiquetaActual}</span>
                <span className="hidden sm:inline">EcoViva</span>
              </span>
              <span className="hidden text-[11px] text-slate-400 sm:block">
                Panel de administración
              </span>
            </div>
          </div>

          <nav className="hidden gap-1 rounded-xl bg-slate-100 p-1 sm:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => ir(t.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  actual === t.id
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                {initial}
              </span>
              <span className="max-w-[12rem] truncate text-xs text-slate-500">{email}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:block"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Menú lateral del teléfono */}
      <Dialog.Root open={menuAbierto} onOpenChange={setMenuAbierto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm sm:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[78vw] max-w-xs flex-col bg-white shadow-2xl focus:outline-none sm:hidden">
            <Dialog.Title className="sr-only">Menú</Dialog.Title>
            <Dialog.Description className="sr-only">
              Secciones del panel de administración
            </Dialog.Description>

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <BrandMark className="h-8 w-8" />
                <span className="font-semibold text-slate-900">EcoViva</span>
              </div>
              <Dialog.Close
                aria-label="Cerrar menú"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => ir(t.id)}
                  className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    actual === t.id
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 px-1 pb-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                  {initial}
                </span>
                <span className="truncate text-xs text-slate-500">{email}</span>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="lotes" element={<LotsManager />} />
          <Route
            path="agenda"
            element={tieneAgenda ? <AgendaManager /> : <Navigate to="/admin/lotes" replace />}
          />
          <Route path="bot" element={<BotPromptManager />} />
          <Route path="probar" element={<BotTester />} />
          <Route path="usuarios" element={<UsersManager currentUserId={session.user.id} />} />
          <Route path="*" element={<Navigate to="/admin/lotes" replace />} />
        </Routes>
      </main>
    </div>
  );
}
