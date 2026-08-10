# Invitación de usuarios y guía privada — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que dar de alta a alguien sea escribir su correo en el panel y que la persona reciba un email, elija su contraseña y quede logueada — más una guía de vendedores en una URL que solo abre quien tiene sesión.

**Architecture:** Los permisos pasan de una lista quemada en el código a la tabla `app_users` en Supabase, con roles `admin` y `vendedor`. El correo lo manda Supabase Auth usando Resend como SMTP, así que no escribimos código de envío. La guía se sirve desde un endpoint que valida el JWT: el HTML nunca queda como archivo estático.

**Tech Stack:** Vite + React 18 + React Router 6, funciones serverless de Vercel en TypeScript, Supabase (Auth + Postgres), Resend como SMTP, vitest para la lógica de autorización.

Spec: [`docs/superpowers/specs/2026-08-10-invitacion-usuarios-y-guia-privada-design.md`](../specs/2026-08-10-invitacion-usuarios-y-guia-privada-design.md)

## Global Constraints

- **Idioma:** todo el texto visible al usuario y todos los comentarios de código van en español. Los comentarios explican *por qué*, no *qué*.
- **Estilo de handlers:** cada archivo en `api/` exporta `export default async function handler(req: any, res: any)` con el comentario `// eslint-disable-next-line @typescript-eslint/no-explicit-any` encima, y arranca con `res.setHeader("Cache-Control", "no-store")`. Seguir el patrón de `api/admin/config.ts`.
- **Imports en `api/`:** siempre con extensión `.js` aunque el archivo sea `.ts` (`from "./_lib/supabase.js"`). Es ESM, y sin la extensión Vercel no resuelve.
- **Imports en `src/`:** sin extensión. `tsconfig.json` solo incluye `src`, así que `tsc` no revisa `api/`.
- **Correos:** siempre normalizados a minúsculas y sin espacios antes de guardarlos o compararlos.
- **Rol por defecto:** `vendedor`. `admin` solo si se pide explícitamente.
- **Contraseña mínima:** 10 caracteres, en la UI y en la config de Supabase.
- **Remitente de correo:** `EcoViva Desarrollos <noreply@send.bralto.io>` — único dominio verificado en Resend.
- **URL de destino de los enlaces:** `${PUBLIC_SITE_URL}/crear-contrasena`, con `https://ecovivadesarrollos.com` como valor por defecto en el código. No derivar del header `Origin`: alguien con un JWT válido podría apuntar la invitación a otro dominio.
- **Estilo visual:** Tailwind con la paleta que ya usa el panel — `emerald-700` para acciones, `slate` para texto y bordes, `rounded-lg`/`rounded-2xl`, `ring-1 ring-slate-200/80`. Copiar de `AdminLogin.tsx` y `AdminDashboard.tsx`.
- **Secretos:** se leen de `.env.local` con `set -a && . ./.env.local && set +a`. Nunca imprimirlos en consola ni commitearlos.
- **No hay `vercel dev` garantizado.** La verificación de endpoints es por vitest y build local; la prueba contra HTTP real ocurre en la Tarea 11, después del deploy.

## Contexto que el implementador necesita

**Cómo se aplican las migraciones.** No hay Supabase CLI configurado (`supabase/config.toml` no existe). El SQL se ejecuta por la Management API:

```bash
set -a && . ./.env.local && set +a
curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @<(python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" supabase/migrations/0007_app_users.sql) \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
```

**Cómo se despliega.** Push a `main` y Vercel construye solo. El push necesita un PAT que pega el usuario en la URL del remote; las credenciales locales de git son de otra cuenta. No intentar `git push` sin pedírselo.

**Estado inicial verificado el 2026-08-10.** El proyecto Supabase es `hujuifwfknlpdqgvogkf`. Tiene exactamente 2 usuarios en `auth.users`: `aguilartradesfx@gmail.com` y `gerencia@duphomes.com`, ambos confirmados. No hay SMTP propio configurado y `site_url` es `http://localhost:3000`.

---

## Estructura de archivos

**Backend**

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0007_app_users.sql` | Tabla `app_users`, triggers, RLS, backfill |
| `api/_lib/supabase.ts` *(modificar)* | `requireUser` / `requireAdmin` sobre `app_users` |
| `api/_lib/supabase.test.ts` | Pruebas de la lógica de autorización |
| `api/me.ts` | Devuelve `{ email, role }` del usuario autenticado |
| `api/admin/users.ts` | CRUD de usuarios + envío de invitaciones |
| `api/guia-vendedores.ts` | Sirve el HTML de la guía a usuarios con sesión |
| `api/_content/guia-vendedores.ts` | Generado. HTML de la guía en base64 |

**Contenido y configuración**

| Archivo | Responsabilidad |
|---|---|
| `content/guia-vendedores.html` | Fuente de verdad de la guía (movido desde la raíz) |
| `scripts/build-content.mjs` | Empaqueta `content/` en módulos importables |
| `scripts/apply-auth-config.mjs` | Aplica SMTP, URLs y plantillas a Supabase |
| `supabase/auth-templates/invite.html` | Plantilla del correo de invitación |
| `supabase/auth-templates/recovery.html` | Plantilla del correo de acceso/recuperación |

**Frontend**

| Archivo | Responsabilidad |
|---|---|
| `src/components/auth/LoginCard.tsx` | Formulario de login reutilizable + «olvidé mi contraseña» |
| `src/components/auth/CreatePasswordPage.tsx` | Ruta `/crear-contrasena` |
| `src/components/guia/GuiaVendedores.tsx` | Ruta `/guia-vendedores` |
| `src/components/admin/UsersManager.tsx` | Pestaña «Usuarios» |
| `src/components/admin/AdminLogin.tsx` *(modificar)* | Envoltura de `LoginCard` |
| `src/components/admin/AdminApp.tsx` *(modificar)* | Verificación de rol antes de montar el panel |
| `src/components/admin/AdminDashboard.tsx` *(modificar)* | Tercera pestaña |
| `src/lib/adminApi.ts` *(modificar)* | Helpers de `/api/me`, usuarios y guía |
| `src/App.tsx` *(modificar)* | Dos rutas nuevas, `ChatWidgetGate` |

---

### Task 1: Tabla `app_users`

**Files:**
- Create: `supabase/migrations/0007_app_users.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabla `public.app_users` con columnas `user_id uuid PK`, `email text unique`, `full_name text`, `role text ('admin'|'vendedor')`, `status text ('active'|'disabled')`, `invited_by text`, `created_at timestamptz`, `updated_at timestamptz`. Las tareas 2 y 5 la consultan.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0007_app_users.sql`:

```sql
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
```

- [ ] **Step 2: Verificar que la tabla todavía no existe**

```bash
set -a && . ./.env.local && set +a
curl -s -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select to_regclass('"'"'public.app_users'"'"') as tabla;"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
```

Esperado: `[{"tabla":null}]`

- [ ] **Step 3: Aplicar la migración**

```bash
set -a && . ./.env.local && set +a
python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/0007_app_users.sql').read()}))" > /tmp/m7.json
curl -s -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" --data-binary @/tmp/m7.json \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
rm /tmp/m7.json
```

Esperado: `[]` (sin error). Si aparece `"message"`, leer el error y corregir el SQL antes de seguir.

- [ ] **Step 4: Verificar el backfill y las restricciones**

```bash
set -a && . ./.env.local && set +a
curl -s -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select email, role, status, invited_by from public.app_users order by email;"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
```

Esperado: exactamente 2 filas, `aguilartradesfx@gmail.com` y `gerencia@duphomes.com`, ambas `role=admin`, `status=active`, `invited_by=migracion_0007`.

Comprobar que el `check` rechaza basura:

```bash
curl -s -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"update public.app_users set role = '"'"'jefe'"'"' where email = '"'"'gerencia@duphomes.com'"'"';"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
```

Esperado: un error que menciona `app_users_role_check`. Si el update pasa, el `check` está mal.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_app_users.sql
git commit -m "Auth: tabla app_users con roles admin/vendedor"
```

---

