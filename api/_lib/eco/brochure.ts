// Generador de folletos (brochure) PDF de marca EcoViva.
//
// En vez de mandar PDFs estáticos y desactualizados, ECO arma el folleto AL
// MOMENTO desde los datos vivos de la tabla `lots` (precios, disponibilidad) y
// lo cachea en Supabase Storage con una huella de datos: si los lotes no
// cambiaron, reusa el PDF; si cambiaron, lo regenera. Una sola fuente de verdad.
//
// Diseño: folleto CLARO (fondo blanco/crema, bandas verdes de marca, fotos),
// que es el estándar inmobiliario y se imprime bien. Sin navegador headless:
// puro pdf-lib (rápido y liviano en serverless).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { calcularCuota, formatMoneda, type Moneda } from "../finance.js";

// Subí esta versión cuando cambie el DISEÑO de la plantilla (fuerza regenerar
// aunque los datos no hayan cambiado).
const TEMPLATE_VERSION = "v1";
const BUCKET = "documentos"; // bucket público ya existente
const SITE = (process.env.SITE_URL || "https://www.ecovivadesarrollos.com").replace(/\/$/, "");

// ── Paleta de marca (de src/index.css) ──
const C = {
  ink: rgb(0.06, 0.14, 0.10), // verde-negro (texto)
  green: rgb(0.09, 0.47, 0.29), // primary  hsl(152 68% 28%)
  greenBright: rgb(0.086, 0.635, 0.286), // accent hsl(142 76% 36%)
  cream: rgb(0.985, 0.985, 0.97),
  panel: rgb(0.945, 0.965, 0.95),
  line: rgb(0.85, 0.89, 0.86),
  muted: rgb(0.36, 0.42, 0.38),
  white: rgb(1, 1, 1),
  red: rgb(0.86, 0.27, 0.27),
  amber: rgb(0.85, 0.6, 0.13),
};

type Idioma = "es" | "en";

interface ProjectMeta {
  name: string;
  moneda: Moneda;
  location: Record<Idioma, string>;
  tagline: Record<Idioma, string>;
  mapUrl: string;
  page: Record<Idioma, string>;
  hero: string;
  gallery: string[];
  highlights: Record<Idioma, string[]>;
}

const LOGO =
  "https://storage.googleapis.com/msgsndr/sQ4u1rK8p10tXr2LW5Cv/media/69000469edac70e1d55bc3f3.png";

const PROJECTS: Record<string, ProjectMeta> = {
  rio_celeste: {
    name: "Oasis Río Celeste",
    moneda: "USD",
    location: {
      es: "Katira de Guatuso, Zona Norte · Costa Rica",
      en: "Katira de Guatuso, Northern Zone · Costa Rica",
    },
    tagline: {
      es: "Su paraíso natural, con acceso privado al Río Celeste.",
      en: "Your natural paradise, with private access to the Río Celeste.",
    },
    mapUrl: "https://maps.app.goo.gl/aey2N8zucrgz3tLK9",
    page: { es: "/rio-celeste-oasis-detalle", en: "/en/rio-celeste-oasis-detalle" },
    hero: "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291a1efd53d7a3.jpeg",
    gallery: [
      "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1fe534c291af16553d7a1.jpeg",
      "https://storage.googleapis.com/msgsndr/hdVpvshZP3RGJQbxx8GA/media/68f1ffe2175e59ba63672f87.jpeg",
    ],
    highlights: {
      es: [
        "Acceso privado al Río Celeste",
        "A 10 min del Volcán Tenorio, 1 h de La Fortuna",
        "1.5 h del aeropuerto internacional de Liberia",
        "Zona de alta seguridad y naturaleza viva",
      ],
      en: [
        "Private access to the Río Celeste",
        "10 min from Tenorio Volcano, 1 h from La Fortuna",
        "1.5 h from Liberia international airport",
        "Safe area surrounded by living nature",
      ],
    },
  },
  llanada: {
    name: "Lomas de la Llanada",
    moneda: "CRC",
    location: {
      es: "La Llanada, a 5 min de Ciudad Quesada · San Carlos",
      en: "La Llanada, 5 min from Ciudad Quesada · San Carlos",
    },
    tagline: {
      es: "Vistas panorámicas, clima fresco y plusvalía en la Zona Norte.",
      en: "Panoramic views, cool climate and strong appreciation in the Northern Zone.",
    },
    mapUrl: "https://maps.app.goo.gl/Dfpd3j9mDmkqg9KMA",
    page: { es: "/lomas-de-la-llanada-detalle", en: "/en/lomas-de-la-llanada-detalle" },
    hero: "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95c1fa0c7535d7678f.jpeg",
    gallery: [
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95d4fb90fa691c3dfb.jpeg",
      "https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6977ce95a87beb359e18dcf7.jpeg",
    ],
    highlights: {
      es: [
        "Vistas a Ciudad Quesada y al Parque Juan Castro Blanco",
        "Clima fresco de montaña",
        "Cerca del hospital de San Carlos, comercio y educación",
        "Zona con alto potencial de plusvalía",
      ],
      en: [
        "Views of Ciudad Quesada and Juan Castro Blanco Park",
        "Cool mountain climate",
        "Near San Carlos hospital, shops and schools",
        "Area with strong appreciation potential",
      ],
    },
  },
};

