import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import LotsManager from "./LotsManager";
import BotPromptManager from "./BotPromptManager";
import BrandMark from "./BrandMark";

type Tab = "lotes" | "bot";

export default function AdminDashboard({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("lotes");

  const tabs: { id: Tab; label: string }[] = [
    { id: "lotes", label: "Lotes" },
    { id: "bot", label: "Bot & Prompt" },
  ];

  const email = session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div className="leading-tight">
              <span className="block font-semibold text-slate-900">EcoViva</span>
              <span className="block text-[11px] text-slate-400">Panel de administración</span>
            </div>
          </div>

          <nav className="hidden sm:flex gap-1 rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                {initial}
              </span>
              <span className="text-xs text-slate-500 max-w-[12rem] truncate">{email}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs móviles */}
        <nav className="sm:hidden flex gap-1 px-4 pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                tab === t.id ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "lotes" ? <LotsManager /> : <BotPromptManager />}
      </main>
    </div>
  );
}
