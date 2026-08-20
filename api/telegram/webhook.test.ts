import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo patrón de cadena que el resto de api/: `from(tabla)` saca la próxima
// respuesta de una cola PROPIA de esa tabla (no una cola global), porque un
// mismo update puede tocar `telegram_updates` y `app_users` en la misma
// pasada (dedup + autorización, o /vincular con select + update).
let colas: Record<string, unknown[]> = {};
const insertSpy = vi.fn();
const updateSpy = vi.fn();

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.gt = vi.fn(self);
  cadena.insert = vi.fn((arg: unknown) => {
    insertSpy(arg);
    return cadena;
  });
  cadena.update = vi.fn((arg: unknown) => {
    updateSpy(arg);
    return cadena;
  });
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
  cadena.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(resolver()).then(
      onFulfilled as (v: unknown) => unknown,
      onRejected as (e: unknown) => unknown,
    );
  return cadena;
}

const from = vi.fn((tabla: string) => {
  const respuesta = (colas[tabla] ?? []).shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => ({ from }),
}));

// telegram.js: nunca se manda un mensaje real. Se mockea entero.
const enviarMensaje = vi.fn();
const escribiendo = vi.fn();
vi.mock("../_lib/agenda/telegram.js", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensaje(...a),
  escribiendo: (...a: unknown[]) => escribiendo(...a),
}));

// db.js: listarCitas se mockea, igual que en cron/agenda.test.ts.
const listarCitas = vi.fn();
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));

// waitUntil: en producción dispara y no espera. En el test capturamos la
// promesa que le pasan para poder esperarla nosotros antes de aserir.
const waitUntilMock = vi.fn();
vi.mock("@vercel/functions", () => ({
  waitUntil: (p: Promise<unknown>) => waitUntilMock(p),
}));

async function cargar() {
  vi.resetModules();
  return await import("./webhook");
}

function req(opts: {
  method?: string;
  secreto?: string | undefined;
  body?: unknown;
}) {
  const headers: Record<string, unknown> = {};
  if (opts.secreto !== undefined) headers["x-telegram-bot-api-secret-token"] = opts.secreto;
  return { method: opts.method ?? "POST", headers, body: opts.body ?? {} };
}

function resRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = { statusCode: 0, body: undefined };
  r.status = vi.fn((c: number) => {
    r.statusCode = c;
    return r;
  });
  r.json = vi.fn((b: unknown) => {
    r.body = b;
    return r;
  });
  r.setHeader = vi.fn();
  return r;
}

// Espera a que la promesa que le llegó a waitUntil (el procesamiento en
// segundo plano) termine, para poder aserir sobre sus efectos.
async function esperarProcesamiento() {
  if (waitUntilMock.mock.calls.length) {
    await waitUntilMock.mock.calls[0][0];
  }
}

const SECRETO = "secreto-de-prueba-123";

function updateBase(overrides: Record<string, unknown> = {}) {
  return {
    update_id: 555,
    message: {
      message_id: 1,
      text: "/hoy",
      chat: { id: 999, type: "private" },
      from: { id: 999 },
    },
    ...overrides,
  };
}

const FILA_AUTORIZADA = {
  email: "alinaramirezgamboa@gmail.com",
  user_id: "uid-alina",
  role: "admin",
  status: "active",
  agenda: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  colas = {};
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRETO;
});

describe("POST /api/telegram/webhook — las cuatro puertas", () => {
  it("método distinto de POST → 405", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
    expect(from).not.toHaveBeenCalled();
  });

  it("1) cabecera de secreto ausente → 401, sin consultar la base", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: undefined, body: updateBase() }), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it("2) cabecera de secreto incorrecta → 401", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: "no-es-el-secreto", body: updateBase() }), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("3) TELEGRAM_WEBHOOK_SECRET ausente del entorno → 401 pase lo que pase en la cabecera", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const { default: handler } = await cargar();
    const res = resRecorder();
    // La cabecera coincide con lo que ANTES era el secreto válido — no debe
    // servir de nada si la variable de entorno no está definida.
    await handler(req({ secreto: SECRETO, body: updateBase() }), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("4) update_id repetido → 200 sin procesar (no llama a enviarMensaje)", async () => {
    // El insert en telegram_updates choca con la llave primaria: es un reintento.
    colas.telegram_updates = [{ data: null, error: { code: "23505", message: "duplicate key" } }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase({ update_id: 777 }) }), res);
    expect(res.statusCode).toBe(200);
    expect(waitUntilMock).not.toHaveBeenCalled();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("5) mensaje de un usuario sin fila en app_users → línea seca exacta y nada más", async () => {
    colas.telegram_updates = [{ data: null, error: null }]; // insert ok, no duplicado
    colas.app_users = [{ data: null, error: null }]; // autorizar: sin fila
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase() }), res);
    expect(res.statusCode).toBe(200);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("999", "No tenés acceso.");
  });

  it("6) usuario con fila pero agenda=false → misma línea seca", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: { ...FILA_AUTORIZADA, agenda: false }, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase() }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("999", "No tenés acceso.");
  });

  it("7) mensaje en un chat de grupo, aunque el usuario esté autorizado en privado → misma línea seca", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    // Ni siquiera debería llegar a consultar app_users: chatType !== "private"
    // corta antes en `autorizar`. Igual dejamos una fila lista por si acaso,
    // así el test discrimina la implementación correcta de una que ignorara
    // chat.type.
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/hoy",
        chat: { id: -1001111, type: "group" },
        from: { id: 999 }, // el mismo usuario autorizado en privado
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("-1001111", "No tenés acceso.");
  });
});

