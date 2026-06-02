import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularCuota, formatMoneda, type Moneda } from "../finance";
import * as ghl from "../ghl";

// ── URLs de documentos (bucket público "documentos" en Supabase Storage) ──
const DOC_BASE =
  (process.env.SUPABASE_URL || "https://hujuifwfknlpdqgvogkf.supabase.co") +
  "/storage/v1/object/public/documentos";
const DOCS: Record<string, Record<string, string>> = {
  rio_celeste: { es: `${DOC_BASE}/rio-celeste-es.pdf`, en: `${DOC_BASE}/rio-celeste-en.pdf` },
  llanada: { es: `${DOC_BASE}/llanada-es.pdf` },
  llanada_frente_calle: { es: `${DOC_BASE}/llanada-frente-a-calle-es.pdf` },
};

const PROYECTO_LABEL: Record<string, string> = {
  rio_celeste: "Oasis Río Celeste",
  llanada: "Lomas de la Llanada",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface ConversationRow {
  id: string;
  channel: string;
  ghl_contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  proyecto_interes: string | null;
  calificado: boolean;
  [k: string]: unknown;
}

export interface ToolContext {
  db: SupabaseClient;
  convo: ConversationRow;
  patchConvo: (fields: Record<string, unknown>) => Promise<void>;
}

// ── Definiciones de tools para la API de Anthropic ──
export const TOOLS = [
  {
    name: "consultar_disponibilidad",
    description:
      "Consulta el inventario VIVO de lotes (disponibles/reservados/vendidos) de un proyecto. Úsala antes de afirmar disponibilidad o dar precios de lotes específicos.",
    input_schema: {
      type: "object",
      properties: {
        proyecto: { type: "string", enum: ["rio_celeste", "llanada"] },
        seccion: {
          type: "string",
          enum: ["bloque_1", "frente_a_calle", "general"],
          description: "Solo para Llanada: bloque_1 o frente_a_calle. Río Celeste usa general.",
        },
        tamano_min: { type: "number", description: "m² mínimos" },
        tamano_max: { type: "number", description: "m² máximos" },
        solo_disponibles: { type: "boolean", description: "Por defecto true" },
      },
      required: ["proyecto"],
    },
  },
  {
    name: "calcular_financiamiento",
    description:
      "Estima la cuota mensual (amortización francesa). Tasa USD 9 % / CRC 8 %. Aplica prima 25 % SOLO si es frente a calle de Llanada (pasa prima_pct=25).",
    input_schema: {
      type: "object",
      properties: {
        monto: { type: "number", description: "Precio total del lote" },
        moneda: { type: "string", enum: ["USD", "CRC"] },
        plazo_anios: { type: "number", enum: [5, 10, 15, 20] },
        prima_pct: { type: "number", description: "0 por defecto; 25 en frente a calle" },
      },
      required: ["monto", "moneda", "plazo_anios"],
    },
  },
  {
    name: "upsert_contacto",
    description:
      "Crea o actualiza el contacto en el CRM (GHL). Llama apenas tengas un dato nuevo. El código de país es OBLIGATORIO en el teléfono.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        apellido: { type: "string" },
        correo: { type: "string" },
        telefono: { type: "string", description: "Número local sin código de país" },
        codigo_pais: { type: "string", description: "Ej: +506, +1" },
        pais: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "set_proyecto_interes",
    description: "Fija el proyecto de interés del contacto cuando muestra interés claro.",
    input_schema: {
      type: "object",
      properties: { proyecto: { type: "string", enum: ["rio_celeste", "llanada"] } },
      required: ["proyecto"],
    },
  },
  {
    name: "enviar_documento_proyecto",
    description: "Comparte el material (PDF) del proyecto. Pregunta antes idioma y, en Llanada, si quiere el de frente a calle.",
    input_schema: {
      type: "object",
      properties: {
        proyecto: { type: "string", enum: ["rio_celeste", "llanada"] },
        idioma: { type: "string", enum: ["es", "en"] },
        frente_a_calle: { type: "boolean", description: "Solo Llanada: documento de lotes frente a calle" },
      },
      required: ["proyecto", "idioma"],
    },
  },
  {
    name: "enviar_formulario_financiamiento",
    description: "Comparte el enlace del formulario de financiamiento cuando preguntan cómo aplicar.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "consultar_horarios_disponibles",
    description: "Devuelve los cupos REALES del calendario para ofrecer horarios de visita. Úsala antes de proponer horas.",
    input_schema: {
      type: "object",
      properties: {
        fecha_desde: { type: "string", description: "YYYY-MM-DD" },
        fecha_hasta: { type: "string", description: "YYYY-MM-DD (opcional, por defecto +7 días)" },
      },
      required: ["fecha_desde"],
    },
  },
  {
    name: "agendar_visita",
    description:
      "Agenda la visita presencial en el calendario. Requiere contacto completo y un cupo válido (verifica con consultar_horarios_disponibles).",
    input_schema: {
      type: "object",
      properties: {
        proyecto: { type: "string", enum: ["rio_celeste", "llanada"] },
        fecha: { type: "string", description: "YYYY-MM-DD" },
        hora: { type: "string", description: "HH:MM en 24h, hora de Costa Rica" },
        presupuesto_mensual: { type: "string", description: "Cuota mensual que puede pagar (opcional)" },
      },
      required: ["proyecto", "fecha", "hora"],
    },
  },
  {
    name: "notificar_asesor",
    description: "Escala a un asesor humano (dispara un workflow de GHL). Úsala en casos fuera de tu alcance.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
    },
  },
];