### Task 2: `requireUser` y `requireAdmin` contra `app_users`

**Files:**
- Modify: `api/_lib/supabase.ts:31-63`
- Create: `api/_lib/supabase.test.ts`
- Modify: `package.json` (devDependency `vitest` + script `test`)

**Interfaces:**
- Consumes: tabla `app_users` de la Tarea 1.
- Produces:
  - `export type AppRole = "admin" | "vendedor"`
  - `export interface Caller { email: string; userId: string | null; role: AppRole }`
  - `export async function requireUser(req): Promise<Caller | null>`
  - `export async function requireAdmin(req): Promise<string | null>` — misma firma que hoy, devuelve el correo o `null`.

`requireAdmin` conserva su firma a propósito: `api/lots.ts`, `api/admin/config.ts` y `api/admin/prompt-assistant.ts` ya la usan y no se tocan.

Nota de simplificación respecto al spec: el spec describía `resolveCaller` más dos envoltorios. `requireUser` *es* el resolvedor, así que se quedan dos funciones en vez de tres.

- [ ] **Step 1: Instalar vitest**

```bash
npm install --save-dev vitest
```

Agregar a `package.json`, en `scripts`:

```json
"test": "vitest run"
```

La lógica de autorización es el único código de este plan que merece pruebas automatizadas: tiene siete ramas y decide quién entra. El resto se verifica contra el entorno real.

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `api/_lib/supabase.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();

// Cadena mínima de supabase-js: db.from(...).select(...).eq(...).maybeSingle()
const mockClient = {
  auth: { getUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
  })),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

const req = (token?: string) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

// El módulo cachea el cliente y lee env al importarse: se recarga en cada prueba.
async function cargar() {
  vi.resetModules();
  return await import("./supabase");
}

// Simula un JWT válido de Supabase para ese correo.
function conUsuario(email: string, id = "uid-1") {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
}

describe("requireUser / requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-de-prueba";
    delete process.env.ADMIN_API_TOKEN;
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("rechaza una petición sin Authorization", async () => {
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req())).toBeNull();
    expect(await requireAdmin(req())).toBeNull();
  });

  it("acepta el token de servidor a servidor como admin", async () => {
    process.env.ADMIN_API_TOKEN = "token-de-servicio";
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("token-de-servicio"))).toEqual({
      email: "service",
      userId: null,
      role: "admin",
    });
    expect(await requireAdmin(req("token-de-servicio"))).toBe("service");
  });

  it("da rol admin a quien tiene fila admin activa", async () => {
    conUsuario("alguien@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "admin", status: "active" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("jwt"))).toEqual({
      email: "alguien@ecoviva.com",
      userId: "uid-1",
      role: "admin",
    });
    expect(await requireAdmin(req("jwt"))).toBe("alguien@ecoviva.com");
  });

  it("deja pasar al vendedor por requireUser pero no por requireAdmin", async () => {
    conUsuario("vendedora@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "vendedor", status: "active" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect((await requireUser(req("jwt")))?.role).toBe("vendedor");
    expect(await requireAdmin(req("jwt"))).toBeNull();
  });

  it("bloquea a un usuario deshabilitado aunque su JWT sea válido", async () => {
    conUsuario("exvendedora@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "admin", status: "disabled" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("jwt"))).toBeNull();
    expect(await requireAdmin(req("jwt"))).toBeNull();
  });

  it("deja entrar a un BASE_ADMIN aunque no tenga fila en app_users", async () => {
    conUsuario("gerencia@duphomes.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("rechaza a un usuario de auth sin fila en app_users", async () => {
    conUsuario("colado@gmail.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireUser } = await cargar();
    expect(await requireUser(req("jwt"))).toBeNull();
  });

  it("normaliza el correo a minúsculas antes de comparar", async () => {
    conUsuario("Gerencia@DupHomes.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("rechaza si Supabase no valida el JWT", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    const { requireUser } = await cargar();
    expect(await requireUser(req("jwt-vencido"))).toBeNull();
  });
});
```

- [ ] **Step 3: Correr las pruebas y confirmar que fallan**

Run: `npm test`

Esperado: FAIL. `requireUser` no existe todavía y varias pruebas de `requireAdmin` fallan porque hoy no consulta `app_users`.

- [ ] **Step 4: Implementar**

En `api/_lib/supabase.ts`, reemplazar todo desde el comentario `// Correos siempre permitidos...` hasta el final del archivo por:

```ts
export type AppRole = "admin" | "vendedor";

export interface Caller {
  email: string;
  userId: string | null;
  role: AppRole;
}

// Red de seguridad: estos correos entran como admin aunque app_users esté vacía
// o mal poblada. Evita quedar encerrado fuera del panel por un error de datos.
const BASE_ADMINS = ["aguilartradesfx@gmail.com", "gerencia@duphomes.com"];

// Identifica a quien hace la petición. Acepta:
//   1) Bearer igual a ADMIN_API_TOKEN → admin de servicio (servidor a servidor).
//   2) Un JWT de Supabase Auth cuyo usuario tenga fila activa en app_users.
// Devuelve null si no hay token, si el JWT no valida, si no hay fila o si la
// cuenta está deshabilitada.
export async function requireUser(req: {
  headers: Record<string, unknown>;
}): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const serviceToken = process.env.ADMIN_API_TOKEN;
  if (serviceToken && token === serviceToken) {
    return { email: "service", userId: null, role: "admin" };
  }

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.auth.getUser(token);
    const user = data?.user;
    const email = user?.email?.toLowerCase();
    if (error || !user || !email) return null;

    const { data: row } = await db
      .from("app_users")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (row) {
      if (row.status !== "active") return null;
      return { email, userId: user.id, role: row.role as AppRole };
    }

    // Sin fila: solo pasa por la red de seguridad.
    if (BASE_ADMINS.includes(email)) {
      return { email, userId: user.id, role: "admin" };
    }
    return null;
  } catch {
    return null;
  }
}

// Igual que requireUser pero exige rol admin. Conserva la firma anterior
// (correo o null) para no tocar los endpoints que ya la usan.
export async function requireAdmin(req: {
  headers: Record<string, unknown>;
}): Promise<string | null> {
  const caller = await requireUser(req);
  return caller && caller.role === "admin" ? caller.email : null;
}
```

Borrar la función `adminEmails()`: `ADMIN_EMAILS` deja de usarse. El backfill de la Tarea 1 metió en `app_users` a todos los usuarios reales de `auth.users`, así que nadie que hoy pueda entrar pierde el acceso.

- [ ] **Step 5: Correr las pruebas y confirmar que pasan**

Run: `npm test`

Esperado: PASS, 9 pruebas.

- [ ] **Step 6: Confirmar que los endpoints existentes siguen compilando**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`

Esperado: sin errores. Revisar a ojo que `api/lots.ts`, `api/admin/config.ts` y `api/admin/prompt-assistant.ts` sigan importando `requireAdmin` y usándolo igual.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/supabase.ts api/_lib/supabase.test.ts package.json package-lock.json
git commit -m "Auth: requireUser/requireAdmin leen roles de app_users"
```

---

### Task 3: Endpoint `/api/me`

**Files:**
- Create: `api/me.ts`

**Interfaces:**
- Consumes: `requireUser` de la Tarea 2.
- Produces: `GET /api/me` → `200 { email: string, role: "admin" | "vendedor" }` o `401 { error: string }`. Lo consumen las tareas 8 y 9.

- [ ] **Step 1: Escribir el endpoint**

Crear `api/me.ts`:

```ts
import { requireUser } from "./_lib/supabase.js";

// /api/me — GET → { email, role }
// Existe porque el rol no viaja dentro del JWT y dos pantallas lo necesitan
// antes de decidir qué renderizar: AdminApp y la página de crear contraseña.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  return res.status(200).json({ email: caller.email, role: caller.role });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/me.ts
git commit -m "API: /api/me devuelve identidad y rol del usuario"
```

---

### Task 4: Configuración de Auth en Supabase (SMTP, URLs, plantillas)

