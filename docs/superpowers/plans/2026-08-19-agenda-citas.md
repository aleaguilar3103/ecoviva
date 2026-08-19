# Agenda de citas privada — Plan de implementación (fases 1–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Alina y Alejandro puedan agendar, mover y cancelar citas desde el panel de EcoViva, con correo de confirmación e invitación de calendario para el cliente, recordatorios automáticos a 24h y 1h, y la agenda visible en su celular — todo aislado de GoHighLevel.

**Architecture:** Tablas propias en Supabase como única fuente de verdad. Los correos salen por la API HTTP de Resend; los recordatorios se **programan** en Resend al crear la cita en vez de barrerse con un cron, para que la entrega no dependa del plan de Vercel. Un cron diario manda el resumen y reconcilia lo que no se pudo programar. El `.ics` se construye a mano como función pura.

**Tech Stack:** Vercel Functions (Node 24), Supabase (`service_role`), Resend HTTP API, React 18 + Tailwind + Radix en el panel, vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-agenda-citas-y-bot-telegram-design.md`

**Alcance de este plan:** fases 1 a 4 del spec. La fase 5 (bot de Telegram) va en un plan aparte que se escribe **después** de terminar este, para que se apoye en firmas reales y no adivinadas.

## Global Constraints

- **Zona horaria:** Costa Rica es UTC−6 fijo, sin horario de verano. Los `.ics` se emiten en UTC con `Z`; nunca se escribe un bloque `VTIMEZONE`.
- **Idioma:** todo el texto visible y todos los comentarios de código, en español.
- **Remitente:** `EcoViva Desarrollos <noreply@send.bralto.io>` (único dominio verificado). `Reply-To` sale de `AGENDA_REPLY_TO`.
- **Permiso, las tres condiciones:** `status = 'active'` **y** `role = 'admin'` **y** `agenda = true`. Se revalida **en el servidor** en cada endpoint. Esconder la pestaña no es control de acceso.
- **`notas` es interna.** Nunca aparece en ningún correo al cliente. El cuerpo del correo se arma desde un subconjunto explícito de campos, jamás desde la fila entera.
- **`ics_uid` no se toca nunca** después de crear. `ics_secuencia` sube en cada cambio.
- **Nada en este plan lee ni escribe en GHL.** Si una tarea parece necesitarlo, está mal entendida.
- **Patrón de endpoint:** `export default async function handler(req: any, res: any)`, con `res.setHeader("Cache-Control", "no-store")` como primera línea, como en `api/admin/users.ts`.
- **Patrón de test:** vitest con mock de bajo nivel del cliente de Supabase mediante cola de respuestas, como en `api/admin/users.test.ts`.
- **Errores al cliente:** nunca se devuelve el texto crudo de Postgres. Se loguea el detalle y se responde un mensaje genérico en español (patrón `logYGenerico`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0008_agenda.sql` | Permisos sobre `app_users` y las cuatro tablas nuevas |
| `api/_lib/supabase.ts` (modificar) | Agregar `requireAgenda` |
| `api/_lib/agenda/db.ts` | Leer y escribir citas y su bitácora |
| `api/_lib/agenda/ics.ts` | Construir el `.ics` — función pura, sin dependencias |
| `api/_lib/agenda/resend.ts` | Cliente HTTP de Resend: enviar, reprogramar, cancelar |
| `api/_lib/agenda/email.ts` | Redactar los cinco correos y despacharlos |
| `api/_lib/agenda/recordatorios.ts` | Decidir qué recordatorios corresponden, y aplicarlo |
| `api/agenda/citas.ts` | CRUD para el panel |
| `api/agenda/feed.ts` | Feed `.ics` de suscripción por token |
| `api/cron/agenda.ts` | Resumen diario, reconciliación, housekeeping |
| `api/me.ts` (modificar) | Devolver también `agenda` |
| `src/lib/adminApi.ts` (modificar) | Tipos y llamadas de agenda |
| `src/components/admin/AgendaManager.tsx` | Pestaña «Agenda» |
| `src/components/admin/AdminDashboard.tsx` (modificar) | Montar la pestaña condicionalmente |
| `src/components/admin/UsersManager.tsx` (modificar) | Interruptor de permiso de agenda |

`recordatorios.ts` separa **decidir** de **hacer** a propósito: la decisión es una función pura y es lo que se prueba sin red de por medio.

---

## FASE 1 — Fundación: datos, permiso y CRUD

### Task 1: Migración y permiso `requireAgenda`

**Files:**
- Create: `supabase/migrations/0008_agenda.sql`
- Modify: `api/_lib/supabase.ts` (agregar `requireAgenda` al final)
- Test: `api/_lib/agenda/permisos.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `supabaseAdmin` de `api/_lib/supabase.ts`
- Produces: `requireAgenda(req): Promise<Caller | null>` — devuelve el mismo `Caller` que `requireUser` o `null`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0008_agenda.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar la migración y verificar que prendió las dos filas correctas**

Run:
```bash
npx supabase db push
```

Verificar (debe imprimir exactamente dos filas con `agenda = true`):
```bash
URL=$(grep -E '^SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/app_users?select=email,agenda"
```

Expected: `aguilartradesfx@gmail.com` y `alinaramirezgamboa@gmail.com` con `agenda: true`; `gerencia@duphomes.com` con `agenda: false`.

**Si alguno de los dos sale en `false`, PARAR.** Significa que el correo en `app_users` no coincide con el de la migración y el permiso quedaría vacío.

- [ ] **Step 3: Escribir el test de permiso (falla)**

Crear `api/_lib/agenda/permisos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo patrón que api/admin/users.test.ts: `from()` va sacando la próxima
// respuesta de una cola en el orden en que el código bajo prueba consulta.
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
  return cadena;
}

const from = vi.fn(() => {
  const respuesta = colaFrom.shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from, auth: { getUser } }),
}));

async function cargar() {
  vi.resetModules();
  return await import("../supabase");
}

function req(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}

beforeEach(() => {
  colaFrom = [];
  from.mockClear();
  getUser.mockReset();
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.ADMIN_API_TOKEN;
});

describe("requireAgenda", () => {
  it("deja pasar al admin con agenda = true", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-alina", email: "alinaramirezgamboa@gmail.com" } },
      error: null,
    });
    // 1ª consulta: la de requireUser (role/status). 2ª: la bandera de agenda.
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null },
      { data: { agenda: true }, error: null },
    ];
    const { requireAgenda } = await cargar();
    const caller = await requireAgenda(req("jwt"));
    expect(caller?.email).toBe("alinaramirezgamboa@gmail.com");
  });

  it("consulta la bandera aunque el correo sea break-glass", async () => {
    // Este es el caso que casi se rompe: requireUser corta temprano para los
    // BASE_ADMINS y nunca lee app_users. Si requireAgenda confiara en eso,
    // Alejandro quedaría fuera de su propia agenda.
    getUser.mockResolvedValue({
      data: { user: { id: "uid-ale", email: "aguilartradesfx@gmail.com" } },
      error: null,
    });
    colaFrom = [{ data: { agenda: true }, error: null }];
    const { requireAgenda } = await cargar();
    const caller = await requireAgenda(req("jwt"));
    expect(caller?.email).toBe("aguilartradesfx@gmail.com");
    expect(from).toHaveBeenCalledWith("app_users");
  });

  it("rechaza al admin sin agenda", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-gerencia", email: "gerencia@duphomes.com" } },
      error: null,
    });
    colaFrom = [{ data: { agenda: false }, error: null }];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("rechaza al vendedor aunque tenga agenda en true", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-v", email: "vendedor@ecoviva.com" } },
      error: null,
    });
    colaFrom = [
      { data: { role: "vendedor", status: "active" }, error: null },
      { data: { agenda: true }, error: null },
    ];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("falla cerrado si la consulta de la bandera da error", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-alina", email: "alinaramirezgamboa@gmail.com" } },
      error: null,
    });
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null },
      { data: null, error: { message: "timeout" } },
    ];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("rechaza el token de servicio: no tiene agenda personal", async () => {
    process.env.ADMIN_API_TOKEN = "token-de-servicio";
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("token-de-servicio"))).toBeNull();
  });
});
```

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `npx vitest run api/_lib/agenda/permisos.test.ts`
Expected: FAIL — `requireAgenda is not a function`.

- [ ] **Step 5: Implementar `requireAgenda`**

Agregar al final de `api/_lib/supabase.ts`:

```ts
// Igual que requireAdmin pero exige además la bandera `agenda` de app_users.
//
// La bandera se consulta SIEMPRE por user_id, aunque requireUser ya haya
// resuelto el rol. No es redundante: para los correos de BASE_ADMINS,
// requireUser devuelve temprano sin leer app_users, y uno de esos correos es
// justamente el de Alejandro. Confiar en el Caller lo dejaría fuera de su
// propia agenda.
//
// Falla cerrado: si la consulta da error, no hay acceso.
export async function requireAgenda(req: {
  headers: Record<string, unknown>;
}): Promise<Caller | null> {
  const caller = await requireUser(req);
  if (!caller || caller.role !== "admin") return null;

  // El token de servicio (servidor a servidor) no tiene fila ni persona detrás,
  // así que no tiene agenda. Fail closed a propósito.
  if (!caller.userId) return null;

  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .select("agenda")
    .eq("user_id", caller.userId)
    .maybeSingle();

  if (error) {
    console.error("requireAgenda: fallo al consultar la bandera", error);
    return null;
  }
  return data?.agenda === true ? caller : null;
}
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npx vitest run api/_lib/agenda/permisos.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_agenda.sql api/_lib/supabase.ts api/_lib/agenda/permisos.test.ts
git commit -m "Agenda: migracion 0008 y permiso requireAgenda"
```

---

### Task 2: Capa de datos de la agenda

**Files:**
- Create: `api/_lib/agenda/db.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` de `api/_lib/supabase.ts`
- Produces:
  - `type Cita` — la fila completa
  - `type Origen = "panel" | "telegram" | "cron"`
  - `listarCitas(opts: { desde: Date; hasta: Date; incluirCanceladas?: boolean }): Promise<Cita[]>`
  - `obtenerCita(id: string): Promise<Cita | null>`
  - `crearCita(datos: DatosCita, actor: string, origen: Origen): Promise<Cita>`
  - `actualizarCita(id: string, cambios: Partial<DatosCita>, actor: string, origen: Origen): Promise<Cita>`
  - `cancelarCita(id: string, actor: string, origen: Origen): Promise<Cita>`
  - `guardarIdsRecordatorio(id: string, ids: { r24h?: string | null; r1h?: string | null }): Promise<void>`

- [ ] **Step 1: Escribir el módulo**

Crear `api/_lib/agenda/db.ts`:

```ts
import { supabaseAdmin } from "../supabase.js";
import { randomUUID } from "node:crypto";