describe("POST /api/telegram/webhook — /vincular", () => {
  it("8) código válido y vigente, en privado → guarda telegram_chat_id y limpia el código", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    // Ronda de arreglo: ahora es UNA sola operación (update condicionado +
    // select), no select-y-después-update, así que una sola entrada en la
    // cola alcanza.
    colas.app_users = [{ data: { email: "alina@ecoviva.test", full_name: "Alina" }, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/vincular 123456",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    expect(updateSpy).toHaveBeenCalledWith({
      telegram_chat_id: "999",
      telegram_codigo: null,
      telegram_codigo_expira: null,
    });
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).toMatch(/Alina/);
  });

  // Ronda de arreglo (hallazgo del coordinador): vincular desde un grupo no
  // es legítimo en ningún caso — el código quedaría a la vista de todo el
  // grupo y la confirmación revelaría el nombre de la persona vinculada.
  // Este es el test 1 que pidió el coordinador.
  it("código válido pero mandado desde un GRUPO → no se vincula nada, línea seca", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    // Ni siquiera debería tocar app_users: el chequeo de chat privado corta
    // antes de llegar al update. No dejamos ninguna entrada en la cola —
    // si la implementación igual consultara, el mock reventaría al no
    // encontrar respuesta preparada... en cambio devuelve el default
    // { data: null, error: null }, así que la aserción real es sobre
    // updateSpy y el texto exacto de la respuesta.
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/vincular 123456",
        chat: { id: -1002222, type: "group" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("-1002222", "No tenés acceso.");
  });

  // Test 2 del coordinador: en privado sigue funcionando — es el test 8 de
  // arriba, sin cambios de intención.

  // Test 3 del coordinador: el update condicionado no encuentra fila (código
  // que no existe, que ya venció, o que alguien más se llevó primero en la
  // carrera) → mensaje de código inválido, nada se vincula.
  it("9) el update condicionado devuelve null (código vencido, inexistente o ya consumido) → avisa que no sirve", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: null, error: null }]; // el where (código + vigencia) no matcheó ninguna fila
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/vincular 999999",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    // El update SÍ se invoca (es la misma operación atómica que intenta el
    // caso feliz) — lo que garantiza "no guarda nada" es el WHERE de
    // Postgres, no que la app se abstenga de llamarlo. Lo que importa acá es
    // que nunca se manda un mensaje de éxito.
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith(
      "999",
      "Ese código no sirve o ya venció. Generá uno nuevo desde el panel.",
    );
  });

  it("/vincular se atiende ANTES de la autorización (sin fila en app_users igual procesa el código)", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: null, error: null }]; // no matchea código → mensaje de "no sirve", no la línea seca
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/vincular 000000",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledWith(
      "999",
      "Ese código no sirve o ya venció. Generá uno nuevo desde el panel.",
    );
    expect(enviarMensaje).not.toHaveBeenCalledWith("999", "No tenés acceso.");
  });

  it("código que ya vinculado a otra cuenta (choque de unique) → mensaje claro, no error crudo", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    // Ahora es una sola operación: el update condicionado en sí devuelve el
    // error de unique_violation (antes eran dos pasos, select + update).
    colas.app_users = [
      {
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "app_users_telegram_chat_id_key"' },
      },
    ];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      message: {
        message_id: 1,
        text: "/vincular 424242",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).not.toMatch(/duplicate key|constraint|23505/i);
    expect(texto).toMatch(/ya está vinculado/i);
  });
});

