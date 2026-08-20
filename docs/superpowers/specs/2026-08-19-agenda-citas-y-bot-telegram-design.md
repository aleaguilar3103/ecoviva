# Agenda de citas privada y bot de Telegram

Fecha: 2026-08-19
Estado: aprobado, listo para plan de implementación

## Problema

EcoViva tiene dos equipos de ventas. Uno trabaja dentro de GoHighLevel. Alina y
Alejandro llevan el otro y necesitan manejar sus citas **desde el panel de
EcoViva**, sin que el equipo de GHL las vea.

Lo que ya existe agenda contra GHL y por eso no sirve para este caso:

- `api/slots.ts` lee la disponibilidad real del calendario de GHL.
- `api/reserve.ts` agenda la cita real ahí.
- ECO tiene `consultar_horarios_disponibles` y `agendar_visita` en
  `api/_lib/eco/tools.ts`, ambas contra GHL.

Ese camino se queda como está: es del otro equipo. Lo que falta construir, y no
existe hoy en ninguna forma:

- Correo de confirmación con invitación de calendario (`.ics`).
- Recordatorios automáticos al cliente.
- Editar y cancelar citas, con aviso al cliente.
- Un canal de Telegram para operar la agenda desde el teléfono.
- Una agenda que solo vean dos personas.

## Alcance

Dentro:

- Tabla de citas propia en Supabase, sin ninguna relación con GHL.
- Agenda **compartida** entre Alina y Alejandro (las citas no tienen dueño).
- Pestaña «Agenda» en `/admin`, visible solo para quien tenga el permiso.
- Correos al cliente: confirmación, reagendado, cancelación, recordatorio a 24h
  y recordatorio a 1h. Todos con la invitación de calendario correspondiente.
- Feed `.ics` de suscripción, con token secreto, para ver la agenda en el celular.
- Resumen diario por Telegram a ambos.
- Aviso instantáneo por Telegram cuando la otra persona toca la agenda.
- Bot de Telegram con lenguaje natural y confirmación por botones, restringido a
  las mismas dos personas.

Fuera, y a propósito. Nada de esto salió de las respuestas del usuario:

- Link público de reserva tipo Calendly. Solo Alina y Alejandro agendan.
- Agenda por persona. Se decidió una sola agenda compartida.
- Duración variable por cita. Duración fija.
- Cualquier integración con GHL, en cualquier dirección.
- Link para que el cliente confirme o cancele por su cuenta.
- Bloqueo duro de horarios encimados. Se avisa, no se impide.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Dónde viven las citas | Tablas propias en Supabase | Único aislamiento real del equipo que usa GHL. Indicación directa del usuario. |
| Quién agenda | Solo Alina y Alejandro | Indicación directa. Sin link público no hay carrera por el mismo horario ni superficie expuesta. |
| Dueño de la cita | Ninguno, agenda compartida | Indicación directa. Simplifica el modelo y los avisos. |
| Cómo se otorga el permiso | Columna `agenda` en `app_users` | La migración 0007 existió para sacar la lista de correos del código. Repetir el hardcode sería desandar eso. |
| Motor de recordatorios | Envíos programados de Resend | Entrega al minuto y **funciona igual en Vercel Hobby o Pro**. Un cron barredor exigiría Pro. |
| Precisión del cron | Irrelevante por diseño | El cron solo manda el resumen y reconcilia. Lo que llega al cliente no depende de él. |
| Ver la agenda en el celular | Feed `.ics` de suscripción | Da el 90% del beneficio de integrar Google Calendar sin OAuth ni refresh tokens. |
| Motor del bot | Agente nuevo, no ECO | El prompt de ECO es de ventas y sus herramientas escriben en GHL. Reusarlo arriesga agendar en el calendario del otro equipo. |
| Escrituras desde el bot | Siempre con confirmación por botón | Un correo al cliente es irreversible. Ninguna escritura pasa sin que un humano la vea escrita. |
| Choque de horarios | Se avisa, no se bloquea | Con agenda compartida entre dos personas, bloquear crea más fricción que la que evita. |

## Verificaciones hechas antes de decidir

Todas contra los servicios reales, el 2026-08-19:

