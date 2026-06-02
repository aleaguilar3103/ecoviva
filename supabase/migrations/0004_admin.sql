-- ECO agent — Fase 5: panel admin
-- bot_config: fila única (id=1) con el interruptor on/off del bot y el system prompt editable.
-- El system_prompt se carga en runtime; si está NULL, el agente usa el SYSTEM_PROMPT del código.

create table if not exists public.bot_config (
  id            smallint primary key default 1 check (id = 1),
  bot_enabled   boolean not null default true,
  system_prompt text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

-- Fila única garantizada
insert into public.bot_config (id, bot_enabled, system_prompt)
values (1, true, null)
on conflict (id) do nothing;

-- RLS: nadie público. Solo el backend (service_role) lo lee/escribe.
alter table public.bot_config enable row level security;
-- (sin políticas: service_role bypassa RLS; el anon no puede tocar la tabla)

-- trigger updated_at (reusa la función public.set_updated_at de 0001)
drop trigger if exists bot_config_set_updated_at on public.bot_config;
create trigger bot_config_set_updated_at before update on public.bot_config
  for each row execute function public.set_updated_at();
