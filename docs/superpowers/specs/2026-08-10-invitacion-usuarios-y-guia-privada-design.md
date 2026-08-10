# Invitación de usuarios y guía privada

Fecha: 2026-08-10
Estado: aprobado, listo para plan de implementación

## Problema

Hoy dar de alta a alguien en EcoViva exige tres pasos manuales y un deploy:

1. Crear el usuario a mano en el dashboard de Supabase, inventándole una contraseña.
2. Pasarle esa contraseña por un canal inseguro.
3. Agregar su correo a `BASE_ADMINS` en `api/_lib/supabase.ts` y desplegar.

No existe correo de invitación, no existe página para que la persona elija su propia
contraseña, y no existe pantalla para administrar usuarios.

Además hace falta publicar `guia-vendedores-ecoviva.html` en una URL que solo abran
las personas con sesión iniciada, sin que aparezca en el panel de administración.

### Dos piezas rotas que bloquean todo

Verificado contra el proyecto `hujuifwfknlpdqgvogkf` el 2026-08-10:

- **No hay SMTP propio** (`smtp_host = null`). El proyecto usa el servicio de correo por
  defecto de Supabase, limitado a 2 correos por hora y que **solo entrega a miembros de la
  organización de Supabase**. Una invitación a un `@gmail.com` externo se pierde en silencio.
- **`site_url = http://localhost:3000`** y `uri_allow_list` vacío. Cualquier enlace de
  invitación o de recuperación redirige al usuario a su propia máquina.

Sin arreglar estas dos, ningún flujo de invitación funciona.

## Alcance

Dentro:

- Invitación por correo con creación de contraseña y sesión iniciada al terminar.
- Pestaña «Usuarios» en `/admin` para invitar, cambiar rol y revocar acceso.
- Sustituir la lista de admins quemada en el código por una tabla en Supabase.
- Recuperación de contraseña («olvidé mi contraseña»), que sale gratis del mismo mecanismo.
- Página `/guia-vendedores` protegida por sesión.
- Alta de `alinaramirezgamboa@gmail.com` con rol `admin`.

Fuera:

- Autenticación con Google u otros proveedores.
- Segundo factor.
- Auditoría de accesos.
- Editar la guía desde el panel.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Rol de Alina | `admin` completo | Indicación directa del usuario. |
| Dónde se dan de alta | Pestaña «Usuarios» en `/admin` | Evita depender de un deploy por cada persona nueva. |
| Envío de correo | Resend como SMTP de Supabase | Cero código de envío; arregla invitación, reset y cambio de correo de una sola vez. |
| Remitente | `EcoViva Desarrollos <noreply@send.bralto.io>` | Único dominio verificado en la cuenta de Resend. |

### Verificaciones hechas antes de decidir

- Envío de prueba a través de la API de Resend con `noreply@send.bralto.io`: aceptado
  (id `84b7115b-3285-44c8-943c-1a986b236474`).
- `RESEND_API_KEY` es una key restringida a envío: no sirve para la API de dominios, pero
  **sí autentica por SMTP** (`smtp.resend.com:465`, usuario `resend`). Probado y confirmado.

### Alternativas descartadas

- **SMTP de Google Workspace.** Funcionaba, pero el usuario ya tenía Resend contratado.
- **API HTTP de Resend desde un endpoint propio.** Da control total de la plantilla, pero
  obliga a mantener un sistema de plantillas nuestro *y además* arreglar el reset de
  contraseña por otra vía. No se justifica para el volumen esperado.
- **Envío vía GoHighLevel.** Obligaría a meter al personal interno como contactos del CRM.

### Riesgo aceptado

Los correos salen de `send.bralto.io`, no de `ecovivadesarrollos.com`. SPF y DKIM alinean
con `bralto.io`, así que la entrega es buena, pero el remitente no coincide con la marca del
mensaje. Aceptado para invitaciones internas. Si más adelante se quiere alinear, es agregar
el dominio en Resend y publicar 3 registros DNS; nada del código cambia.

## Arquitectura

### Modelo de datos

Migración `supabase/migrations/0007_app_users.sql`:

```sql
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

alter table public.app_users enable row level security;
-- Sin políticas: solo service_role la toca, igual que public.bot_config.
```

`email` se guarda siempre en minúsculas. Trigger `set_updated_at` reutilizando la función
que ya define la migración `0001`.

Backfill en la misma migración: los dos usuarios que ya existen en `auth.users`
(`aguilartradesfx@gmail.com` y `gerencia@duphomes.com`) entran como `admin` / `active`.

