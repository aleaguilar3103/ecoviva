-- Calendario de contenido de redes (panel → Redes) y publicación automática en Instagram.
--
-- Cada fila es un carrusel programado. El endpoint /api/cron/redes (llamado cada
-- 15 minutos por pg_cron, más abajo) publica lo que está "programado" y cuya hora
-- ya llegó. Las imágenes viven en el bucket público "redes": Instagram las baja
-- por URL y exige JPEG.
--
-- Estados:
--   programado → sale solo a su hora
--   pausado    → no sale hasta que alguien lo reanude desde el panel
--   publicando → una corrida lo tomó (bloqueo para no publicar dos veces)
--   publicado  → ya está en Instagram (ig_media_id / ig_permalink)
--   error      → falló 3 veces; queda el mensaje en `error`
--
-- Contra duplicados: el contenedor de Instagram (ig_creation_id) se guarda ANTES
-- de media_publish. Si una corrida se corta, la siguiente revisa ese contenedor:
-- si ya salió solo se marca, si está listo se publica ese mismo.

create table if not exists public.redes_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  titulo          text not null,
  proyecto        text not null default 'rio_celeste' check (proyecto in ('rio_celeste','llanada','ecoviva')),
  plataformas     text[] not null default '{instagram}',
  caption         text not null default '',
  imagenes        text[] not null default '{}',
  programado_para timestamptz not null,
  estado          text not null default 'programado'
                  check (estado in ('programado','pausado','publicando','publicado','error')),
  intentos        int not null default 0,
  error           text,
  ig_creation_id  text,
  ig_media_id     text,
  ig_permalink    text,
  publicado_en    timestamptz,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists redes_posts_cola on public.redes_posts (estado, programado_para);

drop trigger if exists redes_posts_set_updated_at on public.redes_posts;
create trigger redes_posts_set_updated_at before update on public.redes_posts
  for each row execute function public.set_updated_at();

alter table public.redes_posts enable row level security;
-- Sin políticas: solo service_role (las funciones de /api) la toca.

-- Bucket público para las láminas (JPEG). Idempotente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('redes', 'redes', true, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

-- Disparador cada 15 minutos. Vercel Hobby solo permite crons diarios con ±59 min
-- de imprecisión, así que el reloj vive en la base. El secreto NO va en este
-- archivo: se guarda una vez en Vault con
--   select vault.create_secret('<CRON_SECRET>', 'redes_cron_secret');
-- y el job lo lee en cada corrida.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('redes-publicar')
where exists (select 1 from cron.job where jobname = 'redes-publicar');

select cron.schedule(
  'redes-publicar',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://www.ecovivadesarrollos.com/api/cron/redes',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'redes_cron_secret' limit 1)
    ),
    timeout_milliseconds := 60000
  );
  $$
);