**Files:**
- Create: `supabase/auth-templates/invite.html`
- Create: `supabase/auth-templates/recovery.html`
- Create: `scripts/apply-auth-config.mjs`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` de `.env.local`.
- Produces: el proyecto Supabase queda enviando correos por Resend y redirigiendo a `/crear-contrasena`. Sin esto las tareas 5 y 7 no se pueden probar de verdad.

Datos ya verificados: `smtp.resend.com:465` con usuario `resend` y la `RESEND_API_KEY` como contraseña autentica correctamente, y `noreply@send.bralto.io` entrega.

- [ ] **Step 1: Escribir la plantilla de invitación**

Crear `supabase/auth-templates/invite.html`:

```html
<!-- Plantilla del correo de invitación de Supabase Auth.
     Variables disponibles: {{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}.
     Se aplica con scripts/apply-auth-config.mjs. Editar aquí, no en el dashboard. -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1A241D">
  <h1 style="font-size:20px;font-weight:600;color:#12291C;margin:0 0 16px">Te dieron acceso a EcoViva</h1>

  <p style="font-size:15px;line-height:1.6;margin:0 0 12px">
    Se creó una cuenta para <strong>{{ .Email }}</strong> en las herramientas internas de
    EcoViva Desarrollos.
  </p>

  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Hacé clic en el botón para elegir tu contraseña. Al terminar quedás dentro,
    no hace falta que la escribas de nuevo.
  </p>

  <p style="margin:0 0 24px">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#35624A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600">
      Crear mi contraseña
    </a>
  </p>

  <p style="font-size:13px;line-height:1.6;color:#5E6B60;margin:0 0 8px">
    El enlace vence en una hora. Si se te pasa, pedile a quien te invitó que te lo reenvíe.
  </p>

  <p style="font-size:13px;line-height:1.6;color:#5E6B60;margin:0">
    Si no esperabas este correo, ignoralo: sin abrir el enlace no se activa nada.
  </p>

  <hr style="border:0;border-top:1px solid #D5DACF;margin:28px 0 16px">
  <p style="font-size:12px;color:#5E6B60;margin:0">EcoViva Desarrollos</p>
</div>
```

- [ ] **Step 2: Escribir la plantilla de acceso/recuperación**

Crear `supabase/auth-templates/recovery.html`. El texto sirve para los dos casos que la usan: alguien que nunca tuvo contraseña y le reenviaron el acceso, y alguien que olvidó la suya.

```html
<!-- Plantilla de recuperación de Supabase Auth. La usan dos flujos:
     "olvidé mi contraseña" y el reenvío de acceso a un usuario que ya existe
     en auth.users (inviteUserByEmail falla si el correo ya está registrado).
     Por eso el texto no asume que la persona ya tenía contraseña. -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1A241D">
  <h1 style="font-size:20px;font-weight:600;color:#12291C;margin:0 0 16px">Acceso a EcoViva</h1>

  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Pedimos crear una contraseña nueva para <strong>{{ .Email }}</strong>.
    Hacé clic en el botón y elegí la tuya. Al terminar quedás dentro.
  </p>

  <p style="margin:0 0 24px">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#35624A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600">
      Crear mi contraseña
    </a>
  </p>

  <p style="font-size:13px;line-height:1.6;color:#5E6B60;margin:0 0 8px">
    El enlace vence en una hora y solo se puede usar una vez.
  </p>

  <p style="font-size:13px;line-height:1.6;color:#5E6B60;margin:0">
    Si no pediste esto, ignorá el correo: tu contraseña actual sigue funcionando.
  </p>

  <hr style="border:0;border-top:1px solid #D5DACF;margin:28px 0 16px">
  <p style="font-size:12px;color:#5E6B60;margin:0">EcoViva Desarrollos</p>
</div>
```

- [ ] **Step 3: Escribir el script que aplica la configuración**

Crear `scripts/apply-auth-config.mjs`:

```js
// Aplica la configuración de Supabase Auth desde el repo: SMTP, URLs permitidas
// y plantillas de correo. Existe para que esos ajustes vivan en git y no solo
// en el dashboard, donde nadie recuerda quién los cambió.
//
// Uso:  set -a && . ./.env.local && set +a && node scripts/apply-auth-config.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => readFileSync(resolve(raiz, p), "utf8");

const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, RESEND_API_KEY } = process.env;

for (const [nombre, valor] of Object.entries({
  SUPABASE_ACCESS_TOKEN,
  SUPABASE_PROJECT_ID,
  RESEND_API_KEY,
})) {
  if (!valor) {
    console.error(`Falta ${nombre} en el entorno.`);
    process.exit(1);
  }
}

const SITIO = "https://ecovivadesarrollos.com";

// Todo destino al que Supabase puede redirigir tras un enlace de correo.
// Sin esta lista los enlaces caen en site_url y se pierde el token.
const REDIRECCIONES = [
  `${SITIO}/crear-contrasena`,
  `https://www.ecovivadesarrollos.com/crear-contrasena`,
  `http://localhost:5173/crear-contrasena`,
  // Los previews de Vercel se llaman ecoviva-git-<rama>-<equipo>.vercel.app,
  // así que el comodín va después del nombre del proyecto, no antes.
  `https://ecoviva-*.vercel.app/crear-contrasena`,
];

const config = {
  site_url: SITIO,
  uri_allow_list: REDIRECCIONES.join(","),
  password_min_length: 10,

  // Resend como SMTP: así inviteUserByEmail y el reset de contraseña salen
  // solos, sin que nosotros escribamos código de envío.
  smtp_host: "smtp.resend.com",
  smtp_port: 465,
  smtp_user: "resend",
  smtp_pass: RESEND_API_KEY,
  smtp_admin_email: "noreply@send.bralto.io",
  smtp_sender_name: "EcoViva Desarrollos",
  // Segundos mínimos entre dos correos al mismo destinatario. El default de 60
  // hace incómodo reenviar un acceso cuando alguien no lo recibió.
  smtp_max_frequency: 20,

  mailer_subjects_invite: "Te dieron acceso a EcoViva",
  mailer_templates_invite_content: leer("supabase/auth-templates/invite.html"),
  mailer_subjects_recovery: "Creá tu contraseña de EcoViva",
  mailer_templates_recovery_content: leer("supabase/auth-templates/recovery.html"),
};

const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth`;
const r = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(config),
});

if (!r.ok) {
  console.error(`Falló (${r.status}):`, await r.text());
  process.exit(1);
}

// Se relee del servidor en vez de confiar en el 200: confirma qué quedó guardado.
const guardado = await (await fetch(url, {
  headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
})).json();

console.log("Configuración aplicada:");
for (const k of [
  "site_url",
  "uri_allow_list",
  "password_min_length",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_admin_email",
  "smtp_sender_name",
  "smtp_max_frequency",
  "mailer_subjects_invite",
  "mailer_subjects_recovery",
]) {
  console.log(`  ${k} = ${JSON.stringify(guardado[k])}`);
}
console.log(`  plantilla invite  = ${String(guardado.mailer_templates_invite_content).length} caracteres`);
console.log(`  plantilla recovery= ${String(guardado.mailer_templates_recovery_content).length} caracteres`);
```

El script nunca imprime `smtp_pass`.

- [ ] **Step 4: Aplicar y verificar**

```bash
set -a && . ./.env.local && set +a && node scripts/apply-auth-config.mjs
```

Esperado, literal:

- `site_url = "https://ecovivadesarrollos.com"` (antes era `http://localhost:3000`)
- `uri_allow_list` con las cuatro entradas
- `password_min_length = 10`
- `smtp_host = "smtp.resend.com"`, `smtp_port = 465`, `smtp_user = "resend"`
- `smtp_admin_email = "noreply@send.bralto.io"`, `smtp_sender_name = "EcoViva Desarrollos"`
- ambas plantillas con más de 800 caracteres

- [ ] **Step 5: Probar que Supabase realmente manda el correo**

Esta es la prueba que importa: verifica la cadena completa Supabase → Resend → bandeja.

