# Runbook: poner a andar el bot de Telegram de la agenda

Guion paso a paso. Hacé un paso, confirmá que salió lo que dice "Cómo saber que salió bien", y recién ahí seguís al siguiente. Si algo no coincide, no sigas — anotá qué salió y lo revisamos antes de continuar.

Son dos personas las que van a quedar usando el bot — **Alejandro** y **Alina** — cada una con su propia cuenta de Telegram y su propio usuario del panel (`https://www.ecovivadesarrollos.com/admin`). El bot se llama **Ecoviva**, usuario `@EcovivacrBot`.

## Antes de empezar — qué ya está hecho

No hay que repetir nada de esto:

- El bot ya existe en Telegram: `@EcovivacrBot`.
- `TELEGRAM_BOT_TOKEN` ya está guardado en `.env.local` (local, no en Vercel todavía — eso es el Paso 4).
- Las migraciones de base de datos ya están aplicadas en producción: las tablas `citas`, `citas_log`, `agenda_acciones_pendientes`, `agenda_jobs`, `telegram_updates` y `agenda_mensajes` ya existen. **No hay que correr ninguna migración en este runbook.**
- El código ya tiene: autorización por usuario (no por chat), vinculación con código de un solo uso, el agente conversacional con sus 5 herramientas, confirmación por botones, deduplicación de updates, comandos `/hoy` y `/semana`, aviso instantáneo cuando uno agenda algo y le llega a la otra persona, y el resumen diario por cron.

Lo que falta es todo lo de abajo: endurecer el bot en BotFather, generar el secreto del webhook, cargar variables en Vercel, desplegar, registrar el webhook, vincular las dos cuentas, y probar.

---

## Paso 1 — Confirmar que el bot responde (opcional, ya está hecho)

Esto ya está hecho — el bot existe y tiene nombre y usuario correctos. Si querés confirmarlo antes de seguir, corré esto vos mismo (reemplazando `$TOKEN` por el valor real de `TELEGRAM_BOT_TOKEN` de `.env.local`):

```bash
curl "https://api.telegram.org/bot$TOKEN/getMe"
```

**Cómo saber que salió bien:** la respuesta trae `"username":"EcovivacrBot"` y `"first_name":"Ecoviva"`.

**Si sale mal:** si da `"ok":false`, el token guardado en `.env.local` no es válido — pedile uno nuevo a BotFather con `/token` sobre `@EcovivacrBot` y actualizá `.env.local`.

Si ya confirmaste esto antes, saltealo y pasá directo al Paso 2.

---

## Paso 2 — Endurecer el bot en BotFather

Esto es lo único que queda pendiente de configurar en BotFather. Abrí el chat con `@BotFather` en Telegram.

1. Mandale `/setjoingroups`, elegí `@EcovivacrBot` de la lista, y respondé **Disable**.
2. Mandale `/setprivacy`, elegí `@EcovivacrBot` de nuevo, y respondé **Enable**.

Por qué: el código ya exige chat privado (`chatType !== "private"` corta el acceso), así que esto no cambia el comportamiento — es una capa menos de superficie: ni siquiera queda la posibilidad de meter el bot a un grupo.

**Cómo saber que salió bien:** corré de nuevo el `getMe` del Paso 1 —

```bash
curl "https://api.telegram.org/bot$TOKEN/getMe"
```

— y en la respuesta tiene que aparecer `"can_join_groups":false`.

**Si sale mal:** si `can_join_groups` sigue en `true`, repetí `/setjoingroups` en BotFather asegurándote de elegir `@EcovivacrBot` en el selector (BotFather administra varios bots a la vez si tenés más de uno, y es fácil tocar el bot equivocado).

---

## Paso 3 — Generar `TELEGRAM_WEBHOOK_SECRET`

Este valor no existe todavía en ningún lado. Es el secreto que Telegram va a mandar en cada request al webhook para probar que es Telegram y no cualquiera pegándole a la URL.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiá el valor que imprime y guardalo en `.env.local` como:

```
TELEGRAM_WEBHOOK_SECRET=<lo que imprimió el comando>
```

**Cómo saber que salió bien:** el comando imprime una cadena hexadecimal de 64 caracteres (32 bytes) y `.env.local` tiene la línea `TELEGRAM_WEBHOOK_SECRET=...` con ese valor.

