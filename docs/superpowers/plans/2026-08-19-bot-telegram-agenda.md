# Bot de Telegram para la agenda — Plan de implementación (fase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Alina y Alejandro puedan agendar, mover, editar y cancelar citas escribiéndole en lenguaje natural a un bot de Telegram, con confirmación por botones antes de que se toque nada, y restringido a ellos dos.

**Architecture:** Un webhook de Vercel recibe los mensajes, autoriza contra la misma tabla de permisos del panel, y corre un bucle manual de herramientas contra Claude. Las herramientas de lectura se ejecutan solas; las de escritura **cortan el turno**: se guarda la acción propuesta, se manda un resumen con botones, y solo al tocar Confirmar se ejecuta — por el mismo camino que usa el panel, no por una segunda implementación.

**Tech Stack:** Vercel Functions (Node 24), `@anthropic-ai/sdk`, API HTTP de Telegram, Supabase (`service_role`), vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-agenda-citas-y-bot-telegram-design.md` (sección «Bot»)

**Depende de:** el plan `2026-08-19-agenda-citas.md`, ya ejecutado y fusionado en `main`. Las tablas, el permiso, los correos y los recordatorios ya existen.

## Global Constraints

- **Zona horaria:** Costa Rica es UTC−6 fijo, sin horario de verano. El agente recibe la fecha y hora actuales de Costa Rica en el prompt y devuelve **siempre fechas absolutas** en ISO con offset `-06:00`. Nunca un "mañana" sin resolver.
- **Idioma:** todo el texto visible y todos los comentarios de código, en español. Los mensajes del bot los leen dos personas costarricenses: voseo, natural, sin sonar traducido.
- **Ninguna escritura sin confirmación humana.** Las herramientas que crean, mueven, editan o cancelan **no se ejecutan** cuando el modelo las pide: se guardan y se muestran. Es la regla que define esta fase.
- **Permiso, las tres condiciones de siempre:** `status = 'active'` **y** `role = 'admin'` **y** `agenda = true`. Más dos propias de Telegram: se valida el **usuario** (`from.id`), no el chat, y se exige `chat.type === 'private'`.
- **A quien no está autorizado, una línea seca.** El bot no dice qué es, ni qué hace, ni que existe una agenda.
- **Una sola implementación de cada operación.** El bot no reimplementa crear/mover/cancelar: usa las mismas funciones que el panel, para que los correos y los recordatorios salgan igual por los dos caminos.
- **Nada de esto toca GoHighLevel.**
- **Modelo:** `AGENDA_MODEL`, por defecto `claude-opus-5`. **Sin `temperature`, `top_p`, `top_k` ni `budget_tokens`** — los cuatro devuelven 400 en este modelo. El pensamiento adaptativo está activo por defecto y `max_tokens` lo cubre junto con la respuesta.
- **Patrón de endpoint:** `export default async function handler(req: any, res: any)` con `res.setHeader("Cache-Control", "no-store")` primero.
- **Compuertas:** `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`, `npm run build`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `api/_lib/agenda/operaciones.ts` | **Nuevo.** Las operaciones completas (guardar + correo + recordatorios), extraídas de `citas.ts` para que el panel y el bot compartan una sola implementación |
| `api/agenda/citas.ts` (modificar) | Pasa a ser una capa HTTP delgada sobre `operaciones.ts` |
| `api/_lib/agenda/telegram.ts` | Cliente de la API de Telegram: mandar, editar, botones, "escribiendo…" |
| `api/_lib/agenda/acciones.ts` | Acciones pendientes de confirmar: guardar, leer, consumir, expirar |
| `api/_lib/agenda/agente.ts` | Definición de las 5 herramientas, el bucle manual y la intercepción de escrituras |
| `api/telegram/webhook.ts` | Recibe updates, autoriza, deduplica, despacha |
| `api/agenda/telegram-link.ts` | Genera el código de 6 dígitos para vincular |
| `api/_lib/agenda/avisos.ts` | Aviso instantáneo a la otra persona y resumen diario |
| `api/cron/agenda.ts` (modificar) | Agrega el resumen diario |
| `src/lib/adminApi.ts` (modificar) | Llamadas de vinculación |
| `src/components/admin/AgendaManager.tsx` (modificar) | Botón «Conectar Telegram» |
| `docs/runbook-bot-telegram.md` | **Entregable final:** configuración paso a paso |

---

## Task 1: Extraer las operaciones compartidas

**Files:**
- Create: `api/_lib/agenda/operaciones.ts`
- Modify: `api/agenda/citas.ts`
- Test: `api/_lib/agenda/operaciones.test.ts`

**Interfaces:**
- Consumes: `crearCita`, `actualizarCita`, `cancelarCita`, `obtenerCita`, `listarCitas`, `registrarReenvio` de `db.ts`; `enviarAhora` de `email.ts`; `aplicarRecordatorios` de `recordatorios.ts`
- Produces:
  - `type ResultadoCorreo = "enviado" | "fallo" | "no_aplica"`
  - `crearCitaCompleta(datos: DatosCita, actor: string, origen: Origen): Promise<{ cita: Cita; choque: boolean; correo: ResultadoCorreo }>`
  - `actualizarCitaCompleta(id: string, datos: DatosCita, actor: string, origen: Origen): Promise<{ cita: Cita; choque: boolean; correo: ResultadoCorreo }>`
  - `cancelarCitaCompleta(id: string, actor: string, origen: Origen): Promise<{ cita: Cita; correo: ResultadoCorreo }>`
  - `reenviarConfirmacion(id: string, actor: string, origen: Origen): Promise<{ cita: Cita; correo: ResultadoCorreo }>`
  - `haySolape(inicioIso: string, excluirId?: string): Promise<boolean>`

**Por qué esta tarea existe.** Hoy toda la orquestación —guardar, decidir qué correo sale, acomodar los recordatorios— vive dentro del handler HTTP de `api/agenda/citas.ts`. El bot necesita exactamente eso mismo, y copiarlo garantizaría que las dos copias se separen con el primer arreglo que se le haga a una sola. Se extrae **sin cambiar comportamiento**: los tests de `citas.test.ts` deben seguir pasando tal cual.

- [ ] **Step 1: Leer lo que hay hoy**

Leé `api/agenda/citas.ts` completo, en particular `avisarAlCliente`, la lógica de tres vías del PATCH (`correoModificado` → `"confirmacion"`, si no `cambioVisible` → `"reagendado"`, si no `"no_aplica"`), la rama de reenvío y `haySolape`. Eso es exactamente lo que hay que mover, **sin alterarlo**.

- [ ] **Step 2: Escribir el test de las operaciones (falla)**

Crear `api/_lib/agenda/operaciones.test.ts`, mockeando `db.js`, `email.js` y `recordatorios.js` con el patrón de `api/agenda/citas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const crearCita = vi.fn();
const actualizarCita = vi.fn();
const cancelarCita = vi.fn();
const obtenerCita = vi.fn();
const listarCitas = vi.fn();
const registrarReenvio = vi.fn();
const enviarAhora = vi.fn();
const aplicarRecordatorios = vi.fn();

