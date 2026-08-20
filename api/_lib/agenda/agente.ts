// api/_lib/agenda/agente.ts
//
// El agente conversacional del bot de Telegram: entiende lenguaje natural
// ("agendá a María el jueves a las 10, su correo es maria@x.com") y decide
// qué hacer con la agenda de Alina y Alejandro.
//
// LA REGLA QUE DEFINE ESTE ARCHIVO: el bucle NO ejecuta las herramientas de
// escritura (crear, mover, editar o cancelar una cita). En cuanto el modelo
// pide una de esas cuatro, el turno CORTA ahí mismo y se devuelve la acción
// propuesta para que una persona la confirme. Mandarle un correo a un
// cliente es irreversible — ya lo leyó — así que ninguna escritura pasa sin
// que Alina o Alejandro la hayan visto escrita primero.
//
// Por eso el bucle es manual y no el "tool runner" automático del SDK: ese
// runner ejecuta la herramienta apenas el modelo la pide, y acá la
// confirmación no es un gancho síncrono dentro de esta llamada — el turno
// se corta, se manda un mensaje a Telegram con botones, y la confirmación
// llega minutos después en OTRA invocación del webhook, en otro proceso.
// Un bucle automático no puede modelar ese corte.
//
// Solo `buscar_citas` (la única lectura) se ejecuta sola y realimenta el
// bucle: no cambia nada, así que no hay nada que confirmar.

import Anthropic from "@anthropic-ai/sdk";
import { listarCitas, obtenerCita } from "./db.js";
import type { Cita } from "./db.js";

// Datos de configuración del modelo, verificados contra la API real (ver el
// brief de la tarea): no tocar sin volver a verificar.
const MODELO = process.env.AGENDA_MODEL || "claude-opus-5";
// El pensamiento adaptativo está activo por defecto en este modelo y
// max_tokens lo cubre junto con la respuesta. Con un valor corto (ej. 16) la
// respuesta vuelve VACÍA con stop_reason "max_tokens" — no truncada, vacía.
// Por eso 4096 no es holgura: es lo mínimo para no fallar en silencio.
const MAX_TOKENS = 4096;
const MAX_VUELTAS = 6;
const TZ = "America/Costa_Rica";

let _cliente: Anthropic | null = null;
function cliente(): Anthropic {
  if (!_cliente) _cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _cliente;
}

// ── Tipos públicos ──

// Un mensaje del historial reciente de la conversación (lo carga y guarda
// quien llama, típicamente el webhook, desde la tabla agenda_mensajes).
export interface Mensaje {
  rol: "usuario" | "agente";
  texto: string;
}

export interface AccionPropuesta {
  herramienta: "crear_cita" | "mover_cita" | "editar_cita" | "cancelar_cita";
  entrada: Record<string, unknown>;
}

export type Resultado =
  | { tipo: "texto"; texto: string }
  | { tipo: "confirmar"; accion: AccionPropuesta; resumen: string };

// Las cuatro herramientas que cambian datos. El bucle las intercepta por
// NOMBRE, sin mirar si el modelo llenó bien los campos: alcanza con que haya
// elegido una de estas cuatro para que el turno corte y la acción se
// devuelva a confirmar. Ninguna se ejecuta sola.
export const ESCRITURAS: ReadonlySet<string> = new Set([
  "crear_cita",
  "mover_cita",
  "editar_cita",
  "cancelar_cita",
]);