**Si sale mal:** si el comando no imprime nada o tira error, confirmá que estás corriendo `node` (no otro intérprete) — `node -v` para verificar que existe en el PATH.

Guardá este valor aparte también (por ejemplo, pegado en una nota temporal) — lo vas a necesitar tal cual en el Paso 6.

---

## Paso 4 — Cargar las variables de entorno en Vercel

**Este paso lo tenés que hacer vos, Alejandro** — mi acceso al proyecto de Vercel da 403 (no tengo permiso de escritura ahí). Entrá a `vercel.com` → proyecto **`ecoviva`** → **Settings → Environment Variables**, y cargá cada una de estas en los tres entornos: **Production, Preview y Development**.

| Variable | Para qué sirve |
|---|---|
| `TELEGRAM_BOT_TOKEN` | El token del bot (el mismo valor que ya está en tu `.env.local`). Sin esto, `api/_lib/agenda/telegram.ts` no puede mandar ni recibir nada de la API de Telegram. |
| `TELEGRAM_WEBHOOK_SECRET` | El secreto que generaste en el Paso 3. El webhook (`api/telegram/webhook.ts`) lo compara contra la cabecera que manda Telegram en cada request; si no coincide, responde 401. |
| `AGENDA_MODEL` | Qué modelo de Claude usa el agente conversacional del bot (`api/_lib/agenda/agente.ts`). Si no la cargás, el código ya trae `claude-opus-5` como valor por defecto — cargarla acá lo fija de forma explícita en vez de depender de ese default silencioso. |
| `RESEND_API_KEY` | **Tiene que ser la llave de acceso completo, NO la de solo envío.** El sistema no solo manda correos nuevos (`POST /emails`) — también reprograma y cancela recordatorios ya programados (`PATCH /emails/{id}` y `POST /emails/{id}/cancel` en `api/_lib/agenda/resend.ts`). Una llave de solo envío puede mandar el primer correo de confirmación sin problema, pero falla en silencio (queda logueado, no tumba nada) apenas alguien mueve o cancela una cita — ese es el síntoma si cargaste la llave equivocada. Pendiente de la fase anterior del proyecto. |
| `CRON_SECRET` | Protege `/api/cron/agenda` (el resumen diario, la purga de mensajes viejos y la reconciliación de recordatorios) para que no sea una URL pública que cualquiera pueda disparar. Pendiente de la fase anterior. |
| `AGENDA_REPLY_TO` | Valor exacto: `info@ecovivadesarrollos.com`. Es la dirección a la que el cliente responde si contesta el correo de la cita — sin esto, el `reply_to` queda vacío. Pendiente de la fase anterior. |

**Cómo saber que salió bien:** las seis variables aparecen listadas en Settings → Environment Variables, cada una con las tres casillas (Production/Preview/Development) marcadas.

**Si sale mal:** si Vercel te da un error de permisos a vos también, el proyecto puede tener un dueño distinto del que esperás — confirmá que estás en el equipo/cuenta correcta antes de seguir.

No sigas al Paso 5 hasta que las seis estén cargadas — un deploy sin ellas va a fallar en runtime, no en el build, así que el error no se nota hasta que alguien le escribe al bot.

---

## Paso 5 — Desplegar

```bash
git push origin main
```

**Ojo con esto:** las credenciales de git guardadas en esta máquina son de otra cuenta, no la tuya. Cuando corras el push, es muy probable que te pida autenticación y falle con las credenciales guardadas — vas a necesitar pegar tu propio token de acceso personal (PAT) de GitHub en el proceso (por ejemplo, en la URL del remoto o cuando el prompt de git te lo pida). No tengo el comando exacto para tu configuración porque depende de cómo esté armado tu remoto en este momento — si el push falla por auth, decime qué error da y lo resolvemos ahí.

Una vez que el push entra, Vercel lo despliega solo (auto-deploy conectado a `main`). Entrá a `vercel.com` → proyecto `ecoviva` → **Deployments** y esperá a que el último build quede en verde (Ready) antes de probar lo siguiente — típicamente 1-2 minutos.

