-- ECO agent — Fase 1: esquema base
-- Proyecto Supabase: hujuifwfknlpdqgvogkf
-- Tablas: lots (fuente de verdad de disponibilidad), conversations, messages, survey_submissions

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- LOTS — fuente de verdad única (web pública + ECO + panel admin)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.lots (
  id              uuid primary key default gen_random_uuid(),
  project         text not null check (project in ('rio_celeste','llanada')),
  section         text not null default 'general'
                    check (section in ('general','bloque_1','frente_a_calle')),
  lot_number      integer not null,
  size_m2         numeric(10,2) not null,
  price_per_m2    numeric(12,2) not null,
  currency        text not null check (currency in ('USD','CRC')),
  price_total     numeric(14,2) generated always as (round(size_m2 * price_per_m2)) stored,
  status          text not null default 'available'
                    check (status in ('available','reserved','sold','not_available')),
  has_view        boolean,
  requires_prima  boolean not null default false,
  prima_pct       numeric(5,2) not null default 0,
  plano_visado_url text,
  notes           text,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (project, lot_number)
);

create index if not exists lots_project_status_idx on public.lots (project, status);

-- ─────────────────────────────────────────────────────────────
-- CONVERSATIONS — una por contacto/canal
-- ─────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null check (channel in ('web','whatsapp')),
  ghl_contact_id   text,
  ghl_conversation_id text,
  external_id      text,                 -- id de sesión del widget web
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  locale           text,                 -- 'es' | 'en'
  proyecto_interes text,
  calificado       boolean not null default false,
  memory           jsonb not null default '{}'::jsonb,  -- memoria estructurada del lead
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists conversations_ghl_contact_idx on public.conversations (ghl_contact_id);
create index if not exists conversations_external_idx on public.conversations (external_id);

-- ─────────────────────────────────────────────────────────────
-- MESSAGES — historial de la conversación
-- ─────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant','tool')),
  content          text,
  tool_calls       jsonb,   -- tool_use blocks emitidos por el asistente
  tool_results     jsonb,   -- resultados de tools
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- SURVEY_SUBMISSIONS — formulario propio de financiamiento
-- ─────────────────────────────────────────────────────────────
create table if not exists public.survey_submissions (
  id               uuid primary key default gen_random_uuid(),
  ghl_contact_id   text,
  conversation_id  uuid references public.conversations(id) on delete set null,
  tipo_id          text,
  numero_id        text,
  nombre           text,
  apellidos        text,
  telefono         text,
  correo           text,
  consentimiento_ley8968 boolean not null default false,
  datos_estudio    jsonb not null default '{}'::jsonb,  -- vivienda, deudas, etc.
  archivos         jsonb not null default '[]'::jsonb,  -- rutas en Storage
  autoriza_sugef   boolean,
  status           text not null default 'recibido'
                    check (status in ('recibido','enviado_sugef','aprobado','rechazado')),
  created_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.lots enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.survey_submissions enable row level security;

-- lots: lectura pública (web + ECO); escritura solo service_role (bypassa RLS)
drop policy if exists "lots_public_read" on public.lots;
create policy "lots_public_read" on public.lots
  for select using (true);

-- El resto de tablas: sin políticas públicas. Solo el backend (service_role) las toca.

-- trigger updated_at en lots
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists lots_set_updated_at on public.lots;
create trigger lots_set_updated_at before update on public.lots
  for each row execute function public.set_updated_at();
