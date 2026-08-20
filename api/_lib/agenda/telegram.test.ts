import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Cliente HTTP de Telegram: se mockea `fetch` global, nunca se pega a la red
// real. `pedir()` espera un cuerpo JSON con `ok: true` (formato real de la
// API de Telegram).
const fetchMock = vi.fn();

function respuestaOk(result: unknown = { message_id: 1 }) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ ok: true, result })),
  });
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.TELEGRAM_BOT_TOKEN = "token-de-prueba";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editarMensaje", () => {
  // Arreglo 1 (ronda de revisión de Task 5): la documentación de Telegram
  // dice que OMITIR `reply_markup` en editMessageText CONSERVA el teclado
  // existente — no lo borra. Así que hay que mandarlo explícitamente vacío
  // para que los botones "Confirmar"/"Cancelar" desaparezcan de verdad.
  it("manda reply_markup con inline_keyboard vacío, para que Telegram borre los botones existentes", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { editarMensaje } = await import("./telegram");
    await editarMensaje("999", 5, "Cita cancelada.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toMatch(/\/editMessageText$/);
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      chat_id: "999",
      message_id: 5,
      text: "Cita cancelada.",
      reply_markup: { inline_keyboard: [] },
    });
  });
});

describe("quitarBotones", () => {
  // Ronda 2 de revisión sobre Task 5: la rama que NO se llevó la acción (le
  // devuelve null) no puede escribir el TEXTO del mensaje — no sabe si
  // venció o si la otra rama ya ejecutó de verdad, y afirmar cualquiera de
  // las dos sería mentir. Pero sí puede (y debe) sacar los botones, para que
  // no quede una invitación a tocarlos de nuevo. `editMessageReplyMarkup` es
  // justo eso: toca el teclado, nunca el texto.
  it("usa editMessageReplyMarkup con inline_keyboard vacío, sin tocar el texto del mensaje", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { quitarBotones } = await import("./telegram");
    await quitarBotones("999", 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toMatch(/\/editMessageReplyMarkup$/);
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      chat_id: "999",
      message_id: 5,
      reply_markup: { inline_keyboard: [] },
    });
    // A propósito: nunca manda "text" — editMessageReplyMarkup no lo acepta,
    // y este helper no tiene por qué conocer ningún texto.
    expect(body.text).toBeUndefined();
  });
});

describe("enviarMensaje", () => {
  it("sin botones, no manda reply_markup", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { enviarMensaje } = await import("./telegram");
    await enviarMensaje("999", "hola");
    const [, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body.reply_markup).toBeUndefined();
  });

  it("con botones, arma el inline_keyboard con callback_data tal cual", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { enviarMensaje } = await import("./telegram");
    await enviarMensaje("999", "Confirmá", {
      botones: [[{ texto: "✅ Confirmar", data: "ok:abc" }, { texto: "✖️ Cancelar", data: "no:abc" }]],
    });
    const [, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: "✅ Confirmar", callback_data: "ok:abc" }, { text: "✖️ Cancelar", callback_data: "no:abc" }]],
    });
  });
});