**Cómo saber que salió bien:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.ecovivadesarrollos.com/api/telegram/webhook
```

Tiene que devolver **`405`**.

**Por qué 405 y no 401:** este `curl` sin `-X POST` es un GET. El handler revisa el método ANTES que el secreto — `api/telegram/webhook.ts:559-560` corta con 405 si el método no es POST, y recién en la línea `:567-570` mira la cabecera del secreto. Un GET nunca llega a esa segunda revisión, así que el 401 no puede salir por este camino aunque el secreto esté mal cargado o ni siquiera exista todavía. **No cambies este curl a POST** — lo que este paso prueba es que la función respondió (y no el HTML del sitio, que significaría que el deploy no llegó a levantar la función).

**Si sale mal:**
- Si devuelve `200` con HTML: el deploy no está activo todavía, o la ruta no se resolvió a la función — revisá el estado del deployment en Vercel.
- Si devuelve `404`: la función no se desplegó — revisá que `api/telegram/webhook.ts` haya quedado incluido en el build (mirá el log del deployment en Vercel).
- Si devuelve `500`: hay un error al arrancar la función — revisá los logs de la función en Vercel (probablemente falta alguna variable de entorno del Paso 4).

---

## Paso 6 — Registrar el webhook en Telegram

Con el deploy ya activo, decile a Telegram a dónde mandar los updates. Usá el mismo `$TOKEN` de siempre y el `$SECRET` que generaste en el Paso 3:

```bash
curl -s -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.ecovivadesarrollos.com/api/telegram/webhook",
       "secret_token":"'"$SECRET"'",
       "allowed_updates":["message","callback_query"]}'
```

`allowed_updates` acota lo que Telegram te manda a solo lo que el bot de verdad usa: mensajes de texto (`message`) y toques de los botones Confirmar/Cancelar (`callback_query`). Sin `callback_query` en esa lista, los botones se ven en el chat pero tocarlos no hace nada — Telegram ni siquiera te manda el update.

**Cómo saber que salió bien:** primero, la respuesta del `setWebhook` de arriba trae `"ok":true`. Después confirmá con:

```bash
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

Tiene que devolver `"url":"https://www.ecovivadesarrollos.com/api/telegram/webhook"` y `"pending_update_count":0`.

**Si sale mal:**
- Si `setWebhook` responde `"ok":false`: revisá que la URL sea exactamente esa (con `https://` y sin barra final) y que `$TOKEN` esté bien.
- Si `getWebhookInfo` trae `pending_update_count` mayor que 0 y no baja después de un rato, o trae `last_error_message`, andá directo a la sección de fallas al final de este documento.

---

## Paso 7 — Vincular el Telegram de Alejandro

1. Abrí `https://www.ecovivadesarrollos.com/admin` e iniciá sesión con tu usuario del panel.
2. Andá a la pestaña **Agenda**.
3. Vas a ver una sección **"Conectar Telegram"**. Tocá el botón **"Conectar Telegram"**.
4. El panel te muestra un código de 6 dígitos y te dice que le mandes `/vincular <código>` a `@EcovivacrBot`. El código dura 10 minutos.
5. Abrí Telegram, buscá `@EcovivacrBot`, y mandale exactamente `/vincular` seguido del código, por ejemplo `/vincular 123456`.

**Cómo saber que salió bien:** el bot contesta `Listo, <tu nombre>. Ya podés escribirme /hoy o /semana.` (o simplemente `Listo. Ya podés escribirme /hoy o /semana.` si el panel no tiene tu nombre guardado). Además, si volvés a la pestaña Agenda del panel y refrescás, la sección ahora dice que la cuenta ya está vinculada, con un botón "Desvincular".

**Si sale mal:**
- `"Ese código no sirve o ya venció. Generá uno nuevo desde el panel."` → pasaron los 10 minutos, o tipeaste mal el código. Tocá "Generar código nuevo" en el panel y probá de nuevo.
- `"Ese Telegram ya está vinculado a otra cuenta. Desvinculalo primero desde el panel."` → esta cuenta de Telegram ya tiene un vínculo previo (por ejemplo, de una prueba anterior). Andá a la cuenta del panel que lo tiene vinculado y tocá "Desvincular", después repetí este paso.
- El bot no contesta nada → andá a la sección de fallas al final de este documento (empezá por `getWebhookInfo`).

---