**Por qué `status` no tiene el valor `invited`.** El estado «pendiente de activar» se deriva
en tiempo de lectura de `auth.users.last_sign_in_at`: si es `null`, la persona nunca entró.
Guardarlo como columna crea una segunda fuente de verdad que se puede desincronizar y una
ruta de escritura extra que hay que mantener. `status` sirve solo para control de acceso.

### Roles

| Rol | `/admin` | `/guia-vendedores` |
|---|---|---|
| `admin` | sí | sí |
| `vendedor` | no | sí |

Alina entra como `admin`. El rol `vendedor` queda listo para la próxima persona.

### Autorización en el backend

`api/_lib/supabase.ts` pasa de una función a dos, sobre un resolvedor común:

```ts
type Caller = { email: string; userId: string | null; role: "admin" | "vendedor" };

resolveCaller(req): Promise<Caller | null>
  // 1. Bearer == ADMIN_API_TOKEN  -> { email: "service", role: "admin" }   (servidor a servidor)
  // 2. JWT de Supabase -> busca en app_users por user_id
  //      status !== 'active' -> null
  // 3. Red de seguridad: si el correo del JWT está en BASE_ADMINS pero no en
  //    app_users, se acepta como admin. Evita quedar fuera del panel por un
  //    error en los datos.

requireUser(req):  Caller | null                     // cualquier usuario activo
requireAdmin(req): string | null                     // solo admin; conserva la firma actual
```

`requireAdmin` mantiene su firma (devuelve el correo o `null`) para no tocar los endpoints
que ya la usan: `api/lots.ts`, `api/admin/config.ts`, `api/admin/prompt-assistant.ts`.

La red de seguridad usa solo `BASE_ADMINS`, no `ADMIN_EMAILS`. El backfill de la migración
mete en `app_users` a todos los usuarios que existen en `auth.users`, así que cualquiera que
hoy pueda entrar de verdad queda cubierto, esté o no en esa variable.

### Endpoints

**`api/admin/users.ts`** — todos requieren `requireAdmin`.

| Método | Qué hace |
|---|---|
| `GET` | Lista `app_users` cruzada con `last_sign_in_at` de `auth.users`. |
| `POST` | `{ email, full_name, role }` → invita y crea la fila. |
| `PATCH` | `{ user_id, role?, status? }` → cambia rol o habilita/deshabilita. |
| `DELETE` | `{ user_id }` → borra de `auth.users`; la fila cae en cascada. |

El `POST` hace, en este orden:

1. Normaliza el correo a minúsculas y valida el formato.
2. `supabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name } })`
   con `redirectTo = ${SITE_URL}/crear-contrasena`.
3. Inserta en `app_users` con el `user_id` devuelto.

Si el paso 2 falla, no se inserta nada y el error del envío se devuelve al panel: el admin
tiene que ver que el correo no salió, no un usuario a medio crear.

Si el correo ya existe en `auth.users`, el endpoint no falla: reenvía la invitación y hace
`upsert` de la fila en `app_users`. Así «Reenviar invitación» es el mismo `POST`.

Protecciones: un admin no puede deshabilitarse, borrarse ni bajarse de rol a sí mismo, y no
se puede dejar el sistema con cero admins activos.

El `redirectTo` sale de `PUBLIC_SITE_URL`, variable nueva en Vercel, con
`https://ecovivadesarrollos.com` como valor por defecto en el código. No se deriva del
`Origin` de la petición: eso dejaría que alguien con un JWT válido apunte el enlace de
invitación a otro dominio.

**`api/me.ts`** — `GET`, requiere `requireUser`. Devuelve `{ email, role }`.

Existe porque dos pantallas necesitan el rol antes de decidir qué mostrar: `AdminApp`, para
no montar el panel a un `vendedor`, y `CreatePasswordPage`, para saber a dónde mandar a la
persona después de crear la contraseña. El rol no viaja en el JWT, así que hay que pedirlo.

**`api/guia-vendedores.ts`** — `GET`, requiere `requireUser` (cualquier rol activo).

Devuelve el HTML con `Content-Type: text/html; charset=utf-8` y
`Cache-Control: private, no-store`. Sin sesión válida responde `401`.

### Cómo se sirve la guía

El archivo **no puede vivir en `public/`**: ahí Vercel lo publica como estático y cualquiera
con la URL lo baja sin pasar por el login.

```
content/guia-vendedores.html          fuente de verdad, versionada en git
   ↓  scripts/build-content.mjs       (codifica a base64)
api/_content/guia-vendedores.ts       export const GUIA_HTML_B64 = "..."
   ↓  import normal
api/guia-vendedores.ts                verifica el JWT y devuelve el HTML
```