- **Resend programa envíos.** `scheduled_at` acepta ISO 8601, hasta 30 días de
  anticipación. `PATCH /emails/{id}` reprograma y `POST /emails/{id}/cancel`
  cancela. Un correo cancelado no se puede reprogramar: hay que crear otro.
- **Vercel Cron por plan.** Hobby: una vez al día, con precisión de ±59 minutos;
  una expresión más frecuente **falla el deploy**. Pro: cada minuto.
- **Plan del proyecto: sin confirmar.** La cuenta personal es Hobby. El proyecto
  `ecoviva` pertenece al team `team_9ygjQBdd3GBiIqmnzSy0DMST`, que el token
  `VERCEL_API_KEY_ECOVIVA_PROJECT` no puede leer (403). Por eso el diseño no
  depende del plan.
- **Dominio de correo verificado y en producción.** Resend ya entrega como
  `EcoViva Desarrollos <noreply@send.bralto.io>`, usado hoy como SMTP de Supabase
  para las invitaciones (`scripts/apply-auth-config.mjs`).
- **La llave de Resend es de envío solamente.** No permite ni listar dominios.
  Enviar sí puede; si `PATCH` y `cancel` resultan bloqueados, hace falta una
  llave de acceso completo. Ver riesgo abierto 1.
- **Tabla de lotes:** `public.lots(id)`, definida en la migración 0001.
- **`app_users` tiene tres filas**, las tres `admin`/`active`:
  `aguilartradesfx@gmail.com`, `gerencia@duphomes.com` y
  `alinaramirezgamboa@gmail.com`. Importa porque `agenda` vive en esa fila: si
  alguno de los dos elegidos no la tuviera, la migración actualizaría cero filas
  y lo dejaría afuera en silencio.
- **`@vercel/functions` ya es dependencia** (^3.6.1), así que `waitUntil()` está
  disponible sin agregar nada.

## Modelo de datos

Migración nueva: `supabase/migrations/0008_agenda.sql`.

### Permisos, sobre `app_users`

```sql
alter table public.app_users
  add column agenda                 boolean not null default false,
  add column telegram_chat_id       text unique,
  add column telegram_codigo        text,
  add column telegram_codigo_expira timestamptz,
  add column feed_token             uuid;
```

`agenda` arranca en `false` para todos. La migración lo pone en `true`
únicamente para `alinaramirezgamboa@gmail.com` y `aguilartradesfx@gmail.com`.

Verificado el 2026-08-19 contra la base: `app_users` tiene exactamente tres
filas, las tres `admin` y `active` — las dos de arriba más
`gerencia@duphomes.com`, que se queda sin agenda. El otro equipo de ventas no
tiene fila: trabaja solo en GHL y nunca entra al panel.

### Citas

```sql
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

  ics_uid          text not null unique,
  ics_secuencia    integer not null default 0,

  recordatorio_24h_email_id text,
  recordatorio_1h_email_id  text,

  creada_por       text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.citas (inicio) where estado = 'agendada';
```

`cliente_email` es obligatorio: sin él no hay correo, ni invitación, ni
recordatorios, que es la razón de ser de todo esto.

`duracion_min` es una columna, pero la interfaz **no la expone**: todas las citas
duran 60 minutos. Está en el esquema porque el `.ics` necesita un `DTEND` y
porque abrirla mañana es cambiar un formulario, no migrar datos. Hoy, duración
fija.

`ics_uid` se genera una sola vez, al crear, y **no se toca nunca más**.
`ics_secuencia` sube en cada cambio. Ese par es lo que hace que reagendar mueva
el evento en el calendario del cliente en vez de dejarle dos citas y que llegue
a la vieja.

`recordatorio_24h_email_id` y `recordatorio_1h_email_id` guardan los ids que
devuelve Resend. Nulo significa «pendiente de programar», que es exactamente lo
que busca el reconciliador diario.

### Tablas de apoyo