```bash
set -a && . ./.env.local && set +a
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"email":"aguilartradesfx@gmail.com"}' \
  "$SUPABASE_URL/auth/v1/recover?redirect_to=https%3A%2F%2Fecovivadesarrollos.com%2Fcrear-contrasena"
```

Esperado: `200`. Después, confirmar en la bandeja de `aguilartradesfx@gmail.com` que llegó «Creá tu contraseña de EcoViva» remitido por `EcoViva Desarrollos <noreply@send.bralto.io>`, y que el enlace apunta a `ecovivadesarrollos.com/crear-contrasena` y **no** a `localhost`.

Si no llega en 2 minutos, revisar el panel de Resend antes de seguir. Las tareas 5 en adelante asumen que el correo sale.

- [ ] **Step 6: Commit**

```bash
git add supabase/auth-templates scripts/apply-auth-config.mjs
git commit -m "Auth: Resend como SMTP de Supabase y plantillas en español"
```

---

### Task 5: Endpoint `/api/admin/users`

**Files:**
- Create: `api/admin/users.ts`

**Interfaces:**
- Consumes: `requireAdmin` y `supabaseAdmin` de la Tarea 2; tabla `app_users` de la Tarea 1; SMTP de la Tarea 4.
- Produces:
  - `GET /api/admin/users` → `{ users: AppUser[] }`
  - `POST /api/admin/users` body `{ email, full_name?, role? }` → `{ user: AppUserRow, resent: boolean }`
  - `PATCH /api/admin/users` body `{ user_id, role?, status? }` → `{ user: AppUserRow }`
  - `DELETE /api/admin/users` body `{ user_id }` → `{ ok: true }`

  con `AppUserRow = { user_id, email, full_name, role, status, invited_by, created_at, updated_at }`
  y `AppUser = AppUserRow & { last_sign_in_at: string | null }`.

  Solo `GET` trae `last_sign_in_at`: es lo único que lo cruza contra `auth.users`.
  `POST` y `PATCH` devuelven la fila cruda, y el panel recarga la lista después.

  La Tarea 9 consume estas cuatro rutas.

- [ ] **Step 1: Escribir el endpoint**

Crear `api/admin/users.ts`:

```ts
import { supabaseAdmin, requireAdmin } from "../_lib/supabase.js";

// /api/admin/users — alta y administración de usuarios del panel. Solo admin.
//   GET     → { users }  lista con "último ingreso" sacado de auth.users
//   POST    { email, full_name?, role? }  → invita (o reenvía el acceso)
//   PATCH   { user_id, role?, status? }   → cambia rol o habilita/deshabilita
//   DELETE  { user_id }                   → borra de auth.users (la fila cae en cascada)

type Rol = "admin" | "vendedor";

// No se deriva del header Origin: alguien con un JWT válido podría apuntar el
// enlace de invitación a un dominio suyo y quedarse con el token.
const SITIO = process.env.PUBLIC_SITE_URL || "https://ecovivadesarrollos.com";
const DESTINO = `${SITIO}/crear-contrasena`;

function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// Son un puñado de usuarios: traerlos todos y filtrar en memoria es más simple
// que paginar, y la API de admin no filtra por correo.
async function buscarEnAuthPorCorreo(email: string) {
  const { data } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

// Manda el correo de "creá tu contraseña" a alguien que ya existe en auth.users.
// No se usa generateLink() porque devuelve el enlace pero no envía nada; el
// endpoint /recover de GoTrue sí dispara el correo por el SMTP configurado.
async function enviarCorreoDeAcceso(email: string): Promise<string | null> {
  const url = `${process.env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(DESTINO)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    },
    body: JSON.stringify({ email }),
  });
  if (r.ok) return null;
  return `No se pudo enviar el correo (${r.status}): ${(await r.text()).slice(0, 200)}`;
}

async function listar() {
  const db = supabaseAdmin();
  const { data: filas, error } = await db
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  // "Pendiente de activar" no se guarda: se deriva de si la persona entró alguna vez.
  const { data: auth } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ultimoIngreso = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

  return (filas ?? []).map((f) => ({
    ...f,
    last_sign_in_at: ultimoIngreso.get(f.user_id) ?? null,
  }));
}

// Impide dejarse a uno mismo sin acceso y quedarse sin ningún admin.
// `cambio` es "delete" o el objeto de updates que se va a aplicar.
async function revisarGuardas(
  targetUserId: string,
  correoDeQuienPide: string,
  cambio: "delete" | { role?: string; status?: string },
): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: objetivo } = await db
    .from("app_users")
    .select("email, role, status")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!objetivo) return "Ese usuario no existe";

  const esUnoMismo = objetivo.email === correoDeQuienPide;
  const pierdeAdmin =
    cambio === "delete" || cambio.role === "vendedor" || cambio.status === "disabled";

  if (esUnoMismo && pierdeAdmin) return "No podés quitarte tu propio acceso";

  if (pierdeAdmin && objetivo.role === "admin" && objetivo.status === "active") {
    const { count } = await db
      .from("app_users")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) return "Tiene que quedar al menos un admin activo";
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const admin = await requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      return res.status(200).json({ users: await listar() });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === "POST") {
      const email = normalizarCorreo(body.email);
      if (!email) return res.status(400).json({ error: "Correo inválido" });

      const rol: Rol = body.role === "admin" ? "admin" : "vendedor";
      const nombre =
        typeof body.full_name === "string" ? body.full_name.trim() || null : null;

      let userId: string;
      let reenviado = false;

      const { data: invitado, error: errorInvitacion } = await db.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: DESTINO, data: nombre ? { full_name: nombre } : undefined },
      );

      if (errorInvitacion) {
        // El caso normal de fallo es que el correo ya esté registrado. Si es así
        // se le reenvía el acceso en vez de tratarlo como error.
        const existente = await buscarEnAuthPorCorreo(email);
        if (!existente) {
          return res.status(502).json({ error: `No se pudo invitar: ${errorInvitacion.message}` });
        }

        const { data: filaPrevia } = await db
          .from("app_users")
          .select("status")
          .eq("user_id", existente.id)
          .maybeSingle();
        if (filaPrevia?.status === "disabled") {
          return res
            .status(400)
            .json({ error: "Ese usuario está deshabilitado. Habilitalo antes de reenviarle el acceso." });
        }

        const errorEnvio = await enviarCorreoDeAcceso(email);
        if (errorEnvio) return res.status(502).json({ error: errorEnvio });

        userId = existente.id;
        reenviado = true;
      } else {
        userId = invitado.user.id;
      }

      // Insert o update explícito, no upsert: un upsert le devolvería el valor por
      // defecto a status y pisaría created_at.
      const { data: filaExistente } = await db
        .from("app_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      const escritura = filaExistente
        ? db.from("app_users").update({ role: rol, full_name: nombre }).eq("user_id", userId)
        : db
            .from("app_users")
            .insert({ user_id: userId, email, full_name: nombre, role: rol, invited_by: admin });

      const { data: fila, error: errorEscritura } = await escritura.select().single();
      if (errorEscritura) return res.status(500).json({ error: errorEscritura.message });

      // Se devuelve la fila tal cual, sin last_sign_in_at: ese dato solo lo arma
      // listar(). El panel recarga la lista después de invitar.
      return res.status(200).json({ user: fila, resent: reenviado });
    }

    if (req.method === "PATCH") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      const cambios: { role?: Rol; status?: "active" | "disabled" } = {};
      if (body.role === "admin" || body.role === "vendedor") cambios.role = body.role;
      if (body.status === "active" || body.status === "disabled") cambios.status = body.status;
      if (!Object.keys(cambios).length) return res.status(400).json({ error: "Nada que cambiar" });

      const problema = await revisarGuardas(userId, admin, cambios);
      if (problema) return res.status(400).json({ error: problema });

      const { data: fila, error } = await db
        .from("app_users")
        .update(cambios)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ user: fila });
    }

    if (req.method === "DELETE") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      const problema = await revisarGuardas(userId, admin, "delete");
      if (problema) return res.status(400).json({ error: problema });

      // Borrar de auth.users arrastra la fila de app_users por ON DELETE CASCADE.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error inesperado" });
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npm test`

Esperado: build sin errores y las 9 pruebas de la Tarea 2 siguen pasando.

- [ ] **Step 3: Commit**

```bash
git add api/admin/users.ts
git commit -m "API: alta, edición y baja de usuarios con invitación por correo"
```

---

### Task 6: Guía privada — contenido y endpoint

**Files:**
- Move: `guia-vendedores-ecoviva.html` → `content/guia-vendedores.html`
- Create: `scripts/build-content.mjs`
- Create: `api/guia-vendedores.ts`
- Modify: `package.json` (script `build`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `requireUser` de la Tarea 2.
- Produces:
  - `api/_content/guia-vendedores.ts` con `export const GUIA_VENDEDORES_B64: string` (generado, no versionado).
  - `GET /api/guia-vendedores` → `200` con el HTML (`Content-Type: text/html; charset=utf-8`) o `401 { error }`. Lo consume la Tarea 10.

- [ ] **Step 1: Mover el archivo**

El archivo está sin trackear en la raíz, así que `git mv` no aplica:

```bash
mkdir -p content
mv guia-vendedores-ecoviva.html content/guia-vendedores.html
```

Confirmar que no quedó copia servible como estático:

```bash
ls public/ dist/ 2>/dev/null | grep -i guia || echo "sin copias en public ni dist"
```

Esperado: `sin copias en public ni dist`.

- [ ] **Step 2: Escribir el empaquetador de contenido**

Crear `scripts/build-content.mjs`:

```js
// Empaqueta los HTML de content/ en módulos TypeScript importables desde /api.
//
// Por qué no fs.readFileSync: el bundler de funciones de Vercel no garantiza que
// un archivo suelto llegue al bundle — habría que configurar includeFiles y
// confiar en que process.cwd() apunte donde uno espera. Un import estático no se
// puede perder.
//
// Por qué base64 y no un template literal: el HTML tiene 38 KB con backticks y
// secuencias ${ que habría que escapar. Base64 no puede romper la sintaxis.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENIDOS = [
  {
    origen: "content/guia-vendedores.html",
    destino: "api/_content/guia-vendedores.ts",
    exporta: "GUIA_VENDEDORES_B64",
  },
];