// ── Las cinco herramientas ──
//
// Sin `strict: true` a propósito: varias tienen campos opcionales, y el modo
// estricto exige un esquema cerrado incómodo para eso. La validación de lo
// que el modelo manda vive en el ejecutor (más abajo, solo aplica a la
// lectura: las escrituras nunca se ejecutan, así que no hay nada que
// validar antes de cortar el turno).
const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "buscar_citas",
    description:
      "Busca citas en un rango de fechas. Usala antes de mover, editar o cancelar cualquier cita, " +
      "para encontrar su id: nunca inventes un id. También servís para responder preguntas del tipo " +
      '"¿qué tengo el jueves?" o "¿hay algo agendado esta semana?". Devuelve id, cliente, fecha, hora ' +
      "y lugar de cada cita encontrada.",
    input_schema: {
      type: "object",
      properties: {
        desde: {
          type: "string",
          description: "Inicio del rango, en ISO (ej. \"2026-08-21\" o \"2026-08-21T00:00:00-06:00\").",
        },
        hasta: {
          type: "string",
          description: "Fin del rango, en ISO (ej. \"2026-08-28\" o \"2026-08-28T23:59:59-06:00\").",
        },
        incluir_canceladas: {
          type: "boolean",
          description: "Si se deben incluir citas canceladas. Por defecto no se incluyen.",
        },
      },
      required: ["desde", "hasta"],
    },
  },
  {
    name: "crear_cita",
    description:
      "Agenda una cita nueva. Usala SOLO cuando ya tenés los cuatro datos obligatorios confirmados por " +
      "la persona: nombre del cliente, correo del cliente, fecha y hora exactas (absolutas, en ISO con " +
      "offset -06:00) y lugar. El correo es obligatorio porque de ahí sale la invitación de calendario y " +
      "los recordatorios: si no lo tenés, preguntalo en el chat en vez de llamar a esta herramienta con un " +
      "valor inventado. Llamarla NO agenda todavía: la persona tiene que confirmar antes de que la cita " +
      "quede creada de verdad.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string", description: "Nombre del cliente." },
        cliente_email: { type: "string", description: "Correo del cliente. Obligatorio." },
        cliente_telefono: { type: "string", description: "Teléfono del cliente, si lo dieron." },
        inicio: {
          type: "string",
          description:
            'Fecha y hora absolutas de la cita, en ISO con offset -06:00 (ej. "2026-08-21T10:00:00-06:00"). ' +
            'Nunca un "mañana" o "el jueves" sin resolver.',
        },
        lugar: { type: "string", description: "Dónde es la cita (dirección o nombre del proyecto/lote)." },
        notas: { type: "string", description: "Notas internas para Alina/Alejandro, opcionales." },
      },
      required: ["cliente_nombre", "cliente_email", "inicio", "lugar"],
    },
  },
  {
    name: "mover_cita",
    description:
      "Reagenda una cita existente a otra fecha u hora. Necesitás su id: buscalo antes con buscar_citas, " +
      "nunca lo inventes. Si lo que cambia es el nombre, el correo o el lugar (no la fecha), usá editar_cita " +
      "en su lugar. Llamarla NO mueve nada todavía: la persona tiene que confirmar.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Id de la cita, obtenido con buscar_citas." },
        inicio: {
          type: "string",
          description:
            'Nueva fecha y hora, en ISO con offset -06:00 (ej. "2026-08-21T10:00:00-06:00"). ' +
            'Nunca un "mañana" sin resolver.',
        },
      },
      required: ["id", "inicio"],
    },
  },
  {
    name: "editar_cita",
    description:
      "Cambia datos de una cita existente que NO son la fecha/hora (para eso está mover_cita): nombre, " +
      "correo o teléfono del cliente, lugar, o notas. Necesitás su id: buscalo antes con buscar_citas, " +
      "nunca lo inventes. Mandá solo los campos que de verdad cambian, no repitas los que quedan igual. " +
      "Llamarla NO edita nada todavía: la persona tiene que confirmar.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Id de la cita, obtenido con buscar_citas." },
        cliente_nombre: { type: "string" },
        cliente_email: { type: "string" },
        cliente_telefono: { type: "string" },
        lugar: { type: "string" },
        notas: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "cancelar_cita",
    description:
      "Cancela una cita existente. Necesitás su id: buscalo antes con buscar_citas, nunca lo inventes. " +
      "Cancelar le manda un correo de cancelación al cliente, así que llamarla NO cancela nada todavía: " +
      "la persona tiene que confirmar.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Id de la cita, obtenido con buscar_citas." },
        motivo: { type: "string", description: "Motivo de la cancelación, opcional (queda en la bitácora)." },
      },
      required: ["id"],
    },
  },
];

