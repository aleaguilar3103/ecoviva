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
  // gte/order/limit: la carga del historial de agenda_mensajes (Task 4) las
  // usa. La cadena termina resolviendo con `.then` (más abajo), como
  // cualquier query de postgrest-js que no llama a `.maybeSingle()`.
  cadena.gte = vi.fn(self);
  cadena.order = vi.fn(self);
  cadena.limit = vi.fn(self);
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

// agenda_acciones_pendientes necesita estado REAL (no una cola de
// respuestas fijas): acciones.ts (Task 5) NO se mockea acá — se deja correr
// tal cual, porque la propiedad que hay que probar (consumirAccion es
// atómico, un solo uso) vive en su código real, no en un mock que la de por
// sentada. Por eso esta tabla es un array en memoria y su cadena resuelve
// insert/delete de verdad, igual que hace acciones.test.ts.
//
// Arreglo 5 (ronda de revisión): igual que en acciones.test.ts, este
// `resolver()` NO implementa un `.select()` suelto real — cualquier select
// sin un `.delete()` antes vuelve `null` de entrada, exista o no la fila. Lo
// que el test del doble toque (más abajo) demuestra es que `consumirAccion`
// usa `delete()` como su única operación contra esta tabla: una
// implementación select-y-después-delete falla ya en su primera llamada, sin
// que haga falta concurrencia real para que se note (verificado corriendo la
// versión secuencial, sin Promise.all, contra la implementación insegura —
// también da rojo). Ver el comentario largo en acciones.test.ts para el
// detalle completo.
interface FilaAccion {
  id: string;
  chat_id: string;
  accion: unknown;
  expira_at: string;
}
let filasAcciones: FilaAccion[] = [];
let proximoIdAccion = 1;

function cadenaAccionesPendientes() {
  let modo: "insert" | "delete" | "select" | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any = null;
  const filtros: { campo: keyof FilaAccion; op: "eq" | "gt"; valor: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  c.insert = (arg: unknown) => {
    modo = "insert";
    payload = arg;
    return c;
  };
  c.delete = () => {
    modo = "delete";
    return c;
  };
  c.select = () => {
    if (!modo) modo = "select";
    return c;
  };
  c.eq = (campo: keyof FilaAccion, valor: unknown) => {
    filtros.push({ campo, op: "eq", valor });
    return c;
  };
  c.gt = (campo: keyof FilaAccion, valor: unknown) => {
    filtros.push({ campo, op: "gt", valor });
    return c;
  };
  const coincide = (f: FilaAccion) =>
    filtros.every((flt) => {
      if (flt.op === "eq") return f[flt.campo] === flt.valor;
      return new Date(f[flt.campo] as string).getTime() > new Date(flt.valor as string).getTime();
    });
  const resolver = () => {
    if (modo === "insert") {
      const fila: FilaAccion = {
        id: `accion-${proximoIdAccion++}`,
        chat_id: payload.chat_id,
        accion: payload.accion,
        expira_at: payload.expira_at,
      };
      filasAcciones.push(fila);
      return { data: { id: fila.id }, error: null };
    }
    if (modo === "delete") {
      const idx = filasAcciones.findIndex(coincide);
      if (idx === -1) return { data: null, error: null };
      const [fila] = filasAcciones.splice(idx, 1);
      return { data: fila, error: null };
    }
    return { data: null, error: null };
  };
  c.single = () => Promise.resolve(resolver());
  c.maybeSingle = () => Promise.resolve(resolver());
  c.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(resolver()).then(
      onFulfilled as (v: unknown) => unknown,
      onRejected as (e: unknown) => unknown,
    );
  return c;
}

const from = vi.fn((tabla: string) => {
  if (tabla === "agenda_acciones_pendientes") return cadenaAccionesPendientes();
  const respuesta = (colas[tabla] ?? []).shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => ({ from }),
}));

