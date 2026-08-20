// api/_lib/agenda/copiaEquipo.ts
//
// Por qué existe este archivo: el dueño pidió que Alina y Alejandro reciban
// en copia oculta (BCC) los correos transaccionales que le salen al cliente
// (confirmación, reagendado, cancelación — los que manda enviarAhora en
// email.ts), para ver exactamente lo que el cliente ve.
//
// Quién entra en esa copia NO se decide acá: lo decide `filtrarAccesoAgenda`
// (agenda/permisos.ts), la única definición de "esta persona comparte la
// agenda" — la misma que usan el panel, el bot, el feed .ics y los avisos de
// Telegram (`destinatarios()` en avisos.ts). Este archivo es la sexta puerta
// que la consume (ver el encabezado de permisos.ts, que las enumera).
//
// Por qué es un archivo aparte y no un import de avisos.ts: avisos.ts es el
// módulo de notificaciones por TELEGRAM. Si email.ts le pidiera la lista a
// avisos.ts, el correo al cliente quedaría acoplado a un transporte que no
// tiene nada que ver con él — un cambio en Telegram podría romper el correo,
// o viceversa, sin que ninguno de los dos lo necesite. Y por qué no vive en
// permisos.ts: ese archivo es deliberadamente puro y no importa
// `../supabase.js` (que sí lo importa a él, para `requireAgenda`) — meterle
// una consulta real acá crearía un ciclo. Este archivo, chico y con una sola
// responsabilidad, es el que menos deuda deja de las tres opciones.
//
// La diferencia deliberada con `destinatarios()` (avisos.ts): ACÁ NO se
// exige `telegram_chat_id`. Avisos.ts lo exige porque sin chat vinculado no
// hay a dónde mandar el mensaje de Telegram — es un canal que hay que haber
// activado antes. El correo no tiene ese problema: Resend lo manda solo, a
// la dirección que ya está en app_users. Alguien con acceso a la agenda pero
// que todavía no corrió /vincular en el bot igual tiene que ver los correos
// que le llegan al cliente.
//
// Nunca tira: si la consulta falla, se loguea y se devuelve una lista vacía.
// Es a propósito — ver el porqué completo (falla abierto hacia el cliente)
// en el encabezado de email.ts, donde se consume.

import { supabaseAdmin } from "../supabase.js";
import { filtrarAccesoAgenda } from "./permisos.js";

interface FilaEmail {
  email: string;
}

export async function emailsCopiaEquipo(): Promise<string[]> {
  try {
    const { data, error } = await filtrarAccesoAgenda(
      supabaseAdmin().from("app_users").select("email"),
    );

    if (error) {
      console.error("agenda/copiaEquipo: no se pudo listar a quién copiar en el correo", error);
      return [];
    }

    const filas = (data ?? []) as FilaEmail[];
    return filas
      .map((f) => f.email)
      .filter((email): email is string => typeof email === "string" && email.length > 0);
  } catch (e) {
    console.error("agenda/copiaEquipo: fallo inesperado al listar a quién copiar en el correo", e);
    return [];
  }
}
