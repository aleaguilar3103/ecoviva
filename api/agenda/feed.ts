import { supabaseAdmin } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import { construirIcs } from "../_lib/agenda/ics.js";
import type { Cita } from "../_lib/agenda/db.js";

// /api/agenda/feed?token=<uuid> — calendario de suscripción para el celular.
//
// El token ES la credencial: una suscripción de calendario no puede iniciar
// sesión, así que quien tenga el enlace ve la agenda completa. Por eso:
//   - es un uuid generado con randomUUID() (ver feed-token.ts), no una
//     secuencia ni algo derivado del correo;
//   - token inválido, cuenta sin `agenda` o cuenta deshabilitada devuelven el
//     MISMO 404 sin cuerpo revelador — un 403 le confirmaría a quien prueba
//     tokens que ese en particular existe;
//   - se puede rotar desde el panel y la URL vieja deja de servir al toque.
//
// A diferencia del correo al cliente, acá SÍ van el teléfono y las notas
// internas: es el calendario privado de Alina y Alejandro, no algo que ve el
// cliente.
//
// Es el único endpoint público de todo el proyecto que no exige sesión (el
// token hace ese papel), así que no puede depender de lo que haga el runtime
// de Vercel ante una excepción sin capturar: todo lo que puede lanzar
// (la consulta a app_users y, sobre todo, listarCitas ante un fallo de
// Postgres) va dentro del try/catch de abajo.

// Misma forma que randomUUID(): 8-4-4-4-12 en hex. Más estricto que "36
// caracteres cualesquiera" para no gastar una consulta a la base con algo que
// nunca va a matchear un uuid real.
const RE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VENTANA_ATRAS_DIAS = 30;
const VENTANA_ADELANTE_DIAS = 180;

// Arma el VEVENT de una cita reusando construirIcs (mismo plegado a 75
// octetos y mismos escapes que usan los correos) y le corta el envoltorio
// VCALENDAR/METHOD, que acá se pone una sola vez para todo el feed.
function eventoDesdeCita(c: Cita): string {
  const ics = construirIcs({
    uid: c.ics_uid,
    secuencia: c.ics_secuencia,
    inicio: new Date(c.inicio),
    duracionMin: c.duracion_min,
    titulo: `${c.cliente_nombre} — ${c.lugar}`,
    descripcion: [
      c.cliente_telefono ? `Tel: ${c.cliente_telefono}` : null,
      c.cliente_email,
      c.notas ? `Notas: ${c.notas}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    lugar: c.lugar,
    organizadorNombre: "EcoViva Desarrollos",
    organizadorEmail: "noreply@send.bralto.io",
    asistenteNombre: c.cliente_nombre,
    asistenteEmail: c.cliente_email,
  });
  const desde = ics.indexOf("BEGIN:VEVENT");
  const hasta = ics.indexOf("END:VEVENT") + "END:VEVENT".length;
  return ics.slice(desde, hasta);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const tokenParam = req.query?.token;
  const token = typeof tokenParam === "string" ? tokenParam : "";
  if (!RE_TOKEN.test(token)) return res.status(404).send("No encontrado");

  try {
    const { data: usuario, error } = await supabaseAdmin()
      .from("app_users")
      .select("agenda, status")
      .eq("feed_token", token)
      .maybeSingle();

    // Fail closed: un error de consulta se trata igual que "no existe". Pero
    // fallar cerrado hacia afuera no es excusa para quedarse ciego hacia
    // adentro — sin este log, un incidente de Supabase haría que el feed le
    // devuelva 404 a todo el mundo y no quedaría ni rastro para notarlo.
    if (error) {
      console.error("agenda/feed: fallo al consultar app_users por token", error);
    }

    // Mismo 404 para token inexistente, cuenta sin la bandera `agenda`,
    // cuenta deshabilitada y fallo de consulta: son casos distintos para
    // nosotros (arriba quedó el rastro que los distingue), pero deben ser
    // indistinguibles para quien esté probando tokens desde afuera.
    if (error || !usuario || usuario.agenda !== true || usuario.status !== "active") {
      return res.status(404).send("No encontrado");
    }

    const ahora = Date.now();
    const citas = await listarCitas({
      desde: new Date(ahora - VENTANA_ATRAS_DIAS * 24 * 60 * 60_000),
      hasta: new Date(ahora + VENTANA_ADELANTE_DIAS * 24 * 60 * 60_000),
    });

    const eventos = citas.map(eventoDesdeCita).join("\r\n");

    const cuerpo =
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EcoViva Desarrollos//Agenda//ES",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Agenda EcoViva",
        "X-WR-TIMEZONE:America/Costa_Rica",
        ...(eventos ? [eventos] : []),
        "END:VCALENDAR",
      ].join("\r\n") + "\r\n";

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    return res.status(200).send(cuerpo);
  } catch (e) {
    // listarCitas (agenda/db.ts, vía reventar) lanza ante cualquier error de
    // Postgres. Acá NO se responde 404: un 404 le diría al cliente de
    // calendario "esta suscripción ya no existe" y algunos la dan de baja
    // solos ante eso. Es un fallo del servidor — 500, para que el cliente
    // reintente más tarde sin perder la suscripción.
    console.error("agenda/feed error", e);
    return res.status(500).send("Error interno");
  }
}