vi.mock("./db.js", () => ({
  crearCita: (...a: unknown[]) => crearCita(...a),
  actualizarCita: (...a: unknown[]) => actualizarCita(...a),
  cancelarCita: (...a: unknown[]) => cancelarCita(...a),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  registrarReenvio: (...a: unknown[]) => registrarReenvio(...a),
}));
vi.mock("./email.js", () => ({ enviarAhora: (...a: unknown[]) => enviarAhora(...a) }));
vi.mock("./recordatorios.js", () => ({
  aplicarRecordatorios: (...a: unknown[]) => aplicarRecordatorios(...a),
}));

async function cargar() {
  vi.resetModules();
  return await import("./operaciones");
}

beforeEach(() => {
  [crearCita, actualizarCita, cancelarCita, obtenerCita, listarCitas,
   registrarReenvio, enviarAhora, aplicarRecordatorios].forEach((m) => m.mockReset());
  aplicarRecordatorios.mockResolvedValue(undefined);
  listarCitas.mockResolvedValue([]);
});

const DATOS = {
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  inicio: "2026-09-01T16:00:00.000Z",
  lugar: "Visita Llanada",
};

describe("crearCitaCompleta", () => {
  it("guarda, manda confirmación y acomoda recordatorios", async () => {
    crearCita.mockResolvedValue({ id: "c1", ...DATOS });
    enviarAhora.mockResolvedValue(undefined);
    const { crearCitaCompleta } = await cargar();
    const r = await crearCitaCompleta(DATOS, "yo@x.com", "telegram");
    expect(crearCita).toHaveBeenCalledWith(DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.objectContaining({ id: "c1" }));
    expect(aplicarRecordatorios).toHaveBeenCalled();
    expect(r.correo).toBe("enviado");
  });

  it("si el correo falla, la cita igual queda", async () => {
    crearCita.mockResolvedValue({ id: "c1", ...DATOS });
    enviarAhora.mockRejectedValue(new Error("Resend caído"));
    const { crearCitaCompleta } = await cargar();
    const r = await crearCitaCompleta(DATOS, "yo@x.com", "telegram");
    expect(r.cita.id).toBe("c1");
    expect(r.correo).toBe("fallo");
  });
});

describe("actualizarCitaCompleta", () => {
  it("cambio de correo gana sobre cambio de hora", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: true, correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.anything());
  });

  it("cambio invisible no manda nada", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: false, correoModificado: false,
    });
    const { actualizarCitaCompleta } = await cargar();
    const r = await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(r.correo).toBe("no_aplica");
  });

  it("recrea los recordatorios cuando cambió el correo", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: false, correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(aplicarRecordatorios).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({ recrear: true }),
    );
  });
});

describe("cancelarCitaCompleta", () => {
  it("no manda un segundo correo si ya estaba cancelada", async () => {
    cancelarCita.mockResolvedValue({ cita: { id: "c1", ...DATOS }, seCancelo: false });
    const { cancelarCitaCompleta } = await cargar();
    const r = await cancelarCitaCompleta("c1", "yo@x.com", "telegram");
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(r.correo).toBe("no_aplica");
  });
});
```

- [ ] **Step 3: Correr y confirmar que falla**

Run: `npx vitest run api/_lib/agenda/operaciones.test.ts`
Expected: FAIL — no existe `./operaciones`.

- [ ] **Step 4: Crear `operaciones.ts` moviendo la lógica**

Mové a `api/_lib/agenda/operaciones.ts` — **sin reescribirla** — la lógica que hoy vive en `citas.ts`: el helper que manda el correo y acomoda los recordatorios, la decisión de tres vías del PATCH, la guarda de reenvío y `haySolape`. Exportá las cinco funciones de la sección **Interfaces**.

Dos cosas que **no** se mueven porque son del transporte HTTP y se quedan en `citas.ts`: la validación de los campos del body (`correoValido`, `fechaValida`, `textoRequerido`, `leerDatos`) y el mapeo de errores a códigos 400/404/409/500.

Poné un comentario en la cabecera explicando por qué existe el archivo: que el panel y el bot compartan una sola implementación, para que los correos y los recordatorios no se separen entre los dos caminos.

- [ ] **Step 5: Adelgazar `citas.ts`**

Reescribí el handler para que llame a las funciones nuevas. El comportamiento observable **no cambia**: mismos códigos, mismas respuestas, mismos campos.

- [ ] **Step 6: Confirmar que nada se rompió**

Run: `npx vitest run`
Expected: los tests de `api/agenda/citas.test.ts` pasan **sin haber sido modificados**. Si tuviste que tocarlos, el refactor cambió comportamiento — pará y decímelo.

Run también: `npm run types:api`, `npx tsc --noEmit`, `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/agenda/operaciones.ts api/_lib/agenda/operaciones.test.ts api/agenda/citas.ts
git commit -m "Agenda: extraer operaciones compartidas entre el panel y el bot"
```

---

## Task 2: Cliente de Telegram y vinculación de cuentas

**Files:**
- Create: `api/_lib/agenda/telegram.ts`
- Create: `api/agenda/telegram-link.ts`
- Test: `api/agenda/telegram-link.test.ts`
- Modify: `src/lib/adminApi.ts`
- Modify: `src/components/admin/AgendaManager.tsx`

**Interfaces:**
- Consumes: `requireAgenda`, `supabaseAdmin`
- Produces:
  - `telegram.ts`: `enviarMensaje(chatId: string, texto: string, opts?: { botones?: Boton[][] }): Promise<number>` (devuelve el `message_id`), `editarMensaje(chatId: string, messageId: number, texto: string): Promise<void>`, `responderCallback(callbackId: string, texto?: string): Promise<void>`, `escribiendo(chatId: string): Promise<void>`, `type Boton = { texto: string; data: string }`
  - `GET /api/agenda/telegram-link` → `{ codigo: string; expira: string; vinculado: boolean }`
  - `DELETE /api/agenda/telegram-link` → `{ ok: true }` (desvincula)
  - `getCodigoTelegram()`, `desvincularTelegram()` en `adminApi.ts`

- [ ] **Step 1: Cliente de Telegram**

Crear `api/_lib/agenda/telegram.ts`:

```ts
// Cliente de la API HTTP de Telegram. Solo lo que el bot de la agenda usa.