export type Origen = "panel" | "telegram" | "cron";
export type EstadoCita = "agendada" | "cancelada" | "completada";

export interface Cita {
  id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  inicio: string;               // ISO con offset, tal como lo devuelve Postgres
  duracion_min: number;
  lugar: string;
  lote_id: string | null;
  notas: string | null;
  estado: EstadoCita;
  ics_uid: string;
  ics_secuencia: number;
  recordatorio_24h_email_id: string | null;
  recordatorio_1h_email_id: string | null;
  creada_por: string;
  created_at: string;
  updated_at: string;
}

export interface DatosCita {
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono?: string | null;
  inicio: string;
  lugar: string;
  lote_id?: string | null;
  notas?: string | null;
}

function db() {
  return supabaseAdmin();
}

// El detalle del error de Postgres se loguea pero nunca sale hacia el cliente.
function reventar(contexto: string, error: unknown, generico: string): never {
  console.error(`agenda/db: ${contexto}`, error);
  throw new Error(generico);
}

export async function listarCitas(opts: {
  desde: Date;
  hasta: Date;
  incluirCanceladas?: boolean;
}): Promise<Cita[]> {
  let q = db()
    .from("citas")
    .select("*")
    .gte("inicio", opts.desde.toISOString())
    .lte("inicio", opts.hasta.toISOString())
    .order("inicio", { ascending: true });

  if (!opts.incluirCanceladas) q = q.neq("estado", "cancelada");

  const { data, error } = await q;
  if (error) reventar("listarCitas", error, "No se pudo obtener la agenda.");
  return (data ?? []) as Cita[];
}

export async function obtenerCita(id: string): Promise<Cita | null> {
  const { data, error } = await db().from("citas").select("*").eq("id", id).maybeSingle();
  if (error) reventar("obtenerCita", error, "No se pudo obtener la cita.");
  return (data as Cita) ?? null;
}

async function registrar(
  citaId: string,
  accion: "creada" | "movida" | "editada" | "cancelada",
  detalle: unknown,
  actor: string,
  origen: Origen,
) {
  const { error } = await db()
    .from("citas_log")
    .insert({ cita_id: citaId, accion, detalle, actor, origen });
  // La bitácora no puede tumbar la operación: la cita ya está guardada y es lo
  // que importa. Pero un fallo silencioso acá es invisible, así que se loguea.
  if (error) console.error("agenda/db: no se pudo registrar en citas_log", error);
}

export async function crearCita(
  datos: DatosCita,
  actor: string,
  origen: Origen,
): Promise<Cita> {
  // El UID se genera una sola vez y no se toca nunca más. Es lo que permite que
  // reagendar mueva el evento del cliente en vez de crearle uno nuevo al lado.
  const ics_uid = `cita-${randomUUID()}@ecovivadesarrollos.com`;

  const { data, error } = await db()
    .from("citas")
    .insert({
      cliente_nombre: datos.cliente_nombre,
      cliente_email: datos.cliente_email,
      cliente_telefono: datos.cliente_telefono ?? null,
      inicio: datos.inicio,
      lugar: datos.lugar,
      lote_id: datos.lote_id ?? null,
      notas: datos.notas ?? null,
      ics_uid,
      creada_por: actor,
    })
    .select()
    .single();

  if (error) reventar("crearCita", error, "No se pudo guardar la cita.");
  const cita = data as Cita;
  await registrar(cita.id, "creada", { inicio: cita.inicio, lugar: cita.lugar }, actor, origen);
  return cita;
}

export async function actualizarCita(
  id: string,
  cambios: Partial<DatosCita>,
  actor: string,
  origen: Origen,
): Promise<Cita> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  if (antes.estado === "cancelada") throw new Error("Esa cita ya fue cancelada.");

  const seMovio = cambios.inicio !== undefined && cambios.inicio !== antes.inicio;

  // La secuencia sube en CUALQUIER cambio, no solo al mover: si cambia el lugar,
  // el cliente también necesita que su calendario se actualice.
  const { data, error } = await db()
    .from("citas")
    .update({ ...cambios, ics_secuencia: antes.ics_secuencia + 1 })
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("actualizarCita", error, "No se pudo actualizar la cita.");
  const despues = data as Cita;
  await registrar(
    id,
    seMovio ? "movida" : "editada",
    { antes: { inicio: antes.inicio, lugar: antes.lugar }, despues: { inicio: despues.inicio, lugar: despues.lugar } },
    actor,
    origen,
  );
  return despues;
}

export async function cancelarCita(id: string, actor: string, origen: Origen): Promise<Cita> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  if (antes.estado === "cancelada") return antes; // idempotente

  const { data, error } = await db()
    .from("citas")
    .update({ estado: "cancelada", ics_secuencia: antes.ics_secuencia + 1 })
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("cancelarCita", error, "No se pudo cancelar la cita.");
  await registrar(id, "cancelada", { inicio: antes.inicio }, actor, origen);
  return data as Cita;
}

export async function guardarIdsRecordatorio(
  id: string,
  ids: { r24h?: string | null; r1h?: string | null },
): Promise<void> {
  const cambios: Record<string, string | null> = {};
  if (ids.r24h !== undefined) cambios.recordatorio_24h_email_id = ids.r24h;
  if (ids.r1h !== undefined) cambios.recordatorio_1h_email_id = ids.r1h;
  if (!Object.keys(cambios).length) return;

  const { error } = await db().from("citas").update(cambios).eq("id", id);
  if (error) console.error("agenda/db: no se pudieron guardar los ids de recordatorio", error);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `api/_lib/agenda/db.ts`.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/agenda/db.ts
git commit -m "Agenda: capa de datos con bitacora"
```

---

### Task 3: Endpoint CRUD para el panel

**Files:**
- Create: `api/agenda/citas.ts`
- Test: `api/agenda/citas.test.ts`

**Interfaces:**
- Consumes: `requireAgenda`; todo lo de `api/_lib/agenda/db.ts`
- Produces: `GET|POST|PATCH|DELETE /api/agenda/citas`
  - `GET ?desde=ISO&hasta=ISO` → `{ citas: Cita[] }`
  - `POST { cliente_nombre, cliente_email, cliente_telefono?, inicio, lugar, lote_id?, notas? }` → `{ cita, choque: boolean }`
  - `PATCH { id, ...cambios }` → `{ cita, choque: boolean }`
  - `DELETE { id }` → `{ cita }`

- [ ] **Step 1: Escribir el test (falla)**

Crear `api/agenda/citas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAgenda = vi.fn();
const listarCitas = vi.fn();
const crearCita = vi.fn();
const actualizarCita = vi.fn();
const cancelarCita = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  requireAgenda: (...a: unknown[]) => requireAgenda(...a),
}));
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  crearCita: (...a: unknown[]) => crearCita(...a),
  actualizarCita: (...a: unknown[]) => actualizarCita(...a),
  cancelarCita: (...a: unknown[]) => cancelarCita(...a),
  obtenerCita: vi.fn(),
}));

async function cargar() {
  vi.resetModules();
  return (await import("./citas")).default;
}

function req(method: string, body?: unknown, query: Record<string, string> = {}) {
  return { method, headers: {}, body, query };
}

function resRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = { statusCode: 0, body: undefined };
  r.status = vi.fn((c: number) => { r.statusCode = c; return r; });
  r.json = vi.fn((b: unknown) => { r.body = b; return r; });
  r.setHeader = vi.fn();
  return r;
}

const YO = { email: "alinaramirezgamboa@gmail.com", userId: "uid-alina", role: "admin" as const };

beforeEach(() => {
  requireAgenda.mockReset();
  listarCitas.mockReset();
  crearCita.mockReset();
  actualizarCita.mockReset();
  cancelarCita.mockReset();
});