// ── Helpers ──
function crISO(fecha: string, hora: string): string {
  // Costa Rica = UTC-6 fijo (sin horario de verano). Sin el hack de -1h de n8n.
  const [h, m] = hora.split(":");
  return `${fecha}T${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}:00-06:00`;
}
function fechaLegibleES(fecha: string): string {
  const [y, mo, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const dia = new Intl.DateTimeFormat("es-CR", { weekday: "long", timeZone: "America/Costa_Rica" }).format(dt);
  return `${dia} ${d} de ${MESES[mo - 1]} de ${y}`;
}
function horaLegible(hora: string): string {
  let [h, m] = hora.split(":").map(Number);
  const p = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${p}`;
}

// ── Ejecutor central ──
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case "consultar_disponibilidad": {
      const proyecto = input.proyecto as string;
      const soloDisp = input.solo_disponibles !== false;
      let q = ctx.db.from("lots").select("*").eq("project", proyecto).order("size_m2");
      if (input.seccion) q = q.eq("section", input.seccion as string);
      if (soloDisp) q = q.eq("status", "available");
      if (input.tamano_min) q = q.gte("size_m2", input.tamano_min as number);
      if (input.tamano_max) q = q.lte("size_m2", input.tamano_max as number);
      const { data, error } = await q;
      if (error) return `Error consultando disponibilidad: ${error.message}`;
      if (!data || !data.length) return "No hay lotes que cumplan esos criterios ahora mismo.";
      const moneda = data[0].currency;
      const precios = data.map((l) => Number(l.price_per_m2));
      const tamanos = data.map((l) => Number(l.size_m2));
      const resumen = {
        proyecto: PROYECTO_LABEL[proyecto],
        disponibles: data.length,
        rango_m2: `${Math.min(...tamanos)}–${Math.max(...tamanos)} m²`,
        rango_precio_m2: `${formatMoneda(Math.min(...precios), moneda)}–${formatMoneda(Math.max(...precios), moneda)} por m²`,
        moneda,
        lotes: data.slice(0, 10).map((l) => ({
          lote: l.lot_number,
          m2: Number(l.size_m2),
          precio_total: formatMoneda(Number(l.price_total), moneda),
          requiere_prima: l.requires_prima ? `${l.prima_pct}%` : "no",
        })),
      };
      return JSON.stringify(resumen);
    }

    case "calcular_financiamiento": {
      const r = calcularCuota({
        monto: input.monto as number,
        moneda: input.moneda as Moneda,
        plazoAnios: input.plazo_anios as number,
        primaPct: (input.prima_pct as number) || 0,
      });
      return JSON.stringify({
        cuota_mensual: formatMoneda(r.cuotaMensual, r.moneda),
        monto_financiado: formatMoneda(r.montoFinanciado, r.moneda),
        prima: r.primaPct ? `${formatMoneda(r.prima, r.moneda)} (${r.primaPct}%)` : "sin prima",
        plazo: `${r.plazoAnios} años`,
        tasa_anual: `${r.tasaAnual}%`,
      });
    }

    case "upsert_contacto": {
      const nombre = (input.nombre as string) || (ctx.convo.contact_name?.split(" ")[0] ?? undefined);
      const apellido = input.apellido as string | undefined;
      const correo = (input.correo as string) || ctx.convo.contact_email || undefined;
      const codigo = (input.codigo_pais as string) || "";
      const tel = input.telefono as string | undefined;
      const phone = tel ? `${codigo}${tel}`.replace(/\s+/g, "") : ctx.convo.contact_phone || undefined;
      const contactId = await ghl.upsertContact({
        firstName: nombre,
        lastName: apellido,
        email: correo,
        phone,
      });
      await ctx.patchConvo({
        ghl_contact_id: contactId,
        contact_name: [nombre, apellido].filter(Boolean).join(" ") || ctx.convo.contact_name,
        contact_email: correo ?? ctx.convo.contact_email,
        contact_phone: phone ?? ctx.convo.contact_phone,
      });
      return `Contacto guardado (id ${contactId}).`;
    }

    case "set_proyecto_interes": {
      const proyecto = input.proyecto as string;
      const label = PROYECTO_LABEL[proyecto];
      if (ctx.convo.ghl_contact_id) {
        await ghl.updateContactCustomFields(ctx.convo.ghl_contact_id, [
          { id: ghl.CF.proyecto, value: label },
        ]);
      }
      await ctx.patchConvo({ proyecto_interes: label });
      return `Proyecto de interés fijado: ${label}.`;
    }

    case "enviar_documento_proyecto": {
      const proyecto = input.proyecto as string;
      const idioma = (input.idioma as string) || "es";
      const key = proyecto === "llanada" && input.frente_a_calle ? "llanada_frente_calle" : proyecto;
      const url = DOCS[key]?.[idioma] || DOCS[key]?.es;
      if (!url) return "No hay documento disponible para esa combinación.";
      return JSON.stringify({ enviado: true, url, nota: "Comparte este enlace con el cliente." });
    }

    case "enviar_formulario_financiamiento": {
      const url = process.env.SURVEY_URL || "https://www.ecovivadesarrollos.com/financiamiento";
      return JSON.stringify({ url, nota: "Comparte el enlace del formulario." });
    }

    case "consultar_horarios_disponibles": {
      const desde = input.fecha_desde as string;
      const hasta = (input.fecha_hasta as string) || desde;
      const startMs = new Date(`${desde}T00:00:00-06:00`).getTime();
      const endMs = new Date(`${hasta}T23:59:59-06:00`).getTime() + 7 * 24 * 3600 * 1000 * (input.fecha_hasta ? 0 : 1);
      try {
        const slots = await ghl.getFreeSlots({ startMs, endMs });
        const out = Object.entries(slots).map(([fecha, v]) => ({
          fecha,
          horas: (v.slots || []).map((s) => horaLegible(s.slice(11, 16))),
        }));
        if (!out.length) return "No hay cupos disponibles en ese rango. Ofrece otra fecha.";
        return JSON.stringify(out);
      } catch (e) {
        return `No pude consultar el calendario: ${(e as Error).message}`;
      }
    }

    case "agendar_visita": {
      const proyecto = input.proyecto as string;
      const label = PROYECTO_LABEL[proyecto];
      const fecha = input.fecha as string;
      const hora = input.hora as string;
      let contactId = ctx.convo.ghl_contact_id;
      if (!contactId) {
        if (!ctx.convo.contact_name && !ctx.convo.contact_phone && !ctx.convo.contact_email) {
          return "Faltan datos de contacto. Pide nombre, teléfono (con código de país) y correo antes de agendar.";
        }
        contactId = await ghl.upsertContact({
          firstName: ctx.convo.contact_name?.split(" ")[0],
          lastName: ctx.convo.contact_name?.split(" ").slice(1).join(" "),
          email: ctx.convo.contact_email || undefined,
          phone: ctx.convo.contact_phone || undefined,
        });
        await ctx.patchConvo({ ghl_contact_id: contactId });
      }
      const fechaLeg = fechaLegibleES(fecha);
      const horaLeg = horaLegible(hora);
      // Custom fields (replica del flujo n8n) + tag de lead
      await ghl.updateContactCustomFields(contactId, [
        { id: ghl.CF.proyecto, value: label },
        { id: ghl.CF.fechaVisita, value: fecha },
        { id: ghl.CF.fechaLegible, value: fechaLeg },
        { id: ghl.CF.horaCita, value: horaLeg },
        ...(input.presupuesto_mensual
          ? [{ id: ghl.CF.presupuesto, value: input.presupuesto_mensual as string }]
          : []),
      ]);
      await ghl.addTags(contactId, [process.env.GHL_LEAD_TAG || "Leads 2026"]);
      await ghl.bookAppointment({
        contactId,
        startTime: crISO(fecha, hora),
        title: `Visita ${label} — ${ctx.convo.contact_name || "Lead"}`,
      });
      await ctx.patchConvo({ proyecto_interes: label, calificado: true });
      return `Visita agendada para ${fechaLeg} a las ${horaLeg} en ${label}. Punto de encuentro: el proyecto.`;
    }

    case "notificar_asesor": {
      if (ctx.convo.ghl_contact_id) {
        await ghl.addTags(ctx.convo.ghl_contact_id, [
          process.env.GHL_ESCALATION_TAG || "eco-escalar-asesor",
        ]);
      }
      return "Listo, un asesor humano dará seguimiento. Motivo registrado.";
    }

    default:
      return `Tool desconocida: ${name}`;
  }
}