// ── El prompt del sistema ──

// Formato largo en español: "miércoles, 19 de agosto de 2026, 12:00 p. m.".
// Se usa tanto para decirle al modelo qué hora es "ahora" como para el
// resumen de confirmación (misma vara: si alguna fecha se lee rara, se nota
// en los dos lugares por igual).
function fechaHoraLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(fecha);
}

function promptSistema(ahora: Date): string {
  const fechaHora = fechaHoraLarga(ahora);
  return [
    `Sos el asistente de agenda de EcoViva para Alina y Alejandro. Ahora mismo es ${fechaHora} ` +
      `(America/Costa_Rica), hora de Costa Rica.`,
    "La agenda es compartida entre los dos: cualquiera de las dos personas puede ver, crear, mover, " +
      "editar o cancelar cualquier cita, no solo las suyas.",
    'Toda fecha que produzcas va absoluta, en ISO con offset -06:00 (ej. "2026-08-21T10:00:00-06:00"). ' +
      'Nunca dejes un "mañana" o "el jueves" sin resolver: resolvelo vos mismo usando la fecha de hoy de arriba.',
    "Para agendar una cita necesitás cuatro datos: nombre del cliente, correo del cliente, fecha y hora, " +
      "y lugar. El correo es obligatorio: sin él no sale la invitación de calendario ni los recordatorios. " +
      "Si falta alguno de estos datos, preguntalo en el chat — nunca lo inventes ni asumas un valor.",
    "Antes de mover, editar o cancelar una cita necesitás saber CUÁL: buscá primero con buscar_citas para " +
      "encontrar su id. Nunca inventes un id.",
    "Respondé corto, como un mensaje de Telegram entre compañeros de trabajo. Sin encabezados ni listas " +
      "con viñetas, salvo que haya varias citas que enumerar.",
    "Respondé siempre en español de Costa Rica, con voseo, sin importar en qué idioma te escriban.",
    "Nunca digas que ya hiciste algo: crear, mover, editar o cancelar una cita es algo que VOS PROPONÉS, " +
      "y todavía tiene que confirmarlo una persona antes de que pase de verdad.",
  ].join("\n\n");
}

// ── Ejecución de la única lectura (buscar_citas) ──

function campoTexto(entrada: Record<string, unknown>, clave: string): string | undefined {
  const v = entrada[clave];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Costa Rica no tiene horario de verano: el offset es siempre -06:00 fijo, así
// que medianoche en Costa Rica es siempre las 06:00 UTC del mismo día
// calendario. Es la MISMA idea que `inicioDeHoyCR` en api/telegram/webhook.ts
// (no se importa desde acá a propósito: un módulo de dominio no debería
// depender de una ruta de API), solo que para una fecha cualquiera que venga
// del modelo, no solo "hoy". Si `txt` ya trae hora (y offset u hora en UTC con
// "Z"), se respeta tal cual con el parser nativo — el ajuste es solo para
// fechas "peladas" (AAAA-MM-DD), porque `new Date("2026-08-21")` sin este
// ajuste las lee como medianoche UTC, seis horas antes de lo que es medianoche
// acá, y eso corre el rango de búsqueda entero.
function interpretarFecha(txt: string): Date | null {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/;
  if (soloFecha.test(txt)) {
    const [anio, mes, dia] = txt.split("-").map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia, 6, 0, 0, 0));
  }
  const fecha = new Date(txt);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