## Paso 8 — Vincular el Telegram de Alina

Exactamente el mismo procedimiento que el Paso 7, pero Alina lo hace con su propia cuenta:

1. Alina abre `https://www.ecovivadesarrollos.com/admin` e inicia sesión con **su** usuario del panel (no el tuyo).
2. Pestaña Agenda → "Conectar Telegram" → le sale su propio código de 6 dígitos.
3. Desde **su** cuenta de Telegram (no la tuya), le manda `/vincular <código>` a `@EcovivacrBot`.

**Cómo saber que salió bien:** el bot le contesta a Alina el mismo `Listo, <su nombre>. Ya podés escribirme /hoy o /semana.` en su propio chat con el bot.

**Si sale mal:** mismos tres casos que el Paso 7.

Importante: si por error Alina usa el código pero desde la cuenta de Telegram de Alejandro (o viceversa), el vínculo queda cruzado — el bot va a creer que le habla la persona equivocada. Si sospechan que pasó esto, desvinculen desde el panel (botón "Desvincular") y repitan el paso con cuidado de que cada quien esté en su propio chat de Telegram.

---

## Paso 9 — Prueba de humo

Con las dos cuentas ya vinculadas, probá estas tres cosas (podés hacerlas vos, Alejandro, no hace falta que participe Alina en esta):

**9.1 — `/hoy`.** Desde tu Telegram, mandale `/hoy` al bot.
**Cómo saber que salió bien:** contesta con la lista de citas de hoy agrupadas, o `"Hoy no tenés nada agendado."` si no hay ninguna. En cualquier caso, contesta — no se queda en silencio.

**9.2 — Un texto libre.** Mandale algo en lenguaje natural, por ejemplo `"¿qué tengo agendado esta semana?"` o `"agendame una prueba"`.
**Cómo saber que salió bien:** el bot muestra "escribiendo..." y después contesta con texto del agente (puede ser una respuesta directa, o puede proponerte una acción con dos botones "✅ Confirmar" / "✖️ Cancelar" si entendió que le pedías crear/mover/editar/cancelar algo). Si te propone una acción de prueba, tocá "✖️ Cancelar" para no dejar basura en la agenda real.

**9.3 — Una tercera cuenta.** Desde un celular o Telegram Web con una cuenta que NO sea la tuya ni la de Alina, buscá `@EcovivacrBot` y mandale cualquier cosa, por ejemplo `"hola"`.
**Cómo saber que salió bien:** el bot contesta únicamente `"No tenés acceso."` — nada más, ni una lista de citas, ni el mensaje de bienvenida.

**Si sale mal en cualquiera de las tres:** andá a la sección de fallas al final.

---

## Paso 10 — Prueba de aviso cruzado

Esto es nuevo respecto de lo que se armó al principio: cuando una persona agenda, mueve, edita o cancela una cita — desde el bot O desde el panel — la OTRA persona recibe un mensaje de Telegram al instante, sin tener que preguntar. Quien hizo el cambio no recibe ese aviso (ya tiene su propia confirmación en pantalla o inline).

**Cómo probarlo:**

1. Vos (Alejandro) le pedís al bot algo que dispare una escritura de prueba — por ejemplo `"agendá una cita de prueba para Juan Pérez mañana a las 3pm en Lomas de la Llanada, su correo es tu-propio-correo@ejemplo.com"`.
2. El bot te va a mostrar el resumen con los botones. Tocá **"✅ Confirmar"**.
3. En el chat de Alina con el bot (su Telegram, no el tuyo), tiene que llegarle un mensaje aparte, sin que ella haya escrito nada, con el formato: `"<tu nombre> creó una cita:"` seguido del cliente, el lugar y la fecha/hora.

**Cómo saber que salió bien:** Alina recibe ese mensaje en segundos (no minutos) después de que vos confirmás. Vos NO recibís ningún aviso de tu propia acción — eso es esperado, no un bug.

**Si sale mal:** si Alina no recibe nada, confirmá primero que su cuenta esté vinculada (`telegram_chat_id` no nulo en su fila de `app_users` — podés verlo desde el panel: la pestaña Agenda de Alina tiene que mostrar "ya está vinculada") y que tenga `agenda = true`. Si eso está bien y aun así no llega nada, mirá los logs de la función `api/telegram/webhook` en Vercel buscando `"agenda/avisos: no se pudo avisar"` — ese log no tumba la cita (la cita ya quedó creada igual), pero te dice por qué no salió el aviso.