Se usa base64 en un módulo TypeScript, y no `fs.readFileSync`, porque el empaquetado de
funciones de Vercel no garantiza que un archivo suelto llegue al bundle: haría falta
configurar `includeFiles` y depender de que `process.cwd()` apunte donde uno espera. Un
`import` es estático y el bundler no lo puede perder. Base64 en vez de un template literal
evita tener que escapar backticks y `${` dentro de 38 KB de HTML.

El script se engancha a `npm run build`, así que es imposible olvidarse de regenerarlo:

```json
"build": "node scripts/build-content.mjs && tsc ; vite build"
```

`guia-vendedores-ecoviva.html` se mueve de la raíz a `content/`. Hay que confirmar que no
quede copia en `public/` ni en `dist/`.

### Frontend

**Rutas nuevas en `src/App.tsx`**, ambas fuera de los árboles de locale y sin el widget de
chat:

- `/crear-contrasena`
- `/guia-vendedores`

Hay que extender el `ChatWidgetGate` para que tampoco monte el widget en estas dos.

**`src/components/auth/LoginCard.tsx`** — se extrae el formulario que hoy está dentro de
`AdminLogin.tsx`, con props `title` y `subtitle`. Lo reutilizan el login del panel y la
puerta de la guía. Se le agrega «¿Olvidaste tu contraseña?», que llama a
`supabase.auth.resetPasswordForEmail(email, { redirectTo: '/crear-contrasena' })`.
`AdminLogin.tsx` queda como una envoltura delgada.

**`src/components/auth/CreatePasswordPage.tsx`** — ruta `/crear-contrasena`.

`supabase-js` tiene `detectSessionInUrl` activo por defecto, así que el token del enlace ya
abre sesión al cargar la página. El flujo:

1. Esperar a que `onAuthStateChange` resuelva.
2. Sin sesión → «El enlace expiró o ya fue usado», con un campo para pedir uno nuevo.
3. Con sesión → dos campos de contraseña, mínimo 10 caracteres, que deben coincidir.
4. `supabase.auth.updateUser({ password })`.
5. Al terminar la persona ya está autenticada. Pedir `GET /api/me` y redirigir según el rol:
   `admin` a `/admin`, `vendedor` a `/guia-vendedores`. Sin el rol no se sabe a dónde
   mandarla, y caer siempre en `/admin` le mostraría a un vendedor una pantalla de «no
   tenés acceso» justo después de activar su cuenta.

La misma página sirve para invitación y para recuperación: el mecanismo es idéntico.

**`AdminApp.tsx`** — hoy asume que tener sesión equivale a poder ver el panel. Con el rol
`vendedor` deja de ser cierto. Pide `GET /api/me` después de resolver la sesión y, si el rol
no es `admin`, muestra «Tu cuenta no tiene acceso al panel» con enlace a `/guia-vendedores`
y botón de salir. Evita que un vendedor vea el panel cargar y luego fallar cada llamada con
401.

**`src/components/admin/UsersManager.tsx`** — pestaña «Usuarios».

Tabla con correo, nombre, rol, estado y último ingreso. Estado mostrado: «Pendiente» si
`last_sign_in_at` es `null`, si no «Activo» o «Deshabilitado». Acciones: invitar (formulario
con correo, nombre y rol), reenviar invitación, cambiar rol, deshabilitar y borrar. Las
acciones destructivas piden confirmación.

`AdminDashboard.tsx` gana la pestaña. Ojo: la línea 82 hoy es un ternario
(`tab === "lotes" ? <LotsManager/> : <BotPromptManager/>`) y con tres pestañas hay que
cambiarla por un mapa o un `switch`.

**`src/components/guia/GuiaVendedores.tsx`** — ruta `/guia-vendedores`.

Sin sesión monta `LoginCard` con el texto «Iniciá sesión para ver la guía». Con sesión pide
`/api/guia-vendedores` con el Bearer y pinta el resultado en un iframe a pantalla completa:

```tsx
<iframe srcDoc={html} sandbox="allow-scripts allow-popups" allow="clipboard-write" />
```

El iframe aísla el CSS de la guía del de Tailwind. Se omite `allow-same-origin` a propósito:
con `allow-scripts` juntas, el documento enmarcado podría leer el `localStorage` del origen
y con él el token de sesión. La guía trae un único script, el botón «Copiar», que sigue
funcionando: si la API de portapapeles queda bloqueada por el sandbox, cae en su propio
respaldo con `document.execCommand('copy')`. **Verificar el botón en el navegador durante la
implementación**; si el respaldo tampoco funcionara, la salida es servir la guía desde una
ruta propia en vez de por `srcDoc`.

`src/lib/adminApi.ts` suma los helpers de usuarios y el de la guía, reutilizando el
`request()` que ya existe.

### Configuración de Supabase

Vía Management API, con `SUPABASE_ACCESS_TOKEN`:

