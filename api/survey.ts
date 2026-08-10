import { randomUUID } from "node:crypto";
import {
  SURVEY_CF,
  upsertContact,
  updateContactCustomFields,
  addNote,
  type UpsertContactInput,
} from "./_lib/ghl.js";
import { supabaseAdmin } from "./_lib/supabase.js";

// /api/survey — recibe la "Aplicación de Financiamiento" (/survey) y la deposita
// en GoHighLevel: upsert de contacto + custom fields + documentos en Supabase
// Storage (URL pública hacia los campos FILE_UPLOAD/SIGNATURE) + nota resumen.
//
// POST body (JSON):
// {
//   tipoId, numeroId, nombre, apellidos, phone, email, consent,
//   casaHabitacion, ubicacionResidencia, poseeInmuebles, poseeVehiculo,
//   estadoCivil, gradoAcademico, dependientes,
//   poseeDeudas, pensionado, tarjetasCredito, sugef,
//   cedulaFrontal?, cedulaPosterior?, firma?   // data URLs (base64) opcionales
// }

const BUCKET = "documentos"; // bucket público ya existente

interface SurveyBody {
  tipoId?: string;
  numeroId?: string;
  nombre?: string;
  apellidos?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
  casaHabitacion?: string;
  ubicacionResidencia?: string;
  poseeInmuebles?: string;
  poseeVehiculo?: string;
  estadoCivil?: string;
  gradoAcademico?: string;
  dependientes?: string;
  poseeDeudas?: string;
  pensionado?: string;
  tarjetasCredito?: string;
  sugef?: string;
  cedulaFrontal?: string | null;
  cedulaPosterior?: string | null;
  firma?: string | null;
}

// Normaliza un teléfono de Costa Rica a E.164. Si ya trae '+', se respeta.
function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 8) return `+506${digits}`; // número local CR
  return `+${digits}`;
}

// Sube un data URL (data:image/...;base64,XXXX) a Storage y devuelve la URL pública.
async function uploadDataUrl(
  db: ReturnType<typeof supabaseAdmin>,
  dataUrl: string,
  path: string
): Promise<string | null> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  // Límite defensivo: ~6 MB por archivo ya comprimido en el cliente.
  if (bytes.length > 6 * 1024 * 1024) return null;
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "bin";
  const fullPath = `${path}.${ext}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(fullPath, bytes, { contentType, upsert: true });
  if (error) {
    console.error("survey upload error", error.message);
    return null;
  }
  return db.storage.from(BUCKET).getPublicUrl(fullPath).data.publicUrl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const b = (req.body ?? {}) as SurveyBody;

  // Validación mínima (lo mismo que el survey original exige).
  if (!b.nombre || !b.apellidos) return res.status(400).json({ error: "Faltan nombre y apellidos" });
  if (!b.email && !b.phone) return res.status(400).json({ error: "Falta correo o teléfono" });
  if (!b.consent) return res.status(400).json({ error: "Debe aceptar el tratamiento de datos (Ley 8968)" });

  try {
    // ── 1. Campos de texto / opciones / radio → custom fields directos ──
    const cf: { id: string; value: string }[] = [];
    const put = (id: string, value?: string) => {
      if (value && value.trim()) cf.push({ id, value: value.trim() });
    };
    put(SURVEY_CF.tipoId, b.tipoId);
    put(SURVEY_CF.numeroId, b.numeroId);
    put(SURVEY_CF.casaHabitacion, b.casaHabitacion);
    put(SURVEY_CF.ubicacionResidencia, b.ubicacionResidencia);
    put(SURVEY_CF.poseeInmuebles, b.poseeInmuebles);
    put(SURVEY_CF.poseeVehiculo, b.poseeVehiculo);
    put(SURVEY_CF.estadoCivil, b.estadoCivil);
    put(SURVEY_CF.gradoAcademico, b.gradoAcademico);
    put(SURVEY_CF.dependientes, b.dependientes);
    put(SURVEY_CF.poseeDeudas, b.poseeDeudas);
    put(SURVEY_CF.pensionado, b.pensionado);
    put(SURVEY_CF.tarjetasCredito, b.tarjetasCredito);
    put(SURVEY_CF.sugef, b.sugef);

    // El upsert lleva SOLO los datos críticos del lead (nombre, contacto, tags).
    // Así, aunque GHL rechace algún custom field de opción mal configurado, el
    // contacto siempre se crea y no perdemos el lead.
    const contactInput: UpsertContactInput = {
      firstName: b.nombre,
      lastName: b.apellidos,
      email: b.email || undefined,
      phone: normalizePhone(b.phone),
      tags: ["aplicacion-financiamiento", "survey-web"],
    };

    const contactId = await upsertContact(contactInput);

    // ── 2. Documentos (opcionales) → Supabase Storage → URL en GHL ──
    const db = supabaseAdmin();
    const base = `survey/${contactId}/${randomUUID().slice(0, 8)}`;
    const docFields: { id: string; value: string }[] = [];
    const docLinks: string[] = [];

    if (b.cedulaFrontal) {
      const url = await uploadDataUrl(db, b.cedulaFrontal, `${base}-cedula-frontal`);
      if (url) {
        docFields.push({ id: SURVEY_CF.cedulaFrontal, value: url });
        docLinks.push(`Cédula (frontal): ${url}`);
      }
    }
    if (b.cedulaPosterior) {
      const url = await uploadDataUrl(db, b.cedulaPosterior, `${base}-cedula-posterior`);
      if (url) {
        docFields.push({ id: SURVEY_CF.cedulaPosterior, value: url });
        docLinks.push(`Cédula (posterior): ${url}`);
      }
    }
    if (b.firma) {
      const url = await uploadDataUrl(db, b.firma, `${base}-firma`);
      if (url) {
        docFields.push({ id: SURVEY_CF.firma, value: url });
        docLinks.push(`Firma: ${url}`);
      }
    }

    // ── 3. Custom fields (datos del estudio + documentos) — no fatal ──
    const allFields = [...cf, ...docFields];
    if (allFields.length) {
      try {
        await updateContactCustomFields(contactId, allFields);
      } catch (e) {
        // Si GHL rechaza algún campo de opción, lo registramos pero NO fallamos:
        // la nota de abajo deja todos los datos visibles en el contacto.
        console.error("survey custom fields error", e);
      }
    }

    // ── 4. Nota resumen en el timeline del contacto (siempre visible) ──
    const resumen = [
      "📋 Aplicación de Financiamiento (web /survey)",
      `Identificación: ${b.tipoId || "—"} ${b.numeroId || ""}`.trim(),
      `Casa de habitación: ${b.casaHabitacion || "—"} · Residencia: ${b.ubicacionResidencia || "—"}`,
      `Inmuebles: ${b.poseeInmuebles || "—"} · Vehículo: ${b.poseeVehiculo || "—"}`,
      `Estado civil: ${b.estadoCivil || "—"} · Grado académico: ${b.gradoAcademico || "—"} · Dependientes: ${b.dependientes || "—"}`,
      `Deudas: ${b.poseeDeudas || "—"} · Pensionado: ${b.pensionado || "—"} · Tarjetas de crédito: ${b.tarjetasCredito || "—"}`,
      `Autorización Sugef: ${b.sugef || "—"}`,
      docLinks.length ? "\nDocumentos:\n" + docLinks.join("\n") : "Documentos: no adjuntados",
    ].join("\n");

    try {
      await addNote(contactId, resumen);
    } catch (e) {
      console.error("survey note error", e);
    }

    return res.status(200).json({ ok: true, contactId });
  } catch (e) {
    console.error("survey error", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
