// api/_lib/agenda/acciones.ts
//
// El agente (agenda/agente.ts) nunca ejecuta una escritura: corta el turno y
// devuelve la acción propuesta para que Alina o Alejandro la confirmen desde
// Telegram. Este archivo es la otra mitad de ese contrato: guarda la acción
// mientras se espera el toque del botón, la consume cuando llega, y la
// despacha a operaciones.ts (la misma orquestación que usa el panel) una vez
// confirmada.
//
// EL PUNTO MÁS IMPORTANTE DE ESTE ARCHIVO: `consumirAccion` es la ÚNICA
// defensa real contra la doble ejecución. El webhook deduplica por
// update_id, pero eso es reducción de ruido, no la defensa — hay caminos que
// producen dos confirmaciones con update_id DISTINTOS: la persona reenvía el
// mensaje a mano, dos dispositivos con la misma cuenta de Telegram, o (el
// caso frecuente de verdad) dos toques al mismo botón porque Telegram tardó
// en responder. Si el "Sí" no fuera atómico, cualquiera de esos tres duplica
// la cita — y con ella el correo al cliente, que es irreversible: ya lo leyó.
//
// Por eso `consumirAccion` es un DELETE con las tres condiciones (id, dueño,
// vigencia) en el mismo `where`, no un SELECT seguido de un DELETE. Ver el
// porqué completo en el comentario de esa función.

import { supabaseAdmin } from "../supabase.js";
import { obtenerCita } from "./db.js";
import type { Cita, DatosCita } from "./db.js";
import {
  crearCitaCompleta,
  actualizarCitaCompleta,
  cancelarCitaCompleta,
  type ResultadoCorreo,
} from "./operaciones.js";
import { ErrorAgenda, esErrorAgenda } from "./errores.js";
import type { AccionPropuesta } from "./agente.js";

const TABLA = "agenda_acciones_pendientes";
// Una acción vieja confirmada por error es una cita agendada a destiempo:
// 10 minutos alcanza para que la persona lea el resumen y decida, sin dejar
// un botón "Confirmar" viable horas después de que la conversación siguió
// para otro lado.
const EXPIRACION_MIN = 10;
const TZ = "America/Costa_Rica";

// Mismo formato que agenda/agente.ts (mismo criterio: si una fecha se lee
// rara, se nota igual en el resumen de confirmación y acá). No se importa de
// ahí porque agente.ts no lo exporta — es un helper de una línea, duplicarlo
// es más barato que acoplar los dos módulos por una función así de chica.
function fechaHoraLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(fecha);
}