| Ajuste | Antes | Después |
|---|---|---|
| `site_url` | `http://localhost:3000` | `https://ecovivadesarrollos.com` |
| `uri_allow_list` | vacío | prod, `www`, `localhost:5173`, `https://*-ecoviva.vercel.app` |
| `password_min_length` | 6 | 10 |
| `smtp_host` / `port` | — | `smtp.resend.com` / `465` |
| `smtp_user` / `pass` | — | `resend` / `RESEND_API_KEY` |
| `smtp_admin_email` | — | `noreply@send.bralto.io` |
| `smtp_sender_name` | — | `EcoViva Desarrollos` |
| Plantillas invite y recovery | inglés genérico | español, marca EcoViva |

Las plantillas se versionan en `supabase/auth-templates/{invite,recovery}.html` y se aplican
por la Management API, para que queden en git y no solo en el dashboard.

`ADMIN_EMAILS` deja de usarse una vez que `app_users` está poblada; se puede quitar del
entorno más adelante. `BASE_ADMINS` se conserva como red de seguridad.

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| El correo de invitación no sale | El `POST` falla, no se crea la fila, el panel muestra el error de Resend. |
| El correo ya existe en `auth.users` | Reenvía la invitación y hace upsert. No es un error. |
| Enlace expirado o ya usado | `/crear-contrasena` lo dice y ofrece pedir uno nuevo. |
| Usuario `disabled` que intenta entrar | Login de Supabase funciona, pero `requireUser` devuelve `401`. La UI muestra «Tu cuenta fue deshabilitada». |
| `/api/guia-vendedores` sin token | `401`, sin filtrar nada del contenido. |
| Un admin intenta borrarse o bajarse el rol | `400` con explicación. |
| Quedaría cero admins activos | `400`, se bloquea la operación. |

Los enlaces de Supabase caducan a la hora (`mailer_otp_exp = 3600`). Vale la pena decirlo en
el texto del correo.

## Verificación

Este repositorio no tiene suite de pruebas automatizadas, así que la verificación es manual
y contra el entorno real.

Antes de tocar código:

- [x] `noreply@send.bralto.io` entrega — envío de prueba aceptado por Resend.
- [x] La key restringida autentica por SMTP en `smtp.resend.com:465`.

Después de implementar:

- [ ] `npm run build` pasa y `api/_content/guia-vendedores.ts` se regenera solo.
- [ ] La migración `0007` aplica y deja a los dos usuarios existentes como `admin`/`active`.
- [ ] Los endpoints que ya existían (`/api/lots`, `/api/admin/config`) siguen autorizando bien.
- [ ] Invitar a Alina: le llega el correo, elige contraseña, **queda logueada sin escribirla
      de nuevo**, y cae en `/admin`.
- [ ] `/guia-vendedores` sin sesión pide login; con sesión muestra la guía.
- [ ] El botón «Copiar» de la guía funciona dentro del iframe.
- [ ] `curl` a `/api/guia-vendedores` sin token devuelve `401`.
- [ ] El HTML de la guía no es accesible como estático: `curl` a
      `/guia-vendedores-ecoviva.html` y a `/content/guia-vendedores.html` no devuelve el
      contenido.
- [ ] «Olvidé mi contraseña» manda el correo y permite cambiarla.
- [ ] Un usuario `disabled` no puede entrar a `/admin` ni a la guía.

El deploy va por push a `main` con auto-deploy de Vercel. `RESEND_API_KEY` no hace falta en
Vercel: la consume Supabase como contraseña de SMTP, nada más. La única variable nueva que
sí hay que dar de alta en Vercel es `PUBLIC_SITE_URL`.

## Archivos afectados

Nuevos:

```
supabase/migrations/0007_app_users.sql
supabase/auth-templates/invite.html
supabase/auth-templates/recovery.html
scripts/build-content.mjs
content/guia-vendedores.html          (movido desde la raíz)
api/_content/guia-vendedores.ts       (generado)
api/admin/users.ts
api/me.ts
api/guia-vendedores.ts
src/components/auth/LoginCard.tsx
src/components/auth/CreatePasswordPage.tsx
src/components/guia/GuiaVendedores.tsx
src/components/admin/UsersManager.tsx
```

Modificados:

```
api/_lib/supabase.ts                  requireUser + requireAdmin sobre resolveCaller
src/App.tsx                           dos rutas nuevas, ChatWidgetGate
src/components/admin/AdminApp.tsx     verificación de rol
src/components/admin/AdminDashboard.tsx   pestaña Usuarios, ternario -> mapa
src/components/admin/AdminLogin.tsx   envoltura de LoginCard
src/lib/adminApi.ts                   helpers de usuarios y guía
package.json                          build-content en el script build
```