async function ejecutarBuscarCitas(
  entrada: Record<string, unknown>,
): Promise<{ texto: string; esError: boolean }> {
  const desdeTxt = campoTexto(entrada, "desde");
  const hastaTxt = campoTexto(entrada, "hasta");
  const desde = desdeTxt ? interpretarFecha(desdeTxt) : null;
  const hasta = hastaTxt ? interpretarFecha(hastaTxt) : null;
  if (!desde || !hasta) {
    return {
      esError: true,
      texto:
        'Mandá "desde" y "hasta" como fechas válidas en ISO (por ejemplo "2026-08-21" o ' +
        '"2026-08-21T10:00:00-06:00").',
    };
  }

  let citas: Cita[];
  try {
    citas = await listarCitas({
      desde,
      hasta,
      incluirCanceladas: entrada.incluir_canceladas === true,
    });
  } catch (e) {
    // El detalle crudo del error nunca sale hacia afuera: se loguea acá y
    // el modelo (y después la persona) reciben solo un mensaje genérico.
    console.error("agenda/agente: fallo al buscar citas", e);
    return { esError: true, texto: "No pude consultar la agenda ahora mismo. Probá de nuevo en un momento." };
  }

  if (!citas.length) return { esError: false, texto: "No hay citas en ese rango." };
  const lineas = citas.map(
    (c) => `id: ${c.id} · ${fechaHoraLarga(new Date(c.inicio))} · ${c.cliente_nombre} · ${c.lugar}`,
  );
  return { esError: false, texto: lineas.join("\n") };
}

async function ejecutarLectura(
  nombre: string,
  entrada: Record<string, unknown>,
): Promise<{ texto: string; esError: boolean }> {
  if (nombre === "buscar_citas") return ejecutarBuscarCitas(entrada);
  // No debería pasar (son las únicas herramientas que se ofrecen), pero si el
  // modelo alucina un nombre, se le avisa en vez de tirar.
  return { esError: true, texto: `No tengo una herramienta llamada "${nombre}".` };
}

// ── El resumen de la confirmación ──
//
// Es lo último que la persona lee antes de tocar "Confirmar": la última
// defensa contra una fecha mal interpretada. Por eso la fecha va en formato
// largo en español y no en ISO crudo, y por eso se arma con lo que HAY —
// nunca revienta si al modelo le faltó algún campo, porque la interceptación
// de una escritura pasa igual (ver el bucle) y el resumen tiene que existir
// siempre, aunque quede incompleto.

async function citaParaResumen(entrada: Record<string, unknown>): Promise<Cita | null> {
  const id = campoTexto(entrada, "id");
  if (!id) return null;
  try {
    return await obtenerCita(id);
  } catch (e) {
    console.error("agenda/agente: fallo al buscar la cita para el resumen", e);
    return null;
  }
}

function resumenCrear(entrada: Record<string, unknown>): string {
  const nombre = campoTexto(entrada, "cliente_nombre") ?? "(sin nombre)";
  const email = campoTexto(entrada, "cliente_email") ?? "(sin correo)";
  const inicioTxt = campoTexto(entrada, "inicio");
  const inicio = inicioTxt ? new Date(inicioTxt) : null;
  const fecha = inicio && !Number.isNaN(inicio.getTime()) ? fechaHoraLarga(inicio) : "(sin fecha)";
  const lugar = campoTexto(entrada, "lugar") ?? "(sin lugar)";
  return `Crear cita nueva\n${fecha}\n${nombre} — ${email}\n${lugar}`;
}

async function resumenMover(entrada: Record<string, unknown>): Promise<string> {
  const cita = await citaParaResumen(entrada);
  const inicioTxt = campoTexto(entrada, "inicio");
  const inicio = inicioTxt ? new Date(inicioTxt) : null;
  const fecha = inicio && !Number.isNaN(inicio.getTime()) ? fechaHoraLarga(inicio) : "(sin fecha nueva)";
  if (!cita) {
    const id = campoTexto(entrada, "id") ?? "?";
    return `Mover cita (id ${id}) a ${fecha}\nNo encontré los datos de esa cita para mostrarlos acá.`;
  }
  return `Mover cita a ${fecha}\n${cita.cliente_nombre} — ${cita.cliente_email}\n${cita.lugar}`;
}

async function resumenEditar(entrada: Record<string, unknown>): Promise<string> {
  const cita = await citaParaResumen(entrada);
  const nombre = campoTexto(entrada, "cliente_nombre") ?? cita?.cliente_nombre ?? "(sin nombre)";
  const email = campoTexto(entrada, "cliente_email") ?? cita?.cliente_email ?? "(sin correo)";
  const lugar = campoTexto(entrada, "lugar") ?? cita?.lugar ?? "(sin lugar)";
  const fecha = cita ? fechaHoraLarga(new Date(cita.inicio)) : "(no encontré esa cita)";
  return `Editar cita\n${fecha}\n${nombre} — ${email}\n${lugar}`;
}

