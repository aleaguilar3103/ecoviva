-- Captura cruda de webhooks entrantes (para inspeccionar qué manda GHL: texto, imágenes, audio, canal)
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  source      text not null default 'ghl',
  headers     jsonb,
  query       jsonb,
  body        jsonb
);

create index if not exists webhook_events_received_idx on public.webhook_events (received_at desc);

alter table public.webhook_events enable row level security;
-- Sin políticas públicas: solo el backend (service_role) escribe/lee.
