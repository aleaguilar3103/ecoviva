import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo mock de bajo nivel que en feed-token.test.ts y admin/users.test.ts.
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
  return cadena;
}

const from = vi.fn(() => {
  const respuesta = colaFrom.shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

const db = { from };

const listarCitas = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => db,
}));
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));
// construirIcs NO se mockea: la prueba del VCALENDAR necesita el ensamblado real.

async function cargar() {
  vi.resetModules();
  return (await import("./feed")).default;
}

function req(query: Record<string, string> = {}) {
  return { method: "GET", headers: {}, query };
}

function resRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = { statusCode: 0, body: undefined, headers: {} as Record<string, string> };
  r.status = vi.fn((c: number) => {
    r.statusCode = c;
    return r;
  });
  r.send = vi.fn((b: unknown) => {
    r.body = b;
    return r;
  });
  r.setHeader = vi.fn((k: string, v: string) => {
    r.headers[k] = v;
  });
  return r;
}

const TOKEN_VALIDO = "11111111-1111-1111-1111-111111111111";
const CUENTA_OK = { user_id: "uid-alina", agenda: true, status: "active" };

// Fila completa de citas.ts, con teléfono y notas — este feed SÍ los muestra.
const CITA_1 = {
  id: "cita-1",
  cliente_nombre: "María Rodríguez",
  cliente_email: "maria@example.com",
  cliente_telefono: "8888-1111",
  inicio: "2026-09-01T16:00:00+00:00",
  duracion_min: 60,
  lugar: "Lomas de la Llanada",
  lote_id: null,
  notas: "Pidió llevar a su suegra, ojo con el horario",
  estado: "agendada" as const,
  ics_uid: "cita-uid-1@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-18T10:00:00+00:00",
  updated_at: "2026-08-18T10:00:00+00:00",
};

const CITA_2 = {
  ...CITA_1,
  id: "cita-2",
  cliente_nombre: "Carlos Jiménez",
  cliente_email: "carlos@example.com",
  cliente_telefono: "8888-2222",
  inicio: "2026-09-02T14:00:00+00:00",
  lugar: "Oficina",
  notas: "Segunda visita, ya vio los planos",
  ics_uid: "cita-uid-2@ecovivadesarrollos.com",
};

const CITA_3 = {
  ...CITA_1,
  id: "cita-3",
  cliente_nombre: "Ana Solís",
  cliente_email: "ana@example.com",
  cliente_telefono: "8888-3333",
  inicio: "2026-09-03T18:30:00+00:00",
  lugar: "Videollamada",
  notas: "Interesada en el lote 12, pidió financiamiento",
  ics_uid: "cita-uid-3@ecovivadesarrollos.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  colaFrom = [];
  listarCitas.mockReset();
});

