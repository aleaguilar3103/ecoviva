import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "../_lib/supabase.js";
import { enviarMensaje, escribiendo, editarMensaje, responderCallback, quitarBotones } from "../_lib/agenda/telegram.js";
import { listarCitas, type Cita } from "../_lib/agenda/db.js";
import { correrAgente, type Mensaje } from "../_lib/agenda/agente.js";
import { guardarAccion, consumirAccion, ejecutarAccion } from "../_lib/agenda/acciones.js";

// /api/telegram/webhook — recibe los updates de Telegram para el bot de la
// agenda privada de Alina y Alejandro.
//
// /vincular, /hoy y /semana se resuelven acá mismo, sin pasar por el modelo:
// son deterministas y no vale la pena pagar una llamada a Claude por ellos.
// Cualquier otro texto se lo pasa al agente conversacional (agenda/agente.ts).
// El agente puede proponer una escritura (crear, mover, editar o cancelar una
// cita): el turno corta, se guarda la acción pendiente (agenda/acciones.ts) y
// se manda el resumen con botones "Confirmar"/"Cancelar". El toque de esos
// botones llega como un update distinto — un `callback_query`, no un
// `message` — que se procesa más abajo en `procesarCallback`.
//
// Cuatro puertas, en orden, cortando en la primera que falla:
//   1. Método (solo POST).
//   2. Secreto de Telegram (cabecera x-telegram-bot-api-secret-token).
//   3. Deduplicación por update_id (Telegram reintenta si tardamos).
//   4. Autorización por from.id (el USUARIO, no el chat) — se aplica IGUAL a
//      un mensaje de texto que a un toque de botón: un botón no es una
//      excepción a la autorización.

// ── Autorización ──
//
// Quién puede hablarle al bot. Se valida el USUARIO (from.id), no el chat, y
// se exige chat privado: así, si alguien mete el bot a un grupo, los del
// grupo no heredan el acceso de quien lo agregó.
export interface Autorizado {
  email: string;
  userId: string;
  chatId: string;
}

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

// ── Tipos mínimos del Update de Telegram que usamos acá ──
// (edited_message y otros tipos de update no se manejan: se ignoran en
// silencio, no hacen tirar el procesamiento. `callback_query` sí se maneja
// — es el toque de un botón "Confirmar"/"Cancelar" — ver procesarCallback.)
interface TelegramUpdate {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id: number; type: string };
    from?: { id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    // El mensaje original (el que tenía los botones): puede faltar si
    // Telegram ya no lo tiene disponible (mensaje viejo o borrado) — se
    // trata igual que un callback_data con una forma que no reconocemos.
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
  };
}

// ── Textos fijos, todos en español, con voseo ──
const LINEA_SECA = "No tenés acceso.";
const CODIGO_INVALIDO = "Ese código no sirve o ya venció. Generá uno nuevo desde el panel.";
const TELEGRAM_YA_VINCULADO =
  "Ese Telegram ya está vinculado a otra cuenta. Desvinculalo primero desde el panel.";
const ERROR_GENERICO = "Se me complicó, probá de nuevo.";
const CONFIRMACION_VENCIDA = "Esa confirmación ya no vale — venció o ya la usaste.";
const MENSAJE_START =
  "Soy el bot de la agenda de EcoViva. Escribime /hoy o /semana para ver las citas. " +
  "Si en algún momento necesitás vincular otro Telegram, generá un código nuevo desde el panel y mandame /vincular <código>.";

// ── Formato de fechas: SIEMPRE hora de Costa Rica, nunca UTC crudo ──
const TZ = "America/Costa_Rica";

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Clave para agrupar por día EN HORA DE COSTA RICA (no en UTC: una cita a las
// 11 p. m. UTC ya es el día siguiente en Costa Rica).
function claveDia(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function encabezadoDia(iso: string): string {
  const dia = new Intl.DateTimeFormat("es-CR", { weekday: "long", timeZone: TZ }).format(
    new Date(iso),
  );
  const fecha = new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(new Date(iso));
  return `${capitalizar(dia)} ${fecha}`;
}

function horaCita(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso));
}