const BASE = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return t;
}

export interface Boton {
  texto: string;
  // Telegram limita callback_data a 64 bytes. Acá siempre va "ok:<uuid>" o
  // "no:<uuid>" (39 bytes), nunca la acción completa — por eso existe la tabla
  // agenda_acciones_pendientes.
  data: string;
}

async function pedir(metodo: string, cuerpo: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(`${BASE}/bot${token()}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : {};
  if (!r.ok || json.ok === false) {
    throw new Error(`Telegram ${metodo} ${r.status}: ${texto.slice(0, 300)}`);
  }
  return json.result as Record<string, unknown>;
}

export async function enviarMensaje(
  chatId: string,
  texto: string,
  opts: { botones?: Boton[][] } = {},
): Promise<number> {
  const cuerpo: Record<string, unknown> = { chat_id: chatId, text: texto };
  if (opts.botones?.length) {
    cuerpo.reply_markup = {
      inline_keyboard: opts.botones.map((fila) =>
        fila.map((b) => ({ text: b.texto, callback_data: b.data })),
      ),
    };
  }
  const res = await pedir("sendMessage", cuerpo);
  return res.message_id as number;
}

// Se usa al confirmar o cancelar: se reescribe el mensaje original para que los
// botones desaparezcan y no se pueda tocar dos veces.
export async function editarMensaje(
  chatId: string,
  messageId: number,
  texto: string,
): Promise<void> {
  await pedir("editMessageText", { chat_id: chatId, message_id: messageId, text: texto });
}

export async function responderCallback(callbackId: string, texto?: string): Promise<void> {
  await pedir("answerCallbackQuery", { callback_query_id: callbackId, text: texto });
}

// El indicador de "escribiendo…". Dura 5 segundos o hasta que llegue el mensaje.
export async function escribiendo(chatId: string): Promise<void> {
  try {
    await pedir("sendChatAction", { chat_id: chatId, action: "typing" });
  } catch {
    /* cosmético: si falla, no pasa nada */
  }
}
```

- [ ] **Step 2: Test del endpoint de vinculación (falla)**

Crear `api/agenda/telegram-link.test.ts` con estos casos:

1. Sin permiso de agenda → 401, y no se toca la base.
2. `GET` genera un código de **6 dígitos** y lo guarda con expiración futura.
3. `GET` cuando la cuenta ya tiene `telegram_chat_id` → responde `vinculado: true`.
4. `DELETE` limpia `telegram_chat_id`, `telegram_codigo` y `telegram_codigo_expira`.

Seguí el patrón de mock de `api/agenda/feed-token.test.ts`.

- [ ] **Step 3: Correr y confirmar que falla**

Run: `npx vitest run api/agenda/telegram-link.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 4: Implementar el endpoint**

Crear `api/agenda/telegram-link.ts`. Puntos que no son obvios:

- El código son **6 dígitos**, generados con `crypto.randomInt(0, 1_000_000)` y rellenados con ceros a la izquierda (`String(n).padStart(6, "0")`). No uses `Math.random()`: es un código de un solo uso que da acceso a la agenda.
- Expira a los **10 minutos**: `new Date(Date.now() + 10 * 60_000)`.
- Un `GET` nuevo **reemplaza** el código anterior. No acumules códigos vivos.
- `requireAgenda` es la primera línea del handler, antes de leer nada.

- [ ] **Step 5: Correr y confirmar que pasa**

Run: `npx vitest run api/agenda/telegram-link.test.ts`

- [ ] **Step 6: Interfaz en el panel**

En `src/lib/adminApi.ts`:

```ts
export function getCodigoTelegram(): Promise<{ codigo: string; expira: string; vinculado: boolean }> {
  return request("/api/agenda/telegram-link");
}

export function desvincularTelegram(): Promise<{ ok: boolean }> {
  return request("/api/agenda/telegram-link", { method: "DELETE" });
}
```

En `AgendaManager.tsx`, junto al bloque del feed, agregá uno de Telegram: un botón «Conectar Telegram» que pide el código y lo muestra grande, con la instrucción de mandarle `/vincular 123456` a **@EcovivacrBot**, y una cuenta regresiva o al menos la hora de expiración. Si ya está vinculado, mostrá eso y un botón para desvincular.

Reusá el estilo de los bloques que ya están en el componente. Que el texto diga con qué bot hablar — sin eso, el código no sirve de nada.

- [ ] **Step 7: Verificar y commitear**

Run: `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`, `npm run build`.

```bash
git add api/_lib/agenda/telegram.ts api/agenda/telegram-link.ts api/agenda/telegram-link.test.ts \
        src/lib/adminApi.ts src/components/admin/AgendaManager.tsx
git commit -m "Bot: cliente de Telegram y vinculacion por codigo de un solo uso"
```

---

## Task 3: El webhook — autorización, deduplicación y comandos

**Files:**
- Create: `api/telegram/webhook.ts`
- Test: `api/telegram/webhook.test.ts`
- Maybe modify: `supabase/migrations/0010_telegram_updates.sql` (solo si hace falta, ver Step 2)

**Interfaces:**
- Consumes: `supabaseAdmin`; `enviarMensaje`, `escribiendo` de `telegram.ts`; `listarCitas` de `db.ts`
- Produces: `POST /api/telegram/webhook`; `export async function autorizar(fromId, chatType): Promise<Autorizado | null>` para que las tareas siguientes la reusen; `type Autorizado = { email: string; userId: string; chatId: string }`

**En esta tarea el bot todavía no habla con Claude.** Entrega el esqueleto: recibe, verifica, autoriza, deduplica, y responde a `/vincular`, `/hoy` y `/semana`. Cualquier otro texto recibe «todavía no sé responder eso». La Task 4 le pone el agente. Así la parte de seguridad se revisa sola, sin el ruido del modelo.

- [ ] **Step 1: Las cuatro puertas, antes de tocar nada**

El handler valida en este orden y corta a la primera que falle:

1. **Método.** Solo `POST`; cualquier otro → 405.
2. **Secreto.** Telegram devuelve en cada llamada la cabecera `x-telegram-bot-api-secret-token` con el valor que se le dio al registrar el webhook. Si no coincide con `TELEGRAM_WEBHOOK_SECRET` → **401**. **Falla cerrado:** si la variable no está definida en el entorno, se rechaza igual — no dejes pasar todo cuando falta la variable, que es el agujero clásico.
3. **Deduplicación** por `update_id` (Step 2).
4. **Autorización** por `from.id` (Step 3).

- [ ] **Step 2: Deduplicación**

Leé `supabase/migrations/0003_webhook_events.sql`. Si esa tabla sirve para guardar un identificador externo de evento con una restricción de unicidad, **reusala** y decilo en el reporte. Si su forma es específica de GHL y no calza, creá `supabase/migrations/0010_telegram_updates.sql`:

```sql
-- Telegram reintenta un update si el webhook no contesta rápido. Contestamos
-- 200 de inmediato y procesamos con waitUntil, así que el reintento es raro —
-- pero un update procesado dos veces podria agendar dos veces, y eso si importa.
create table if not exists public.telegram_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;
```

La deduplicación es un `insert` que **falla si ya existe**: si el insert choca con la llave primaria, es un reintento y se responde 200 sin procesar nada. No consultes primero y después insertés — entre las dos consultas caben dos ejecuciones simultáneas del mismo update.

Si creás la migración, aplicala por la API de administración de Supabase (el CLI no está enlazado; mirá cómo se hizo en `.superpowers/sdd/2026-08-19-agenda-citas/task-1-report.md` si sigue en disco, o usá `POST https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query` con `SUPABASE_ACCESS_TOKEN`) y verificá contra la base que quedó.

- [ ] **Step 3: Autorización**

```ts
export interface Autorizado {
  email: string;
  userId: string;
  chatId: string;
}

// Quién puede hablarle al bot. Se valida el USUARIO (from.id), no el chat, y se
// exige chat privado: así, si alguien mete el bot a un grupo, los del grupo no
// heredan el acceso del que lo agregó.
export async function autorizar(
  fromId: number | undefined,
  chatType: string | undefined,
): Promise<Autorizado | null> {
  if (!fromId || chatType !== "private") return null;

  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .select("email, user_id, role, status, agenda")
    .eq("telegram_chat_id", String(fromId))
    .maybeSingle();

  if (error) {
    console.error("telegram/webhook: fallo al autorizar", error);
    return null; // falla cerrado
  }
  if (!data || data.status !== "active" || data.role !== "admin" || data.agenda !== true) {
    return null;
  }
  return { email: data.email, userId: data.user_id, chatId: String(fromId) };
}
```

A quien no pase, el bot le responde **una sola línea seca** y nada más: `"No tenés acceso."` Sin decir qué es, ni qué hace, ni que existe una agenda. Y `/vincular` es la única excepción — se atiende **antes** de la autorización, porque justamente sirve para obtenerla.

- [ ] **Step 4: Contestar rápido y procesar después**

Telegram reintenta si el webhook tarda, y una vuelta del agente (Task 4) toma varios segundos. Así que:

```ts
import { waitUntil } from "@vercel/functions";

// ... tras validar secreto y deduplicar:
waitUntil(procesarUpdate(update));
return res.status(200).json({ ok: true });
```

`procesarUpdate` no debe tirar nunca: envolvela en `try/catch`, logueá con `console.error` y, si podés, mandale al usuario un «se me complicó, probá de nuevo». Un error silencioso en Telegram se ve como un bot que ignora a la gente.

- [ ] **Step 5: Comandos**

- `/vincular 123456` — busca en `app_users` una fila con ese `telegram_codigo` **y** `telegram_codigo_expira > now()`. Si la hay: guarda `telegram_chat_id = from.id`, limpia el código y confirma con el nombre de la persona. Si no: `"Ese código no sirve o ya venció. Generá uno nuevo desde el panel."` **Un solo uso:** el código se limpia en el mismo update.
- `/hoy` — las citas de hoy en hora de Costa Rica, en orden. Si no hay: «Hoy no tenés nada agendado.»
- `/semana` — de hoy a 7 días.
- `/start` — un saludo corto que diga qué es y cómo vincularse, **solo si ya está autorizado**; si no, la línea seca.
- Cualquier otro texto — por ahora: `"Todavía no sé responder eso."` (la Task 4 lo reemplaza por el agente).

Formato de las citas en el chat, que se lee mucho mejor que una tabla:

```
Jueves 21 de agosto
  10:00 a. m. — María Rodríguez
  Visita Lomas de la Llanada · 8888-7777
```

Usá `Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica" })`. **Nunca** muestres horas en UTC.

- [ ] **Step 6: Tests**

Crear `api/telegram/webhook.test.ts`, mockeando `telegram.js`, `db.js` y supabase:

1. Cabecera de secreto ausente → 401, y **no** se consulta la base.
2. Cabecera incorrecta → 401.
3. `TELEGRAM_WEBHOOK_SECRET` **ausente del entorno** → 401 pase lo que pase en la cabecera. Este es el que protege contra el fallo abierto.
4. `update_id` repetido → 200 sin procesar (no se llama `enviarMensaje`).
5. Mensaje de un usuario **sin fila** en `app_users` → responde exactamente `"No tenés acceso."` y nada más.
6. Mensaje de un usuario con fila pero `agenda = false` → misma línea seca.
7. Mensaje en un chat de **grupo**, aunque el usuario esté autorizado → misma línea seca.
8. `/vincular` con código válido y vigente → guarda el `chat_id` y limpia el código.
9. `/vincular` con código **vencido** → no guarda nada.
10. `/hoy` de un usuario autorizado → llama a `listarCitas` y contesta.

Antes de afirmar que un test es RED, corrélo de verdad y pegá la salida. Cada test tiene que discriminar.

- [ ] **Step 7: Verificar y commitear**

Run: `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`.

```bash
git add api/telegram/webhook.ts api/telegram/webhook.test.ts supabase/migrations/
git commit -m "Bot: webhook con secreto, deduplicacion, autorizacion y comandos"
```

---

## Task 4: El agente — herramientas y bucle con intercepción

**Files:**
- Create: `api/_lib/agenda/agente.ts`
- Test: `api/_lib/agenda/agente.test.ts`
- Modify: `api/telegram/webhook.ts` (enchufar el agente donde hoy dice «Todavía no sé responder eso»)

**Interfaces:**
- Consumes: `@anthropic-ai/sdk`; `listarCitas`, `obtenerCita` de `db.ts`
- Produces:
  - `type Resultado = { tipo: "texto"; texto: string } | { tipo: "confirmar"; accion: AccionPropuesta; resumen: string }`
  - `type AccionPropuesta = { herramienta: "crear_cita" | "mover_cita" | "editar_cita" | "cancelar_cita"; entrada: Record<string, unknown> }`
  - `correrAgente(opts: { mensaje: string; historial: Mensaje[]; ahora?: Date }): Promise<Resultado>`
  - `export const ESCRITURAS: ReadonlySet<string>`

**Esta es la tarea que define la fase.** El bucle **no ejecuta** las herramientas de escritura.

- [ ] **Step 1: Entender por qué es un bucle manual y no el «tool runner» del SDK**

El SDK trae un bucle automático que ejecuta las herramientas apenas el modelo las pide. **Acá no sirve**, y no es cuestión de gusto: la confirmación no es un gancho síncrono dentro de una llamada. Cuando el modelo quiere escribir, el turno **termina**, se manda un mensaje a Telegram con botones, y la confirmación llega minutos después en **otra invocación del webhook**, en otro proceso. Ese corte no lo modela un bucle automático.

Entonces: bucle manual que auto-ejecuta **solo lecturas** y corta en la primera escritura.

- [ ] **Step 2: Escribir los tests (fallan)**

Crear `api/_lib/agenda/agente.test.ts`, mockeando el SDK de Anthropic y `db.js`. **El test que más importa es el primero.**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...a: unknown[]) => create(...a) }; },
}));