const T = {
  es: {
    pricesTitle: "Precios y disponibilidad",
    fromPerM2: "por m²",
    lotsOf: "Lotes de",
    available: "Disponibles ahora",
    lotsTable: "Algunos lotes disponibles",
    lot: "Lote",
    size: "Tamaño",
    pricePerM2: "Precio/m²",
    total: "Total",
    primaCol: "Prima",
    noPrima: "Sin prima",
    financingTitle: "Financiamiento directo",
    financingBody:
      "Directo con la desarrolladora, sin fiador. Plazo hasta 20 años, tasa {rate}% anual (cuota fija). Llená el formulario y hay respuesta en hasta 72 horas.",
    example: "Ejemplo de cuota",
    forLot: "para un lote de",
    perMonth: "/mes",
    years: "años",
    withPrima: "incluye prima del 25%",
    whyTitle: "Por qué este proyecto",
    contactTitle: "Conversemos",
    phone: "WhatsApp / Tel: +506 8414 2111",
    seeOnline: "Ver el proyecto en línea, con mapa de lotes y fotos:",
    map: "Ubicación en el mapa:",
    disclaimer:
      "Precios y disponibilidad de referencia, se confirman según el lote al momento de la visita. La plusvalía tiende a darse en la zona; no constituye ganancia garantizada.",
    generated: "Generado el",
  },
  en: {
    pricesTitle: "Pricing & availability",
    fromPerM2: "per m²",
    lotsOf: "Lots of",
    available: "Available now",
    lotsTable: "Some available lots",
    lot: "Lot",
    size: "Size",
    pricePerM2: "Price/m²",
    total: "Total",
    primaCol: "Down pmt.",
    noPrima: "No down payment",
    financingTitle: "Direct financing",
    financingBody:
      "Directly with the developer, no co-signer. Term up to 20 years, {rate}% annual rate (fixed payment). Fill out the form and get an answer within 72 hours.",
    example: "Sample payment",
    forLot: "for a lot of",
    perMonth: "/mo",
    years: "years",
    withPrima: "includes 25% down payment",
    whyTitle: "Why this project",
    contactTitle: "Let's talk",
    phone: "WhatsApp / Phone: +506 8414 2111",
    seeOnline: "See the project online, with lot map and photos:",
    map: "Location on the map:",
    disclaimer:
      "Reference prices and availability, confirmed per lot at the time of the visit. Appreciation tends to occur in the area; it is not a guaranteed return.",
    generated: "Generated on",
  },
};

// ── Caché de assets remotos (fuentes/imágenes) entre invocaciones tibias ──
const assetCache = new Map<string, Uint8Array | null>();
async function fetchBytes(url: string): Promise<Uint8Array | null> {
  if (assetCache.has(url)) return assetCache.get(url) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = new Uint8Array(await res.arrayBuffer());
    assetCache.set(url, buf);
    return buf;
  } catch {
    assetCache.set(url, null);
    return null;
  }
}

interface Fonts {
  reg: PDFFont;
  semi: PDFFont;
  bold: PDFFont;
}