```sql
create table if not exists public.citas_log (
  id         bigserial primary key,
  cita_id    uuid not null references public.citas(id) on delete cascade,
  accion     text not null,      -- creada | movida | editada | cancelada
  detalle    jsonb,              -- antes/después
  actor      text not null,      -- correo
  origen     text not null check (origen in ('panel','telegram','cron')),
  created_at timestamptz not null default now()
);

create table if not exists public.agenda_acciones_pendientes (
  id         uuid primary key default gen_random_uuid(),
  chat_id    text not null,
  accion     jsonb not null,
  expira_at  timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agenda_jobs (
  fecha             date primary key,
  resumen_enviado_at timestamptz
);
```

`citas_log` importa porque son dos personas escribiendo en la misma agenda desde
dos interfaces distintas: sin registro, «yo no moví eso» no tiene respuesta.

`agenda_acciones_pendientes` existe porque el `callback_data` de Telegram tope
en 64 bytes y la acción propuesta no cabe ahí. El botón lleva solo el uuid.

`agenda_jobs` evita que el resumen diario salga dos veces si el cron se repite.

Todas con RLS activado y **sin políticas**, igual que `app_users` y `bot_config`:
solo `service_role` las toca y todo pasa por `/api`.

## Permisos

Tres puertas, la misma regla en las tres: `status = 'active'` **y**
`role = 'admin'` **y** `agenda = true`.

- **Panel:** `api/me.ts` pasa a devolver también `agenda`; la pestaña se muestra
  solo si es `true`, y cada endpoint de `/api/agenda/*` lo revalida en el
  servidor. Esconder la pestaña no es control de acceso.
- **Bot:** se resuelve el usuario por `telegram_chat_id`. Se valida `from.id`
  (el usuario, no el chat) y se exige `chat.type === 'private'`, para que meter
  el bot a un grupo no le dé acceso a los del grupo.
- **Feed:** el `feed_token` es la credencial. Una suscripción de calendario no
  puede iniciar sesión. Devuelve las citas no canceladas de los últimos 30 días y
  los próximos 6 meses, e incluye teléfono y notas internas — es el calendario
  privado de ellos, no el correo al cliente.

Un helper nuevo, `requireAgenda(req)`, junto a `requireUser` y `requireAdmin` en
`api/_lib/supabase.ts`.

Nota sobre los break-glass: `BASE_ADMINS` da rol `admin` sin fila en
`app_users`. Como `agenda` vive en esa fila, un break-glass sin fila **no** tiene
agenda. Es lo correcto — el break-glass existe para no quedar encerrado fuera del
panel, no para heredar toda la agenda privada de otro equipo.

## Componentes

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `api/_lib/agenda/db.ts` | Leer y escribir citas y el log | supabase |
| `api/_lib/agenda/ics.ts` | Construir `.ics` (función pura) | nada |
| `api/_lib/agenda/email.ts` | Redactar y enviar los cinco correos | resend, ics |
| `api/_lib/agenda/recordatorios.ts` | **Decidir** qué programar; y aplicarlo | resend |
| `api/_lib/agenda/telegram.ts` | Cliente de la API de Telegram | nada |
| `api/_lib/agenda/agente.ts` | Bucle de Claude y las cinco herramientas | anthropic, db |
| `api/agenda/citas.ts` | CRUD para el panel | db, email, recordatorios |
| `api/agenda/feed.ts` | Feed `.ics` por token | db, ics |
| `api/agenda/telegram-link.ts` | Generar el código de 8 dígitos | db |
| `api/cron/agenda.ts` | Resumen, reconciliación, housekeeping | db, recordatorios, telegram |
| `api/telegram/webhook.ts` | Recibir updates, autorizar, confirmar | agente, db, telegram |

`recordatorios.ts` separa **decidir** de **hacer** a propósito: la decisión es una
función pura que devuelve un plan, y es lo que se prueba sin red de por medio.

Variables de entorno nuevas: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`CRON_SECRET`, `AGENDA_REPLY_TO`.

## Flujos

### Crear

1. Validar permiso y datos. `cliente_email` obligatorio.
2. Insertar la cita con `ics_uid` nuevo y `ics_secuencia = 0`.
3. Enviar la confirmación con `.ics` (`METHOD:REQUEST`).
4. Programar los dos recordatorios en Resend; guardar sus ids.
5. Escribir en `citas_log`.
6. Avisar por Telegram a los demás con agenda.