const listarCitas = vi.fn();
const obtenerCita = vi.fn();
vi.mock("./db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
}));

async function cargar() {
  vi.resetModules();
  return await import("./agente");
}

// Una respuesta del modelo pidiendo una herramienta.
function pideHerramienta(name: string, input: unknown) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tu_1", name, input }],
  };
}
function respondeTexto(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

beforeEach(() => {
  create.mockReset();
  listarCitas.mockReset();
  obtenerCita.mockReset();
  process.env.ANTHROPIC_API_KEY = "test";
});

const AHORA = new Date("2026-08-19T18:00:00.000Z"); // mediodía en Costa Rica

describe("correrAgente", () => {
  it("NUNCA ejecuta una herramienta de escritura: la devuelve para confirmar", async () => {
    create.mockResolvedValueOnce(
      pideHerramienta("crear_cita", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-08-21T10:00:00-06:00",
        lugar: "Visita Llanada",
      }),
    );
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "agendá a María el jueves a las 10", historial: [], ahora: AHORA });

    expect(r.tipo).toBe("confirmar");
    if (r.tipo !== "confirmar") throw new Error("no era confirmar");
    expect(r.accion.herramienta).toBe("crear_cita");
    // Y lo esencial: el modelo se llamó UNA sola vez. No hubo segunda vuelta
    // alimentando un resultado, porque la herramienta no se ejecutó.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("las cuatro herramientas de escritura cortan el turno", async () => {
    const { ESCRITURAS, correrAgente } = await cargar();
    expect([...ESCRITURAS].sort()).toEqual(
      ["cancelar_cita", "crear_cita", "editar_cita", "mover_cita"],
    );
    for (const nombre of ESCRITURAS) {
      create.mockReset();
      create.mockResolvedValueOnce(pideHerramienta(nombre, { id: "c1" }));
      const r = await correrAgente({ mensaje: "hacelo", historial: [], ahora: AHORA });
      expect(r.tipo).toBe("confirmar");
      expect(create).toHaveBeenCalledTimes(1);
    }
  });

  it("las herramientas de lectura sí se ejecutan y el bucle sigue", async () => {
    listarCitas.mockResolvedValue([]);
    create
      .mockResolvedValueOnce(pideHerramienta("buscar_citas", { desde: "2026-08-19", hasta: "2026-08-26" }))
      .mockResolvedValueOnce(respondeTexto("No tenés nada esta semana."));
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "qué tengo esta semana", historial: [], ahora: AHORA });

    expect(listarCitas).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ tipo: "texto", texto: "No tenés nada esta semana." });
  });

  it("el prompt le dice al modelo la fecha y hora de Costa Rica", async () => {
    create.mockResolvedValueOnce(respondeTexto("ok"));
    const { correrAgente } = await cargar();
    await correrAgente({ mensaje: "hola", historial: [], ahora: AHORA });

    const system = create.mock.calls[0][0].system as string;
    expect(system).toContain("miércoles");   // 19 de agosto de 2026 es miércoles
    expect(system).toContain("19 de agosto");
    expect(system).toContain("America/Costa_Rica");
  });

  it("no manda parámetros que el modelo rechaza", async () => {
    create.mockResolvedValueOnce(respondeTexto("ok"));
    const { correrAgente } = await cargar();
    await correrAgente({ mensaje: "hola", historial: [], ahora: AHORA });

    const params = create.mock.calls[0][0];
    // Estos cuatro devuelven 400 en el modelo configurado.
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    expect(params.thinking?.budget_tokens).toBeUndefined();
  });

  it("si el modelo se niega, responde con calma y sin romperse", async () => {
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "...", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("texto");
  });

  it("corta si el modelo se queda dando vueltas entre lecturas", async () => {
    listarCitas.mockResolvedValue([]);
    create.mockResolvedValue(pideHerramienta("buscar_citas", {}));
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "buscá", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("texto");
    expect(create.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("si pide dos escrituras a la vez, toma una sola y lo dice", async () => {
    create.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "cancelar_cita", input: { id: "c1" } },
        { type: "tool_use", id: "t2", name: "cancelar_cita", input: { id: "c2" } },
      ],
    });
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "cancelá las dos", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("confirmar");
    if (r.tipo !== "confirmar") throw new Error("no era confirmar");
    expect(r.resumen.toLowerCase()).toMatch(/una|de a una|primero/);
  });
});
```

- [ ] **Step 3: Correr y confirmar que fallan**

Run: `npx vitest run api/_lib/agenda/agente.test.ts`
Expected: FAIL — no existe `./agente`.

- [ ] **Step 4: Implementar el agente**

Crear `api/_lib/agenda/agente.ts`. Puntos obligatorios:

**Configuración del modelo.**

```ts
const MODELO = process.env.AGENDA_MODEL || "claude-opus-5";
const MAX_VUELTAS = 6;
```

`max_tokens` en 4096 y `output_config: { effort: "medium" }`. **No pases `temperature`, `top_p`, `top_k` ni `thinking.budget_tokens`** — los cuatro devuelven 400 en este modelo. El pensamiento adaptativo ya está activo por defecto, y `max_tokens` lo cubre junto con la respuesta, así que no lo dejes corto.

**El prompt del sistema** arranca con la fecha y hora de Costa Rica, calculadas con `Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "full", timeStyle: "short" })` sobre el `ahora` inyectable. Y dice, en español claro:

- Que es el asistente de agenda de EcoViva para Alina y Alejandro, y que la agenda es compartida entre los dos.
- Que **toda** fecha que produzca va absoluta, en ISO con offset `-06:00`. Nunca «mañana» sin resolver.
- Que si le falta un dato obligatorio para agendar —nombre, correo, fecha y hora, lugar— **lo pregunta** en vez de inventarlo. El correo del cliente es obligatorio: sin él no hay invitación de calendario ni recordatorios.
- Que antes de mover, editar o cancelar necesita saber **cuál** cita, y para eso busca primero.
- Que responde corto, en el tono de un mensaje de Telegram entre compañeros de trabajo. Sin encabezados, sin listas con viñetas salvo que haya varias citas que enumerar.
- Que no promete haber hecho nada: lo que él propone todavía tiene que confirmarse.

**Las cinco herramientas.** `buscar_citas` es la única de lectura:

```ts
export const ESCRITURAS: ReadonlySet<string> = new Set([
  "crear_cita", "mover_cita", "editar_cita", "cancelar_cita",
]);
```

Describilas con precisión — la descripción es lo que decide si el modelo las usa bien. Decí **cuándo** llamarlas, no solo qué hacen. Ejemplo del nivel que quiero para `buscar_citas`:

> «Busca citas en un rango de fechas. Usala **antes** de mover, editar o cancelar cualquier cita, para encontrar su id: nunca inventes un id. También para responder preguntas del tipo "¿qué tengo el jueves?". Devuelve id, cliente, fecha, hora y lugar.»

No uses `strict: true`: varias herramientas tienen campos opcionales y el modo estricto obliga a un esquema cerrado que se vuelve incómodo. En su lugar, **validá en el ejecutor** y devolvé `is_error: true` con un mensaje claro en español para que el modelo se corrija solo.

**El bucle.** Esta es la forma:

```ts
for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
  const res = await cliente().messages.create({ model: MODELO, max_tokens: 4096, /* … */ });

  if (res.stop_reason === "refusal") return { tipo: "texto", texto: "…" };

  const usos = res.content.filter((b) => b.type === "tool_use");
  const escrituras = usos.filter((b) => ESCRITURAS.has(b.name));

  // ── El corazón de esta fase ──
  // Una herramienta de escritura NO se ejecuta. Se devuelve para que un humano
  // la confirme. Mandarle un correo a un cliente es irreversible: ya lo leyó.
  if (escrituras.length > 0) {
    return { tipo: "confirmar", accion: /* la primera */, resumen: /* … */ };
  }

  if (usos.length === 0) return { tipo: "texto", texto: /* el texto de res */ };

  // Solo lecturas: ejecutar, adjuntar los resultados y seguir.
}
```

Si `escrituras.length > 1`, tomá **la primera** y que el resumen le avise a la persona que las demás quedaron sin hacer y que las pida de a una. Confirmar dos cosas con un solo botón es pedir un accidente.

**El resumen** es lo que la persona va a leer antes de tocar Confirmar, así que es la última defensa contra una fecha mal interpretada. Mostrá la fecha en **formato largo en español** («jueves 21 de agosto de 2026, 10:00 a. m.»), el nombre y el correo del cliente, y el lugar. Que un error salte a la vista.

Salí del bucle con un texto si se acaban las vueltas: «Me enredé, ¿me lo repetís más simple?».

- [ ] **Step 5: Correr y confirmar que pasan**

Run: `npx vitest run api/_lib/agenda/agente.test.ts`

**Además, verificá la discriminación del primer test**: cambiá a mano el bucle para que ejecute las escrituras (como haría el bucle automático del SDK) y confirmá que ese test **falla**. Revertí y pegá ambas salidas. Si el test pasa con las dos versiones, no está protegiendo nada.

- [ ] **Step 6: Enchufarlo al webhook**

En `api/telegram/webhook.ts`, reemplazá el «Todavía no sé responder eso» por: mandar `escribiendo(chatId)`, llamar a `correrAgente`, y según el resultado responder con el texto o —por ahora— con el resumen sin botones y una nota de que la confirmación llega en la tarea siguiente. Los botones son la Task 5.

Guardá el historial reciente de la conversación para que el bot entienda «sí, ese» o «cambialo a las 11». Lo más simple que funciona: una tabla chica `agenda_mensajes (chat_id, rol, contenido, created_at)` y cargar los de la última hora, con tope de 20. Si preferís otra forma, explicá por qué en el reporte.

- [ ] **Step 7: Verificar y commitear**

Run: `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`.

```bash
git add api/_lib/agenda/agente.ts api/_lib/agenda/agente.test.ts api/telegram/webhook.ts supabase/migrations/
git commit -m "Bot: agente con bucle manual que intercepta las escrituras"
```

---

## Task 5: Confirmación por botones

**Files:**
- Create: `api/_lib/agenda/acciones.ts`
- Test: `api/_lib/agenda/acciones.test.ts`
- Modify: `api/telegram/webhook.ts`
- Modify: `api/telegram/webhook.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`; `crearCitaCompleta`, `actualizarCitaCompleta`, `cancelarCitaCompleta` de `operaciones.ts`; `enviarMensaje`, `editarMensaje`, `responderCallback` de `telegram.ts`
- Produces:
  - `guardarAccion(chatId: string, accion: AccionPropuesta): Promise<string>` (devuelve el uuid)
  - `consumirAccion(id: string, chatId: string): Promise<AccionPropuesta | null>` — atómica, un solo uso
  - `ejecutarAccion(accion: AccionPropuesta, actor: string): Promise<string>` — devuelve el texto para el usuario

La tabla `agenda_acciones_pendientes` ya existe desde la migración 0008: `id uuid`, `chat_id text`, `accion jsonb`, `expira_at timestamptz`.

- [ ] **Step 1: Tests de las acciones (fallan)**

Crear `api/_lib/agenda/acciones.test.ts`. Los cuatro que importan:

1. **Un solo uso.** `consumirAccion` con el mismo id dos veces: la primera devuelve la acción, la segunda devuelve `null`. Es lo que evita que un doble toque agende dos veces.
2. **Dueño.** `consumirAccion` con un `chatId` distinto al que guardó la acción devuelve `null`. Alina no confirma lo que propuso Alejandro.
3. **Expiración.** Una acción con `expira_at` en el pasado devuelve `null`.
4. **Despacho.** `ejecutarAccion` llama a la función correcta de `operaciones.ts` según la herramienta, y con `origen: "telegram"`.

Mockeá `operaciones.js` y supabase con el patrón del repo.

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `npx vitest run api/_lib/agenda/acciones.test.ts`

- [ ] **Step 3: Implementar `acciones.ts`**

Dos cosas que hay que hacer bien:

**El consumo es atómico.** No consultes y después borres: entre las dos consultas caben dos toques del mismo botón. Un `delete` con `returning` resuelve todo de una — Postgres garantiza que solo una de dos ejecuciones simultáneas se lleva la fila:

```ts
const { data } = await supabaseAdmin()
  .from("agenda_acciones_pendientes")
  .delete()
  .eq("id", id)
  .eq("chat_id", chatId)
  .gt("expira_at", new Date().toISOString())
  .select()
  .maybeSingle();