mkdirSync(resolve(raiz, "api/_content"), { recursive: true });

for (const { origen, destino, exporta } of CONTENIDOS) {
  const bytes = readFileSync(resolve(raiz, origen));
  const salida =
    `// Generado por scripts/build-content.mjs — no editar a mano.\n` +
    `// Fuente: ${origen}\n` +
    `export const ${exporta} =\n  "${bytes.toString("base64")}";\n`;
  writeFileSync(resolve(raiz, destino), salida);
  console.log(`${origen} → ${destino} (${bytes.length} bytes)`);
}
```

- [ ] **Step 3: Engancharlo al build e ignorar lo generado**

En `package.json`, cambiar el script `build`:

```json
"build": "node scripts/build-content.mjs && tsc ; vite build"
```

Así es imposible olvidarse de regenerarlo, tanto en local como en Vercel.

Agregar al final de `.gitignore`:

```
# Generado por scripts/build-content.mjs en cada build
api/_content/
```

No se versiona: son 51 KB de base64 que ensuciarían el diff cada vez que se toca la guía. Si alguna vez no se generara, el bundler falla ruidosamente por módulo no encontrado — no hay forma de que pase inadvertido.

- [ ] **Step 4: Generar y verificar el ida y vuelta**

```bash
node scripts/build-content.mjs
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const gen = readFileSync('api/_content/guia-vendedores.ts','utf8');
const b64 = gen.match(/\"([A-Za-z0-9+/=]+)\"/)[1];
const html = Buffer.from(b64,'base64').toString('utf8');
const orig = readFileSync('content/guia-vendedores.html','utf8');
console.log('idéntico al original:', html === orig);
console.log('bytes:', html.length);
console.log('arranca con doctype:', html.trimStart().toLowerCase().startsWith('<!doctype html>'));
"
```

Esperado: `idéntico al original: true`, `bytes: 38078`, `arranca con doctype: true`.

- [ ] **Step 5: Escribir el endpoint**

Crear `api/guia-vendedores.ts`:

```ts
import { requireUser } from "./_lib/supabase.js";
import { GUIA_VENDEDORES_B64 } from "./_content/guia-vendedores.js";

// /api/guia-vendedores — GET. Devuelve el HTML de la guía de venta.
// Cualquier usuario activo, admin o vendedor.
//
// El HTML no vive en public/ justamente por esto: ahí Vercel lo publicaría como
// estático y cualquiera con la URL lo bajaría sin pasar por el login.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(Buffer.from(GUIA_VENDEDORES_B64, "base64").toString("utf8"));
}
```

- [ ] **Step 6: Verificar el build completo**

Run: `npm run build`

Esperado: imprime `content/guia-vendedores.html → api/_content/guia-vendedores.ts (38078 bytes)` y termina sin errores.

- [ ] **Step 7: Commit**

```bash
git add content/guia-vendedores.html scripts/build-content.mjs api/guia-vendedores.ts package.json .gitignore
git commit -m "Guía: contenido empaquetado y servido tras verificar sesión"
```

---

### Task 7: `LoginCard` reutilizable con recuperación de contraseña

**Files:**
- Create: `src/components/auth/LoginCard.tsx`
- Modify: `src/components/admin/AdminLogin.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabaseClient`.
- Produces: `export default function LoginCard({ title?, subtitle? }: { title?: string; subtitle?: string })`. Lo usan `AdminLogin` (Tarea 7) y `GuiaVendedores` (Tarea 10).

- [ ] **Step 1: Escribir el componente**

Crear `src/components/auth/LoginCard.tsx`:

```tsx
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import BrandMark from "../admin/BrandMark";

interface Props {
  title?: string;
  subtitle?: string;
}

