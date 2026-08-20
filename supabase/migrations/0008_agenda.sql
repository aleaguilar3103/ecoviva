-- Agenda privada de Alina y Alejandro. Aislada de GHL a propósito: el otro
-- equipo de ventas trabaja allá y no debe ver estas citas.

-- ── Permiso y vínculos personales, sobre app_users ──
alter table public.app_users
  add column if not exists agenda                 boolean not null default false,
  add column if not exists telegram_chat_id       text unique,
  add column if not exists telegram_codigo        text,
  add column if not exists telegram_codigo_expira timestamptz,
  add column if not exists feed_token             uuid;

-- Default-deny: un admin nuevo NO hereda la agenda. Se prende a mano.
update public.app_users set agenda = true
where email in ('alinaramirezgamboa@gmail.com', 'aguilartradesfx@gmail.com');

-- ── Citas ──
create table if not exists public.citas (
  id               uuid primary key default gen_random_uuid(),

  cliente_nombre   text not null,
  cliente_email    text not null,
  cliente_telefono text,

  inicio           timestamptz not null,
  duracion_min     integer not null default 60,
  lugar            text not null,
  lote_id          uuid references public.lots(id) on delete set null,
  notas            text,
  estado           text not null default 'agendada'
                     check (estado in ('agendada','cancelada','completada')),

  -- UID estable de por vida + secuencia creciente: es lo que hace que reagendar
  -- MUEVA el evento en el calendario del cliente en vez de dejarle dos citas.
  ics_uid          text not null unique,
  ics_secuencia    integer not null default 0,

  -- Ids de los correos programados en Resend. Nulo = pendiente de programar,
  -- que es justo lo que busca el reconciliador del cron.
  recordatorio_24h_email_id text,
  recordatorio_1h_email_id  text,

  creada_por       text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists citas_inicio_activas
  on public.citas (inicio) where estado = 'agendada';

drop trigger if exists citas_set_updated_at on public.citas;
create trigger citas_set_updated_at before update on public.citas
  for each row execute function public.set_updated_at();

-- ── Bitácora ──
-- Dos personas escriben en la misma agenda desde dos interfaces: sin registro,
-- "yo no moví eso" no tiene respuesta.
create table if not exists public.citas_log (
  id         bigserial primary key,
  cita_id    uuid not null references public.citas(id) on delete cascade,
  accion     text not null check (accion in ('creada','movida','editada','cancelada')),
  detalle    jsonb,
  actor      text not null,
  origen     text not null check (origen in ('panel','telegram','cron')),
  created_at timestamptz not null default now()
);

create index if not exists citas_log_cita on public.citas_log (cita_id, created_at desc);

-- ── Acciones pendientes de confirmar en Telegram ──
-- Existe porque callback_data de Telegram tope en 64 bytes y la acción no cabe.
create table if not exists public.agenda_acciones_pendientes (
  id         uuid primary key default gen_random_uuid(),
  chat_id    text not null,
  accion     jsonb not null,
  expira_at  timestamptz not null,
  created_at timestamptz not null default now()
);

-- ── Control de ejecución del cron ──
-- Evita que el resumen diario salga dos veces si el cron se repite.
create table if not exists public.agenda_jobs (
  fecha              date primary key,
  resumen_enviado_at timestamptz
);

-- Sin políticas, igual que app_users y bot_config: solo service_role las toca.
alter table public.citas                       enable row level security;
alter table public.citas_log                   enable row level security;
alter table public.agenda_acciones_pendientes  enable row level security;
alter table public.agenda_jobs                 enable row level security;