// data === null  →  no existe, no es suya, ya venció, o alguien ya la consumió.
```

Las tres condiciones van **en el mismo `delete`**, no en un `if` posterior. Comentá por qué.

**La expiración es de 10 minutos.** Una acción vieja confirmada por error es una cita agendada a destiempo.

`ejecutarAccion` despacha a `operaciones.ts` con `origen: "telegram"` y devuelve un texto listo para mandar, con la fecha en formato largo en español y el resultado del correo si falló.

- [ ] **Step 4: Enchufar los botones en el webhook**

Cuando `correrAgente` devuelve `{ tipo: "confirmar" }`:

```ts
const id = await guardarAccion(chatId, r.accion);
await enviarMensaje(chatId, r.resumen, {
  botones: [[
    { texto: "✅ Confirmar", data: `ok:${id}` },
    { texto: "✖️ Cancelar",  data: `no:${id}` },
  ]],
});
```

Y manejar los `callback_query` que llegan al webhook:

1. **Autorizar igual que un mensaje** — `update.callback_query.from.id` pasa por `autorizar()`. Un botón no es una excepción a la autorización.
2. Parsear `data` como `ok:<uuid>` o `no:<uuid>`. Cualquier otra forma se ignora.
3. `responderCallback(id)` cuanto antes — sin eso, Telegram le deja al usuario el botón "cargando" dando vueltas.
4. Si es `no:` → consumir la acción (para que no quede viva) y editar el mensaje a «Cancelado.» sin botones.
5. Si es `ok:` → `consumirAccion`. Si devuelve `null`, editar a «Esa confirmación ya no vale — venció o ya la usaste.» Si devuelve la acción, ejecutarla y editar el mensaje con el resultado.
6. **Editá el mensaje original en vez de mandar uno nuevo.** Al editarlo, los botones desaparecen y el chat queda con el registro de lo que se hizo, no con un botón muerto que invita a tocarlo otra vez.

- [ ] **Step 5: Tests del flujo completo en el webhook**

Agregá a `api/telegram/webhook.test.ts`:

1. Un `callback_query` de un usuario **no autorizado** → no se ejecuta nada.
2. `ok:<uuid>` válido → se llama la operación correspondiente y se edita el mensaje.
3. El **mismo** `ok:<uuid>` dos veces → la operación se llama **una sola vez**; la segunda edita el mensaje avisando que ya no vale.
4. `no:<uuid>` → **no** se llama ninguna operación, y la acción queda consumida (un `ok` posterior sobre el mismo id no hace nada).

El tercero es el que protege contra el doble toque. Verificá que discrimina: si quitás la atomicidad del consumo, tiene que ponerse rojo.

- [ ] **Step 6: Verificar y commitear**

Run: `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`.

```bash
git add api/_lib/agenda/acciones.ts api/_lib/agenda/acciones.test.ts api/telegram/webhook.ts api/telegram/webhook.test.ts
git commit -m "Bot: confirmacion por botones con consumo atomico de un solo uso"
```

---

## Task 6: Avisos entre ustedes y resumen diario

**Files:**
- Create: `api/_lib/agenda/avisos.ts`
- Test: `api/_lib/agenda/avisos.test.ts`
- Modify: `api/_lib/agenda/operaciones.ts`
- Modify: `api/cron/agenda.ts`
- Modify: `api/cron/agenda.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`, `enviarMensaje`, `listarCitas`
- Produces:
  - `avisarCambio(cita: Cita, accion: "creada" | "movida" | "editada" | "cancelada", actorEmail: string): Promise<void>`
  - `resumenDiario(ahora: Date): Promise<number>` (devuelve a cuántos les llegó)

- [ ] **Step 1: Tests (fallan)**

`api/_lib/agenda/avisos.test.ts`:

1. `avisarCambio` le manda a **todos los que tienen agenda y Telegram vinculado, menos a quien lo hizo**. Quien actúa ya tiene su confirmación —inline en Telegram o en pantalla en el panel—; reenviársela es ruido.
2. Un usuario con agenda pero **sin** `telegram_chat_id` se saltea sin romper nada.
3. `avisarCambio` **nunca tira**: si Telegram falla, se loguea y sigue. Un aviso caído no puede tumbar la operación que ya se guardó.
4. `resumenDiario` manda las citas de hoy en hora de Costa Rica a cada persona vinculada.
5. `resumenDiario` con la agenda vacía manda un mensaje corto igual (para que se note que el cron corrió) — o no manda nada, si preferís; elegí, dejalo dicho y que el test lo fije.

- [ ] **Step 2: Correr, implementar, correr**

Run: `npx vitest run api/_lib/agenda/avisos.test.ts` (RED), implementar, volver a correr (GREEN). Pegá ambas salidas.

- [ ] **Step 3: Engancharlo en `operaciones.ts`**

`avisarCambio` se llama desde las funciones de `operaciones.ts`, **no** desde el endpoint ni desde el webhook. Así los avisos salen igual venga el cambio del panel o del bot — que es exactamente para lo que se extrajo ese archivo en la Task 1.

Va **después** de guardar, envuelto para que no pueda tumbar la respuesta. Mismo criterio que el correo al cliente: lo que ya se guardó no se pierde porque falle un paso posterior.

- [ ] **Step 4: Resumen diario en el cron**

En `api/cron/agenda.ts`, agregá el resumen como **primer** trabajo, antes de la reconciliación. Protegido contra doble ejecución con la tabla `agenda_jobs` (que ya existe): una fila por fecha, `insert` con `on conflict do nothing`; si el insert no agrega fila, el resumen ya salió hoy y se saltea.

Un fallo del resumen **no** puede impedir la reconciliación: envolvelo aparte. La reconciliación es lo que hace que a los clientes les lleguen los recordatorios; el resumen es comodidad.

Actualizá también el comentario de cabecera del archivo, que hoy dice que el resumen «no está acá: se agrega en un plan aparte». Ese plan es este.

- [ ] **Step 5: Tests del cron**

Agregá a `api/cron/agenda.test.ts`:

1. Con el header correcto, se llama `resumenDiario`.
2. Si `resumenDiario` **tira**, la reconciliación se corre igual y la respuesta no es 500.
3. Corriendo dos veces el mismo día, el resumen sale **una sola vez**.

- [ ] **Step 6: Verificar y commitear**

Run: `npx vitest run`, `npm run types:api`, `npx tsc --noEmit`.

```bash
git add api/_lib/agenda/avisos.ts api/_lib/agenda/avisos.test.ts api/_lib/agenda/operaciones.ts \
        api/cron/agenda.ts api/cron/agenda.test.ts