describe("POST /api/telegram/webhook — comandos de un usuario autorizado", () => {
  it("10) /hoy llama a listarCitas y contesta con las citas", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    listarCitas.mockResolvedValue([
      {
        id: "c1",
        cliente_nombre: "María Rodríguez",
        cliente_email: "maria@example.com",
        cliente_telefono: "8888-7777",
        inicio: "2026-08-19T16:00:00+00:00",
        duracion_min: 60,
        lugar: "Visita Lomas de la Llanada",
        lote_id: null,
        notas: null,
        estado: "agendada",
        ics_uid: "cita-1@ecovivadesarrollos.com",
        ics_secuencia: 0,
        recordatorio_24h_email_id: null,
        recordatorio_1h_email_id: null,
        creada_por: "panel",
        created_at: "2026-08-01T00:00:00+00:00",
        updated_at: "2026-08-01T00:00:00+00:00",
      },
    ]);
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase({ update_id: 42 }) }), res);
    await esperarProcesamiento();

    expect(listarCitas).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [chatId, texto] = enviarMensaje.mock.calls[0];
    expect(chatId).toBe("999");
    expect(texto).toMatch(/María Rodríguez/);
    expect(texto).toMatch(/Visita Lomas de la Llanada/);
    expect(texto).toMatch(/8888-7777/);
    // Nunca hora cruda en UTC: "16:00" no debe aparecer (son las 10 a. m. en CR).
    expect(texto).not.toMatch(/16:00/);
  });

  it("/hoy sin citas → 'Hoy no tenés nada agendado.'", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    listarCitas.mockResolvedValue([]);
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase({ update_id: 43 }) }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledWith("999", "Hoy no tenés nada agendado.");
  });

  it("/semana sin citas → mensaje distinto al de /hoy (no dice 'Hoy')", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    listarCitas.mockResolvedValue([]);
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 49,
      message: {
        message_id: 1,
        text: "/semana",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).not.toBe("Hoy no tenés nada agendado.");
    expect(texto).toMatch(/7 días/);
  });

  it("/semana llama a listarCitas con un rango de 7 días desde hoy", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    listarCitas.mockResolvedValue([]);
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 44,
      message: {
        message_id: 1,
        text: "/semana",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    expect(listarCitas).toHaveBeenCalledTimes(1);
    const arg = listarCitas.mock.calls[0][0] as { desde: Date; hasta: Date };
    const diffDias = (arg.hasta.getTime() - arg.desde.getTime()) / (24 * 60 * 60_000);
    expect(diffDias).toBeCloseTo(7, 1);
  });

  it("/start de un usuario autorizado → saludo, no la línea seca", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 45,
      message: {
        message_id: 1,
        text: "/start",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).not.toBe("No tenés acceso.");
    expect(texto.length).toBeGreaterThan(10);
  });

  it("/start de un usuario NO autorizado → línea seca (sin decir qué es el bot)", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: null, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 46,
      message: {
        message_id: 1,
        text: "/start",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledWith("999", "No tenés acceso.");
  });

  it("texto que no es ningún comando conocido → 'Todavía no sé responder eso.'", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 47,
      message: {
        message_id: 1,
        text: "hola eco",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();
    expect(enviarMensaje).toHaveBeenCalledWith("999", "Todavía no sé responder eso.");
  });
});

describe("POST /api/telegram/webhook — robustez del procesamiento en segundo plano", () => {
  it("un error inesperado durante el procesamiento no tira: se loguea y se avisa a la persona", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    listarCitas.mockRejectedValue(new Error("boom de postgres"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: updateBase({ update_id: 48 }) }), res);
    // El handler ya respondió 200 antes de que termine el procesamiento.
    expect(res.statusCode).toBe(200);
    await esperarProcesamiento();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(enviarMensaje).toHaveBeenCalledWith("999", "Se me complicó, probá de nuevo.");
    consoleErrorSpy.mockRestore();
  });
});

describe("POST /api/telegram/webhook — cabecera Cache-Control", () => {
  it("manda Cache-Control: no-store siempre, incluso en el 401", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: "malo", body: updateBase() }), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});

describe("autorizar()", () => {
  it("devuelve null si falta fromId", async () => {
    const { autorizar } = await cargar();
    expect(await autorizar(undefined, "private")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("devuelve null si el chat no es privado, aunque el usuario esté vinculado", async () => {
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { autorizar } = await cargar();
    expect(await autorizar(999, "group")).toBeNull();
  });

  it("falla cerrado si la consulta da error", async () => {
    colas.app_users = [{ data: null, error: { message: "boom" } }];
    const { autorizar } = await cargar();
    expect(await autorizar(999, "private")).toBeNull();
  });

  it("devuelve los datos cuando la fila está activa, admin y con agenda", async () => {
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { autorizar } = await cargar();
    const resultado = await autorizar(999, "private");
    expect(resultado).toEqual({
      email: "alinaramirezgamboa@gmail.com",
      userId: "uid-alina",
      chatId: "999",
    });
  });
});
