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

// Se usa al confirmar o cancelar: se reescribe el mensaje original con el
// resultado. `reply_markup: { inline_keyboard: [] }` va SIEMPRE explícito a
// propósito: la documentación de Telegram dice que OMITIR `reply_markup` en
// editMessageText CONSERVA el teclado que el mensaje ya tenía, no lo borra.
// Sin este campo, los botones "Confirmar"/"Cancelar" seguirían visibles
// después de editar el texto — invitando a tocarlos de nuevo sobre una
// acción que ya se consumió (ver acciones.ts). Como el único uso de esta
// función es reescribir un mensaje que YA no debe tener botones, limpiarlo
// siempre es lo correcto: no hay ningún llamador que quiera conservarlos.
export async function editarMensaje(
  chatId: string,
  messageId: number,
  texto: string,
): Promise<void> {
  await pedir("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    reply_markup: { inline_keyboard: [] },
  });
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
