import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "../_lib/supabase.js";
import { enviarMensaje, escribiendo } from "../_lib/agenda/telegram.js";
import { listarCitas, type Cita } from "../_lib/agenda/db.js";

// /api/telegram/webhook — recibe los updates de Telegram para el bot de la
// agenda privada de Alina y Alejandro.
//
// En esta tarea el bot todavía NO habla con Claude: responde a /vincular,
// /hoy y /semana, y cualquier otro texto recibe "Todavía no sé responder
// eso." La Task 4 le pone el agente conversacional encima de este esqueleto.
//
// Cuatro puertas, en orden, cortando en la primera que falla:
//   1. Método (solo POST).
//   2. Secreto de Telegram (cabecera x-telegram-bot-api-secret-token).
//   3. Deduplicación por update_id (Telegram reintenta si tardamos).
//   4. Autorización por from.id (el USUARIO, no el chat).

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
// (edited_message, callback_query, etc. no se manejan en esta tarea: se
// ignoran en silencio, no hacen tirar el procesamiento.)
interface TelegramUpdate {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id: number; type: string };
    from?: { id: number };
  };
}

// ── Textos fijos, todos en español, con voseo ──
const LINEA_SECA = "No tenés acceso.";
const CODIGO_INVALIDO = "Ese código no sirve o ya venció. Generá uno nuevo desde el panel.";
const TELEGRAM_YA_VINCULADO =
  "Ese Telegram ya está vinculado a otra cuenta. Desvinculalo primero desde el panel.";
const ERROR_GENERICO = "Se me complicó, probá de nuevo.";
const TODAVIA_NO = "Todavía no sé responder eso.";
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

// ── Procesamiento de un update ya deduplicado ──
// No debe tirar NUNCA: un error silencioso acá se ve, desde Telegram, como
// un bot que ignora a la gente. Se envuelve entero en try/catch, se loguea
// con console.error y se intenta avisarle a la persona.
async function procesarUpdate(update: TelegramUpdate): Promise<void> {
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

    // La Task 4 reemplaza esto por el agente conversacional.
    await enviarMensaje(chatId, TODAVIA_NO);
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