Repetí la prueba al revés (Alina agenda algo, vos recibís el aviso) si querés confirmar los dos sentidos. Cancelá después la cita de prueba que quedó (mandale al bot `"cancelá la cita de prueba de Juan Pérez"` y confirmá).

---

## Paso 11 — Prueba real de punta a punta

Esta es la que confirma que todo el circuito funciona con un cliente real de por medio (usando tu propio correo, para no molestar a nadie).

1. **Agendar.** Por el bot, pedile que agende una cita de prueba con el correo de Alejandro o de Alina (el que la esté haciendo). Ejemplo: `"agendá una visita para [tu nombre] el [fecha real, unos días adelante] a las 10am en Lomas de la Llanada, mi correo es [tu correo real]"`.
2. **Confirmar.** Tocá "✅ Confirmar" en el resumen que te manda el bot.
3. **Revisar el correo.** Revisá la bandeja del correo que diste. Tiene que llegar un mail con asunto `"Tu cita con EcoViva — <fecha>, <hora>"`, con un archivo adjunto `cita.ics` (la invitación de calendario) y un enlace de "Agregar a Google Calendar".
4. **Mover.** Por el bot, pedile que mueva esa misma cita a otro horario: `"mové mi cita de prueba a las 2pm"`. Confirmá con el botón.
5. **Revisar que el evento se MUEVE, no se duplica.** Si abriste el `cita.ics` del correo anterior en tu calendario (Google/Apple/Outlook), el nuevo correo (asunto `"Cambio de hora: tu cita ahora es el <fecha>"`) tiene que actualizar ESE MISMO evento en tu calendario, no crear uno nuevo al lado. Esto funciona porque cada cita tiene un `ics_uid` estable de por vida y un número de secuencia que sube en cada cambio — es lo que le dice a tu app de calendario "esto es una actualización, no un evento nuevo".
6. **Cancelar.** Por el bot, pedile que cancele la cita de prueba. Confirmá. Tiene que llegar un tercer correo, `"Cita cancelada — <fecha>"`, y si tenías el evento agregado al calendario, se tiene que marcar como cancelado ahí también.

**Cómo saber que salió bien:** los tres correos llegan (confirmación, cambio de hora, cancelación), cada uno con el `.ics` correcto, y en tu calendario personal ves UN solo evento que cambió de hora y después se canceló — nunca dos eventos separados.

**Si sale mal:**
- No llega ningún correo → la `RESEND_API_KEY` en Vercel no está cargada o es inválida. Revisá el Paso 4.
- Llega el primer correo (confirmación) pero no el de "cambio de hora" ni el de "cancelada" → la `RESEND_API_KEY` cargada es la de **solo envío**, no la de acceso completo. Mover y cancelar dependen de `PATCH /emails/{id}` y `POST /emails/{id}/cancel`, que una llave de solo envío no puede hacer. Reemplazala por la llave de acceso completo en Vercel y repetí la prueba.
- El calendario muestra dos eventos en vez de uno movido → algo rompió el `ics_uid`/secuencia; esto no debería pasar con el código actual, así que si lo ves, avisá antes de seguir usando el bot en producción — no es un problema de configuración, sería un bug.

---

## Paso 12 — Verificar que el resumen diario quedó andando

Todos los días a las **11:00 UTC (5:00 a.m. de Costa Rica)** corre el cron `/api/cron/agenda` (configurado en `vercel.json`), que entre otras cosas manda por Telegram el resumen de las citas del día a todo el que tenga la agenda vinculada. Como recién estás desplegando esto, la corrida de hoy probablemente ya pasó (o todavía no) — de cualquier forma no hace falta esperar hasta mañana para confirmar que está bien armado:

**Verificación inmediata (sin esperar al cron):** entrá al panel de Supabase → **Table Editor** → tabla `agenda_jobs`. Si el cron ya corrió alguna vez desde que este código está desplegado, vas a ver una fila con la fecha de hoy (formato `YYYY-MM-DD`, zona horaria Costa Rica) y la columna `resumen_enviado_at` con un timestamp (no `null`). Una fila con `fecha` de hoy pero `resumen_enviado_at` en `null` significa que el cron reclamó el día pero el envío falló — revisá los logs de la función `api/cron/agenda` en Vercel.