describe("/api/agenda/citas", () => {
  it("rechaza a quien no tiene agenda", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("exige correo del cliente al crear", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", { cliente_nombre: "María", inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada" }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(crearCita).not.toHaveBeenCalled();
  });

  it("avisa del choque pero igual crea la cita", async () => {
    requireAgenda.mockResolvedValue(YO);
    // Ya hay algo a esa hora.
    listarCitas.mockResolvedValue([
      { id: "otra", inicio: "2026-09-01T16:00:00.000Z", duracion_min: 60 },
    ]);
    crearCita.mockResolvedValue({ id: "nueva", inicio: "2026-09-01T16:30:00.000Z" });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:30:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.choque).toBe(true);
    expect(crearCita).toHaveBeenCalled();
  });

  it("no marca choque cuando no se solapan", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([
      { id: "otra", inicio: "2026-09-01T16:00:00.000Z", duracion_min: 60 },
    ]);
    crearCita.mockResolvedValue({ id: "nueva", inicio: "2026-09-01T17:00:00.000Z" });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T17:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.body.choque).toBe(false);
  });

  it("rechaza un correo con formato inválido", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria-arroba-example",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run api/agenda/citas.test.ts`
Expected: FAIL — no existe `./citas`.

- [ ] **Step 3: Implementar el endpoint**

Crear `api/agenda/citas.ts`:

```ts
import { requireAgenda } from "../_lib/supabase.js";
import { listarCitas, crearCita, actualizarCita, cancelarCita } from "../_lib/agenda/db.js";
import type { Cita, DatosCita } from "../_lib/agenda/db.js";

// /api/agenda/citas — CRUD de la agenda privada. Solo admin con bandera agenda.
//
// Los correos NO se mandan desde acá todavía: eso entra en la fase 2. Este
// endpoint ya deja al panel agendar y ver, que es entregable por sí solo.

const DURACION_MIN = 60; // fija por ahora; la columna existe pero la UI no la expone

function correoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function fechaValida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function textoRequerido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 200 ? t : null;
}

// Se avisa del solape, no se bloquea: con agenda compartida entre dos personas,
// a veces sí quieren dos cosas a la misma hora. Bloquear crearía más fricción
// que la que evita.
async function haySolape(inicioIso: string, excluirId?: string): Promise<boolean> {
  const inicio = new Date(inicioIso);
  const fin = new Date(inicio.getTime() + DURACION_MIN * 60_000);
  // Ventana holgada a ambos lados para traer cualquier cita que pueda solapar.
  const vecinas = await listarCitas({
    desde: new Date(inicio.getTime() - 4 * 60 * 60_000),
    hasta: new Date(inicio.getTime() + 4 * 60 * 60_000),
  });
  return vecinas.some((c: Cita) => {
    if (excluirId && c.id === excluirId) return false;
    const cIni = new Date(c.inicio).getTime();
    const cFin = cIni + (c.duracion_min ?? DURACION_MIN) * 60_000;
    return cIni < fin.getTime() && cFin > inicio.getTime();
  });
}

function leerDatos(body: Record<string, unknown>): { datos: DatosCita } | { error: string } {
  const cliente_nombre = textoRequerido(body.cliente_nombre);
  if (!cliente_nombre) return { error: "Falta el nombre del cliente" };

  const cliente_email = correoValido(body.cliente_email);
  if (!cliente_email) {
    return { error: "Hace falta un correo válido del cliente: sin él no hay invitación ni recordatorios" };
  }

  const inicio = fechaValida(body.inicio);
  if (!inicio) return { error: "Fecha y hora inválidas" };

  const lugar = textoRequerido(body.lugar);
  if (!lugar) return { error: "Falta el lugar de la cita" };

  return {
    datos: {
      cliente_nombre,
      cliente_email,
      cliente_telefono: typeof body.cliente_telefono === "string" ? body.cliente_telefono.trim() || null : null,
      inicio,
      lugar,
      lote_id: typeof body.lote_id === "string" && body.lote_id ? body.lote_id : null,
      notas: typeof body.notas === "string" ? body.notas.trim() || null : null,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const caller = await requireAgenda(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  try {
    if (req.method === "GET") {
      const { desde, hasta } = (req.query ?? {}) as { desde?: string; hasta?: string };
      const d = desde ? new Date(desde) : new Date(Date.now() - 7 * 24 * 60 * 60_000);
      const h = hasta ? new Date(hasta) : new Date(Date.now() + 60 * 24 * 60 * 60_000);
      if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) {
        return res.status(400).json({ error: "Rango de fechas inválido" });
      }
      return res.status(200).json({ citas: await listarCitas({ desde: d, hasta: h }) });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === "POST") {
      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      const choque = await haySolape(leido.datos.inicio);
      const cita = await crearCita(leido.datos, caller.email, "panel");
      return res.status(200).json({ cita, choque });
    }

    if (req.method === "PATCH") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });

      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      const choque = await haySolape(leido.datos.inicio, id);
      const cita = await actualizarCita(id, leido.datos, caller.email, "panel");
      return res.status(200).json({ cita, choque });
    }

    if (req.method === "DELETE") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });
      return res.status(200).json({ cita: await cancelarCita(id, caller.email, "panel") });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("agenda/citas error", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error inesperado" });
  }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run api/agenda/citas.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add api/agenda/citas.ts api/agenda/citas.test.ts
git commit -m "Agenda: endpoint CRUD con aviso de solape"
```

---

### Task 4: La pestaña «Agenda» en el panel

**Files:**
- Modify: `api/me.ts` (devolver `agenda`)
- Modify: `src/lib/adminApi.ts` (tipos y llamadas)
- Modify: `src/components/admin/AdminApp.tsx:44-56` (guardar el `me` completo)
- Modify: `src/components/admin/AdminDashboard.tsx:10-22` (pestaña condicional)
- Create: `src/components/admin/AgendaManager.tsx`

**Interfaces:**
- Consumes: `GET|POST|PATCH|DELETE /api/agenda/citas` de la Task 3; `getLots()` que ya existe
- Produces:
  - `getMe(): Promise<{ email: string; role: AppRole; agenda: boolean }>`
  - `getCitas(desde: Date, hasta: Date): Promise<{ citas: CitaRow[] }>`
  - `crearCita(datos: NuevaCita): Promise<{ cita: CitaRow; choque: boolean }>`
  - `actualizarCita(id: string, datos: NuevaCita): Promise<{ cita: CitaRow; choque: boolean }>`
  - `cancelarCita(id: string): Promise<{ cita: CitaRow }>`

- [ ] **Step 1: Que `/api/me` devuelva la bandera**

En `api/me.ts`, reemplazar el cuerpo del handler después de `requireUser`:

```ts
  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  // La bandera se consulta aparte y no desde el Caller: requireUser corta
  // temprano para los correos break-glass y nunca lee app_users.
  let agenda = false;
  if (caller.userId) {
    const { data } = await supabaseAdmin()
      .from("app_users")
      .select("agenda")
      .eq("user_id", caller.userId)
      .maybeSingle();
    agenda = data?.agenda === true;
  }

  return res.status(200).json({ email: caller.email, role: caller.role, agenda });
```

Y cambiar el import de la primera línea a:

```ts
import { requireUser, supabaseAdmin } from "./_lib/supabase.js";
```

- [ ] **Step 2: Agregar tipos y llamadas al cliente**

En `src/lib/adminApi.ts`, cambiar la firma de `getMe` (línea 146) y agregar al final del archivo:

```ts
// ── Agenda ──
export interface CitaRow {
  id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  inicio: string;
  duracion_min: number;
  lugar: string;
  lote_id: string | null;
  notas: string | null;
  estado: "agendada" | "cancelada" | "completada";
  creada_por: string;
}

export interface NuevaCita {
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono?: string | null;
  inicio: string;
  lugar: string;
  lote_id?: string | null;
  notas?: string | null;
}

export function getCitas(desde: Date, hasta: Date): Promise<{ citas: CitaRow[] }> {
  const q = `?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`;
  return request<{ citas: CitaRow[] }>(`/api/agenda/citas${q}`);
}

export function crearCita(datos: NuevaCita): Promise<{ cita: CitaRow; choque: boolean }> {
  return request(`/api/agenda/citas`, { method: "POST", body: JSON.stringify(datos) });
}

export function actualizarCita(
  id: string,
  datos: NuevaCita,
): Promise<{ cita: CitaRow; choque: boolean }> {
  return request(`/api/agenda/citas`, { method: "PATCH", body: JSON.stringify({ id, ...datos }) });
}

export function cancelarCita(id: string): Promise<{ cita: CitaRow }> {
  return request(`/api/agenda/citas`, { method: "DELETE", body: JSON.stringify({ id }) });
}
```

Y reemplazar `getMe`:

```ts
export function getMe(): Promise<{ email: string; role: AppRole; agenda: boolean }> {
  return request<{ email: string; role: AppRole; agenda: boolean }>("/api/me");
}
```

- [ ] **Step 3: Pasar la bandera desde AdminApp**

En `src/components/admin/AdminApp.tsx`, agregar junto a `acceso`:

```ts
  const [tieneAgenda, setTieneAgenda] = useState(false);
```

Dentro del `.then` de `getMe()` (línea ~52), reemplazar por:

```ts
      .then((yo) => {
        if (!vivo) return;
        setTieneAgenda(yo.agenda === true);
        setAcceso(yo.role === "admin" ? "admin" : "denegado");
      })
```

Y en la última línea, pasar la prop:

```tsx
  return <AdminDashboard session={session} tieneAgenda={tieneAgenda} />;
```

- [ ] **Step 4: Montar la pestaña condicionalmente**

En `src/components/admin/AdminDashboard.tsx`:

```tsx
import AgendaManager from "./AgendaManager";

type Tab = "lotes" | "bot" | "probar" | "usuarios" | "agenda";

export default function AdminDashboard({
  session,
  tieneAgenda,
}: {
  session: Session;
  tieneAgenda: boolean;
}) {
  const [tab, setTab] = useState<Tab>("lotes");

  // La pestaña se esconde para quien no tiene la bandera, pero eso es comodidad
  // visual, no seguridad: /api/agenda/citas revalida el permiso en el servidor.
  const tabs: { id: Tab; label: string }[] = [
    { id: "lotes", label: "Lotes" },
    ...(tieneAgenda ? [{ id: "agenda" as Tab, label: "Agenda" }] : []),
    { id: "bot", label: "Bot & Prompt" },
    { id: "probar", label: "Probar bot" },
    { id: "usuarios", label: "Usuarios" },
  ];
```

Y en el `<main>`:

```tsx
        {tab === "agenda" && tieneAgenda && <AgendaManager />}
```

- [ ] **Step 5: Crear la pestaña**

Crear `src/components/admin/AgendaManager.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCitas, crearCita, actualizarCita, cancelarCita, getLots,
  type CitaRow, type NuevaCita, type Lot,
} from "../../lib/adminApi";

const LUGARES = ["Visita Lomas de la Llanada", "Visita Río Celeste", "Oficina", "Videollamada", "Notaría"];

// Costa Rica es UTC−6 fijo. El <input type="datetime-local"> trabaja en la hora
// local del navegador, que puede no ser la de Costa Rica si alguien viaja. Se
// convierte explícitamente para que la cita quede siempre en hora tica.
const OFFSET_CR_MS = -6 * 60 * 60_000;

function isoDesdeLocalCR(valor: string): string {
  // valor = "2026-09-01T10:30" interpretado como hora de Costa Rica
  const [fecha, hora] = valor.split("T");
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_CR_MS).toISOString();
}

function localCRDesdeIso(iso: string): string {
  const d = new Date(new Date(iso).getTime() + OFFSET_CR_MS);
  return d.toISOString().slice(0, 16);
}

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(iso));
}

const VACIA: NuevaCita = {
  cliente_nombre: "", cliente_email: "", cliente_telefono: "",
  inicio: "", lugar: LUGARES[0], lote_id: null, notas: "",
};

export default function AgendaManager() {
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [lotes, setLotes] = useState<Lot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<NuevaCita>(VACIA);
  const [guardando, setGuardando] = useState(false);

  const rango = useMemo(() => {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const hasta = new Date(Date.now() + 90 * 24 * 60 * 60_000);
    return { desde, hasta };
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { citas } = await getCitas(rango.desde, rango.hasta);
      setCitas(citas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la agenda");
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    recargar();
    getLots().then((r) => setLotes(r.lots)).catch(() => setLotes([]));
  }, [recargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const r = editando ? await actualizarCita(editando, form) : await crearCita(form);
      setAviso(r.choque ? "Guardada. Ojo: ya tenías algo a esa hora." : "Guardada.");
      setForm(VACIA);
      setEditando(null);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(c: CitaRow) {
    if (!confirm(`¿Cancelar la cita de ${c.cliente_nombre}?`)) return;
    try {
      await cancelarCita(c.id);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar");
    }
  }

  function editar(c: CitaRow) {
    setEditando(c.id);
    setForm({
      cliente_nombre: c.cliente_nombre,
      cliente_email: c.cliente_email,
      cliente_telefono: c.cliente_telefono ?? "",
      inicio: c.inicio,
      lugar: c.lugar,
      lote_id: c.lote_id,
      notas: c.notas ?? "",
    });
  }

  const etiquetaLote = (l: Lot) =>
    `${l.project === "llanada" ? "Llanada" : "Río Celeste"} · Lote ${l.lot_number}${l.lot_suffix ?? ""}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form onSubmit={guardar} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit">
        <h2 className="font-semibold text-slate-900">
          {editando ? "Editar cita" : "Nueva cita"}
        </h2>

        <input required placeholder="Nombre del cliente" value={form.cliente_nombre}
          onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />

        <input required type="email" placeholder="Correo del cliente" value={form.cliente_email}
          onChange={(e) => setForm({ ...form, cliente_email: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <p className="text-[11px] text-slate-400">
          Sin correo no hay invitación de calendario ni recordatorios.
        </p>

        <input placeholder="Teléfono (opcional)" value={form.cliente_telefono ?? ""}
          onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />

        <label className="block text-xs text-slate-500">
          Fecha y hora (Costa Rica)
          <input required type="datetime-local"
            value={form.inicio ? localCRDesdeIso(form.inicio) : ""}
            onChange={(e) => setForm({ ...form, inicio: isoDesdeLocalCR(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>

        <select value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {LUGARES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <select value={form.lote_id ?? ""} onChange={(e) => setForm({ ...form, lote_id: e.target.value || null })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Sin lote de interés</option>
          {lotes.map((l) => <option key={l.id} value={l.id}>{etiquetaLote(l)}</option>)}
        </select>

        <textarea placeholder="Notas internas (el cliente nunca las ve)" rows={3}
          value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />

        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agendar"}
          </button>
          {editando && (
            <button type="button" onClick={() => { setEditando(null); setForm(VACIA); }}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
              Cancelar
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {aviso && <p className="text-sm text-emerald-700">{aviso}</p>}
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Próximas citas</h2>
        {cargando && <p className="text-sm text-slate-500">Cargando…</p>}
        {!cargando && citas.length === 0 && (
          <p className="text-sm text-slate-500">No hay citas en el rango.</p>
        )}
        {citas.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{c.cliente_nombre}</p>
                <p className="text-sm text-slate-600 first-letter:uppercase">{fechaLarga(c.inicio)}</p>
                <p className="text-xs text-slate-500">{c.lugar}</p>
                {c.notas && <p className="mt-1 text-xs text-amber-700">{c.notas}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => editar(c)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                  Editar
                </button>
                <button onClick={() => cancelar(c)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar que compila y que la pestaña aparece**

Run: `npx tsc --noEmit && npm run build`
Expected: build limpio.

Prueba manual: entrar a `/admin` con `aguilartradesfx@gmail.com`, confirmar que la pestaña «Agenda» aparece; entrar con `gerencia@duphomes.com` y confirmar que **no** aparece.

- [ ] **Step 7: Commit**

```bash
git add api/me.ts src/lib/adminApi.ts src/components/admin/AdminApp.tsx \
        src/components/admin/AdminDashboard.tsx src/components/admin/AgendaManager.tsx
git commit -m "Agenda: pestana en el panel, visible solo con la bandera"
```

**Fin de la fase 1.** Ya se puede agendar, ver, editar y cancelar desde el panel. Todavía no sale ningún correo.

---

## FASE 2 — Correos e invitación de calendario

### Task 5: Construir el `.ics`

**Files:**
- Create: `api/_lib/agenda/ics.ts`
- Test: `api/_lib/agenda/ics.test.ts`

**Interfaces:**
- Consumes: nada. Función pura, sin dependencias.
- Produces:
  - `interface EventoIcs { uid, secuencia, inicio: Date, duracionMin, titulo, descripcion?, lugar?, organizadorNombre, organizadorEmail, asistenteNombre, asistenteEmail, cancelado?, ahora? }`
  - `construirIcs(e: EventoIcs): string`

- [ ] **Step 1: Escribir los tests (fallan)**

Crear `api/_lib/agenda/ics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { construirIcs } from "./ics";

const BASE = {
  uid: "cita-abc@ecovivadesarrollos.com",
  secuencia: 0,
  inicio: new Date("2026-09-01T16:00:00.000Z"), // 10:00 a.m. de Costa Rica
  duracionMin: 60,
  titulo: "Visita a Lomas de la Llanada",
  organizadorNombre: "EcoViva Desarrollos",
  organizadorEmail: "noreply@send.bralto.io",
  asistenteNombre: "María Rodríguez",
  asistenteEmail: "maria@example.com",
  ahora: new Date("2026-08-19T12:00:00.000Z"),
};

describe("construirIcs", () => {
  it("emite las horas en UTC con Z", () => {
    const ics = construirIcs(BASE);
    expect(ics).toContain("DTSTART:20260901T160000Z");
    expect(ics).toContain("DTEND:20260901T170000Z");
    expect(ics).not.toContain("VTIMEZONE");
  });

  it("usa CRLF y termina con salto de línea", () => {
    const ics = construirIcs(BASE);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapa comas, punto y coma, backslash y saltos de línea", () => {
    const ics = construirIcs({
      ...BASE,
      titulo: "Visita, con coma; y punto y coma",
      descripcion: "Primera línea\nSegunda línea con \\ backslash",
    });
    expect(ics).toContain("SUMMARY:Visita\\, con coma\; y punto y coma");
    expect(ics).toContain("Primera línea\\nSegunda línea con \\\\ backslash");
  });

  it("pliega las líneas largas a 75 octetos con espacio inicial", () => {
    const ics = construirIcs({ ...BASE, titulo: "A".repeat(200) });
    const lineas = ics.split("\r\n");
    for (const l of lineas) {
      expect(Buffer.from(l, "utf8").length).toBeLessThanOrEqual(75);
    }
    // Las continuaciones arrancan con un espacio.
    const idx = lineas.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lineas[idx + 1].startsWith(" ")).toBe(true);
  });

  it("no parte un carácter multibyte al plegar", () => {
    // 80 eñes: cada una son 2 bytes en UTF-8, así que el corte cae justo en medio
    // de un carácter si el plegado cuenta caracteres en vez de octetos.
    const ics = construirIcs({ ...BASE, titulo: "ñ".repeat(80) });
    expect(ics).not.toContain("�"); // ningún carácter de reemplazo
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:" + "ñ".repeat(80));
  });

  it("al cancelar usa METHOD:CANCEL y STATUS:CANCELLED", () => {
    const ics = construirIcs({ ...BASE, secuencia: 3, cancelado: true });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:3");
  });

  it("al crear y reagendar usa METHOD:REQUEST con el mismo UID", () => {
    const creada = construirIcs(BASE);
    const movida = construirIcs({
      ...BASE,
      secuencia: 1,
      inicio: new Date("2026-09-02T16:00:00.000Z"),
    });
    expect(creada).toContain("METHOD:REQUEST");
    expect(movida).toContain("METHOD:REQUEST");
    expect(creada).toContain(`UID:${BASE.uid}`);
    expect(movida).toContain(`UID:${BASE.uid}`);
    expect(creada).toContain("SEQUENCE:0");
    expect(movida).toContain("SEQUENCE:1");
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run api/_lib/agenda/ics.test.ts`
Expected: FAIL — no existe `./ics`.

- [ ] **Step 3: Implementar**

Crear `api/_lib/agenda/ics.ts`:

```ts
// Construcción de archivos .ics (RFC 5545). Función pura, sin dependencias:
// son unas 60 líneas y meter una librería para esto no se paga.
//
// Las tres cosas que rompen un .ics en silencio y que acá se hacen a propósito:
//   1. Plegado de líneas a 75 OCTETOS (no caracteres), sin partir un carácter
//      multibyte por la mitad.
//   2. Escape de \ ; , y saltos de línea en los campos de texto.
//   3. Horas en UTC con Z, para no tener que embutir un bloque VTIMEZONE.
//      Costa Rica es UTC−6 fijo, sin horario de verano.

export interface EventoIcs {
  uid: string;
  secuencia: number;
  inicio: Date;
  duracionMin: number;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  organizadorNombre: string;
  organizadorEmail: string;
  asistenteNombre: string;
  asistenteEmail: string;
  cancelado?: boolean;
  ahora?: Date; // inyectable para que los tests sean deterministas
}

function utc(d: Date): string {
  // 2026-09-01T16:00:00.000Z → 20260901T160000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapar(v: string): string {
  // El backslash va primero o se re-escaparían los que agregan los demás.
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function plegar(linea: string): string {
  const bytes = Buffer.from(linea, "utf8");
  if (bytes.length <= 75) return linea;

  const partes: string[] = [];
  let i = 0;
  let primera = true;
  while (i < bytes.length) {
    // Las continuaciones llevan un espacio inicial que también cuenta.
    const max = primera ? 75 : 74;
    let fin = Math.min(i + max, bytes.length);
    // Retroceder hasta el inicio de un carácter: 0b10xxxxxx es continuación UTF-8.
    while (fin > i + 1 && fin < bytes.length && (bytes[fin] & 0xc0) === 0x80) fin--;
    partes.push((primera ? "" : " ") + bytes.subarray(i, fin).toString("utf8"));
    i = fin;
    primera = false;
  }
  return partes.join("\r\n");
}

export function construirIcs(e: EventoIcs): string {
  const fin = new Date(e.inicio.getTime() + e.duracionMin * 60_000);
  const metodo = e.cancelado ? "CANCEL" : "REQUEST";

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EcoViva Desarrollos//Agenda//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utc(e.ahora ?? new Date())}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(fin)}`,
    `SEQUENCE:${e.secuencia}`,
    `SUMMARY:${escapar(e.titulo)}`,
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    ...(e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : []),
    `ORGANIZER;CN=${escapar(e.organizadorNombre)}:mailto:${e.organizadorEmail}`,
    `ATTENDEE;CN=${escapar(e.asistenteNombre)};RSVP=FALSE:mailto:${e.asistenteEmail}`,
    `STATUS:${e.cancelado ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lineas.map(plegar).join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run api/_lib/agenda/ics.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/agenda/ics.ts api/_lib/agenda/ics.test.ts
git commit -m "Agenda: constructor de .ics con plegado por octetos"
```

---

### Task 6: Cliente de Resend y redacción de los correos

**Files:**
- Create: `api/_lib/agenda/resend.ts`
- Create: `api/_lib/agenda/email.ts`
- Test: `api/_lib/agenda/email.test.ts`

**Interfaces:**
- Consumes: `construirIcs` de `ics.ts`; `Cita` de `db.ts`
- Produces:
  - `resend.ts`: `enviarCorreo(opts): Promise<string>` (devuelve el id), `reprogramarCorreo(id, cuando: Date): Promise<void>`, `cancelarCorreo(id): Promise<void>`
  - `email.ts`: `type ClaseCorreo`, `datosParaCorreo(cita: Cita): DatosCorreo`, `armarCorreo(clase, datos): { subject, html, attachments }`, `enviarAhora(clase, cita): Promise<void>`

- [ ] **Step 1: Cliente HTTP de Resend**

Crear `api/_lib/agenda/resend.ts`:

```ts
// Cliente de la API HTTP de Resend. Se usa la API y no el SMTP porque el SMTP
// no puede programar envíos, y los recordatorios dependen de eso.

const BASE = "https://api.resend.com";
const REMITENTE = "EcoViva Desarrollos <noreply@send.bralto.io>";

function apiKey(): string {
  const k = process.env.RESEND_API_KEY;
  if (!k) throw new Error("Falta RESEND_API_KEY");
  return k;
}

export interface Adjunto {
  filename: string;
  content: string;      // base64
  contentType?: string;
}

async function pedir(path: string, method: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status} ${method} ${path}: ${texto.slice(0, 500)}`);
  return texto ? JSON.parse(texto) : null;
}

export async function enviarCorreo(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Adjunto[];
  cuando?: Date;   // si viene, se programa en vez de enviarse ya
}): Promise<string> {
  const body: Record<string, unknown> = {
    from: REMITENTE,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  // Que el cliente pueda responder y le llegue a una persona, no al buzón nulo.
  if (process.env.AGENDA_REPLY_TO) body.reply_to = [process.env.AGENDA_REPLY_TO];
  if (opts.attachments?.length) body.attachments = opts.attachments;
  if (opts.cuando) body.scheduled_at = opts.cuando.toISOString();

  const json = await pedir("/emails", "POST", body);
  return String((json as { id: string }).id);
}

export async function reprogramarCorreo(id: string, cuando: Date): Promise<void> {
  await pedir(`/emails/${id}`, "PATCH", { scheduled_at: cuando.toISOString() });
}

export async function cancelarCorreo(id: string): Promise<void> {
  // Un correo cancelado NO se puede reprogramar después: hay que crear otro.
  // Por eso quien cancela debe poner el id en null en la fila.
  await pedir(`/emails/${id}/cancel`, "POST");
}
```

- [ ] **Step 2: Escribir el test de redacción (falla)**

Crear `api/_lib/agenda/email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { datosParaCorreo, armarCorreo } from "./email";

const CITA = {
  id: "cita-1",
  cliente_nombre: "María Rodríguez",
  cliente_email: "maria@example.com",
  cliente_telefono: "+50688887777",
  inicio: "2026-09-01T16:00:00.000Z",
  duracion_min: 60,
  lugar: "Visita Lomas de la Llanada",
  lote_id: null,
  notas: "SECRETO: regatea mucho, no bajar de 45k",
  estado: "agendada" as const,
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-19T12:00:00.000Z",
  updated_at: "2026-08-19T12:00:00.000Z",
};

describe("datosParaCorreo", () => {
  it("no deja pasar las notas internas ni el teléfono", () => {
    const d = datosParaCorreo(CITA);
    expect(JSON.stringify(d)).not.toContain("SECRETO");
    expect(JSON.stringify(d)).not.toContain("88887777");
    expect("notas" in d).toBe(false);
  });
});

describe("armarCorreo", () => {
  const d = datosParaCorreo(CITA);

  it("la confirmación lleva el .ics y el botón de Google Calendar", () => {
    const { subject, html, attachments } = armarCorreo("confirmacion", d);
    expect(subject).toContain("cita");
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("cita.ics");
    const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:REQUEST");
    expect(html).toContain("calendar.google.com/calendar/render");
  });

  it("ningún correo al cliente contiene las notas internas", () => {
    for (const clase of ["confirmacion", "reagendado", "cancelacion", "recordatorio24h", "recordatorio1h"] as const) {
      const { html, subject } = armarCorreo(clase, d);
      expect(html).not.toContain("SECRETO");
      expect(subject).not.toContain("SECRETO");
    }
  });

  it("la cancelación adjunta un .ics de CANCEL", () => {
    const { attachments } = armarCorreo("cancelacion", { ...d, ics_secuencia: 2 });
    const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("el recordatorio de 1 hora no lleva adjunto: es un ping", () => {
    const { attachments } = armarCorreo("recordatorio1h", d);
    expect(attachments).toHaveLength(0);
  });

  it("muestra la hora de Costa Rica, no UTC", () => {
    // 16:00Z son las 10:00 a.m. en Costa Rica
    const { html } = armarCorreo("confirmacion", d);
    expect(html).toContain("10:00");
    expect(html).not.toContain("16:00");
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run api/_lib/agenda/email.test.ts`
Expected: FAIL — no existe `./email`.

- [ ] **Step 4: Implementar la redacción**

Crear `api/_lib/agenda/email.ts`:

```ts
import { construirIcs } from "./ics.js";
import { enviarCorreo, type Adjunto } from "./resend.js";
import type { Cita } from "./db.js";

// Redacción de los correos al cliente.
//
// REGLA QUE NO SE ROMPE: el cuerpo se arma desde `DatosCorreo`, un subconjunto
// EXPLÍCITO de la cita, nunca desde la fila entera. Así, agregar mañana una
// columna interna no puede filtrarla al cliente por descuido. `notas` y
// `cliente_telefono` no están acá a propósito.

export type ClaseCorreo =
  | "confirmacion"
  | "reagendado"
  | "cancelacion"
  | "recordatorio24h"
  | "recordatorio1h";

export interface DatosCorreo {
  cliente_nombre: string;
  cliente_email: string;
  inicio: string;
  duracion_min: number;
  lugar: string;
  ics_uid: string;
  ics_secuencia: number;
}

export function datosParaCorreo(cita: Cita): DatosCorreo {
  return {
    cliente_nombre: cita.cliente_nombre,
    cliente_email: cita.cliente_email,
    inicio: cita.inicio,
    duracion_min: cita.duracion_min,
    lugar: cita.lugar,
    ics_uid: cita.ics_uid,
    ics_secuencia: cita.ics_secuencia,
  };
}

const TZ = "America/Costa_Rica";

function fechaLarga(iso: string): string {
  const t = new Intl.DateTimeFormat("es-CR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
  }).format(new Date(iso));
}

// Enlace de "Agregar a Google Calendar". El adjunto .ics cubre Apple y Outlook;
// esto cubre Gmail, que es donde va a estar la mayoría.
function enlaceGoogle(d: DatosCorreo): string {
  const ini = new Date(d.inicio);
  const fin = new Date(ini.getTime() + d.duracion_min * 60_000);
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Cita con EcoViva — ${d.lugar}`,
    dates: `${fmt(ini)}/${fmt(fin)}`,
    details: "Cita coordinada con EcoViva Desarrollos.",
    location: d.lugar,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function envoltura(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#059669;margin:0 0 8px">EcoViva Desarrollos</p>
  <h1 style="font-size:22px;color:#0f172a;margin:0 0 20px">${titulo}</h1>
  ${cuerpo}
  <p style="font-size:12px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px">
    Si necesitás cambiar la cita, respondé este correo.
  </p>
</div></body></html>`;
}

function bloqueDatos(d: DatosCorreo): string {
  return `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
  <tr><td style="padding:16px 20px">
    <p style="margin:0 0 4px;font-size:16px;color:#0f172a"><strong>${fechaLarga(d.inicio)}</strong></p>
    <p style="margin:0 0 12px;font-size:16px;color:#0f172a">${hora(d.inicio)}</p>
    <p style="margin:0;font-size:14px;color:#475569">${d.lugar}</p>
  </td></tr></table>`;
}

function botonGoogle(d: DatosCorreo): string {
  return `<p style="margin:20px 0">
    <a href="${enlaceGoogle(d)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
      Agregar a Google Calendar
    </a>
  </p>
  <p style="font-size:12px;color:#94a3b8;margin:0">
    ¿Usás iPhone o Outlook? Abrí el archivo <strong>cita.ics</strong> adjunto.
  </p>`;
}

function adjuntoIcs(d: DatosCorreo, cancelado: boolean): Adjunto[] {
  const ics = construirIcs({
    uid: d.ics_uid,
    secuencia: d.ics_secuencia,
    inicio: new Date(d.inicio),
    duracionMin: d.duracion_min,
    titulo: `Cita con EcoViva — ${d.lugar}`,
    descripcion: "Cita coordinada con EcoViva Desarrollos.",
    lugar: d.lugar,
    organizadorNombre: "EcoViva Desarrollos",
    organizadorEmail: "noreply@send.bralto.io",
    asistenteNombre: d.cliente_nombre,
    asistenteEmail: d.cliente_email,
    cancelado,
  });
  return [{
    filename: "cita.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
    contentType: "text/calendar",
  }];
}

export function armarCorreo(
  clase: ClaseCorreo,
  d: DatosCorreo,
): { subject: string; html: string; attachments: Adjunto[] } {
  const nombre = d.cliente_nombre.split(" ")[0];

  switch (clase) {
    case "confirmacion":
      return {
        subject: `Tu cita con EcoViva — ${fechaLarga(d.inicio)}, ${hora(d.inicio)}`,
        html: envoltura("Tu cita quedó agendada", `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, te esperamos:</p>
          ${bloqueDatos(d)}${botonGoogle(d)}`),
        attachments: adjuntoIcs(d, false),
      };

    case "reagendado":
      return {
        subject: `Cambio de hora: tu cita ahora es el ${fechaLarga(d.inicio)}`,
        html: envoltura("Cambiamos la hora de tu cita", `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, tu cita quedó reprogramada:</p>
          ${bloqueDatos(d)}
          <p style="font-size:13px;color:#475569">Si ya la tenías en tu calendario, se actualiza sola al abrir el archivo adjunto.</p>
          ${botonGoogle(d)}`),
        attachments: adjuntoIcs(d, false),
      };

    case "cancelacion":
      return {
        subject: `Cita cancelada — ${fechaLarga(d.inicio)}`,
        html: envoltura("Tu cita fue cancelada", `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, cancelamos la cita del ${fechaLarga(d.inicio)} a las ${hora(d.inicio)}.</p>
          <p style="font-size:15px;color:#334155">Si querés reprogramarla, respondé este correo y la coordinamos.</p>`),
        attachments: adjuntoIcs(d, true),
      };

    case "recordatorio24h":
      return {
        subject: `Mañana: tu cita con EcoViva a las ${hora(d.inicio)}`,
        html: envoltura("Tu cita es mañana", `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, te recordamos:</p>
          ${bloqueDatos(d)}${botonGoogle(d)}`),
        attachments: adjuntoIcs(d, false),
      };

    case "recordatorio1h":
      // Un ping. Sin adjunto: a esta altura ya lo tiene o ya no le sirve.
      return {
        subject: `En una hora: tu cita con EcoViva`,
        html: envoltura("Tu cita es en una hora", `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, nos vemos a las ${hora(d.inicio)} en ${d.lugar}.</p>`),
        attachments: [],
      };
  }
}

// Envío inmediato (confirmación, reagendado, cancelación).
export async function enviarAhora(clase: ClaseCorreo, cita: Cita): Promise<void> {
  const d = datosParaCorreo(cita);
  const { subject, html, attachments } = armarCorreo(clase, d);
  await enviarCorreo({ to: d.cliente_email, subject, html, attachments });
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run api/_lib/agenda/email.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/agenda/resend.ts api/_lib/agenda/email.ts api/_lib/agenda/email.test.ts
git commit -m "Agenda: cliente de Resend y redaccion de los cinco correos"
```

---

### Task 7: Enganchar los correos al CRUD

**Files:**
- Modify: `api/agenda/citas.ts`
- Modify: `api/agenda/citas.test.ts` (dos casos nuevos)

**Interfaces:**
- Consumes: `enviarAhora` de `email.ts`
- Produces: las respuestas de POST/PATCH/DELETE ganan `correo: "enviado" | "fallo"`

- [ ] **Step 1: Agregar los casos de test**

En `api/agenda/citas.test.ts`, agregar al mock de módulos:

```ts
const enviarAhora = vi.fn();
vi.mock("../_lib/agenda/email.js", () => ({
  enviarAhora: (...a: unknown[]) => enviarAhora(...a),
}));
```

Y estos dos casos dentro del `describe`:

```ts
  it("manda la confirmación al crear", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    crearCita.mockResolvedValue({ id: "nueva", cliente_email: "maria@example.com" });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María", cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada",
      }),
      res,
    );
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.objectContaining({ id: "nueva" }));
    expect(res.body.correo).toBe("enviado");
  });

  it("si el correo falla, la cita igual queda guardada", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    crearCita.mockResolvedValue({ id: "nueva", cliente_email: "maria@example.com" });
    enviarAhora.mockRejectedValue(new Error("Resend 500"));
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María", cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada",
      }),
      res,
    );
    // Mismo criterio que /api/reserve: lo que ya se guardó no se pierde porque
    // falle un paso posterior.
    expect(res.statusCode).toBe(200);
    expect(res.body.cita.id).toBe("nueva");
    expect(res.body.correo).toBe("fallo");
  });
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `npx vitest run api/agenda/citas.test.ts`
Expected: FAIL — `enviarAhora` nunca se llama.

- [ ] **Step 3: Enganchar**

En `api/agenda/citas.ts`, agregar el import:

```ts
import { enviarAhora, type ClaseCorreo } from "../_lib/agenda/email.js";
import type { Cita } from "../_lib/agenda/db.js";
```

Agregar el helper antes del handler:

```ts
// El correo va DESPUÉS de guardar y nunca deshace lo guardado. Mismo criterio
// que api/reserve.ts, donde el lead nunca se pierde porque falle un paso
// posterior. Se reporta el resultado para que el panel lo pueda mostrar.
async function avisarAlCliente(clase: ClaseCorreo, cita: Cita): Promise<"enviado" | "fallo"> {
  try {
    await enviarAhora(clase, cita);
    return "enviado";
  } catch (e) {
    console.error(`agenda/citas: no se pudo mandar el correo "${clase}"`, e);
    return "fallo";
  }
}
```

Y cambiar los tres retornos:

```ts
      // POST
      const cita = await crearCita(leido.datos, caller.email, "panel");
      const correo = await avisarAlCliente("confirmacion", cita);
      return res.status(200).json({ cita, choque, correo });
```

```ts
      // PATCH
      const cita = await actualizarCita(id, leido.datos, caller.email, "panel");
      const correo = await avisarAlCliente("reagendado", cita);
      return res.status(200).json({ cita, choque, correo });
```

```ts
      // DELETE
      const cita = await cancelarCita(id, caller.email, "panel");
      const correo = await avisarAlCliente("cancelacion", cita);
      return res.status(200).json({ cita, correo });
```

- [ ] **Step 4: Correr toda la suite**

Run: `npx vitest run`
Expected: PASS, todos los archivos.

- [ ] **Step 5: Mostrar el resultado del correo en el panel**

En `src/components/admin/AgendaManager.tsx`, dentro de `guardar()`, reemplazar la línea de `setAviso`:

```ts
      const avisos: string[] = ["Guardada."];
      if (r.choque) avisos.push("Ojo: ya tenías algo a esa hora.");
      if (r.correo === "fallo") avisos.push("El correo al cliente NO salió — avisale por otro medio.");
      setAviso(avisos.join(" "));
```

Y ampliar el tipo de retorno en `src/lib/adminApi.ts`:

```ts
export function crearCita(datos: NuevaCita): Promise<{ cita: CitaRow; choque: boolean; correo: "enviado" | "fallo" }> {
  return request(`/api/agenda/citas`, { method: "POST", body: JSON.stringify(datos) });
}

export function actualizarCita(
  id: string,
  datos: NuevaCita,
): Promise<{ cita: CitaRow; choque: boolean; correo: "enviado" | "fallo" }> {
  return request(`/api/agenda/citas`, { method: "PATCH", body: JSON.stringify({ id, ...datos }) });
}
```

- [ ] **Step 6: Prueba real de punta a punta**

Agendar una cita desde el panel con **tu propio correo** como cliente. Verificar:
1. Llega el correo con el asunto correcto y la hora de Costa Rica.
2. El adjunto `cita.ics` abre y crea el evento a la hora correcta.
3. Mover la cita: llega el segundo correo y el evento **se mueve**, no se duplica.
4. Cancelarla: llega el tercer correo y el evento desaparece del calendario.

El punto 3 es el que hay que mirar con más cuidado: si te quedan dos eventos, el `ics_uid` se está regenerando y hay que revisar `crearCita`/`actualizarCita`.

- [ ] **Step 7: Commit**

```bash
git add api/agenda/citas.ts api/agenda/citas.test.ts src/lib/adminApi.ts src/components/admin/AgendaManager.tsx
git commit -m "Agenda: correo de confirmacion, cambio y cancelacion"
```

**Fin de la fase 2.** Ya es «tipo Calendly» para el cliente.

---

## FASE 3 — Recordatorios automáticos

### Task 8: Decidir qué recordatorios corresponden (función pura)

**Files:**
- Create: `api/_lib/agenda/recordatorios.ts`
- Test: `api/_lib/agenda/recordatorios.test.ts`

**Interfaces:**
- Consumes: nada. Función pura.
- Produces:
  - `type Clase = "24h" | "1h"`
  - `type Accion = { tipo: "programar"; clase: Clase; enviarA: Date } | { tipo: "reprogramar"; clase: Clase; emailId: string; enviarA: Date } | { tipo: "cancelar"; clase: Clase; emailId: string } | { tipo: "nada"; clase: Clase }`
  - `planificarRecordatorios(opts: { inicio: Date; ahora: Date; idActual24h: string | null; idActual1h: string | null; citaCancelada?: boolean }): Accion[]`

- [ ] **Step 1: Escribir los tests (fallan)**

Crear `api/_lib/agenda/recordatorios.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planificarRecordatorios } from "./recordatorios";

const AHORA = new Date("2026-08-19T12:00:00.000Z");
const enDias = (d: number) => new Date(AHORA.getTime() + d * 24 * 60 * 60_000);
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 60 * 60_000);

function accion(as: ReturnType<typeof planificarRecordatorios>, clase: "24h" | "1h") {
  return as.find((a) => a.clase === clase)!;
}

describe("planificarRecordatorios", () => {
  it("cita en 3 días sin nada programado: programa los dos", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("programar");
    expect(accion(as, "1h").tipo).toBe("programar");
  });

  it("calcula bien los instantes de envío", () => {
    const inicio = enDias(3);
    const as = planificarRecordatorios({
      inicio, ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    const a24 = accion(as, "24h") as { enviarA: Date };
    const a1 = accion(as, "1h") as { enviarA: Date };
    expect(a24.enviarA.getTime()).toBe(inicio.getTime() - 24 * 60 * 60_000);
    expect(a1.enviarA.getTime()).toBe(inicio.getTime() - 60 * 60_000);
  });

  it("cita en 6 horas: el de 24h ya no aplica, el de 1h sí", () => {
    const as = planificarRecordatorios({
      inicio: enHoras(6), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("programar");
  });

  it("cita en 30 minutos: ninguno aplica", () => {
    const as = planificarRecordatorios({
      inicio: new Date(AHORA.getTime() + 30 * 60_000),
      ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("cita a más de 30 días: quedan pendientes para el cron", () => {
    const as = planificarRecordatorios({
      inicio: enDias(45), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("reagendar dentro de la ventana: reprograma los existentes", () => {
    const as = planificarRecordatorios({
      inicio: enDias(5), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    const a24 = accion(as, "24h");
    expect(a24.tipo).toBe("reprogramar");
    expect((a24 as { emailId: string }).emailId).toBe("em_24");
  });

  it("reagendar fuera de la ventana: cancela los existentes", () => {
    const as = planificarRecordatorios({
      inicio: enDias(60), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("cancelar");
  });

  it("mover una cita a dentro de 6 horas cancela el de 24h y reprograma el de 1h", () => {
    const as = planificarRecordatorios({
      inicio: enHoras(6), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("reprogramar");
  });

  it("cancelar la cita cancela todo lo programado", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA,
      idActual24h: "em_24", idActual1h: "em_1", citaCancelada: true,
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("cancelar");
  });

  it("cancelar una cita que no tenía nada programado no hace nada", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA,
      idActual24h: null, idActual1h: null, citaCancelada: true,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("no programa nada a menos de 2 minutos de distancia", () => {
    // El margen evita que Resend rechace un scheduled_at que ya quedó en el
    // pasado entre que se calcula y se manda la petición.
    const as = planificarRecordatorios({
      inicio: new Date(AHORA.getTime() + 61 * 60_000), // el de 1h caería en 1 min
      ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "1h").tipo).toBe("nada");
  });
});
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `npx vitest run api/_lib/agenda/recordatorios.test.ts`
Expected: FAIL — no existe `./recordatorios`.

- [ ] **Step 3: Implementar la decisión**

Crear `api/_lib/agenda/recordatorios.ts`:

```ts
// Decidir qué recordatorios corresponden. Función PURA a propósito: separar
// "decidir" de "hacer" es lo que permite probar todas las reglas de borde sin
// red de por medio. La parte que llama a Resend está más abajo y no tiene
// lógica propia.

export type Clase = "24h" | "1h";

export type Accion =
  | { tipo: "programar"; clase: Clase; enviarA: Date }
  | { tipo: "reprogramar"; clase: Clase; emailId: string; enviarA: Date }
  | { tipo: "cancelar"; clase: Clase; emailId: string }
  | { tipo: "nada"; clase: Clase };

const OFFSETS: Record<Clase, number> = {
  "24h": 24 * 60 * 60_000,
  "1h": 60 * 60_000,
};

// Resend acepta hasta 30 días. Se usa 29 para no rozar el borde entre que se
// calcula el instante y se manda la petición.
const VENTANA_MS = 29 * 24 * 60 * 60_000;

// Un scheduled_at a segundos de distancia puede quedar en el pasado para cuando
// la petición llega. Dos minutos de colchón.
const MARGEN_MS = 2 * 60_000;

export function planificarRecordatorios(opts: {
  inicio: Date;
  ahora: Date;
  idActual24h: string | null;
  idActual1h: string | null;
  citaCancelada?: boolean;
}): Accion[] {
  const actuales: Record<Clase, string | null> = {
    "24h": opts.idActual24h,
    "1h": opts.idActual1h,
  };

  return (Object.keys(OFFSETS) as Clase[]).map((clase): Accion => {
    const emailId = actuales[clase];

    if (opts.citaCancelada) {
      return emailId ? { tipo: "cancelar", clase, emailId } : { tipo: "nada", clase };
    }

    const enviarA = new Date(opts.inicio.getTime() - OFFSETS[clase]);
    const dentro =
      enviarA.getTime() > opts.ahora.getTime() + MARGEN_MS &&
      enviarA.getTime() <= opts.ahora.getTime() + VENTANA_MS;

    if (!dentro) {
      // Fuera de ventana: si había algo programado hay que quitarlo, porque ya
      // no corresponde (o el envío quedó en el pasado, o falta demasiado).
      return emailId ? { tipo: "cancelar", clase, emailId } : { tipo: "nada", clase };
    }

    return emailId
      ? { tipo: "reprogramar", clase, emailId, enviarA }
      : { tipo: "programar", clase, enviarA };
  });
}
```

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `npx vitest run api/_lib/agenda/recordatorios.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/agenda/recordatorios.ts api/_lib/agenda/recordatorios.test.ts
git commit -m "Agenda: reglas de programacion de recordatorios"
```

---

### Task 9: Aplicar el plan de recordatorios contra Resend

**Files:**
- Modify: `api/_lib/agenda/recordatorios.ts` (agregar `aplicarRecordatorios`)
- Modify: `api/agenda/citas.ts` (llamarla en POST, PATCH y DELETE)

**Interfaces:**
- Consumes: `planificarRecordatorios`; `enviarCorreo`/`reprogramarCorreo`/`cancelarCorreo` de `resend.ts`; `armarCorreo`/`datosParaCorreo` de `email.ts`; `guardarIdsRecordatorio` de `db.ts`
- Produces: `aplicarRecordatorios(cita: Cita, ahora?: Date): Promise<void>`

- [ ] **Step 1: VERIFICAR PRIMERO que la llave de Resend puede reprogramar y cancelar**

Este es el riesgo abierto 1 del spec. **No sigas con los pasos siguientes hasta resolverlo.**

Correr este script, que programa un correo a 20 días, lo reprograma y lo cancela:

```bash
cd "/Users/alejandro/Documents/Visual Studio Code/Ecoviva"
KEY=$(grep -E '^RESEND_API_KEY=' .env.local | cut -d= -f2-)
DEST="aguilartradesfx@gmail.com"

ID=$(curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"from\":\"EcoViva Desarrollos <noreply@send.bralto.io>\",\"to\":[\"$DEST\"],\"subject\":\"prueba de programacion (ignorar)\",\"html\":\"<p>prueba</p>\",\"scheduled_at\":\"2026-09-08T12:00:00.000Z\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
echo "id programado: $ID"

echo "--- reprogramar (PATCH) ---"
curl -s -X PATCH "https://api.resend.com/emails/$ID" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"scheduled_at":"2026-09-09T12:00:00.000Z"}'

echo ""; echo "--- cancelar ---"
curl -s -X POST "https://api.resend.com/emails/$ID/cancel" -H "Authorization: Bearer $KEY"
echo ""
```

Expected: las tres llamadas devuelven JSON con un `id`, sin `statusCode: 401` ni `restricted_api_key`.

**Si el PATCH o el cancel devuelven 401 o `restricted_api_key`:** parar y pedirle al usuario que cree en resend.com/api-keys una llave con permiso **Full access**, y reemplazar `RESEND_API_KEY` en `.env.local` y en las variables de entorno de Vercel. Sin esto, reagendar no puede mover los recordatorios ya programados y el cliente recibiría el aviso a la hora vieja.

**Al terminar, cancelar el correo de prueba** (el script ya lo hace en el último paso) para que no le llegue nada real a nadie.

- [ ] **Step 2: Implementar `aplicarRecordatorios`**

Agregar al final de `api/_lib/agenda/recordatorios.ts`:

```ts
import { enviarCorreo, reprogramarCorreo, cancelarCorreo } from "./resend.js";
import { armarCorreo, datosParaCorreo } from "./email.js";
import { guardarIdsRecordatorio } from "./db.js";
import type { Cita } from "./db.js";

const CLASE_A_CORREO = {
  "24h": "recordatorio24h",
  "1h": "recordatorio1h",
} as const;

// Ejecuta el plan y guarda los ids resultantes. Nunca tira: un fallo acá deja
// el id en null, y el reconciliador del cron lo retoma al día siguiente.
export async function aplicarRecordatorios(cita: Cita, ahora = new Date()): Promise<void> {
  const acciones = planificarRecordatorios({
    inicio: new Date(cita.inicio),
    ahora,
    idActual24h: cita.recordatorio_24h_email_id,
    idActual1h: cita.recordatorio_1h_email_id,
    citaCancelada: cita.estado === "cancelada",
  });

  const d = datosParaCorreo(cita);
  const nuevos: { r24h?: string | null; r1h?: string | null } = {};
  const guardar = (clase: Clase, valor: string | null) => {
    if (clase === "24h") nuevos.r24h = valor;
    else nuevos.r1h = valor;
  };

  for (const a of acciones) {
    try {
      if (a.tipo === "nada") continue;

      if (a.tipo === "cancelar") {
        await cancelarCorreo(a.emailId);
        // Un correo cancelado en Resend NO se puede reprogramar: el id deja de
        // servir para siempre, así que se borra de la fila.
        guardar(a.clase, null);
        continue;
      }

      if (a.tipo === "reprogramar") {
        await reprogramarCorreo(a.emailId, a.enviarA);
        continue; // el id no cambia
      }

      const { subject, html, attachments } = armarCorreo(CLASE_A_CORREO[a.clase], d);
      const id = await enviarCorreo({
        to: d.cliente_email, subject, html, attachments, cuando: a.enviarA,
      });
      guardar(a.clase, id);
    } catch (e) {
      console.error(`agenda/recordatorios: fallo la accion ${a.tipo} de ${a.clase}`, e);
      // Se deja en null para que el reconciliador lo vuelva a intentar.
      if (a.tipo === "programar") guardar(a.clase, null);
    }
  }

  await guardarIdsRecordatorio(cita.id, nuevos);
}
```

- [ ] **Step 3: Llamarla desde el CRUD**

En `api/agenda/citas.ts`, agregar el import:

```ts
import { aplicarRecordatorios } from "../_lib/agenda/recordatorios.js";
```

Y ampliar `avisarAlCliente` para que también acomode los recordatorios:

```ts
async function avisarAlCliente(clase: ClaseCorreo, cita: Cita): Promise<"enviado" | "fallo"> {
  // Los recordatorios se acomodan siempre, salga o no el correo inmediato: son
  // mecanismos independientes y uno no debe arrastrar al otro.
  const recordatorios = aplicarRecordatorios(cita).catch((e) => {
    console.error("agenda/citas: no se pudieron acomodar los recordatorios", e);
  });

  let resultado: "enviado" | "fallo" = "enviado";
  try {
    await enviarAhora(clase, cita);
  } catch (e) {
    console.error(`agenda/citas: no se pudo mandar el correo "${clase}"`, e);
    resultado = "fallo";
  }

  await recordatorios;
  return resultado;
}
```

- [ ] **Step 4: Correr toda la suite**

Run: `npx vitest run`
Expected: PASS. Si `citas.test.ts` falla por el módulo nuevo, agregar el mock:

```ts
vi.mock("../_lib/agenda/recordatorios.js", () => ({
  aplicarRecordatorios: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 5: Prueba real**

Agendar una cita a 3 días con tu correo. En el dashboard de Resend, confirmar que aparecen **dos** correos en estado `scheduled` con las horas correctas. Mover la cita un día: confirmar que los dos `scheduled` cambiaron de hora y **no** se crearon dos nuevos. Cancelarla: confirmar que los dos quedan `canceled`.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/agenda/recordatorios.ts api/agenda/citas.ts api/agenda/citas.test.ts
git commit -m "Agenda: programar, reprogramar y cancelar recordatorios en Resend"
```

---

### Task 10: Cron de reconciliación

**Files:**
- Create: `api/cron/agenda.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `listarCitas`, `aplicarRecordatorios`, `supabaseAdmin`
- Produces: `GET /api/cron/agenda` → `{ reconciliadas: number, completadas: number }`

> **Nota de alcance:** el resumen diario por Telegram **no** entra acá. Telegram es la fase 5 y va en el plan siguiente, que agregará ese paso a este mismo cron. Esta tarea entrega solo la reconciliación y el housekeeping, que es lo que puede funcionar hoy.

- [ ] **Step 1: Escribir el cron**

Crear `api/cron/agenda.ts`:

```ts
import { supabaseAdmin } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import { aplicarRecordatorios } from "../_lib/agenda/recordatorios.js";

// /api/cron/agenda — corre una vez al día (11:00 UTC = 5 a.m. de Costa Rica).
//
// Hace dos cosas, ninguna sensible a la hora exacta. Eso es a propósito: en el
// plan Hobby de Vercel el cron solo corre una vez al día y con ±59 minutos de
// imprecisión. Los recordatorios del cliente NO pasan por acá — los entrega
// Resend al minuto — así que esa imprecisión nunca llega al cliente.
//
//   1. Reconciliar: citas de las próximas 48h a las que les falte algún
//      recordatorio programado. Cubre los fallos transitorios de Resend y las
//      citas agendadas a más de 30 días, que recién ahora entran en ventana.
//   2. Marcar como completada lo que ya pasó, para que la vista no se llene.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // Vercel manda este header en los crons. Sin el secreto, la URL sería pública.
  const auth = (req.headers["authorization"] || "") as string;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const ahora = new Date();

  try {
    // ── 1. Reconciliar ──
    const proximas = await listarCitas({
      desde: ahora,
      hasta: new Date(ahora.getTime() + 48 * 60 * 60_000),
    });

    // Idempotente por construcción: solo se toca lo que tiene un id en null, así
    // que correr el cron de más no duplica ni reprograma nada.
    const pendientes = proximas.filter(
      (c) =>
        c.estado === "agendada" &&
        (c.recordatorio_24h_email_id === null || c.recordatorio_1h_email_id === null),
    );

    for (const cita of pendientes) {
      await aplicarRecordatorios(cita, ahora);
    }

    // ── 2. Housekeeping ──
    const { data: completadas, error } = await supabaseAdmin()
      .from("citas")
      .update({ estado: "completada" })
      .eq("estado", "agendada")
      .lt("inicio", ahora.toISOString())
      .select("id");

    if (error) console.error("cron/agenda: no se pudo cerrar las citas pasadas", error);

    return res.status(200).json({
      reconciliadas: pendientes.length,
      completadas: completadas?.length ?? 0,
    });
  } catch (e) {
    console.error("cron/agenda error", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
```

- [ ] **Step 2: Registrar el cron en Vercel**

Reemplazar `vercel.json` por:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/agenda", "schedule": "0 11 * * *" }
  ]
}
```

**Una sola vez al día a propósito.** Si el proyecto está en el plan Hobby, cualquier expresión más frecuente **falla el deploy** con «Hobby accounts are limited to daily cron jobs» — no se degrada, revienta.

- [ ] **Step 3: Agregar `CRON_SECRET`**

Generar un secreto y agregarlo a `.env.local` y a las variables de entorno del proyecto en Vercel:

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 4: Probar el cron a mano**

Después de desplegar:

```bash
SECRET=$(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -s -H "Authorization: Bearer $SECRET" \
  https://www.ecovivadesarrollos.com/api/cron/agenda
```

Expected: `{"reconciliadas":N,"completadas":M}`.

Y verificar que sin el header responde 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.ecovivadesarrollos.com/api/cron/agenda
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add api/cron/agenda.ts vercel.json
git commit -m "Agenda: cron diario de reconciliacion y cierre de citas pasadas"
```

**Fin de la fase 3.** Los recordatorios ya salen solos.

---

## FASE 4 — La agenda en el celular

### Task 11: Feed `.ics` de suscripción

**Files:**
- Create: `api/agenda/feed.ts`
- Modify: `api/agenda/citas.ts` (nada) — no aplica
- Modify: `src/lib/adminApi.ts` (obtener y rotar el token)
- Modify: `src/components/admin/AgendaManager.tsx` (mostrar la URL)
- Create: `api/agenda/feed-token.ts`

**Interfaces:**
- Consumes: `requireAgenda`, `listarCitas`, `construirIcs`, `supabaseAdmin`
- Produces:
  - `GET /api/agenda/feed?token=<uuid>` → `text/calendar`
  - `GET|POST /api/agenda/feed-token` → `{ url: string }` (POST rota el token)
  - `getFeedUrl(): Promise<{ url: string }>`, `rotarFeedToken(): Promise<{ url: string }>`

- [ ] **Step 1: Endpoint del token**

Crear `api/agenda/feed-token.ts`:

```ts
import { requireAgenda, supabaseAdmin } from "../_lib/supabase.js";
import { randomUUID } from "node:crypto";

// GET  → devuelve la URL del feed (creando el token la primera vez)
// POST → rota el token: la URL vieja deja de servir de inmediato

function urlDelFeed(token: string): string {
  const sitio = process.env.PUBLIC_SITE_URL || "https://www.ecovivadesarrollos.com";
  return `${sitio}/api/agenda/feed?token=${token}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const caller = await requireAgenda(req);
  if (!caller || !caller.userId) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      const { data } = await db
        .from("app_users").select("feed_token").eq("user_id", caller.userId).maybeSingle();
      let token = data?.feed_token as string | null;
      if (!token) {
        token = randomUUID();
        await db.from("app_users").update({ feed_token: token }).eq("user_id", caller.userId);
      }
      return res.status(200).json({ url: urlDelFeed(token) });
    }

    if (req.method === "POST") {
      const token = randomUUID();
      const { error } = await db
        .from("app_users").update({ feed_token: token }).eq("user_id", caller.userId);
      if (error) {
        console.error("agenda/feed-token: no se pudo rotar", error);
        return res.status(500).json({ error: "No se pudo generar la URL nueva." });
      }
      return res.status(200).json({ url: urlDelFeed(token) });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("agenda/feed-token error", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
```

- [ ] **Step 2: Endpoint del feed**

Crear `api/agenda/feed.ts`:

```ts
import { supabaseAdmin } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import { construirIcs } from "../_lib/agenda/ics.js";

// /api/agenda/feed?token=<uuid> — calendario de suscripción para el celular.
//
// El token ES la credencial: una suscripción de calendario no puede iniciar
// sesión, así que quien tenga el enlace ve la agenda. Por eso es un uuid y se
// puede rotar desde el panel.
//
// A diferencia del correo al cliente, acá SÍ van el teléfono y las notas
// internas: es el calendario privado de ellos.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const token = (req.query?.token ?? "") as string;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(404).send("No encontrado");

  const { data: usuario, error } = await supabaseAdmin()
    .from("app_users")
    .select("user_id, agenda, status")
    .eq("feed_token", token)
    .maybeSingle();

  // Mismo 404 para token inválido y para cuenta sin permiso: no se confirma la
  // existencia de un token a quien lo esté probando.
  if (error || !usuario || usuario.agenda !== true || usuario.status !== "active") {
    return res.status(404).send("No encontrado");
  }

  const ahora = Date.now();
  const citas = await listarCitas({
    desde: new Date(ahora - 30 * 24 * 60 * 60_000),
    hasta: new Date(ahora + 180 * 24 * 60 * 60_000),
  });

  // Un solo VCALENDAR con todos los eventos: se reusa construirIcs por cita y se
  // extraen sus VEVENT, para no duplicar el plegado y el escape.
  const eventos = citas
    .map((c) => {
      const uno = construirIcs({
        uid: c.ics_uid,
        secuencia: c.ics_secuencia,
        inicio: new Date(c.inicio),
        duracionMin: c.duracion_min,
        titulo: `${c.cliente_nombre} — ${c.lugar}`,
        descripcion: [
          c.cliente_telefono ? `Tel: ${c.cliente_telefono}` : null,
          c.cliente_email,
          c.notas ? `Notas: ${c.notas}` : null,
        ].filter(Boolean).join("\n"),
        lugar: c.lugar,
        organizadorNombre: "EcoViva Desarrollos",
        organizadorEmail: "noreply@send.bralto.io",
        asistenteNombre: c.cliente_nombre,
        asistenteEmail: c.cliente_email,
      });
      const desde = uno.indexOf("BEGIN:VEVENT");
      const hasta = uno.indexOf("END:VEVENT") + "END:VEVENT".length;
      return uno.slice(desde, hasta);
    })
    .join("\r\n");

  const cuerpo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EcoViva Desarrollos//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Agenda EcoViva",
    "X-WR-TIMEZONE:America/Costa_Rica",
    eventos,
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  return res.status(200).send(cuerpo);
}
```

- [ ] **Step 3: Llamadas en el cliente**

Agregar a `src/lib/adminApi.ts`:

```ts
export function getFeedUrl(): Promise<{ url: string }> {
  return request<{ url: string }>("/api/agenda/feed-token");
}

export function rotarFeedToken(): Promise<{ url: string }> {
  return request<{ url: string }>("/api/agenda/feed-token", { method: "POST" });
}
```

- [ ] **Step 4: Mostrarlo en el panel**

En `AgendaManager.tsx`, agregar el import y el estado:

```ts
import { getFeedUrl, rotarFeedToken } from "../../lib/adminApi";
// …
const [feedUrl, setFeedUrl] = useState<string | null>(null);
```

Dentro del `useEffect` existente, agregar:

```ts
    getFeedUrl().then((r) => setFeedUrl(r.url)).catch(() => setFeedUrl(null));
```

Y al final del formulario, antes de `</form>`:

```tsx
        {feedUrl && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700">Ver la agenda en tu celular</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Suscribí esta URL en tu calendario. Es de solo lectura y puede tardar en
              refrescar — para cambios al instante, usá el panel.
            </p>
            <input readOnly value={feedUrl} onFocus={(e) => e.target.select()}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600" />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => navigator.clipboard.writeText(feedUrl)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                Copiar
              </button>
              <button type="button"
                onClick={async () => {
                  if (!confirm("La URL actual dejará de funcionar. ¿Seguir?")) return;
                  const r = await rotarFeedToken();
                  setFeedUrl(r.url);
                }}
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">
                Generar URL nueva
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Probar el feed**

```bash
curl -s "https://www.ecovivadesarrollos.com/api/agenda/feed?token=<el-token>" | head -20
curl -s -o /dev/null -w "%{http_code}\n" "https://www.ecovivadesarrollos.com/api/agenda/feed?token=00000000-0000-0000-0000-000000000000"
```

Expected: el primero devuelve un `VCALENDAR`; el segundo, `404`.

Prueba real: suscribir la URL en el iPhone (Ajustes → Calendario → Cuentas → Añadir → Otra → Añadir suscripción) y confirmar que las citas aparecen a la hora correcta.

- [ ] **Step 6: Commit**

```bash
git add api/agenda/feed.ts api/agenda/feed-token.ts src/lib/adminApi.ts src/components/admin/AgendaManager.tsx
git commit -m "Agenda: feed .ics de suscripcion con token rotable"
```

**Fin de la fase 4.** El plan de la fase 5 (bot de Telegram) se escribe a partir de acá.

---

## Autorrevisión del plan

Hecha contra el spec después de escribirlo:

**Cobertura del spec.** Cada sección tiene tarea: permisos → 1; modelo de datos → 1; capa de datos → 2; CRUD → 3; panel → 4; `.ics` → 5; correos → 6 y 7; reglas de recordatorios → 8; aplicación contra Resend → 9; cron → 10; feed → 11. Las cuatro pruebas que pedía el spec están: `permisos.test.ts` (1), `ics.test.ts` (5), `recordatorios.test.ts` (8) y — la cuarta, `agente.test.ts` — pertenece a la fase 5 y va en el plan siguiente, junto con el resumen diario de Telegram, que por eso no aparece en la Task 10.

**Consistencia de tipos.** `Cita`, `DatosCita` y `Origen` se definen en la Task 2 y se usan igual en 3, 6, 7, 9, 10 y 11. `Clase` y `Accion` se definen en la 8 y se consumen en la 9. `DatosCorreo` se define en la 6 y `armarCorreo` recibe siempre `DatosCorreo`, nunca `Cita`, que es lo que hace estructuralmente imposible filtrar `notas`.

**Dos cosas que la revisión cambió:**

- La Task 4 originalmente hacía que `AdminDashboard` llamara a `getMe` por su cuenta. `AdminApp` ya lo llama para decidir el acceso; una segunda llamada era una petición de red repetida y una segunda fuente de verdad. Ahora la bandera baja como prop.
- El cron de la Task 10 iba a mandar el resumen diario. Depende de Telegram, que es la fase 5. Se sacó y se dejó anotado, en vez de dejar una tarea que no puede terminar.