git commit -m "Bot: aviso instantaneo entre ellos y resumen diario en el cron"
```

---

## Task 7: Runbook de configuración

**Files:**
- Create: `docs/runbook-bot-telegram.md`

Este es el entregable que pidió el usuario: las instrucciones para dejar el bot andando, **una por una**, para ir confirmando paso a paso. No es documentación de referencia — es un guion.

- [ ] **Step 1: Escribir el runbook**

Un paso por sección, numerados, cada uno con: qué hacer, dónde hacerlo, **cómo saber que salió bien**, y qué hacer si sale mal. Nada de «configurá el webhook» sin el comando exacto.

Los pasos, en orden:

1. **Ya hecho** — el bot existe (@EcovivacrBot) y `TELEGRAM_BOT_TOKEN` está en `.env.local`. Verificación: `curl https://api.telegram.org/bot$TOKEN/getMe` devuelve `"username":"EcovivacrBot"`.
2. **Endurecer el bot en BotFather** — `/setjoingroups` → **Disable** (el bot no debería poder ser agregado a grupos; el código ya exige chat privado, pero es una capa menos de superficie), y `/setprivacy` → Enable. Verificación: `getMe` devuelve `can_join_groups: false`.
3. **Generar `TELEGRAM_WEBHOOK_SECRET`** — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, guardarlo en `.env.local`.
4. **Cargar las variables en Vercel** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `AGENDA_MODEL`, más las que quedaron pendientes de la fase anterior (`RESEND_API_KEY` con la llave de acceso completo, `CRON_SECRET`, `AGENDA_REPLY_TO`). Production, Preview y Development.
5. **Desplegar** — `git push origin main`. Verificación: `curl -s -o /dev/null -w "%{http_code}" https://www.ecovivadesarrollos.com/api/telegram/webhook` devuelve **401** (existe y rechaza sin el secreto), no 200 con HTML (que significaría que no está desplegado).
6. **Registrar el webhook** — el comando exacto:
   ```bash
   curl -s -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://www.ecovivadesarrollos.com/api/telegram/webhook",
          "secret_token":"'"$SECRET"'",
          "allowed_updates":["message","callback_query"]}'
   ```
   Verificación: `getWebhookInfo` devuelve la URL y `pending_update_count: 0`. Explicá que `allowed_updates` acota lo que Telegram manda a lo que el bot usa.
