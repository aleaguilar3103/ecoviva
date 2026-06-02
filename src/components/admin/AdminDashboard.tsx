import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import LotsManager from "./LotsManager";
import BotPromptManager from "./BotPromptManager";

type Tab = "lotes" | "bot";

export default function AdminDashboard({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("lotes");

  const tabs: { id: Tab; label: string }[] = [
    { id: "lotes", label: "Lotes" },
    { id: "bot", label: "Bot & Prompt" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">EcoViva · Panel</span>
            <nav className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    tab === t.id
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-500">{session.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "lotes" ? <LotsManager /> : <BotPromptManager />}
      </main>
    </div>
  );
}