// telegram.js: nunca se manda un mensaje real. Se mockea entero.
const enviarMensaje = vi.fn();
const escribiendo = vi.fn();
const editarMensaje = vi.fn();
const responderCallback = vi.fn();
vi.mock("../_lib/agenda/telegram.js", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensaje(...a),
  escribiendo: (...a: unknown[]) => escribiendo(...a),
  editarMensaje: (...a: unknown[]) => editarMensaje(...a),
  responderCallback: (...a: unknown[]) => responderCallback(...a),
}));

// db.js: listarCitas se mockea, igual que en cron/agenda.test.ts. obtenerCita
// se agrega para que acciones.ts (real, sin mockear) pueda resolverlo si
// algún día un test de acá ejercita mover_cita/editar_cita.
const listarCitas = vi.fn();
const obtenerCita = vi.fn();
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
}));

// operaciones.js: se mockea para poder aserir "se llamó una sola vez" sin
// tener que levantar toda la infraestructura de correo/recordatorios detrás
// — esa parte ya la cubre operaciones.test.ts.
const crearCitaCompleta = vi.fn();
const actualizarCitaCompleta = vi.fn();
const cancelarCitaCompleta = vi.fn();
vi.mock("../_lib/agenda/operaciones.js", () => ({
  crearCitaCompleta: (...a: unknown[]) => crearCitaCompleta(...a),
  actualizarCitaCompleta: (...a: unknown[]) => actualizarCitaCompleta(...a),
  cancelarCitaCompleta: (...a: unknown[]) => cancelarCitaCompleta(...a),
}));