7. **Vincular el Telegram de Alejandro** — panel → Agenda → Conectar Telegram → código → `/vincular 123456` al bot. Verificación: el bot confirma con el nombre.
8. **Vincular el de Alina** — igual, con su propia cuenta del panel.
9. **Prueba de humo** — `/hoy` (debe contestar), un texto cualquiera (debe contestar el agente), y **desde una tercera cuenta de Telegram** mandarle algo: debe recibir «No tenés acceso.» y nada más.
10. **Prueba real de punta a punta** — agendar una cita de prueba por el bot con el correo de uno de ustedes, confirmar con el botón, revisar que llegue el correo con la invitación, moverla, y confirmar que el evento **se mueve** en el calendario en vez de duplicarse. Después cancelarla.

Cerrá con una sección de **qué hacer si algo falla**, con los síntomas reales: el bot no contesta nada (mirar `getWebhookInfo` → `last_error_message`), contesta «No tenés acceso» a alguien que sí debería entrar (revisar `agenda` y `telegram_chat_id` en `app_users`), los botones no hacen nada (`allowed_updates` sin `callback_query`), o el correo al cliente no sale (llave de Resend en Vercel).

- [ ] **Step 2: Commit**

```bash
git add docs/runbook-bot-telegram.md
git commit -m "Bot: runbook de configuracion paso a paso"
```