// Arma el texto de la lista de citas, agrupadas por día. `listarCitas` ya
// devuelve el orden ascendente por `inicio`, así que agrupar con un Map
// preserva el orden cronológico sin tener que ordenar de nuevo.
function formatearCitas(citas: Cita[]): string {
  const grupos = new Map<string, Cita[]>();
  for (const c of citas) {
    const clave = claveDia(c.inicio);
    const lista = grupos.get(clave);
    if (lista) lista.push(c);
    else grupos.set(clave, [c]);
  }

  const bloques: string[] = [];
  for (const citasDelDia of grupos.values()) {
    const lineas = [encabezadoDia(citasDelDia[0].inicio)];
    for (const c of citasDelDia) {
      lineas.push(`  ${horaCita(c.inicio)} — ${c.cliente_nombre}`);
      const telefono = c.cliente_telefono ? ` · ${c.cliente_telefono}` : "";
      lineas.push(`  ${c.lugar}${telefono}`);
    }
    bloques.push(lineas.join("\n"));
  }
  return bloques.join("\n\n");
}

// Medianoche de HOY en Costa Rica (UTC-6 fijo, sin horario de verano),
// expresada como instante UTC. Se calcula a partir de los campos de fecha
// que Intl entrega para "ahora" en la zona de Costa Rica, no restando horas
// a mano sobre `ahora` (eso rompería justo en el borde del día).
function inicioDeHoyCR(ahora: Date): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const obj = Object.fromEntries(partes.map((p) => [p.type, p.value])) as Record<string, string>;
  // Medianoche CR = 06:00 UTC del mismo día calendario de Costa Rica.
  return new Date(
    Date.UTC(Number(obj.year), Number(obj.month) - 1, Number(obj.day), 6, 0, 0, 0),
  );
}

async function responderHoy(chatId: string): Promise<void> {
  const desde = inicioDeHoyCR(new Date());
  const hasta = new Date(desde.getTime() + 24 * 60 * 60_000 - 1);
  const citas = await listarCitas({ desde, hasta });
  if (!citas.length) {
    await enviarMensaje(chatId, "Hoy no tenés nada agendado.");
    return;
  }
  await enviarMensaje(chatId, formatearCitas(citas));
}

async function responderSemana(chatId: string): Promise<void> {
  const desde = inicioDeHoyCR(new Date());
  const hasta = new Date(desde.getTime() + 7 * 24 * 60 * 60_000 - 1);
  const citas = await listarCitas({ desde, hasta });
  if (!citas.length) {
    // Distinto del mensaje de /hoy a propósito: "Hoy no tenés nada
    // agendado" sería engañoso acá, donde el rango es de 7 días.
    await enviarMensaje(chatId, "No tenés nada agendado en los próximos 7 días.");
    return;
  }
  await enviarMensaje(chatId, formatearCitas(citas));
}

// ── /vincular ──
// Se atiende ANTES de la autorización, porque justamente sirve para
// obtenerla. Usa `from.id`, no `chat.id`: son el mismo valor en un chat
// privado, pero conceptualmente lo que se guarda es la identidad de la
// PERSONA, no del chat donde escribió el comando.
//
// Ronda de arreglo (hallazgo del coordinador): vincular desde un grupo NUNCA
// es legítimo, así que la puerta ni siquiera debería existir ahí. Un código
// escrito en un grupo queda a la vista de todos — es una credencial de 10
// minutos que da acceso a la agenda completa — y la confirmación con el
// nombre de la persona revelaría, en ese mismo grupo, que el bot maneja una
// agenda y de quién es. Por eso la respuesta ante un chat no privado es la
// misma línea seca que usa `autorizar`: no explica nada, no menciona que
// existe un comando de vinculación.
function extraerCodigo(texto: string): string | null {
  const partes = texto.trim().split(/\s+/);
  return partes.length >= 2 ? partes[1] : null;
}