async function resumenCancelar(entrada: Record<string, unknown>): Promise<string> {
  const cita = await citaParaResumen(entrada);
  if (!cita) {
    const id = campoTexto(entrada, "id") ?? "?";
    return `Cancelar cita (id ${id})\nNo encontré los datos de esa cita para mostrarlos acá.`;
  }
  return `Cancelar cita\n${fechaHoraLarga(new Date(cita.inicio))}\n${cita.cliente_nombre} — ${cita.cliente_email}\n${cita.lugar}`;
}

async function armarResumen(nombre: string, entrada: Record<string, unknown>): Promise<string> {
  switch (nombre) {
    case "crear_cita":
      return resumenCrear(entrada);
    case "mover_cita":
      return resumenMover(entrada);
    case "editar_cita":
      return resumenEditar(entrada);
    case "cancelar_cita":
      return resumenCancelar(entrada);
    default:
      return "Acción propuesta.";
  }
}

// ── El bucle ──

export async function correrAgente(opts: {
  mensaje: string;
  historial: Mensaje[];
  ahora?: Date;
}): Promise<Resultado> {
  const ahora = opts.ahora ?? new Date();
  const system = promptSistema(ahora);

  const messages: Anthropic.MessageParam[] = [
    ...opts.historial.map(
      (m): Anthropic.MessageParam => ({
        role: m.rol === "usuario" ? "user" : "assistant",
        content: m.texto,
      }),
    ),
    { role: "user", content: opts.mensaje },
  ];

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    let res: Anthropic.Message;
    try {
      res = await cliente().messages.create({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        system,
        tools: HERRAMIENTAS,
        messages,
        output_config: { effort: "medium" },
      });
    } catch (e) {
      console.error("agenda/agente: fallo al llamar al modelo", e);
      return { tipo: "texto", texto: "Se me complicó pensar la respuesta. Probá de nuevo en un momento." };
    }

    // El modelo se puede negar. Se responde con calma, sin romperse.
    if (res.stop_reason === "refusal") {
      return { tipo: "texto", texto: "Preferí no responder eso. ¿Lo planteamos de otra forma?" };
    }

    const usos = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const escrituras = usos.filter((u) => ESCRITURAS.has(u.name));

    // ── El corazón de esta fase ──
    // Una herramienta de escritura NO se ejecuta. Se devuelve para que una
    // persona la confirme. Si pidió dos o más a la vez, se toma la primera y
    // se avisa que las demás quedaron sin hacer: confirmar dos cosas con un
    // solo botón es pedir un accidente.
    if (escrituras.length > 0) {
      const primera = escrituras[0];
      const entrada = (primera.input ?? {}) as Record<string, unknown>;
      const accion: AccionPropuesta = {
        herramienta: primera.name as AccionPropuesta["herramienta"],
        entrada,
      };
      let resumen = await armarResumen(primera.name, entrada);
      if (escrituras.length > 1) {
        resumen +=
          `\n\n(Pediste ${escrituras.length} cambios juntos — tomé el primero. Las demás quedaron sin ` +
          "hacer: pedímelas de a una.)";
      }
      return { tipo: "confirmar", accion, resumen };
    }

    if (usos.length === 0) {
      const texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { tipo: "texto", texto: texto || "No tengo una respuesta armada para eso. ¿Podés reformular?" };
    }

    // Solo lecturas: se ejecutan de una y se realimenta el bucle.
    messages.push({ role: "assistant", content: res.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const uso of usos) {
      const { texto, esError } = await ejecutarLectura(uso.name, (uso.input ?? {}) as Record<string, unknown>);
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: texto, is_error: esError });
    }
    messages.push({ role: "user", content: resultados });
  }

  // Se acabaron las vueltas sin llegar a nada concreto.
  return { tipo: "texto", texto: "Me enredé, ¿me lo repetís más simple?" };
}