describe("/api/agenda/feed", () => {
  it("token inexistente → 404", async () => {
    colaFrom = [{ data: null, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    expect(res.statusCode).toBe(404);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("cuenta con agenda=false → 404, no 403 (no confirma que el token existe)", async () => {
    colaFrom = [{ data: { ...CUENTA_OK, agenda: false }, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    expect(res.statusCode).toBe(404);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("cuenta con status='disabled' → 404", async () => {
    colaFrom = [{ data: { ...CUENTA_OK, status: "disabled" }, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    expect(res.statusCode).toBe(404);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("token válido → 200, Content-Type de calendario, cuerpo BEGIN/END VCALENDAR", async () => {
    colaFrom = [{ data: CUENTA_OK, error: null }];
    listarCitas.mockResolvedValue([]);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toMatch(/text\/calendar/);
    const cuerpo: string = res.body;
    expect(cuerpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(cuerpo.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("token con formato inválido (no uuid) → 404 sin consultar la base", async () => {
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: "no-es-un-uuid" }), res);
    expect(res.statusCode).toBe(404);
    expect(from).not.toHaveBeenCalled();
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("sin token → 404 sin consultar la base", async () => {
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({}), res);
    expect(res.statusCode).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it("manda Cache-Control: no-store", async () => {
    colaFrom = [{ data: null, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });

  it("los cuatro casos malos (token inexistente, agenda=false, disabled, formato inválido) devuelven el MISMO 404 — mismo status y mismo cuerpo, sin distinción hacia afuera", async () => {
    const resultados: { statusCode: number; body: unknown }[] = [];

    colaFrom = [{ data: null, error: null }];
    let handler = await cargar();
    let res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    resultados.push({ statusCode: res.statusCode, body: res.body });

    colaFrom = [{ data: { ...CUENTA_OK, agenda: false }, error: null }];
    handler = await cargar();
    res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    resultados.push({ statusCode: res.statusCode, body: res.body });

    colaFrom = [{ data: { ...CUENTA_OK, status: "disabled" }, error: null }];
    handler = await cargar();
    res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    resultados.push({ statusCode: res.statusCode, body: res.body });

    handler = await cargar();
    res = resRecorder();
    await handler(req({ token: "no-es-un-uuid" }), res);
    resultados.push({ statusCode: res.statusCode, body: res.body });

    for (const r of resultados) {
      expect(r.statusCode).toBe(404);
      expect(r.body).toBe("No encontrado");
    }
    // Los cuatro son literalmente indistinguibles entre sí.
    const unico = new Set(resultados.map((r) => `${r.statusCode}:${r.body}`));
    expect(unico.size).toBe(1);
  });

  it("si falla la consulta a app_users, sigue devolviendo el mismo 404 (fail closed) pero deja rastro en el log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    colaFrom = [{ data: null, error: { message: "conexión con Supabase caída" } }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ token: TOKEN_VALIDO }), res);
    // El 404 hacia afuera no cambia: sigue siendo indistinguible de "no existe".
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("No encontrado");
    // Pero puertas adentro sí queda rastro — sin esto, un incidente de
    // Supabase sería indistinguible de "no existe" también en los logs.
    expect(spy).toHaveBeenCalled();
    const detalleLogueado = spy.mock.calls.some((llamada) =>
      llamada.some((arg) => arg && typeof arg === "object" && "message" in (arg as object)),
    );
    expect(detalleLogueado).toBe(true);
    spy.mockRestore();
  });

  it("si listarCitas revienta (fallo de Postgres), responde 500 (no 404) sin propagar la excepción", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    colaFrom = [{ data: CUENTA_OK, error: null }];
    listarCitas.mockRejectedValue(new Error("No se pudo obtener la agenda."));
    const handler = await cargar();
    const res = resRecorder();
    // No debe lanzar: el handler tiene que atrapar la excepción él mismo.
    await expect(handler(req({ token: TOKEN_VALIDO }), res)).resolves.not.toThrow();
    // Nunca 404: un 404 le diría a un cliente de calendario "esta
    // suscripción ya no existe" y algunos la dan de baja solos ante eso.
    expect(res.statusCode).toBe(500);
    expect(res.statusCode).not.toBe(404);
    // El detalle crudo del error no sale hacia afuera.
    expect(String(res.body)).not.toMatch(/No se pudo obtener la agenda/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe("VCALENDAR con varias citas", () => {
    it("un solo BEGIN/END VCALENDAR, tantos BEGIN:VEVENT como citas, líneas ≤75 octetos, con teléfono y notas", async () => {
      colaFrom = [{ data: CUENTA_OK, error: null }];
      listarCitas.mockResolvedValue([CITA_1, CITA_2, CITA_3]);
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ token: TOKEN_VALIDO }), res);

      expect(res.statusCode).toBe(200);
      const cuerpo: string = res.body;

      const inicios = cuerpo.match(/BEGIN:VCALENDAR/g) ?? [];
      const fines = cuerpo.match(/END:VCALENDAR/g) ?? [];
      expect(inicios.length).toBe(1);
      expect(fines.length).toBe(1);

      const beginEventos = cuerpo.match(/BEGIN:VEVENT/g) ?? [];
      const endEventos = cuerpo.match(/END:VEVENT/g) ?? [];
      expect(beginEventos.length).toBe(3);
      expect(endEventos.length).toBe(3);

      const lineas = cuerpo.split("\r\n");
      const lineasLargas = lineas.filter((l) => Buffer.byteLength(l, "utf8") > 75);
      expect(lineasLargas).toEqual([]);

      // Teléfono y notas internas SÍ aparecen: es el calendario privado de ellos,
      // no el correo del cliente. Se "despliega" (deshace el plegado RFC 5545)
      // antes de buscar texto: una nota larga puede quedar partida a la mitad
      // por una continuación "\r\n " y una búsqueda cruda fallaría por eso, no
      // porque el dato no esté.
      const desplegado = cuerpo.replace(/\r\n /g, "");
      expect(desplegado).toContain("8888-1111");
      expect(desplegado).toContain("8888-2222");
      expect(desplegado).toContain("8888-3333");
      expect(desplegado).toContain("Pidió llevar a su suegra");
      expect(desplegado).toContain("Segunda visita");
      expect(desplegado).toContain("financiamiento");

      // Reporte de los números pedidos en la tarea.
      console.log("VCALENDAR test — líneas totales:", lineas.length);
      console.log("VCALENDAR test — BEGIN:VEVENT:", beginEventos.length, "citas:", 3);
      console.log(
        "VCALENDAR test — longitud máxima de línea (octetos):",
        Math.max(...lineas.map((l) => Buffer.byteLength(l, "utf8"))),
      );
    });

    it("una cita sin teléfono no revienta y no deja 'Tel:' colgando", async () => {
      colaFrom = [{ data: CUENTA_OK, error: null }];
      listarCitas.mockResolvedValue([{ ...CITA_1, cliente_telefono: null }]);
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ token: TOKEN_VALIDO }), res);
      expect(res.statusCode).toBe(200);
      const cuerpo: string = res.body;
      expect(cuerpo).not.toContain("Tel: \n");
      expect(cuerpo.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    });
  });
});