const MONT = {
  reg: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/montserrat/Montserrat_400Regular.ttf",
  semi: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/montserrat/Montserrat_600SemiBold.ttf",
  bold: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/montserrat/Montserrat_700Bold.ttf",
};

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  // Intenta Montserrat (fuente de marca). Si falla la descarga, cae a Helvetica.
  const [r, s, b] = await Promise.all([
    fetchBytes(MONT.reg),
    fetchBytes(MONT.semi),
    fetchBytes(MONT.bold),
  ]);
  if (r && s && b) {
    return {
      reg: await doc.embedFont(r, { subset: true }),
      semi: await doc.embedFont(s, { subset: true }),
      bold: await doc.embedFont(b, { subset: true }),
    };
  }
  const { StandardFonts } = await import("pdf-lib");
  return {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    semi: await doc.embedFont(StandardFonts.HelveticaBold),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

async function embedImage(doc: PDFDocument, url: string) {
  const bytes = await fetchBytes(url);
  if (!bytes) return null;
  try {
    if (/\.png(\?|$)/i.test(url)) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

// ── Lote como viene de Supabase ──
interface Lot {
  lot_number: number;
  section: string;
  size_m2: number;
  price_per_m2: number;
  price_total: number;
  currency: Moneda;
  status: string;
  requires_prima: boolean;
  prima_pct: number | null;
  updated_at: string;
}

interface PriceTier {
  pricePerM2: number;
  minSize: number;
  maxSize: number;
  exampleTotal: number;
}

function priceTiers(lots: Lot[]): PriceTier[] {
  const byPrice = new Map<number, Lot[]>();
  for (const l of lots) {
    const arr = byPrice.get(l.price_per_m2) || [];
    arr.push(l);
    byPrice.set(l.price_per_m2, arr);
  }
  return [...byPrice.entries()]
    .map(([pricePerM2, arr]) => {
      const sizes = arr.map((l) => l.size_m2);
      const minSize = Math.min(...sizes);
      const median = arr.slice().sort((a, b) => a.size_m2 - b.size_m2)[Math.floor(arr.length / 2)];
      return { pricePerM2, minSize, maxSize: Math.max(...sizes), exampleTotal: median.price_total };
    })
    .sort((a, b) => b.pricePerM2 - a.pricePerM2);
}

// ── Helpers de dibujo ──
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

class Doc {
  doc!: PDFDocument;
  page!: PDFPage;
  f!: Fonts;
  y = PAGE_H - MARGIN;

  async init() {
    this.doc = await PDFDocument.create();
    this.doc.registerFontkit(fontkit);
    this.f = await loadFonts(this.doc);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.cream });
    this.y = PAGE_H - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 24) this.newPage();
  }

  text(s: string, opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; gap?: number } = {}) {
    const font = opts.font || this.f.reg;
    const size = opts.size || 11;
    const lines = wrap(s, font, size, CONTENT_W - (opts.x ? opts.x - MARGIN : 0));
    for (const ln of lines) {
      this.ensure(size + 4);
      this.page.drawText(ln, { x: opts.x ?? MARGIN, y: this.y - size, size, font, color: opts.color || C.ink });
      this.y -= size + (opts.gap ?? 4);
    }
  }

  gap(h: number) {
    this.y -= h;
  }
}

function fmt(v: number, m: Moneda) {
  return formatMoneda(v, m);
}