async function manejarVincular(
  texto: string,
  fromId: number | undefined,
  chatType: string | undefined,
  chatId: string,
): Promise<void> {
  if (chatType !== "private") {
    await enviarMensaje(chatId, LINEA_SECA);
    return;
  }

  const codigo = extraerCodigo(texto);
  if (!fromId || !codigo) {
    await enviarMensaje(chatId, CODIGO_INVALIDO);
    return;
  }

  const db = supabaseAdmin();

  // Update condicionado por el código Y su vigencia, en UNA sola operación
  // (con `.select()` para recuperar el nombre de la fila que efectivamente
  // se tocó). Antes esto era un select seguido de un update: entre esas dos
  // consultas cabía una carrera real — si dos personas mandaban el mismo
  // código casi al mismo tiempo, las dos lo encontraban vigente en el select
  // y las dos escribían su propio `chat_id`, y como los ids son distintos la
  // restricción `unique` no frenaba nada: la segunda escritura pisaba a la
  // primera, dejando vinculado a quien ganó la carrera y no a quien era
  // dueño del código. Con las dos condiciones DENTRO del `where` del update,
  // Postgres garantiza que como mucho una ejecución concurrente encuentra la
  // fila todavía vigente: la segunda ya no matchea (el código quedó en
  // null) y `data` le vuelve `null`. Mismo principio que ya usa el resto del
  // repo para consumir credenciales de un solo uso (p. ej. la rotación de
  // `feed_token` en feed-token.ts, aunque ahí no hay ventana de carrera
  // porque no depende de una condición previa).
  const { data, error } = await db
    .from("app_users")
    .update({ telegram_chat_id: String(fromId), telegram_codigo: null, telegram_codigo_expira: null })
    .eq("telegram_codigo", codigo)
    .gt("telegram_codigo_expira", new Date().toISOString())
    .select("email, full_name")
    .maybeSingle();

  if (error) {
    // telegram_chat_id es unique: si este Telegram ya estaba vinculado a
    // OTRA cuenta, el update choca contra esa restricción. Es un caso real
    // que puede pasar en el uso normal, no un error de sistema — y sigue
    // existiendo con el update atómico, es un caso distinto al de arriba.
    if (error.code === "23505") {
      await enviarMensaje(chatId, TELEGRAM_YA_VINCULADO);
      return;
    }
    console.error("telegram/webhook: fallo al vincular", error);
    await enviarMensaje(chatId, ERROR_GENERICO);
    return;
  }
  if (!data) {
    // El código no existe, ya venció, o alguien se lo llevó primero en la
    // carrera descrita arriba: en los tres casos, Postgres no tocó ninguna
    // fila y acá no hay forma (ni falta) de distinguirlos.
    await enviarMensaje(chatId, CODIGO_INVALIDO);
    return;
  }

  const nombre = (data.full_name as string | null)?.trim();
  const saludo = nombre ? `Listo, ${nombre}` : "Listo";
  await enviarMensaje(chatId, `${saludo}. Ya podés escribirme /hoy o /semana.`);
}

// ── Historial reciente de la conversación con el agente ──
//
// Cada mensaje de Telegram es una invocación NUEVA del webhook, en otro
// proceso: sin guardar lo que se dijo, el agente no podría entender un "sí,
// ese" o un "cambialo a las 11". La tabla es chica a propósito (solo
// chat_id, rol, contenido): alcanza con lo último de la última hora para
// dar contexto, no hace falta guardar conversaciones enteras acá.
const HISTORIAL_MINUTOS = 60;
const HISTORIAL_TOPE = 20;