El paso 2 es el que no puede fallar. Del 3 en adelante, un fallo se registra y se
reporta pero **no deshace la cita** — mismo criterio que ya rige en
`api/reserve.ts`, donde el lead nunca se pierde aunque falle lo de después.

### Reagendar

`ics_secuencia + 1`, mismo `ics_uid`, correo con el `.ics` actualizado que
reemplaza el evento, y `PATCH` a los dos recordatorios. Si alguno estaba nulo se
programa ahora; si la hora nueva lo saca de la ventana de 30 días o lo deja en el
pasado, se cancela y vuelve a nulo.

### Cancelar

Estado a `cancelada`, correo con `.ics` de `METHOD:CANCEL` (le borra el evento al
cliente), y `cancel` a los dos recordatorios programados.

### Reglas de programación de recordatorios

Solo se programa lo que cae en el futuro y dentro de la ventana de 30 días de
Resend:

| Situación | 24h antes | 1h antes |
|---|---|---|
| Cita en 3 días | se programa | se programa |
| Cita en 6 horas | no aplica, ya pasó | se programa |
| Cita en 30 minutos | no aplica | no aplica |
| Cita en 45 días | queda nulo, lo toma el cron | queda nulo, lo toma el cron |

### Cron diario

`/api/cron/agenda`, a las 11:00 UTC (5 a.m. de Costa Rica), protegido con
`CRON_SECRET`:

1. Resumen del día por Telegram a cada chat vinculado, una sola vez por fecha.
2. Reconciliar: citas activas dentro de 48h con algún id de recordatorio nulo,
   programarlos. Idempotente por construcción: solo actúa sobre nulos.
3. Marcar `completada` las citas ya pasadas.

En Hobby esto llega entre las 5 y las 6 a.m. por la imprecisión del plan, lo cual
no afecta a nadie. Los recordatorios del cliente no pasan por aquí.

### Bot

1. Telegram llama al webhook con la cabecera `X-Telegram-Bot-Api-Secret-Token`;
   si no coincide, 401 sin más.
2. Deduplicar por `update_id`, igual que `webhook_events` hace con GHL.
3. Autorizar. A quien no está autorizado, una línea seca: nada que revele qué es
   esto ni qué puede hacer.
4. Responder 200 de inmediato y procesar el turno con `waitUntil()`, mandando el
   indicador de «escribiendo…». Telegram reintenta si uno tarda, y una vuelta del
   agente toma varios segundos.
5. El agente recibe la fecha y hora actual de Costa Rica explícitas y devuelve
   siempre fechas absolutas ISO.
6. Las herramientas de lectura se ejecutan directo. Las de escritura se
   interceptan: se guardan en `agenda_acciones_pendientes` y se responde con un
   resumen en español, con la fecha en formato largo, y botones
   [Confirmar] [Cancelar]. La acción expira a los 10 minutos.
7. Al confirmar se ejecuta el mismo camino que usa el panel — no una segunda
   implementación.

Comandos además del lenguaje natural: `/hoy`, `/semana`, `/vincular <código>`.

### Vincular Telegram

En el panel, «Conectar Telegram» genera un código de 8 dígitos válido 10 minutos.
`/vincular 12345678` guarda el `chat_id` en la fila de esa persona. Un solo uso.

### Avisos entre ustedes

Cualquier creación, cambio o cancelación avisa por Telegram a **todos los que
tienen agenda menos a quien la hizo**: el que actúa ya tiene su confirmación,
inline en Telegram o en pantalla en el panel.

## El `.ics`

Se construye a mano, sin librería: son unas 60 líneas y una dependencia para esto
no se paga. Lo que hay que hacer bien, porque rompe el archivo en silencio:

