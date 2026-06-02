import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para el navegador (solo se usa en el panel admin para login).
// Usa la anon key (pública por diseño). RLS protege los datos; las escrituras
// sensibles pasan por /api con verificación de admin (JWT).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "ecoviva-admin-auth",
  },
});

export const supabaseConfigured = Boolean(url && anonKey);
