-- Telegram reintenta un update si el webhook no contesta rápido. Contestamos
-- 200 de inmediato y procesamos aparte, así que el reintento es raro — pero un
-- update procesado dos veces podría agendar la misma cita dos veces, y eso sí
-- importa.
create table if not exists public.telegram_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;