function campoTexto(entrada: Record<string, unknown>, clave: string): string | undefined {
  const v = entrada[clave];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Arreglo 4 (ronda de revisión): `citas.cliente_email` es `text not null`
// SIN restricción de formato en la base, así que sin este chequeo una cita
// con el correo mal escrito se guarda igual — y el fallo de envío que viene
// después es indistinguible, para quien lee el resultado en Telegram, de un
// hipo transitorio de Resend. Mismo criterio que `correoValido` en
// api/agenda/citas.ts (duplicado a propósito, no importado: ese archivo es
// una ruta HTTP del panel, y un módulo de dominio como este no debería
// depender de una ruta de API — mismo razonamiento que ya usa este archivo
// para no importar `fechaHoraLarga`/`inicioDeHoyCR` de agente.ts/webhook.ts.
// Si el criterio cambia en un lado, hay que replicarlo a mano en el otro).
// Devuelve el correo normalizado (recortado y en minúsculas) o `null` si no
// tiene forma de correo.
function correoValido(v: string): string | null {
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// ── Guardar ──
//
// Se llama apenas el agente propone una escritura: el resumen ya se le
// mandó a la persona con los botones, así que esta fila tiene que existir
// ANTES de que pueda llegar el callback_query del toque.
export async function guardarAccion(chatId: string, accion: AccionPropuesta): Promise<string> {
  const expira_at = new Date(Date.now() + EXPIRACION_MIN * 60_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from(TABLA)
    .insert({ chat_id: chatId, accion, expira_at })
    .select("id")
    .single();
  if (error) {
    console.error("agenda/acciones: no se pudo guardar la acción pendiente", error);
    throw new Error("No se pudo guardar la acción para confirmar.");
  }
  return (data as { id: string }).id;
}

// ── Consumir (atómico, un solo uso) ──
//
// Las tres condiciones — id, dueño (chat_id) y vigencia (expira_at) — van
// DENTRO del mismo `delete().eq().eq().gt()`, nunca en un `if` posterior
// sobre el resultado de un `select` previo. La razón: un select y un delete
// son DOS viajes a la base, y entre esos dos viajes cabe una segunda
// ejecución concurrente que hace su propio select — todavía ve la fila viva,
// porque el primer delete no llegó a correr — y termina devolviendo la MISMA
// acción que la primera. Ese es exactamente el doble toque que hay que
// evitar: las dos ejecuciones "ganan" y la cita (con su correo irreversible)
// se crea dos veces.
//
// Con las tres condiciones en el `where` de un único `delete`, Postgres las
// evalúa y borra la fila como una sola operación atómica: como mucho una
// ejecución concurrente encuentra la fila todavía viva para borrarla. La
// segunda ejecuta el mismo `delete` un instante después, ya no encuentra
// ninguna fila que matchee (la `id` ya no existe) y `data` le vuelve `null`.
// No hay ventana entre "mirar" y "actuar" — mirar y actuar son la misma
// operación.
//
// Es el mismo patrón que ya se aplicó en este repo dos veces: el consumo
// del código de vinculación (`/vincular` en webhook.ts) y el feed del
// calendario — las dos veces DESPUÉS de encontrar la carrera real en
// producción. Acá se hace bien desde el principio.
//
// `data === null` es una respuesta deliberadamente ambigua: no existe, no es
// de este chat, ya venció, o alguien ya la consumió. No hace falta (ni
// conviene) distinguir esos casos para quien llama — el texto que ve la
// persona es el mismo en los cuatro: "esa confirmación ya no vale".
export async function consumirAccion(id: string, chatId: string): Promise<AccionPropuesta | null> {
  const { data, error } = await supabaseAdmin()
    .from(TABLA)
    .delete()
    .eq("id", id)
    .eq("chat_id", chatId)
    .gt("expira_at", new Date().toISOString())
    .select()
    .maybeSingle();

  if (error) {
    console.error("agenda/acciones: fallo al consumir la acción pendiente", error);
    return null;
  }
  if (!data) return null;
  return (data as { accion: AccionPropuesta }).accion;
}

// ── Ejecutar ──
//
// El texto de acá es lo último que la persona lee para saber qué pasó de
// verdad: por eso la fecha va en formato largo en español (no ISO crudo) y
// por eso, si el correo al cliente falló, lo dice claro — sin que parezca
// que la cita no se guardó. La cita SÍ quedó: lo que falló es el aviso, y
// hay que decírselo para que la persona avise por otro medio.
function textoResultado(accionTexto: string, cita: Cita, correo: ResultadoCorreo): string {
  const lineas = [accionTexto, fechaHoraLarga(new Date(cita.inicio)), `${cita.cliente_nombre} — ${cita.lugar}`];
  if (correo === "fallo") {
    lineas.push(
      "",
      "Ojo: no se pudo mandar el correo al cliente. La cita SÍ quedó guardada — avisale por otro medio.",
    );
  }
  return lineas.join("\n");
}

async function ejecutarCrear(entrada: Record<string, unknown>, actor: string): Promise<string> {
  const cliente_nombre = campoTexto(entrada, "cliente_nombre");
  const cliente_email_crudo = campoTexto(entrada, "cliente_email");
  const inicio = campoTexto(entrada, "inicio");
  const lugar = campoTexto(entrada, "lugar");
  // No debería pasar: crear_cita exige estos cuatro campos en su esquema
  // (ver agente.ts). Si igual faltan, mejor avisar que mandarle a
  // operaciones.ts un dato a medias.
  if (!cliente_nombre || !cliente_email_crudo || !inicio || !lugar) {
    return "Me faltó algún dato para crear la cita (nombre, correo, fecha o lugar). Pedímelo de nuevo.";
  }
  // Arreglo 4: el formato del correo SÍ se valida acá — la base no lo hace
  // (ver el comentario largo en correoValido más arriba).
  const cliente_email = correoValido(cliente_email_crudo);
  if (!cliente_email) {
    return `Ese correo (${cliente_email_crudo}) no parece válido. Decime el correo bien escrito del cliente y probamos de nuevo.`;
  }
  const datos: DatosCita = {
    cliente_nombre,
    cliente_email,
    cliente_telefono: campoTexto(entrada, "cliente_telefono") ?? null,
    inicio,
    lugar,
    notas: campoTexto(entrada, "notas") ?? null,
  };
  const { cita, correo } = await crearCitaCompleta(datos, actor, "telegram");
  return textoResultado("Cita creada.", cita, correo);
}

async function ejecutarMover(entrada: Record<string, unknown>, actor: string): Promise<string> {
  const id = campoTexto(entrada, "id");
  const inicio = campoTexto(entrada, "inicio");
  if (!id || !inicio) return "Me faltó el id o la fecha nueva para mover la cita. Pedímelo de nuevo.";

  // actualizarCitaCompleta exige el DatosCita COMPLETO (así lo tipa
  // operaciones.ts), pero mover_cita solo trae el id y la fecha nueva: el
  // resto se completa con lo que ya tiene la cita, para no pisar datos que
  // la persona no quiso tocar.
  const actual = await obtenerCita(id);
  if (!actual) throw new ErrorAgenda("no_encontrada", "Esa cita ya no existe.");

  const datos: DatosCita = {
    cliente_nombre: actual.cliente_nombre,
    cliente_email: actual.cliente_email,
    cliente_telefono: actual.cliente_telefono,
    inicio,
    lugar: actual.lugar,
    lote_id: actual.lote_id,
    notas: actual.notas,
  };
  const { cita, correo } = await actualizarCitaCompleta(id, datos, actor, "telegram");
  return textoResultado("Cita movida.", cita, correo);
}

async function ejecutarEditar(entrada: Record<string, unknown>, actor: string): Promise<string> {
  const id = campoTexto(entrada, "id");
  if (!id) return "Me faltó el id de la cita a editar. Pedímelo de nuevo.";

  const actual = await obtenerCita(id);
  if (!actual) throw new ErrorAgenda("no_encontrada", "Esa cita ya no existe.");

  // Arreglo 4: solo se valida si el correo es uno de los campos que de
  // verdad cambian — si no vino en `entrada`, se preserva el que ya tenía
  // la cita (ese ya pasó por esta misma validación cuando se creó/editó por
  // última vez, no hace falta revalidarlo).
  const cliente_email_crudo = campoTexto(entrada, "cliente_email");
  let cliente_email = actual.cliente_email;
  if (cliente_email_crudo !== undefined) {
    const normalizado = correoValido(cliente_email_crudo);
    if (!normalizado) {
      return `Ese correo (${cliente_email_crudo}) no parece válido. Decime el correo bien escrito del cliente y probamos de nuevo.`;
    }
    cliente_email = normalizado;
  }

  // Mismo criterio que mover_cita: editar_cita solo trae los campos que
  // cambian, el resto se completa con la cita actual.
  const datos: DatosCita = {
    cliente_nombre: campoTexto(entrada, "cliente_nombre") ?? actual.cliente_nombre,
    cliente_email,
    cliente_telefono: campoTexto(entrada, "cliente_telefono") ?? actual.cliente_telefono,
    inicio: actual.inicio,
    lugar: campoTexto(entrada, "lugar") ?? actual.lugar,
    lote_id: actual.lote_id,
    notas: campoTexto(entrada, "notas") ?? actual.notas,
  };
  const { cita, correo } = await actualizarCitaCompleta(id, datos, actor, "telegram");
  return textoResultado("Cita editada.", cita, correo);
}

async function ejecutarCancelar(entrada: Record<string, unknown>, actor: string): Promise<string> {
  const id = campoTexto(entrada, "id");
  if (!id) return "Me faltó el id de la cita a cancelar. Pedímelo de nuevo.";

  const { cita, correo } = await cancelarCitaCompleta(id, actor, "telegram");
  // Idempotente en operaciones.ts: si ya estaba cancelada, correo vuelve
  // "no_aplica" y no se mandó nada nuevo. Se le avisa distinto a la persona
  // para que no piense que la acabamos de cancelar recién ahora.
  if (correo === "no_aplica") {
    return [
      "Esa cita ya estaba cancelada de antes — no le avisé de nuevo al cliente.",
      fechaHoraLarga(new Date(cita.inicio)),
      `${cita.cliente_nombre} — ${cita.lugar}`,
    ].join("\n");
  }
  return textoResultado("Cita cancelada.", cita, correo);
}

// Despacha la acción confirmada a operaciones.ts y devuelve un texto listo
// para mandar por Telegram. Nunca revienta: cualquier error de dominio
// (ErrorAgenda) se traduce a su propio mensaje, ya pensado para la persona
// — sin comparar texto, con esErrorAgenda — y cualquier otro error se
// loguea con el detalle crudo (que nunca sale hacia afuera) y devuelve un
// texto genérico.
export async function ejecutarAccion(accion: AccionPropuesta, actor: string): Promise<string> {
  try {
    switch (accion.herramienta) {
      case "crear_cita":
        return await ejecutarCrear(accion.entrada, actor);
      case "mover_cita":
        return await ejecutarMover(accion.entrada, actor);
      case "editar_cita":
        return await ejecutarEditar(accion.entrada, actor);
      case "cancelar_cita":
        return await ejecutarCancelar(accion.entrada, actor);
    }
  } catch (e) {
    if (esErrorAgenda(e)) return e.message;
    console.error("agenda/acciones: fallo al ejecutar la acción confirmada", e);
    return "Se me complicó completar esa acción. Revisá el panel antes de reintentar, para no duplicarla.";
  }
}
