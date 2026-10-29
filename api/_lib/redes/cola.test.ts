import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { correrCola, publicarPost, MAX_INTENTOS, type ApiInstagram, type PostRedes } from "./cola.js";

// Base en memoria: lo justo de la cadena de supabase-js que usa cola.ts
// (update/select + eq/in/lt/lte/gte/contains/order/limit). Filtra de verdad, así
// que lo que se prueba es el efecto sobre las filas y no las llamadas.
type Fila = PostRedes;
let filas: Fila[];

function fakeDb(): SupabaseClient {
  const from = () => {
    const filtros: ((f: Fila) => boolean)[] = [];
    let cambios: Partial<Fila> | null = null;
    let orden: { campo: keyof Fila; asc: boolean } | null = null;
    let tope = Infinity;
    const b = {
      update(c: Partial<Fila>) { cambios = c; return b; },
      select() { return b; },
      eq(c: keyof Fila, v: unknown) { filtros.push((f) => f[c] === v); return b; },
      in(c: keyof Fila, v: unknown[]) { filtros.push((f) => v.includes(f[c])); return b; },
      lt(c: keyof Fila, v: string) { filtros.push((f) => String(f[c]) < v); return b; },
      lte(c: keyof Fila, v: string) { filtros.push((f) => String(f[c]) <= v); return b; },
      gte(c: keyof Fila, v: string) { filtros.push((f) => String(f[c]) >= v); return b; },
      contains(c: keyof Fila, v: string[]) { filtros.push((f) => v.every((x) => (f[c] as string[]).includes(x))); return b; },
      order(c: keyof Fila, o: { ascending: boolean }) { orden = { campo: c, asc: o.ascending }; return b; },
      limit(n: number) { tope = n; return b; },
      then(ok: (r: { data: Fila[]; error: null }) => unknown) {
        let res = filas.filter((f) => filtros.every((p) => p(f)));
        if (cambios) {
          res.forEach((f) => Object.assign(f, cambios, { updated_at: new Date().toISOString() }));
        }
        if (orden) {
          const { campo, asc } = orden;
          res = [...res].sort((a, z) => (String(a[campo]) < String(z[campo]) ? -1 : 1) * (asc ? 1 : -1));
        }
        return Promise.resolve({ data: res.slice(0, tope).map((f) => ({ ...f })), error: null }).then(ok);
      },
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const AHORA = new Date("2026-10-29T18:05:00.000Z"); // 12:05 en Costa Rica

function post(p: Partial<Fila> = {}): Fila {
  return {
    id: p.slug ?? "p1",
    slug: "p1",
    titulo: "Prueba",
    proyecto: "rio_celeste",
    plataformas: ["instagram"],
    caption: "Hola",
    imagenes: ["https://x/1.jpg", "https://x/2.jpg"],
    programado_para: "2026-10-29T18:00:00.000Z",
    estado: "programado",
    intentos: 0,
    error: null,
    ig_creation_id: null,
    ig_media_id: null,
    ig_permalink: null,
    publicado_en: null,
    updated_at: "2026-10-29T17:00:00.000Z",
    ...p,
  };
}

function igFalso(o: Partial<Record<keyof ApiInstagram, unknown>> = {}): ApiInstagram & Record<string, ReturnType<typeof vi.fn>> {
  return {
    crearCarrusel: vi.fn(async () => "cont-1"),
    esperarContenedor: vi.fn(async () => "FINISHED"),
    estadoContenedor: vi.fn(async () => "FINISHED"),
    publicarContenedor: vi.fn(async () => ({ id: "media-1", permalink: "https://instagram.com/p/abc" })),
    ...o,
  } as never;
}

beforeEach(() => {
  filas = [];
});

describe("correrCola", () => {
  it("publica lo que ya tocaba y guarda el enlace", async () => {
    filas = [post()];
    const ig = igFalso();
    const r = await correrCola(fakeDb(), AHORA, ig);
    expect(r.publicacion).toMatchObject({ resultado: "publicado", permalink: "https://instagram.com/p/abc" });
    expect(filas[0]).toMatchObject({ estado: "publicado", ig_media_id: "media-1", ig_creation_id: "cont-1" });
    expect(ig.crearCarrusel).toHaveBeenCalledWith({ imagenes: filas[0].imagenes, caption: "Hola" });
  });

  it("no toca lo que todavía no toca, lo pausado ni lo atrasado más de 36 h", async () => {
    filas = [
      post({ slug: "futuro", programado_para: "2026-10-30T18:00:00.000Z" }),
      post({ slug: "pausado", estado: "pausado" }),
      post({ slug: "vencido", programado_para: "2026-10-27T18:00:00.000Z" }),
    ];
    const ig = igFalso();
    const r = await correrCola(fakeDb(), AHORA, ig);
    expect(r.publicacion).toBeNull();
    expect(ig.crearCarrusel).not.toHaveBeenCalled();
  });

  it("publica una sola fila por corrida, la más vieja", async () => {
    filas = [
      post({ slug: "b", programado_para: "2026-10-29T18:00:00.000Z" }),
      post({ slug: "a", programado_para: "2026-10-29T12:00:00.000Z" }),
    ];
    await correrCola(fakeDb(), AHORA, igFalso());
    expect(filas.find((f) => f.slug === "a")?.estado).toBe("publicado");
    expect(filas.find((f) => f.slug === "b")?.estado).toBe("programado");
  });

  it("rescata lo trabado en «publicando» y lo vuelve a la cola", async () => {
    filas = [post({ estado: "publicando", updated_at: "2026-10-29T17:30:00.000Z" })];
    const r = await correrCola(fakeDb(), AHORA, igFalso());
    expect(r.rescatados).toBe(1);
    expect(filas[0].estado).toBe("publicado");
  });
});

describe("publicarPost (reintentos sin duplicar)", () => {
  it("si el contenedor guardado ya salió, solo marca publicado", async () => {
    filas = [post({ estado: "publicando", ig_creation_id: "viejo" })];
    const ig = igFalso({ estadoContenedor: vi.fn(async () => "PUBLISHED") });
    const r = await publicarPost(fakeDb(), filas[0], ig);
    expect(r.resultado).toBe("publicado");
    expect(ig.crearCarrusel).not.toHaveBeenCalled();
    expect(ig.publicarContenedor).not.toHaveBeenCalled();
  });

  it("si el contenedor guardado está listo, publica ese mismo", async () => {
    filas = [post({ estado: "publicando", ig_creation_id: "listo" })];
    const ig = igFalso();
    await publicarPost(fakeDb(), filas[0], ig);
    expect(ig.crearCarrusel).not.toHaveBeenCalled();
    expect(ig.publicarContenedor).toHaveBeenCalledWith("listo");
  });

  it("si Instagram sigue procesando, suelta la fila con el contenedor guardado", async () => {
    filas = [post({ estado: "publicando" })];
    const ig = igFalso({ esperarContenedor: vi.fn(async () => "IN_PROGRESS") });
    const r = await publicarPost(fakeDb(), filas[0], ig);
    expect(r.resultado).toBe("procesando");
    expect(filas[0]).toMatchObject({ estado: "programado", ig_creation_id: "cont-1", intentos: 0 });
  });

  it("una falla suma intento y vuelve a la cola; a la tercera queda en error", async () => {
    filas = [post({ estado: "publicando", intentos: MAX_INTENTOS - 2 })];
    const falla = igFalso({ crearCarrusel: vi.fn(async () => { throw new Error("Meta caída"); }) });
    const r1 = await publicarPost(fakeDb(), filas[0], falla);
    expect(r1).toMatchObject({ resultado: "fallo", agotado: false });
    expect(filas[0]).toMatchObject({ estado: "programado", intentos: MAX_INTENTOS - 1, error: "Meta caída" });

    filas[0].estado = "publicando";
    const r2 = await publicarPost(fakeDb(), filas[0], falla);
    expect(r2).toMatchObject({ resultado: "fallo", agotado: true });
    expect(filas[0].estado).toBe("error");
  });
});