export async function buildBrochure(proyecto: string, idioma: Idioma, lots: Lot[]): Promise<Uint8Array> {
  const meta = PROJECTS[proyecto];
  const t = T[idioma];
  const d = new Doc();
  await d.init();
  const { f } = d;

  const available = lots.filter((l) => l.status === "available");
  const tiers = priceTiers(available.length ? available : lots);

  // ── PORTADA: hero full-bleed arriba + banda verde (logo/título) debajo ──
  // pdf-lib no recorta imágenes; usamos "cover" centrado y la banda (dibujada
  // después) tapa el desborde inferior; el desborde superior se sale del lienzo.
  const HERO_H = 215;
  const BAND_H = 92;
  const hero = await embedImage(d.doc, meta.hero);
  if (hero) {
    const s = Math.max(PAGE_W / hero.width, HERO_H / hero.height);
    const dw = hero.width * s;
    const dh = hero.height * s;
    // Anclado por abajo en el borde superior de la banda: el exceso de alto se
    // sale por ARRIBA del lienzo (se recorta solo), nunca invade el contenido.
    d.page.drawImage(hero, {
      x: (PAGE_W - dw) / 2,
      y: PAGE_H - HERO_H,
      width: dw,
      height: dh,
    });
  } else {
    d.page.drawRectangle({ x: 0, y: PAGE_H - HERO_H, width: PAGE_W, height: HERO_H, color: C.greenBright });
  }

  const bandY = PAGE_H - HERO_H - BAND_H;
  d.page.drawRectangle({ x: 0, y: bandY, width: PAGE_W, height: BAND_H, color: C.green });
  // delgada línea de acento sobre la banda
  d.page.drawRectangle({ x: 0, y: bandY + BAND_H - 3, width: PAGE_W, height: 3, color: C.greenBright });

  const logo = await embedImage(d.doc, LOGO);
  if (logo) {
    const lw = 118;
    const lh = (logo.height / logo.width) * lw;
    d.page.drawImage(logo, { x: PAGE_W - MARGIN - lw, y: bandY + (BAND_H - lh) / 2, width: lw, height: lh });
  }
  d.page.drawText(meta.name, { x: MARGIN, y: bandY + 50, size: 23, font: f.bold, color: C.white });
  d.page.drawText(meta.location[idioma], { x: MARGIN, y: bandY + 30, size: 9.5, font: f.reg, color: rgb(0.86, 0.95, 0.9) });
  d.y = bandY - 28;

  d.text(meta.tagline[idioma], { font: f.semi, size: 14, color: C.green, gap: 8 });
  d.gap(4);

  // ── PRECIOS Y DISPONIBILIDAD ──
  sectionHeader(d, t.pricesTitle);
  for (const tier of tiers) {
    d.ensure(24);
    const sizeLabel =
      tier.minSize === tier.maxSize
        ? `${t.lotsOf} ${tier.minSize.toLocaleString()} m²`
        : `${t.lotsOf} ${tier.minSize.toLocaleString()}–${tier.maxSize.toLocaleString()} m²`;
    d.page.drawText(`${fmt(tier.pricePerM2, meta.moneda)} ${t.fromPerM2}`, {
      x: MARGIN, y: d.y - 14, size: 15, font: f.bold, color: C.green,
    });
    d.page.drawText(`${sizeLabel}  ·  ~${fmt(tier.exampleTotal, meta.moneda)}`, {
      x: MARGIN + 150, y: d.y - 13, size: 11, font: f.reg, color: C.muted,
    });
    d.y -= 24;
  }

  // pill de disponibilidad
  d.gap(4);
  d.ensure(26);
  const pill = `${available.length} ${t.available}`;
  const pw = f.semi.widthOfTextAtSize(pill, 11) + 24;
  d.page.drawRectangle({ x: MARGIN, y: d.y - 20, width: pw, height: 22, color: C.greenBright });
  d.page.drawText(pill, { x: MARGIN + 12, y: d.y - 14, size: 11, font: f.semi, color: C.white });
  d.y -= 34;

  // ── TABLA DE LOTES ──
  const sample = available.slice(0, 9);
  if (sample.length) {
    sectionHeader(d, t.lotsTable);
    drawLotTable(d, sample, meta.moneda, t);
  }

  // ── FINANCIAMIENTO ──
  sectionHeader(d, t.financingTitle);
  const rate = meta.moneda === "USD" ? 9 : 8;
  d.text(t.financingBody.replace("{rate}", String(rate)), { size: 11, color: C.ink, gap: 5 });
  d.gap(6);

  // ejemplo de cuota a partir de un lote disponible representativo
  const ref = sample[Math.floor(sample.length / 2)] || available[0] || lots[0];
  if (ref) {
    const primaPct = ref.requires_prima ? ref.prima_pct || 25 : 0;
    const r20 = calcularCuota({ monto: ref.price_total, moneda: meta.moneda, plazoAnios: 20, primaPct });
    d.ensure(54);
    d.page.drawRectangle({ x: MARGIN, y: d.y - 50, width: CONTENT_W, height: 50, color: C.panel });
    d.page.drawText(`${t.example} · ${t.forLot} ${ref.size_m2.toLocaleString()} m²`, {
      x: MARGIN + 14, y: d.y - 20, size: 10, font: f.semi, color: C.muted,
    });
    d.page.drawText(`${fmt(r20.cuotaMensual, meta.moneda)}${t.perMonth}`, {
      x: MARGIN + 14, y: d.y - 42, size: 20, font: f.bold, color: C.green,
    });
    const note = `20 ${t.years} · ${rate}%${primaPct ? ` · ${t.withPrima}` : ` · ${t.noPrima}`}`;
    d.page.drawText(note, { x: MARGIN + 200, y: d.y - 35, size: 10, font: f.reg, color: C.muted });
    d.y -= 62;
  }

  // ── POR QUÉ ──
  sectionHeader(d, t.whyTitle);
  for (const h of meta.highlights[idioma]) {
    d.ensure(18);
    d.page.drawCircle({ x: MARGIN + 4, y: d.y - 8, size: 2.5, color: C.greenBright });
    d.text(h, { x: MARGIN + 16, size: 11, gap: 5 });
  }
  d.gap(8);

  // ── CONTACTO ──
  sectionHeader(d, t.contactTitle);
  d.text(t.phone, { font: f.semi, size: 12, color: C.green, gap: 6 });
  d.text(`${t.seeOnline} ${SITE}${meta.page[idioma]}`, { size: 10, color: C.muted, gap: 4 });
  d.text(`${t.map} ${meta.mapUrl}`, { size: 10, color: C.muted, gap: 4 });

  // ── PIE en la última página ──
  const last = d.doc.getPages()[d.doc.getPageCount() - 1];
  last.drawLine({ start: { x: MARGIN, y: MARGIN + 34 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 34 }, thickness: 0.5, color: C.line });
  const disc = wrap(t.disclaimer, f.reg, 7.5, CONTENT_W);
  let dy = MARGIN + 22;
  for (const ln of disc) {
    last.drawText(ln, { x: MARGIN, y: dy, size: 7.5, font: f.reg, color: C.muted });
    dy -= 10;
  }

  return await d.doc.save();
}