export default function LoginCard({
  title = "EcoViva",
  subtitle = "Panel de administración",
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError("Correo o contraseña incorrectos.");
  }

  async function onRecuperar() {
    const correo = email.trim();
    if (!correo) {
      setError("Escribí tu correo primero.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/crear-contrasena`,
    });
    setLoading(false);
    // El mensaje no distingue si la cuenta existe: eso revelaría quién tiene acceso.
    setAviso(
      error
        ? "No se pudo enviar el correo. Probá de nuevo en un minuto."
        : "Si esa cuenta existe, te llegó un correo para crear tu contraseña.",
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-lg shadow-emerald-900/5 ring-1 ring-slate-200/80 p-7"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            {aviso && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={onRecuperar}
              disabled={loading}
              className="w-full text-center text-xs text-slate-500 underline underline-offset-2 transition hover:text-emerald-700 disabled:opacity-60"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          EcoViva Desarrollos · acceso restringido
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reducir `AdminLogin` a una envoltura**

Reemplazar todo el contenido de `src/components/admin/AdminLogin.tsx` por:

```tsx
import LoginCard from "../auth/LoginCard";

// El formulario vive en LoginCard porque la guía de vendedores lo reutiliza.
export default function AdminLogin() {
  return <LoginCard title="EcoViva" subtitle="Panel de administración" />;
}
```

- [ ] **Step 3: Verificar en el navegador**

Run: `npm run dev` y abrir `http://localhost:5173/admin`

Verificar:
- La pantalla se ve igual que antes, más el enlace «¿Olvidaste tu contraseña?».
- Con el campo de correo vacío, ese enlace muestra «Escribí tu correo primero.».
- Con `aguilartradesfx@gmail.com`, muestra el aviso verde y llega el correo (SMTP quedó configurado en la Tarea 4).
- Entrar con el usuario y contraseña reales sigue funcionando.

- [ ] **Step 4: Verificar el build**

Run: `npm run build`

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/LoginCard.tsx src/components/admin/AdminLogin.tsx
git commit -m "Auth: LoginCard reutilizable con recuperación de contraseña"
```

---

### Task 8: Página `/crear-contrasena`

**Files:**
- Create: `src/components/auth/CreatePasswordPage.tsx`
- Modify: `src/lib/adminApi.ts` (agregar `getMe`)
- Modify: `src/App.tsx` (ruta + `ChatWidgetGate`)

**Interfaces:**
- Consumes: `GET /api/me` de la Tarea 3.
- Produces: ruta `/crear-contrasena`; `export function getMe(): Promise<{ email: string; role: "admin" | "vendedor" }>` en `adminApi.ts`, que también usa la Tarea 9.

- [ ] **Step 1: Agregar `getMe` a `adminApi.ts`**

Al final de `src/lib/adminApi.ts`:

```ts
// ── Identidad ──
export type AppRole = "admin" | "vendedor";

export function getMe(): Promise<{ email: string; role: AppRole }> {
  return request<{ email: string; role: AppRole }>("/api/me");
}
```

- [ ] **Step 2: Escribir la página**

Crear `src/components/auth/CreatePasswordPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getMe } from "../../lib/adminApi";
import BrandMark from "../admin/BrandMark";

const MINIMO = 10;

type Estado = "cargando" | "sin-enlace" | "listo" | "guardando";

// Ruta /crear-contrasena. La usan dos flujos con el mismo mecanismo: la
// invitación a un usuario nuevo y el "olvidé mi contraseña".
//
// supabase-js tiene detectSessionInUrl activo, así que el token que viene en el
// hash del enlace ya abre sesión al montar la página. Por eso al terminar la
// persona queda logueada sin escribir la contraseña otra vez.
export default function CreatePasswordPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [correoReenvio, setCorreoReenvio] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    // Margen antes de declarar muerto el enlace: procesar el hash es asíncrono y
    // getSession() puede resolver antes de que termine.
    const reloj = setTimeout(() => {
      if (vivo) setEstado((e) => (e === "cargando" ? "sin-enlace" : e));
    }, 3000);

    const marcarListo = () => {
      clearTimeout(reloj);
      setEstado((e) => (e === "cargando" ? "listo" : e));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo && sesion) marcarListo();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (vivo && data.session) marcarListo();
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (p1.length < MINIMO) {
      setError(`La contraseña necesita al menos ${MINIMO} caracteres.`);
      return;
    }
    if (p1 !== p2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setEstado("guardando");
    const { error: errorGuardado } = await supabase.auth.updateUser({ password: p1 });
    if (errorGuardado) {
      setEstado("listo");
      setError(errorGuardado.message);
      return;
    }

    // Ya está autenticada. A dónde va depende del rol, que no viaja en el JWT.
    try {
      const yo = await getMe();
      navigate(yo.role === "admin" ? "/admin" : "/guia-vendedores", { replace: true });
    } catch {
      navigate("/guia-vendedores", { replace: true });
    }
  }

  async function onPedirOtro() {
    const correo = correoReenvio.trim();
    if (!correo) {
      setError("Escribí tu correo.");
      return;
    }
    setError(null);
    const { error: errorEnvio } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/crear-contrasena`,
    });
    setAviso(
      errorEnvio
        ? "No se pudo enviar el correo. Probá de nuevo en un minuto."
        : "Si esa cuenta existe, te llegó un enlace nuevo.",
    );
  }

  const marco = (contenido: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">EcoViva</h1>
          <p className="text-sm text-slate-500">Creá tu contraseña</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg shadow-emerald-900/5 ring-1 ring-slate-200/80 p-7">
          {contenido}
        </div>
      </div>
    </div>
  );

  if (estado === "cargando") {
    return marco(
      <div className="flex justify-center py-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>,
    );
  }

  if (estado === "sin-enlace") {
    return marco(
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Este enlace venció o ya se usó. Pedí uno nuevo con tu correo.
        </p>
        <input
          type="email"
          autoComplete="email"
          value={correoReenvio}
          onChange={(e) => setCorreoReenvio(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {aviso && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>
        )}
        <button
          type="button"
          onClick={onPedirOtro}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          Enviarme un enlace nuevo
        </button>
      </div>,
    );
  }

  return marco(
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <p className="mt-1.5 text-xs text-slate-400">Mínimo {MINIMO} caracteres.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Repetila</label>
        <input
          type="password"
          autoComplete="new-password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={estado === "guardando"}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {estado === "guardando" ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>,
  );
}
```

- [ ] **Step 3: Registrar la ruta**

En `src/App.tsx`:

Junto al `lazy` de `AdminApp`, agregar:

```tsx
// Rutas fuera del sitio público: no llevan locale ni widget de chat.
const CreatePasswordPage = lazy(() => import("./components/auth/CreatePasswordPage"));
```

Reemplazar el cuerpo de `ChatWidgetGate` por:

```tsx
// Muestra el widget de ECO en el sitio público, pero no en el panel ni en las
// pantallas con sesión.
const SIN_WIDGET = ["/admin", "/crear-contrasena", "/guia-vendedores"];

function ChatWidgetGate() {
  const location = useLocation();
  if (SIN_WIDGET.some((ruta) => location.pathname.startsWith(ruta))) return null;
  return <EcoChatWidget />;
}
```

Dentro del `<Routes>` principal, justo debajo de la ruta `/admin/*`:

```tsx
{/* Creación de contraseña — llega desde el enlace del correo */}
<Route path="/crear-contrasena" element={<CreatePasswordPage />} />
```

Tiene que ir **antes** de la ruta comodín `/*`, si no la captura el árbol de locale español.

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run dev` y abrir `http://localhost:5173/crear-contrasena` sin token.

Esperado: spinner unos 3 segundos y después «Este enlace venció o ya se usó» con el campo de correo. No debe aparecer el widget de chat.

- [ ] **Step 5: Verificar el build**

Run: `npm run build`

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/CreatePasswordPage.tsx src/lib/adminApi.ts src/App.tsx
git commit -m "Auth: página para crear contraseña que deja la sesión abierta"
```

---

### Task 9: Pestaña «Usuarios» y verificación de rol en el panel

**Files:**
- Create: `src/components/admin/UsersManager.tsx`
- Modify: `src/lib/adminApi.ts` (helpers de usuarios)
- Modify: `src/components/admin/AdminApp.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx:8`, `:13-16`, `:82`

**Interfaces:**
- Consumes: `/api/admin/users` (Tarea 5), `getMe` (Tarea 8).
- Produces: `export default function UsersManager({ currentEmail }: { currentEmail: string })`.

- [ ] **Step 1: Agregar los helpers a `adminApi.ts`**

Al final de `src/lib/adminApi.ts`:

```ts
// ── Usuarios ──
export interface AppUserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  status: "active" | "disabled";
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

// Solo el listado cruza la fila contra auth.users para saber si la persona entró
// alguna vez. POST y PATCH devuelven la fila cruda.
export type AppUser = AppUserRow & { last_sign_in_at: string | null };

export function getUsers(): Promise<{ users: AppUser[] }> {
  return request<{ users: AppUser[] }>("/api/admin/users");
}

// Sirve para invitar y para reenviar el acceso: el backend detecta cuál es.
export function inviteUser(input: {
  email: string;
  full_name?: string;
  role: AppRole;
}): Promise<{ user: AppUserRow; resent: boolean }> {
  return request<{ user: AppUserRow; resent: boolean }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  user_id: string,
  updates: { role?: AppRole; status?: "active" | "disabled" },
): Promise<{ user: AppUserRow }> {
  return request<{ user: AppUserRow }>("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ user_id, ...updates }),
  });
}

export function deleteUser(user_id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/admin/users", {
    method: "DELETE",
    body: JSON.stringify({ user_id }),
  });
}
```

- [ ] **Step 2: Escribir `UsersManager`**

Crear `src/components/admin/UsersManager.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  type AppUser,
  type AppRole,
} from "../../lib/adminApi";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "Pendiente" no es un estado guardado: es no haber entrado nunca.
function etiquetaEstado(u: AppUser): { texto: string; clase: string } {
  if (u.status === "disabled") return { texto: "Deshabilitado", clase: "bg-red-50 text-red-600" };
  if (!u.last_sign_in_at) return { texto: "Pendiente", clase: "bg-amber-50 text-amber-700" };
  return { texto: "Activo", clase: "bg-emerald-50 text-emerald-700" };
}

