import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Cliente HTTP de Resend: se mockea `fetch` global, nunca se pega a la red
// real. Mismo patrón que telegram.test.ts.
const fetchMock = vi.fn();

function respuestaOk(json: unknown = { id: "email-id-1" }) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(json)),
  });
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.RESEND_API_KEY = "clave-de-prueba";
  delete process.env.AGENDA_REPLY_TO;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function cuerpoEnviado() {
  const [, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(opts.body);
}

describe("enviarCorreo — bcc", () => {
  // Test del plan (6): con lista vacía, el cuerpo que se le manda a Resend
  // NO incluye la clave "bcc". Resend interpreta `bcc: []` como un valor
  // presente, no como "sin bcc" — mandarlo igual sería, en el mejor caso,
  // ruido, y no es lo que la API espera quien la documenta.
  it("con bcc: [], el cuerpo enviado a Resend no incluye la clave bcc", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { enviarCorreo } = await import("./resend");

    await enviarCorreo({
      to: "cliente@example.com",
      subject: "Asunto",
      html: "<p>hola</p>",
      bcc: [],
    });

    const body = cuerpoEnviado();
    expect("bcc" in body).toBe(false);
  });

  it("sin pasar bcc (undefined), tampoco incluye la clave", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { enviarCorreo } = await import("./resend");

    await enviarCorreo({ to: "cliente@example.com", subject: "Asunto", html: "<p>hola</p>" });

    const body = cuerpoEnviado();
    expect("bcc" in body).toBe(false);
  });

  it("con bcc no vacío, lo manda tal cual en el cuerpo", async () => {
    fetchMock.mockImplementationOnce(() => respuestaOk());
    const { enviarCorreo } = await import("./resend");

    await enviarCorreo({
      to: "cliente@example.com",
      subject: "Asunto",
      html: "<p>hola</p>",
      bcc: ["alina@x.com", "alejandro@x.com"],
    });

    const body = cuerpoEnviado();
    expect(body.bcc).toEqual(["alina@x.com", "alejandro@x.com"]);
  });
});
