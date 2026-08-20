-- Historial reciente de la conversación de cada chat con el agente del bot
-- de Telegram. Existe porque cada mensaje llega en una invocación NUEVA del
-- webhook, en otro proceso: sin guardarlo en algún lado, el agente no
-- entendería un "sí, ese" o un "cambialo a las 11" que depende de lo que se
-- dijo un momento antes. Quien llama (el webhook) carga los de la última
-- hora, con un tope, y los pasa como `historial` a correrAgente.
create table if not exists public.agenda_mensajes (
  id         bigserial primary key,
  chat_id    text not null,
  rol        text not null check (rol in ('usuario','agente')),
  contenido  text not null,
  created_at timestamptz not null default now()
);

-- La consulta siempre es "los últimos N mensajes de este chat_id": el índice
-- calza exacto con eso.
create index if not exists agenda_mensajes_chat_id_created_at
  on public.agenda_mensajes (chat_id, created_at desc);

-- Sin políticas, igual que citas y app_users: solo service_role la toca.
alter table public.agenda_mensajes enable row level security;