async function cargarHistorial(chatId: string): Promise<Mensaje[]> {
  const desde = new Date(Date.now() - HISTORIAL_MINUTOS * 60_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("agenda_mensajes")
    .select("rol, contenido")
    .eq("chat_id", chatId)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(HISTORIAL_TOPE);

  if (error) {
    // Sin historial el agente igual contesta (solo pierde contexto de corto
    // plazo), así que un hipo acá no debe tumbar la respuesta.
    console.error("telegram/webhook: no se pudo cargar el historial de la conversación", error);
    return [];
  }

  // Se pidió del más nuevo al más viejo para que el tope de 20 se quede con
  // los últimos mensajes de la hora; acá se da vuelta para que correrAgente
  // los reciba en el orden en que de verdad se dijeron.
  return (data ?? [])
    .slice()
    .reverse()
    .map((f) => ({ rol: f.rol as Mensaje["rol"], texto: String(f.contenido) }));
}

async function guardarMensaje(chatId: string, rol: Mensaje["rol"], contenido: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("agenda_mensajes")
    .insert({ chat_id: chatId, rol, contenido });
  // Peor que perder un renglón del historial es dejar a la persona sin
  // respuesta porque falló guardar la bitácora: se loguea y se sigue.
  if (error) console.error("telegram/webhook: no se pudo guardar el mensaje en el historial", error);
}

// ── callback_query: el toque de un botón "Confirmar"/"Cancelar" ──
//
// callback_data siempre llega como "ok:<id>" o "no:<id>" (ver telegram.ts):
// la acción completa nunca viaja en el botón, vive en
// agenda_acciones_pendientes. Cualquier otra forma se ignora.
const RE_CALLBACK = /^(ok|no):(.+)$/;

// No debe tirar NUNCA, por la misma razón que procesarUpdate: un error acá
// se ve, desde Telegram, como un botón que no hace nada.
//
// ── LA REGLA CENTRAL (ronda 2 de revisión) ──
// Una rama que NO se llevó la acción (consumirAccion le devolvió `null`)
// NUNCA escribe el texto del mensaje. No sabe si la acción venció sola, o
// si la otra rama —la que sí ganó la fila— ya ejecutó de verdad (cita
// creada, correo mandado, irreversible). Afirmar cualquiera de las dos
// cosas sería, en el peor caso, mentir sobre un hecho que ya pasó. El texto
// del mensaje le pertenece ÚNICA Y EXCLUSIVAMENTE a la rama que se llevó la
// fila: la que sabe, porque lo hizo ella misma, qué fue lo que pasó.
//
// Por eso las dos ramas que obtienen `null` (tanto "no:" como "ok:") jamás
// llaman a `editarMensaje`. Lo único que hacen es: (a) avisar por el TOAST
// del callback —efímero, solo lo ve quien tocó, y desaparece— con
// `CONFIRMACION_VENCIDA`, y (b) `quitarBotones`, que toca el TECLADO sin
// tocar el TEXTO — así no hay invitación a tocar de nuevo, pero tampoco se
// pisa lo que la rama ganadora vaya a escribir (antes o después, no importa
// el orden en que lleguen las dos respuestas HTTP a Telegram).
//
// Un callback se contesta UNA sola vez — contestarlo dos veces falla contra
// la API real. Por eso cada uno de los cuatro caminos (no:/ok: × con
// fila/sin fila) llama a `responderCallback` EXACTAMENTE una vez:
//   - "no:" contesta DESPUÉS de consumir (un solo `delete`, rápido —
//     Telegram da varios segundos de margen), con o sin texto según si
//     obtuvo la fila.
//   - "ok:" con fila SÍ contesta ANTES de `ejecutarAccion` (que puede
//     tardar — manda un correo): sin eso, el botón queda "cargando" todo
//     ese tiempo. "ok:" sin fila contesta con el toast apenas sabe que no
//     hay nada que ejecutar — no llega a acercarse a `ejecutarAccion`.
async function procesarCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  let chatId: string | undefined;
  try {
    // Un botón NO es una excepción a la autorización: cualquiera que
    // consiga el identificador de un mensaje podría intentar tocarlo. Se
    // valida exactamente igual que un mensaje de texto (from.id + chat
    // privado). Si no está autorizado, silencio total: ni se ejecuta nada
    // ni se le confirma a quien tocó que el bot notó algo.
    const autorizado = await autorizar(cb.from?.id, cb.message?.chat?.type);
    if (!autorizado) return;

    chatId = autorizado.chatId;
    const messageId = cb.message?.message_id;
    const match = RE_CALLBACK.exec(cb.data ?? "");
    if (!match || messageId === undefined) return; // no es un botón nuestro: se ignora

    const [, tipo, id] = match;

    if (tipo === "no") {
      // Se consume igual que un "ok", aunque no se ejecute nada: si no se
      // consumiera acá, la acción quedaría viva y un "ok" posterior sobre
      // el mismo id la ejecutaría igual, como si nunca se hubiera cancelado.
      const consumida = await consumirAccion(id, chatId);
      if (!consumida) {
        // No se llevó nada: no sabe si venció o si "ok:" ya ejecutó de
        // verdad. Toast + quitar botones, JAMÁS editarMensaje (ver la regla
        // central arriba).
        await responderCallback(cb.id, CONFIRMACION_VENCIDA);
        await quitarBotones(chatId, messageId);
        return;
      }
      await responderCallback(cb.id);
      await editarMensaje(chatId, messageId, "Cancelado.");
      return;
    }

    // tipo === "ok". ESTE consumo es la única defensa real contra la doble
    // ejecución (el porqué completo está en acciones.ts): si devuelve null,
    // ya no hay nada que ejecutar — venció, no era de esta persona, o
    // alguien (quizás el mismo dedo, dos toques) ya se la llevó. Si
    // devuelve la acción, acá es la ÚNICA vez que se ejecuta: no queda
    // forma de que un segundo "ok" sobre el mismo id vuelva a pasar por acá.
    const accion = await consumirAccion(id, chatId);
    if (!accion) {
      // Mismo caso que arriba: no se llevó nada, no puede afirmar nada.
      await responderCallback(cb.id, CONFIRMACION_VENCIDA);
      await quitarBotones(chatId, messageId);
      return;
    }

    // Se ganó la fila: se contesta ACÁ, ANTES de ejecutarAccion (que puede
    // tardar — manda un correo), para que el botón no quede "cargando"
    // mientras tanto. Sin texto: el resultado va a quedar escrito en el
    // mensaje editado más abajo, no hace falta repetirlo en el toast.
    await responderCallback(cb.id);

    const texto = await ejecutarAccion(accion, autorizado.email);
    // Se EDITA el mensaje original, nunca se manda uno nuevo: al editarlo
    // los botones desaparecen y el chat queda con el registro de lo que se
    // hizo, en vez de un botón muerto que invita a tocarlo otra vez. (Esto
    // aplica SOLO a este camino — el único que de verdad ejecutó algo y
    // sabe qué escribir; los dos caminos con `null` de arriba nunca llegan
    // acá.)
    //
    // Arreglo 3 (ronda de revisión): a partir de acá la acción YA se
    // ejecutó — no hay forma de deshacerla ni tiene sentido reintentarla.
    // Por eso este `editarMensaje` va en SU PROPIO try/catch, separado del
    // catch general de más abajo: si cae al catch general, la persona lee
    // "Se me complicó, probá de nuevo." — un texto que invita a reintentar
    // algo que YA pasó. Un reintento humano (mandar el mensaje de nuevo)
    // generaría una acción NUEVA que, al confirmarse, SÍ duplicaría la cita
    // — no porque falle la atomicidad de consumirAccion, sino porque el
    // aviso mintió sobre el estado. Mismo principio que rige todo este
    // archivo: lo que ya se hizo no se pierde, y no se anuncia como que no
    // se hizo. Si falla la edición, se intenta avisar por un mensaje NUEVO
    // (con el mismo texto del resultado); si eso también falla, se loguea y
    // no se hace nada más — no queda ninguna forma honesta de decir "no sé
    // si te llegó el aviso, pero la cita SÍ quedó hecha" que no sea, en el
    // peor caso, silencio.
    try {
      await editarMensaje(chatId, messageId, texto);
    } catch (e) {
      console.error("telegram/webhook: la acción se ejecutó pero no se pudo editar el mensaje original", e);
      try {
        await enviarMensaje(chatId, texto);
      } catch (e2) {
        console.error("telegram/webhook: tampoco se pudo avisar el resultado por un mensaje nuevo", e2);
      }
    }
  } catch (e) {
    console.error("telegram/webhook: error inesperado al procesar el callback", e);
    try {
      if (chatId) await enviarMensaje(chatId, ERROR_GENERICO);
    } catch (e2) {
      console.error("telegram/webhook: no se pudo avisar del error a la persona (callback)", e2);
    }
  }
}

