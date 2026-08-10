-- app_users: quién puede entrar y con qué rol.
-- Sustituye la lista BASE_ADMINS/ADMIN_EMAILS quemada en api/_lib/supabase.ts,
-- que obligaba a un deploy por cada persona nueva.

create table if not exists public.app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       text not null default 'vendedor' check (role in ('admin','vendedor')),
  status     text not null default 'active'  check (status in ('active','disabled')),
  invited_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No existe un estado 'invited': "pendiente de activar" se deriva de
-- auth.users.last_sign_in_at al listar. Guardarlo aquí crearía una segunda
-- fuente de verdad que se puede desincronizar. status es solo control de acceso.

-- El correo se compara en minúsculas en todo el backend; se normaliza en la
-- base para que ninguna ruta de escritura pueda saltarse la regla.
create or replace function public.app_users_normalize_email()
returns trigger language plpgsql as $$
begin
  new.email = lower(trim(new.email));
  return new;
end $$;

drop trigger if exists app_users_normalize_email on public.app_users;
create trigger app_users_normalize_email before insert or update on public.app_users
  for each row execute function public.app_users_normalize_email();

-- Reutiliza la función public.set_updated_at que define la migración 0001.
drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at before update on public.app_users
  for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
-- Sin políticas: solo service_role la toca, igual que public.bot_config.

-- Backfill: quien ya podía entrar sigue pudiendo, ahora desde la tabla.
insert into public.app_users (user_id, email, role, status, invited_by)
select id, lower(email), 'admin', 'active', 'migracion_0007'
from auth.users
where email is not null
on conflict (user_id) do nothing;