// agente.js: el agente conversacional en sí ya tiene su propia batería de
// tests (agenda/agente.test.ts). Acá solo importa el ENCHUFE: que el webhook
// lo llame con lo correcto y traduzca su resultado a Telegram.
const correrAgente = vi.fn();
vi.mock("../_lib/agenda/agente.js", () => ({
  correrAgente: (...a: unknown[]) => correrAgente(...a),
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

// Mismo propósito que la de arriba, pero para tests que llaman al handler
// más de una vez en la misma prueba (p. ej. "no:" y después "ok:" sobre el
// mismo id): espera la ÚLTIMA promesa capturada, no siempre la primera.
async function esperarUltimoProcesamiento() {
  const llamadas = waitUntilMock.mock.calls;
  if (llamadas.length) await llamadas[llamadas.length - 1][0];
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

// Update de un toque de botón: callback_query en vez de message. data llega
// como "ok:<id>" o "no:<id>" (ver telegram.ts).
function callbackUpdate(overrides: Record<string, unknown> = {}) {
  return {
    update_id: 900,
    callback_query: {
      id: "cbq-1",
      data: "ok:accion-1",
      from: { id: 999 },
      message: { message_id: 5, chat: { id: 999, type: "private" } },
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

// Fila completa tal como la devuelve operaciones.ts, para los tests de
// callback_query (mismos 16 campos que citas.test.ts usa para CITA_BASE).
const CITA_PARA_ACCIONES = {
  id: "cita-1",
  cliente_nombre: "María Rodríguez",
  cliente_email: "maria@example.com",
  cliente_telefono: "8888-7777",
  inicio: "2026-09-01T16:00:00+00:00",
  duracion_min: 60,
  lugar: "Visita Lomas de la Llanada",
  lote_id: null,
  notas: null,
  estado: "agendada" as const,
  ics_uid: "cita-1@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-01T00:00:00+00:00",
  updated_at: "2026-08-01T00:00:00+00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  colas = {};
  filasAcciones = [];
  proximoIdAccion = 1;
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

  it("texto libre (tipo 'texto') → se lo pasa al agente y contesta lo que devuelve", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    correrAgente.mockResolvedValue({ tipo: "texto", texto: "¿A qué hora querés la cita?" });
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

    expect(correrAgente).toHaveBeenCalledTimes(1);
    const arg = correrAgente.mock.calls[0][0] as { mensaje: string; historial: unknown[]; ahora: Date };
    expect(arg.mensaje).toBe("hola eco");
    expect(arg.ahora).toBeInstanceOf(Date);
    expect(enviarMensaje).toHaveBeenCalledWith("999", "¿A qué hora querés la cita?");
    // Se guardan los dos lados de la conversación en agenda_mensajes.
    expect(insertSpy).toHaveBeenCalledWith({ chat_id: "999", rol: "usuario", contenido: "hola eco" });
    expect(insertSpy).toHaveBeenCalledWith({
      chat_id: "999",
      rol: "agente",
      contenido: "¿A qué hora querés la cita?",
    });
  });

  it("el agente propone una escritura (tipo 'confirmar') → guarda la acción pendiente y manda el resumen con botones Confirmar/Cancelar", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    correrAgente.mockResolvedValue({
      tipo: "confirmar",
      accion: { herramienta: "crear_cita", entrada: { cliente_nombre: "María" } },
      resumen: "Crear cita nueva\njueves 21 de agosto, 10:00 a. m.\nMaría — maria@example.com\nVisita Llanada",
    });
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 50,
      message: {
        message_id: 1,
        text: "agendá a María el jueves a las 10",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    // La acción queda guardada, lista para que consumirAccion la encuentre
    // cuando llegue el callback_query del toque.
    expect(filasAcciones).toHaveLength(1);
    expect(filasAcciones[0].chat_id).toBe("999");
    expect(filasAcciones[0].accion).toEqual({ herramienta: "crear_cita", entrada: { cliente_nombre: "María" } });

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [chatId, texto, opts] = enviarMensaje.mock.calls[0];
    expect(chatId).toBe("999");
    expect(texto).toMatch(/María — maria@example\.com/);
    // callback_data nunca lleva la acción completa, solo "ok:<id>"/"no:<id>"
    // (la acción vive en la tabla): ver el porqué en acciones.ts.
    const id = filasAcciones[0].id;
    expect(opts.botones).toEqual([
      [
        { texto: "✅ Confirmar", data: `ok:${id}` },
        { texto: "✖️ Cancelar", data: `no:${id}` },
      ],
    ]);
  });

  it("carga el historial reciente del chat y se lo pasa al agente en orden cronológico", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    // La consulta pide `order("created_at", { ascending: false })`: el más
    // nuevo primero. Acá simulamos esa fila cruda tal como llega de Postgres.
    colas.agenda_mensajes = [
      {
        data: [
          { rol: "agente", contenido: "¿Con quién y cuándo?" }, // más reciente
          { rol: "usuario", contenido: "quiero agendar una cita" }, // más viejo
        ],
        error: null,
      },
    ];
    correrAgente.mockResolvedValue({ tipo: "texto", texto: "listo" });
    const { default: handler } = await cargar();
    const res = resRecorder();
    const update = updateBase({
      update_id: 51,
      message: {
        message_id: 1,
        text: "con María, el jueves a las 10",
        chat: { id: 999, type: "private" },
        from: { id: 999 },
      },
    });
    await handler(req({ secreto: SECRETO, body: update }), res);
    await esperarProcesamiento();

    const arg = correrAgente.mock.calls[0][0] as { historial: { rol: string; texto: string }[] };
    // Orden cronológico (el más viejo primero): se da vuelta lo que trajo la
    // consulta antes de pasárselo al agente.
    expect(arg.historial).toEqual([
      { rol: "usuario", texto: "quiero agendar una cita" },
      { rol: "agente", texto: "¿Con quién y cuándo?" },
    ]);
  });
});

describe("POST /api/telegram/webhook — callback_query (botones Confirmar/Cancelar)", () => {
  it("callback_query de un usuario NO autorizado no ejecuta nada", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: null, error: null }]; // sin fila en app_users
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: callbackUpdate({ update_id: 901 }) }), res);
    await esperarProcesamiento();

    expect(cancelarCitaCompleta).not.toHaveBeenCalled();
    expect(crearCitaCompleta).not.toHaveBeenCalled();
    expect(actualizarCitaCompleta).not.toHaveBeenCalled();
    expect(editarMensaje).not.toHaveBeenCalled();
    expect(enviarMensaje).not.toHaveBeenCalled();
    // La acción sigue viva: un usuario no autorizado no puede ni consumirla.
    expect(filasAcciones).toHaveLength(1);
  });

  it("ok:<id> válido → se llama la operación correspondiente y se edita el mensaje original", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_PARA_ACCIONES, correo: "enviado" });

    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: callbackUpdate({ update_id: 910 }) }), res);
    await esperarProcesamiento();

    expect(responderCallback).toHaveBeenCalledWith("cbq-1");
    expect(cancelarCitaCompleta).toHaveBeenCalledTimes(1);
    expect(cancelarCitaCompleta).toHaveBeenCalledWith("cita-1", "alinaramirezgamboa@gmail.com", "telegram");

    // Se EDITA el mensaje original (mismo chat, mismo message_id) — no se
    // manda uno nuevo: así los botones desaparecen y el chat queda con el
    // registro de lo que se hizo.
    expect(editarMensaje).toHaveBeenCalledTimes(1);
    const [chatIdArg, messageIdArg, textoArg] = editarMensaje.mock.calls[0];
    expect(chatIdArg).toBe("999");
    expect(messageIdArg).toBe(5);
    expect(textoArg).toMatch(/Cita cancelada/);
    expect(enviarMensaje).not.toHaveBeenCalled();

    // Y la acción quedó consumida: ya no está en la tabla.
    expect(filasAcciones).toHaveLength(0);
  });

  // El más importante de los tests de esta tarea: si el consumo no fuera
  // atómico, un doble toque al mismo botón (dos update_id DISTINTOS, porque
  // así es como Telegram entrega dos toques reales) ejecutaría la operación
  // dos veces — y con ella, un segundo correo de cancelación al cliente.
  // Las dos llamadas al handler se disparan SIN esperar la primera (Promise.all
  // en vez de dos await secuenciales) para simular de verdad dos requests
  // concurrentes, no dos requests que casualmente nunca se solapan.
  it("el MISMO ok:<id> dos veces (dos toques) → la operación se llama una sola vez; la segunda avisa que ya no vale", async () => {
    colas.telegram_updates = [{ data: null, error: null }, { data: null, error: null }];
    colas.app_users = [
      { data: FILA_AUTORIZADA, error: null },
      { data: FILA_AUTORIZADA, error: null },
    ];
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_PARA_ACCIONES, correo: "enviado" });

    const { default: handler } = await cargar();
    const res1 = resRecorder();
    const res2 = resRecorder();
    const update1 = callbackUpdate({
      update_id: 920,
      callback_query: {
        id: "cbq-a",
        data: "ok:accion-1",
        from: { id: 999 },
        message: { message_id: 5, chat: { id: 999, type: "private" } },
      },
    });
    const update2 = callbackUpdate({
      update_id: 921, // distinto update_id: es justo el caso que la deduplicación NO frena
      callback_query: {
        id: "cbq-b",
        data: "ok:accion-1",
        from: { id: 999 },
        message: { message_id: 5, chat: { id: 999, type: "private" } },
      },
    });

    const p1 = handler(req({ secreto: SECRETO, body: update1 }), res1);
    const p2 = handler(req({ secreto: SECRETO, body: update2 }), res2);
    await Promise.all([p1, p2]);
    await Promise.all(waitUntilMock.mock.calls.map(([p]) => p));

    // La defensa real: la operación de dominio se ejecuta UNA sola vez.
    expect(cancelarCitaCompleta).toHaveBeenCalledTimes(1);

    // Los dos toques reciben una respuesta (los dos mensajes se editan),
    // pero solo uno cuenta la cancelación real; el otro avisa que ya no vale.
    expect(editarMensaje).toHaveBeenCalledTimes(2);
    const textos = editarMensaje.mock.calls.map((c) => c[2] as string);
    expect(textos.some((t) => /Cita cancelada/.test(t))).toBe(true);
    expect(textos.some((t) => /venció o ya la usaste/i.test(t))).toBe(true);
  });

  // Arreglo 2 (ronda de revisión): con los botones todavía visibles después
  // de un toque (Arreglo 1 los estaba dejando ahí), es plausible que alguien
  // toque "Confirmar" y, dudando si pegó, toque "Cancelar" sobre el MISMO
  // mensaje. Si el "ok:" gana la carrera y ejecuta de verdad la cancelación
  // (con su correo, irreversible), el "no:" que llega después NO puede
  // escribir "Cancelado." — eso sería mentir sobre algo que sí ocurrió y ya
  // no se puede deshacer. La rama "no:" tiene que mirar qué le devolvió
  // consumirAccion, igual que ya hace la rama "ok:".
  it("ok: y no: compitiendo sobre el MISMO id (ok gana la carrera) → el mensaje final nunca dice 'Cancelado.'", async () => {
    colas.telegram_updates = [{ data: null, error: null }, { data: null, error: null }];
    colas.app_users = [
      { data: FILA_AUTORIZADA, error: null },
      { data: FILA_AUTORIZADA, error: null },
    ];
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_PARA_ACCIONES, correo: "enviado" });

    const { default: handler } = await cargar();
    const res1 = resRecorder();
    const res2 = resRecorder();
    const updateOk = callbackUpdate({
      update_id: 922,
      callback_query: {
        id: "cbq-ok",
        data: "ok:accion-1",
        from: { id: 999 },
        message: { message_id: 5, chat: { id: 999, type: "private" } },
      },
    });
    const updateNo = callbackUpdate({
      update_id: 923,
      callback_query: {
        id: "cbq-no",
        data: "no:accion-1",
        from: { id: 999 },
        message: { message_id: 5, chat: { id: 999, type: "private" } },
      },
    });

    // "ok:" se dispara primero (array literal, evaluación sincrónica en
    // orden): en nuestro mock gana la carrera de forma determinística, igual
    // que en el test de "el MISMO ok:<id> dos veces" de arriba.
    const p1 = handler(req({ secreto: SECRETO, body: updateOk }), res1);
    const p2 = handler(req({ secreto: SECRETO, body: updateNo }), res2);
    await Promise.all([p1, p2]);
    await Promise.all(waitUntilMock.mock.calls.map(([p]) => p));

    expect(cancelarCitaCompleta).toHaveBeenCalledTimes(1);
    expect(editarMensaje).toHaveBeenCalledTimes(2);
    const textos = editarMensaje.mock.calls.map((c) => c[2] as string);
    // La aserción central del arreglo: "Cancelado." NUNCA debe aparecer,
    // porque lo que de verdad pasó fue una cancelación real (con correo).
    expect(textos).not.toContain("Cancelado.");
    expect(textos.some((t) => /Cita cancelada/.test(t))).toBe(true);
    expect(textos.some((t) => /venció o ya la usaste/i.test(t))).toBe(true);
  });

  it("no:<id> → no se llama ninguna operación, y la acción queda consumida (un ok posterior ya no hace nada)", async () => {
    colas.telegram_updates = [{ data: null, error: null }, { data: null, error: null }];
    colas.app_users = [
      { data: FILA_AUTORIZADA, error: null },
      { data: FILA_AUTORIZADA, error: null },
    ];
    filasAcciones.push({
      id: "accion-2",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    const { default: handler } = await cargar();

    const res1 = resRecorder();
    await handler(
      req({
        secreto: SECRETO,
        body: callbackUpdate({
          update_id: 930,
          callback_query: {
            id: "cbq-no",
            data: "no:accion-2",
            from: { id: 999 },
            message: { message_id: 7, chat: { id: 999, type: "private" } },
          },
        }),
      }),
      res1,
    );
    await esperarUltimoProcesamiento();

    expect(cancelarCitaCompleta).not.toHaveBeenCalled();
    expect(crearCitaCompleta).not.toHaveBeenCalled();
    expect(actualizarCitaCompleta).not.toHaveBeenCalled();
    expect(editarMensaje).toHaveBeenCalledWith("999", 7, "Cancelado.");
    expect(filasAcciones).toHaveLength(0); // consumida, aunque no se ejecutó nada

    // Un "ok" posterior sobre el MISMO id ya no encuentra nada que confirmar.
    const res2 = resRecorder();
    await handler(
      req({
        secreto: SECRETO,
        body: callbackUpdate({
          update_id: 931,
          callback_query: {
            id: "cbq-ok-tarde",
            data: "ok:accion-2",
            from: { id: 999 },
            message: { message_id: 7, chat: { id: 999, type: "private" } },
          },
        }),
      }),
      res2,
    );
    await esperarUltimoProcesamiento();

    expect(cancelarCitaCompleta).not.toHaveBeenCalled();
    expect(editarMensaje).toHaveBeenLastCalledWith("999", 7, "Esa confirmación ya no vale — venció o ya la usaste.");
  });

  it("callback_data en un formato que no reconocemos se ignora (no ejecuta nada, no revienta)", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(
      req({
        secreto: SECRETO,
        body: callbackUpdate({ update_id: 940, callback_query: { id: "cbq-raro", data: "algo-random", from: { id: 999 }, message: { message_id: 9, chat: { id: 999, type: "private" } } } }),
      }),
      res,
    );
    await esperarProcesamiento();

    expect(cancelarCitaCompleta).not.toHaveBeenCalled();
    expect(crearCitaCompleta).not.toHaveBeenCalled();
    expect(actualizarCitaCompleta).not.toHaveBeenCalled();
    expect(editarMensaje).not.toHaveBeenCalled();
  });

  // Arreglo 3 (ronda de revisión): si ejecutarAccion salió bien — la cita ya
  // se creó/canceló de verdad, con su correo mandado — pero el editarMensaje
  // final falla (un hipo de red hacia Telegram), la persona NO puede leer
  // "Se me complicó, probá de nuevo.": ese texto invita a reintentar algo
  // que YA pasó, y un reintento humano generaría una acción NUEVA que, al
  // confirmarse, sí duplicaría la cita.
  it("la acción se ejecuta bien pero falla el editarMensaje final → avisa por un mensaje NUEVO, no dice 'probá de nuevo'", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_PARA_ACCIONES, correo: "enviado" });
    editarMensaje.mockRejectedValue(new Error("hipo de red hacia Telegram"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: callbackUpdate({ update_id: 960 }) }), res);
    await esperarProcesamiento();

    // La ejecución real SÍ pasó — no se reintenta ni se deshace.
    expect(cancelarCitaCompleta).toHaveBeenCalledTimes(1);
    // Al fallar la edición, se avisa por un mensaje NUEVO con el mismo texto
    // del resultado (no se pierde la noticia de lo que pasó).
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    const [chatIdArg, textoArg] = enviarMensaje.mock.calls[0];
    expect(chatIdArg).toBe("999");
    expect(textoArg).toMatch(/Cita cancelada/);
    // Nunca el texto que invita a reintentar algo que ya pasó.
    expect(enviarMensaje).not.toHaveBeenCalledWith("999", "Se me complicó, probá de nuevo.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("si TAMBIÉN falla el aviso por mensaje nuevo, se loguea y no revienta (tampoco manda 'probá de nuevo')", async () => {
    colas.telegram_updates = [{ data: null, error: null }];
    colas.app_users = [{ data: FILA_AUTORIZADA, error: null }];
    filasAcciones.push({
      id: "accion-1",
      chat_id: "999",
      accion: { herramienta: "cancelar_cita", entrada: { id: "cita-1" } },
      expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_PARA_ACCIONES, correo: "enviado" });
    editarMensaje.mockRejectedValue(new Error("hipo de red hacia Telegram"));
    enviarMensaje.mockRejectedValue(new Error("Telegram también caído para sendMessage"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req({ secreto: SECRETO, body: callbackUpdate({ update_id: 961 }) }), res);
    await esperarProcesamiento();

    expect(cancelarCitaCompleta).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(enviarMensaje).not.toHaveBeenCalledWith("999", "Se me complicó, probá de nuevo.");
    consoleErrorSpy.mockRestore();
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