// ── Procesamiento de un update ya deduplicado ──
// No debe tirar NUNCA: un error silencioso acá se ve, desde Telegram, como
// un bot que ignora a la gente. Se envuelve entero en try/catch, se loguea
// con console.error y se intenta avisarle a la persona.
async function procesarUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await procesarCallback(update.callback_query);
    return;
  }

  const msg = update.message;
  try {
    if (!msg || typeof msg.text !== "string" || !msg.chat) return; // nada que responder acá

    const chatId = String(msg.chat.id);
    const fromId = msg.from?.id;
    const chatType = msg.chat.type;
    const texto = msg.text.trim();

    if (texto.startsWith("/vincular")) {
      await manejarVincular(texto, fromId, chatType, chatId);
      return;
    }

    const autorizado = await autorizar(fromId, chatType);
    if (!autorizado) {
      await enviarMensaje(chatId, LINEA_SECA);
      return;
    }

    if (texto === "/start") {
      await enviarMensaje(chatId, MENSAJE_START);
      return;
    }

    if (texto === "/hoy") {
      await escribiendo(chatId);
      await responderHoy(chatId);
      return;
    }

    if (texto === "/semana") {
      await escribiendo(chatId);
      await responderSemana(chatId);
      return;
    }

    // Cualquier otro texto: lo entiende el agente conversacional. Si propone
    // una escritura, el turno corta: se guarda la acción pendiente y el
    // resumen se manda con botones para confirmarla o cancelarla.
    await escribiendo(chatId);
    const historial = await cargarHistorial(chatId);
    const resultado = await correrAgente({ mensaje: texto, historial, ahora: new Date() });
    await guardarMensaje(chatId, "usuario", texto);

    if (resultado.tipo === "texto") {
      await guardarMensaje(chatId, "agente", resultado.texto);
      await enviarMensaje(chatId, resultado.texto);
    } else {
      await guardarMensaje(chatId, "agente", resultado.resumen);
      // callback_data tope en 64 bytes: acá va solo "ok:<id>"/"no:<id>", la
      // acción completa vive en agenda_acciones_pendientes (ver acciones.ts).
      const id = await guardarAccion(chatId, resultado.accion);
      await enviarMensaje(chatId, resultado.resumen, {
        botones: [
          [
            { texto: "✅ Confirmar", data: `ok:${id}` },
            { texto: "✖️ Cancelar", data: `no:${id}` },
          ],
        ],
      });
    }
  } catch (e) {
    console.error("telegram/webhook: error inesperado al procesar el update", e);
    try {
      const chatId = msg?.chat?.id;
      if (chatId) await enviarMensaje(String(chatId), ERROR_GENERICO);
    } catch (e2) {
      console.error("telegram/webhook: no se pudo avisar del error a la persona", e2);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // 1) Método.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // 2) Secreto. Falla cerrado: si la variable no está definida en el
  // entorno, se rechaza igual — no dejar pasar todo cuando falta la
  // variable es justamente lo que evita el agujero (mismo patrón que
  // api/cron/agenda.ts con CRON_SECRET).
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  const recibido = req.headers["x-telegram-bot-api-secret-token"];
  if (!secreto || recibido !== secreto) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const update = (req.body ?? {}) as TelegramUpdate;

  // 3) Deduplicación por update_id: un insert que falla si ya existe. No se
  // consulta y después se inserta — entre las dos consultas caben dos
  // ejecuciones simultáneas del mismo update.
  if (typeof update.update_id === "number") {
    const { error } = await supabaseAdmin()
      .from("telegram_updates")
      .insert({ update_id: update.update_id });
    if (error) {
      if (error.code === "23505") {
        // Reintento de Telegram: este update ya se procesó.
        return res.status(200).json({ ok: true });
      }
      // Un hipo de la base al deduplicar no debería dejar a la persona sin
      // respuesta: se loguea y se sigue. Peor sería quedar en silencio.
      console.error("telegram/webhook: fallo al deduplicar", error);
    }
  }

  // 4) Autorización: se resuelve DENTRO de procesarUpdate (necesita
  // chat.type y from.id del mensaje, y /vincular es la excepción que se
  // atiende antes). Acá solo se dispara el procesamiento en segundo plano
  // y se responde rápido, para no hacer esperar a Telegram.
  waitUntil(procesarUpdate(update));
  return res.status(200).json({ ok: true });
}