function sectionHeader(d: Doc, title: string) {
  d.gap(10);
  d.ensure(28);
  d.page.drawRectangle({ x: MARGIN, y: d.y - 4, width: 22, height: 3, color: C.greenBright });
  d.page.drawText(title, { x: MARGIN, y: d.y - 20, size: 15, font: d.f.bold, color: C.ink });
  d.y -= 30;
}

function drawLotTable(d: Doc, lots: Lot[], moneda: Moneda, t: typeof T["es"]) {
  const cols = [MARGIN + 4, MARGIN + 70, MARGIN + 165, MARGIN + 270, MARGIN + 400];
  d.ensure(20);
  // encabezado
  d.page.drawRectangle({ x: MARGIN, y: d.y - 18, width: CONTENT_W, height: 18, color: C.green });
  const heads = [t.lot, t.size, t.pricePerM2, t.total, t.primaCol];
  heads.forEach((h, i) => d.page.drawText(h, { x: cols[i], y: d.y - 13, size: 9, font: d.f.semi, color: C.white }));
  d.y -= 18;
  lots.forEach((l, idx) => {
    d.ensure(17);
    if (idx % 2 === 0) d.page.drawRectangle({ x: MARGIN, y: d.y - 16, width: CONTENT_W, height: 16, color: C.panel });
    const row = [
      `#${l.lot_number}`,
      `${l.size_m2.toLocaleString()} m²`,
      fmt(l.price_per_m2, moneda),
      fmt(l.price_total, moneda),
      l.requires_prima ? `${l.prima_pct || 25}%` : t.noPrima,
    ];
    row.forEach((cell, i) =>
      d.page.drawText(cell, {
        x: cols[i], y: d.y - 12, size: 9,
        font: d.f.reg, color: i === 4 && l.requires_prima ? C.amber : C.ink,
      })
    );
    d.y -= 16;
  });
  d.y -= 6;
}

// ── Punto de entrada: devuelve la URL pública del folleto (cacheado) ──
export async function getBrochureUrl(
  db: SupabaseClient,
  proyecto: string,
  idioma: Idioma
): Promise<string> {
  if (!PROJECTS[proyecto]) throw new Error(`Proyecto desconocido: ${proyecto}`);

  const { data: lots, error } = await db
    .from("lots")
    .select("*")
    .eq("project", proyecto)
    .order("lot_number");
  if (error) throw new Error(`No pude leer lotes: ${error.message}`);
  const rows = (lots || []) as Lot[];

  // Huella de datos: versión de plantilla + última actualización + conteo + estados.
  const maxUpdated = rows.reduce((mx, l) => (l.updated_at > mx ? l.updated_at : mx), "");
  const statuses = rows.map((l) => `${l.lot_number}:${l.status}`).join(",");
  const fp = createHash("sha1")
    .update(`${TEMPLATE_VERSION}|${idioma}|${maxUpdated}|${rows.length}|${statuses}`)
    .digest("hex")
    .slice(0, 12);
  const path = `brochures/${proyecto}-${idioma}-${fp}.pdf`;

  const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // ¿Ya existe este folleto (misma huella)? Reusarlo.
  const { data: existing } = await db.storage
    .from(BUCKET)
    .list("brochures", { search: `${proyecto}-${idioma}-${fp}.pdf` });
  if (existing && existing.length) return publicUrl;

  // Generar + subir.
  const bytes = await buildBrochure(proyecto, idioma, rows);
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`No pude subir el folleto: ${upErr.message}`);

  return publicUrl;
}