**Verificación al día siguiente (la definitiva):** al otro día, entre las 5:00 y las 6:00 a.m. de Costa Rica (el plan Hobby de Vercel corre los cron con hasta 59 minutos de margen, así que no es al segundo), tanto vos como Alina tienen que recibir en Telegram un mensaje que empieza con `"Hoy:"` seguido de la lista de citas del día, o `"Hoy no hay citas."` si no hay ninguna agendada. Ese mensaje corto en un día vacío es a propósito — confirma que el cron corrió aunque no haya nada que listar.

**Cómo saber que salió bien:** la fila de `agenda_jobs` de la fecha correspondiente tiene `resumen_enviado_at` con un valor, Y tanto vos como Alina recibieron el mensaje en Telegram.

**Si sale mal:**
- No hay ninguna fila en `agenda_jobs` para la fecha de hoy/ayer → el cron no corrió. Confirmá en Vercel → proyecto `ecoviva` → **Settings → Cron Jobs** que `/api/cron/agenda` aparece listado y activo (los crons solo corren en deployments de Production).
- Hay fila pero `resumen_enviado_at` en `null` → el cron corrió pero `resumenDiario` o el registro posterior fallaron. Mirá los logs de esa invocación de la función en Vercel, buscando `"cron/agenda: fallo al mandar el resumen diario"`.
- El mensaje le llega a uno y al otro no → esa persona no tiene `telegram_chat_id` guardado (no completó la vinculación) o tiene `agenda = false` — mismo chequeo que en el Paso 10.

---

## Qué hacer si algo falla

Síntomas reales y dónde mirar primero:

**El bot no contesta nada, a nadie.**
Corré `curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"` y mirá el campo `last_error_message`. Ahí Telegram te dice la última vez que intentó entregar un update y qué pasó (por ejemplo, un timeout o un código de error HTTP). Si `pending_update_count` está subiendo, Telegram está reintentando y no está pudiendo entregar nada — el webhook puede estar mal registrado (repetí el Paso 6) o la función puede estar tirando 500 (revisá los logs de `api/telegram/webhook` en Vercel).

**Contesta "No tenés acceso." a alguien que sí debería entrar.**
El bot autoriza por `from.id` contra la tabla `app_users`, y exige **las cuatro** condiciones a la vez (`api/telegram/webhook.ts`, función `autorizar`) — no solo dos:
- `telegram_chat_id` tiene que coincidir con el ID de Telegram de esa persona (si nunca hizo `/vincular` con éxito, esto está vacío).
- `agenda` tiene que ser `true` (el permiso para usar la agenda compartida).
- `role` tiene que ser `'admin'` (si por error quedó como `'vendedor'`, se lo rechaza aunque tenga `agenda = true`).
- `status` tiene que ser `'active'` (si quedó `'disabled'`, también se lo rechaza).
Revisá los cuatro campos de esa fila en `app_users`, no solo `agenda` y `telegram_chat_id`.

**Los botones "Confirmar"/"Cancelar" no hacen nada al tocarlos.**
Casi seguro que el `setWebhook` del Paso 6 quedó sin `callback_query` en `allowed_updates` — Telegram ni siquiera te manda ese update. Repetí el Paso 6 con el `allowed_updates` completo tal cual está escrito ahí.

**El correo al cliente no sale (o sale el primero pero no los siguientes).**
Revisá la `RESEND_API_KEY` en Vercel: tiene que ser la de acceso completo, no la de solo envío (ver el detalle en el Paso 4 y en el Paso 11). Si no sale ni el primer correo, la llave puede estar directamente mal cargada o vencida — probá pegarla de nuevo en Vercel y redeployá (`git push` de un cambio trivial, o "Redeploy" desde el dashboard de Vercel, alcanza para que tome la variable nueva).

**El aviso instantáneo a la otra persona no llega, o el resumen diario no llega.**
Ver el Paso 10 (aviso instantáneo) y el Paso 12 (resumen diario) — ambos tienen su propia sección de "si sale mal" con las causas más probables.