---

## Autorrevisión del plan

Hecha contra el spec después de escribirlo:

**Cobertura.** El spec pide para la fase 5: canal con secreto (T3), autorización por usuario y chat privado (T3), vinculación con código de un solo uso (T2), agente propio y no el de ECO (T4), cinco herramientas (T4), confirmación por botones con la acción fuera del `callback_data` (T5), fechas absolutas y formato largo en la confirmación (T4), `waitUntil` y deduplicación (T3), comandos `/hoy` `/semana` `/vincular` (T3), avisos entre ellos (T6) y resumen diario en el cron (T6). El cuarto test que pedía el spec —«ninguna herramienta de escritura se ejecuta sin confirmación»— es el primero de la T4, y además se le exige verificar que discrimina.

**Consistencia de tipos.** `AccionPropuesta` se define en T4 y se consume en T5. `Autorizado` se define en T3 y se reusa en T5. `ResultadoCorreo` sale de T1 y lo usan T5 y T6. `Cita`, `DatosCita` y `Origen` vienen de `db.ts`, ya existente.

**Tres cosas que la revisión cambió:**

- La T1 no estaba. Iba a hacer que el bot llamara al endpoint HTTP por dentro o que duplicara la orquestación de correos y recordatorios. Lo primero es raro (una función llamándose a sí misma por la red) y lo segundo garantiza que las dos copias se separen. Extraer `operaciones.ts` primero cuesta una tarea y elimina el problema.
- El bucle del agente iba a usar el «tool runner» del SDK. No sirve: la confirmación no es síncrona dentro de una llamada, el turno se corta y sigue minutos después en otra invocación. Va bucle manual, y la Task 4 arranca explicando por qué para que nadie lo «mejore» después.
- El consumo de la acción pendiente iba a ser leer-y-después-borrar. Entre esas dos consultas caben dos toques del mismo botón, o sea dos citas. Ahora es un solo `delete` con las tres condiciones adentro, y hay un test que se pone rojo si alguien lo separa.