export default function UsersManager({ currentEmail }: { currentEmail: string }) {
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<AppRole>("vendedor");
  const [invitando, setInvitando] = useState(false);

  async function recargar() {
    try {
      const { users } = await getUsers();
      setUsuarios(users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function onInvitar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setInvitando(true);
    try {
      const { user, resent } = await inviteUser({
        email,
        full_name: nombre || undefined,
        role: rol,
      });
      setAviso(
        resent
          ? `Le reenviamos el acceso a ${user.email}.`
          : `Invitación enviada a ${user.email}.`,
      );
      setEmail("");
      setNombre("");
      setRol("vendedor");
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo invitar.");
    } finally {
      setInvitando(false);
    }
  }

  async function accion(id: string, fn: () => Promise<unknown>) {
    setError(null);
    setAviso(null);
    setOcupado(id);
    try {
      await fn();
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  async function onReenviar(u: AppUser) {
    await accion(u.user_id, async () => {
      await inviteUser({ email: u.email, full_name: u.full_name ?? undefined, role: u.role });
      setAviso(`Le reenviamos el acceso a ${u.email}.`);
    });
  }

  async function onBorrar(u: AppUser) {
    if (!confirm(`¿Borrar la cuenta de ${u.email}? No se puede deshacer.`)) return;
    await accion(u.user_id, () => deleteUser(u.user_id));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <form
        onSubmit={onInvitar}
        className="bg-white rounded-2xl ring-1 ring-slate-200/80 p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 mb-1">Invitar a alguien</h2>
        <p className="text-sm text-slate-500 mb-4">
          Le llega un correo para crear su contraseña. Al terminar queda dentro.
        </p>

        <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
          <input
            type="email"
            required
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as AppRole)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={invitando}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {invitando ? "Enviando…" : "Invitar"}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Vendedor ve solo la guía de venta. Admin ve además este panel.
        </p>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {aviso && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</p>
      )}

      <div className="bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Persona</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Último ingreso</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => {
                  const estado = etiquetaEstado(u);
                  const esUnoMismo = u.email === currentEmail;
                  const trabajando = ocupado === u.user_id;
                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-900">
                          {u.full_name || u.email}
                        </span>
                        {u.full_name && (
                          <span className="block text-xs text-slate-400">{u.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={esUnoMismo || trabajando}
                          onChange={(e) =>
                            accion(u.user_id, () =>
                              updateUser(u.user_id, { role: e.target.value as AppRole }),
                            )
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none transition focus:border-emerald-500 disabled:opacity-50"
                        >
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatearFecha(u.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={trabajando || u.status === "disabled"}
                            onClick={() => onReenviar(u)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            Reenviar acceso
                          </button>
                          <button
                            type="button"
                            disabled={esUnoMismo || trabajando}
                            onClick={() =>
                              accion(u.user_id, () =>
                                updateUser(u.user_id, {
                                  status: u.status === "active" ? "disabled" : "active",
                                }),
                              )
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            {u.status === "active" ? "Deshabilitar" : "Habilitar"}
                          </button>
                          <button
                            type="button"
                            disabled={esUnoMismo || trabajando}
                            onClick={() => onBorrar(u)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar el rol antes de montar el panel**

En `src/components/admin/AdminApp.tsx`, agregar el import:

```tsx
import { getMe } from "../../lib/adminApi";
```

Agregar el estado y el efecto después del `useEffect` que ya existe:

```tsx
  // Tener sesión ya no equivale a poder ver el panel: un vendedor se autentica
  // igual pero no entra acá. El rol no viaja en el JWT, hay que preguntarlo.
  const [acceso, setAcceso] = useState<"cargando" | "admin" | "denegado">("cargando");

  useEffect(() => {
    if (!session) {
      setAcceso("cargando");
      return;
    }
    let vivo = true;
    getMe()
      .then((yo) => vivo && setAcceso(yo.role === "admin" ? "admin" : "denegado"))
      .catch(() => vivo && setAcceso("denegado"));
    return () => {
      vivo = false;
    };
  }, [session]);
```

Reemplazar la última línea (`if (!session) return <AdminLogin />;` y el `return <AdminDashboard .../>`) por:

```tsx
  if (!session) return <AdminLogin />;

  if (acceso === "cargando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (acceso === "denegado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Tu cuenta no tiene acceso al panel
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Si buscabas la guía de venta, está acá.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="/guia-vendedores"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Ir a la guía
            </a>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard session={session} />;
```

- [ ] **Step 4: Agregar la pestaña**

En `src/components/admin/AdminDashboard.tsx`:

Línea 6, agregar el import:

```tsx
import UsersManager from "./UsersManager";
```

Línea 8:

```tsx
type Tab = "lotes" | "bot" | "usuarios";
```

Líneas 13-16:

```tsx
  const tabs: { id: Tab; label: string }[] = [
    { id: "lotes", label: "Lotes" },
    { id: "bot", label: "Bot & Prompt" },
    { id: "usuarios", label: "Usuarios" },
  ];
```

Línea 82 — el ternario ya no alcanza con tres pestañas:

```tsx
        {tab === "lotes" && <LotsManager />}
        {tab === "bot" && <BotPromptManager />}
        {tab === "usuarios" && <UsersManager currentEmail={email.toLowerCase()} />}
```

En minúsculas porque `UsersManager` lo compara contra `app_users.email`, que el
trigger de la Tarea 1 guarda siempre normalizado.

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev`, entrar a `http://localhost:5173/admin` con el usuario real.

Verificar:
- Aparece la pestaña «Usuarios» en escritorio y en móvil.
- La tabla lista los 2 usuarios existentes como Admin / Activo.
- En tu propia fila, el selector de rol y los botones Deshabilitar y Borrar están deshabilitados.
- Las pestañas Lotes y Bot & Prompt siguen funcionando.

Nota: si `/api` no responde en local (no hay `vercel dev` corriendo), la tabla mostrará un error de carga. Eso es esperable; la verificación real de esta pestaña ocurre en la Tarea 11.

- [ ] **Step 6: Verificar el build**

Run: `npm run build && npm test`

Esperado: build sin errores, 9 pruebas pasando.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/UsersManager.tsx src/components/admin/AdminApp.tsx src/components/admin/AdminDashboard.tsx src/lib/adminApi.ts
git commit -m "Admin: pestaña Usuarios y verificación de rol al entrar al panel"
```

---

### Task 10: Página `/guia-vendedores`

**Files:**
- Create: `src/components/guia/GuiaVendedores.tsx`
- Modify: `src/lib/adminApi.ts` (`getGuiaHtml`)
- Modify: `src/App.tsx` (ruta)

**Interfaces:**
- Consumes: `GET /api/guia-vendedores` (Tarea 6), `LoginCard` (Tarea 7).
- Produces: ruta `/guia-vendedores`.

- [ ] **Step 1: Agregar `getGuiaHtml` a `adminApi.ts`**

Al final de `src/lib/adminApi.ts`:

```ts
// ── Guía de vendedores ──
// No usa request(): el endpoint devuelve HTML, no JSON.
export async function getGuiaHtml(): Promise<string> {
  const res = await fetch("/api/guia-vendedores", { headers: await authHeaders() });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Tu cuenta no tiene acceso a la guía.");
    throw new Error(`No se pudo cargar la guía (${res.status}).`);
  }
  return res.text();
}
```

- [ ] **Step 2: Escribir la página**

Crear `src/components/guia/GuiaVendedores.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient";
import { getGuiaHtml } from "../../lib/adminApi";
import LoginCard from "../auth/LoginCard";

// Ruta /guia-vendedores. No aparece en ningún menú: el enlace se comparte a mano.
// El HTML llega de /api/guia-vendedores, que valida el JWT — nunca se publica
// como archivo estático.
export default function GuiaVendedores() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setCargandoSesion(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHtml(null);
      return;
    }
    let vivo = true;
    setError(null);
    getGuiaHtml()
      .then((h) => vivo && setHtml(h))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudo cargar la guía."));
    return () => {
      vivo = false;
    };
  }, [session]);

  const spinner = (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
    </div>
  );

  if (cargandoSesion) return spinner;

  if (!session) {
    return <LoginCard title="Guía de venta" subtitle="Iniciá sesión para verla" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">No pudimos abrir la guía</h1>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  if (!html) return spinner;

  // El iframe aísla el CSS de la guía del de Tailwind.
  // Se omite allow-same-origin a propósito: junto con allow-scripts, el documento
  // enmarcado podría leer el localStorage de este origen y con él el token de
  // sesión. El botón "Copiar" de la guía tiene su propio respaldo con
  // document.execCommand si la API de portapapeles queda bloqueada.
  return (
    <iframe
      title="Guía de venta · Lomas de la Llanada"
      srcDoc={html}
      sandbox="allow-scripts allow-popups"
      allow="clipboard-write"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
```

- [ ] **Step 3: Registrar la ruta**

En `src/App.tsx`, junto al otro `lazy`:

```tsx
const GuiaVendedores = lazy(() => import("./components/guia/GuiaVendedores"));
```

Y dentro del `<Routes>` principal, junto a `/crear-contrasena`:

```tsx
{/* Guía de venta — solo con sesión. El enlace se comparte a mano. */}
<Route path="/guia-vendedores" element={<GuiaVendedores />} />
```

`ChatWidgetGate` ya la incluye desde la Tarea 8.

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run dev`, abrir `http://localhost:5173/guia-vendedores`.

Esperado sin sesión: el formulario de login con el título «Guía de venta». Sin widget de chat.

- [ ] **Step 5: Verificar el build**

Run: `npm run build && npm test`

Esperado: sin errores, 9 pruebas pasando.

- [ ] **Step 6: Commit**

```bash
git add src/components/guia/GuiaVendedores.tsx src/lib/adminApi.ts src/App.tsx
git commit -m "Guía: página /guia-vendedores protegida por sesión"
```

---

### Task 11: Deploy, alta de Alina y aceptación end-to-end

**Files:** ninguno (salvo que la verificación encuentre defectos).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el enlace `https://ecovivadesarrollos.com/guia-vendedores` funcionando y la cuenta de `alinaramirezgamboa@gmail.com` activa como admin.

- [ ] **Step 1: Pedirle el push al usuario**

El push a `main` necesita un PAT que pega el usuario en la URL del remote. **No intentar el push sin pedírselo.** Decirle qué commits van y esperar a que confirme que Vercel terminó de desplegar.

- [ ] **Step 2: Verificar que la guía no quedó expuesta como estático**

```bash
for u in \
  "https://ecovivadesarrollos.com/guia-vendedores-ecoviva.html" \
  "https://ecovivadesarrollos.com/content/guia-vendedores.html" ; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$u")"
done
curl -s "https://ecovivadesarrollos.com/guia-vendedores-ecoviva.html" | grep -c "Lomas de la Llanada" || echo "0 coincidencias — bien"
```

Esperado: las dos URLs devuelven el `index.html` del SPA (por el rewrite de `vercel.json`), **no** el contenido de la guía. El `grep` tiene que dar 0.

- [ ] **Step 3: Verificar que los endpoints exigen autenticación**

```bash
for r in me admin/users guia-vendedores ; do
  echo "$r -> $(curl -s -o /dev/null -w '%{http_code}' "https://ecovivadesarrollos.com/api/$r")"
done
```

Esperado: `401` en los tres.

- [ ] **Step 4: Verificar que los endpoints existentes no se rompieron**

```bash
curl -s -o /dev/null -w "lots publico: %{http_code}\n" "https://ecovivadesarrollos.com/api/lots?onlyAvailable=true"
```

Esperado: `200`. La lectura de lotes es pública y la Tarea 2 no debía tocarla.

Después, entrar a `https://ecovivadesarrollos.com/admin` con tu cuenta y confirmar que Lotes y Bot & Prompt cargan y guardan como antes.

- [ ] **Step 5: Invitar a Alina**

En `/admin` → pestaña Usuarios:

- Correo: `alinaramirezgamboa@gmail.com`
- Nombre: `Alina Ramírez Gamboa`
- Rol: **Admin**

Esperado: mensaje verde «Invitación enviada a alinaramirezgamboa@gmail.com» y una fila nueva con estado **Pendiente**.

Confirmar en la base que quedó bien:

```bash
set -a && . ./.env.local && set +a
curl -s -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select email, role, status, invited_by from public.app_users order by created_at;"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
```

Esperado: 3 filas, la de Alina con `role=admin`, `status=active`.

- [ ] **Step 6: Recorrer el flujo completo de invitación**

Pedirle a Alina (o probarlo con un correo propio distinto antes) que:

1. Abra el correo «Te dieron acceso a EcoViva» de `EcoViva Desarrollos <noreply@send.bralto.io>`.
2. Haga clic en «Crear mi contraseña».
3. Confirme que cae en `ecovivadesarrollos.com/crear-contrasena`, **no** en localhost.
4. Escriba una contraseña de 10+ caracteres dos veces.
5. Confirme que **entra directo al panel sin volver a escribirla**. Eso es lo que había que construir.

Probar también los rechazos: una contraseña de 5 caracteres da «necesita al menos 10 caracteres», y dos distintas dan «no coinciden».

- [ ] **Step 7: Verificar la guía**

1. En una ventana privada, abrir `https://ecovivadesarrollos.com/guia-vendedores`. Debe pedir login con el título «Guía de venta».
2. Entrar. Debe cargar la guía a pantalla completa.
3. **Probar el botón «Copiar» de algún gancho y pegar el texto en otro lado.** Es el punto con incertidumbre técnica del diseño: el iframe va sin `allow-same-origin` para que no pueda leer el token de sesión, lo que puede bloquear la API de portapapeles. Si el respaldo `execCommand` tampoco funciona, la salida es servir la guía navegando el iframe a una ruta propia en vez de por `srcDoc`.
4. Confirmar que el widget de chat de ECO **no** aparece encima.

- [ ] **Step 8: Verificar «olvidé mi contraseña»**

Desde `/admin`, con sesión cerrada: escribir un correo válido, tocar «¿Olvidaste tu contraseña?», confirmar que llega el correo «Creá tu contraseña de EcoViva» y que el enlace deja cambiarla.

Confirmar también que con un correo inexistente el mensaje es el mismo — no debe revelar quién tiene cuenta.

- [ ] **Step 9: Verificar las guardas de seguridad**

En la pestaña Usuarios:

- En tu propia fila, el selector de rol y los botones Deshabilitar y Borrar están deshabilitados.
- Deshabilitar a Alina y confirmar que, con su sesión, `/admin` y `/guia-vendedores` dejan de funcionar. Volver a habilitarla.

Y contra la API, saltándose la UI:

```bash
# Reemplazar <JWT> por el access_token de tu sesión (DevTools → Application →
# Local Storage → ecoviva-admin-auth) y <TU_USER_ID> por tu user_id.
curl -s -X PATCH -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"user_id":"<TU_USER_ID>","role":"vendedor"}' \
  "https://ecovivadesarrollos.com/api/admin/users"
```

Esperado: `{"error":"No podés quitarte tu propio acceso"}`.

- [ ] **Step 10: Pasarle el enlace al usuario**

Confirmarle que puede compartir `https://ecovivadesarrollos.com/guia-vendedores` y que solo abre para quien tenga cuenta activa.

---

## Notas de cierre

- `ADMIN_EMAILS` queda sin uso tras la Tarea 2. Se puede borrar del entorno de Vercel cuando se quiera; dejarla no hace daño.
- No hace falta ninguna variable de entorno nueva en Vercel. `PUBLIC_SITE_URL` tiene valor por defecto en el código y el reenvío de acceso usa `SUPABASE_SERVICE_ROLE_KEY`, que ya está configurada.
- Para actualizar la guía en el futuro: editar `content/guia-vendedores.html`, commitear y pushear. El build la reempaqueta solo.