- Plegado de líneas a 75 octetos.
- Escape de `,` `;` `\` y saltos de línea en `SUMMARY`, `DESCRIPTION` y `LOCATION`.
- `DTSTART`/`DTEND` en UTC con `Z`, para no tener que embutir un `VTIMEZONE`.
  Costa Rica es UTC−6 fijo, sin horario de verano; `api/slots.ts` ya lo asume así.
- `METHOD:REQUEST` al crear y reagendar; `METHOD:CANCEL` con `STATUS:CANCELLED`
  al cancelar.
- `SEQUENCE` siempre igual a `ics_secuencia`.

El adjunto resuelve Apple Calendar y Outlook. Para Gmail se agrega además un
botón «Agregar a Google Calendar» en el cuerpo, que es un enlace a
`calendar.google.com/render` con los datos ya rellenos.

El cuerpo del correo se arma desde un subconjunto explícito de campos, nunca
desde la fila entera, para que agregar mañana un campo interno no lo filtre al
cliente por accidente. `notas` no sale jamás.

Las plantillas reusan el estilo de `supabase/auth-templates/invite.html`.

## Manejo de errores

| Falla | Qué pasa |
|---|---|
| La cita no se puede guardar | Error al usuario. Nada más ocurre. |
| El correo falla tras guardar | La cita queda. Se registra y se avisa en pantalla, con opción de reenviar. |
| Resend rechaza un envío programado | El id queda nulo; el reconciliador lo reintenta al día siguiente. |
| Telegram no responde en el cron | Se registra; la reconciliación sigue igual. |
| El agente interpreta mal la fecha | La confirmación por botón lo atrapa antes de tocar nada. |
| Update repetido de Telegram | Deduplicado por `update_id`. |
| Token de feed filtrado | Se rota desde el panel; el anterior deja de servir. |

## Pruebas

Con vitest, siguiendo el patrón de `api/admin/users.test.ts`:

- `ics.test.ts` — plegado, escapes, UTC, `SEQUENCE` incremental, `CANCEL` bien
  formado. Función pura: barata de probar, cara de equivocar.
- `recordatorios.test.ts` — la tabla de reglas de arriba, caso por caso, más
  reagendar hacia adentro y hacia afuera de la ventana.
- `permisos.test.ts` — que el vendedor, el admin sin `agenda`, el usuario
  deshabilitado y el break-glass sin fila quedan afuera de las tres puertas.
- `agente.test.ts` — que ninguna herramienta de escritura se ejecuta sin
  confirmación, y que una acción expirada no se puede confirmar.

## Fases

Cada una entregable por su cuenta:

1. Migración, `requireAgenda`, CRUD y pestaña del panel. Sin correos todavía.
2. Correos con `.ics`: confirmación, reagendado, cancelación.
3. Recordatorios programados, cron y resumen diario.
4. Feed `.ics` de suscripción.
5. Bot de Telegram.

Telegram va de último a propósito: es el pedazo más grande y se apoya en todo lo
anterior. Para cuando llegue, agendar, mover y cancelar ya son funciones
probadas y el bot solo les pone una boca.

## Riesgos abiertos

1. **Permisos de la llave de Resend.** Se confirmó que es de envío solamente. Si
   `PATCH /emails/{id}` y `POST /emails/{id}/cancel` están bloqueados, reagendar
   no puede mover los recordatorios ya programados. Se verifica con una llamada
   real **antes** de construir la fase 3. Salida: llave de acceso completo.
2. **Remitente.** El cliente verá `noreply@send.bralto.io`, que dice Bralto y no
   EcoViva. Se mitiga con `Reply-To` a un correo real. Cambiarlo exige verificar
   otro dominio en Resend.
3. ~~**Los dos correos con acceso.**~~ Resuelto el 2026-08-19: la agenda se
   prende para `alinaramirezgamboa@gmail.com` y `aguilartradesfx@gmail.com`.
   `gerencia@duphomes.com` queda como `admin` **sin** agenda — es el primer caso
   real del default-deny y es intencional.
4. **Refresco del feed.** Google Calendar refresca las suscripciones cuando
   quiere, a veces con 24 horas de retraso; iOS se puede bajar a 15 minutos. El
   feed es comodidad de lectura, no la fuente de verdad. Hay que decirlo al
   entregarlo o va a parecer un error.
5. **Plan de Vercel sin confirmar.** No bloquea nada: el diseño funciona en
   Hobby. Pero si el team resultara estar en Hobby, conviene saberlo antes de
   agregar cualquier cron futuro con expresión más frecuente que diaria, porque
   **falla el deploy**, no se degrada.
