import { requireAgenda, supabaseAdmin } from "../_lib/supabase.js";
import { randomInt } from "node:crypto";

// /api/agenda/telegram-link — vinculación de la cuenta del panel con Telegram.
//   GET    → de solo lectura: { vinculado }. No genera ni toca ningún código.
//   POST   → genera (o reemplaza) el código de un solo uso para /vincular.
//   DELETE → desvincula: borra el chat_id guardado y cualquier código pendiente.
//
// Por qué el GET no genera nada (ronda de arreglo sobre la versión anterior):
// el panel llama a este GET al montar el componente, para saber si ya hay
// vínculo antes de pintar el botón "Conectar". Si el GET generara un código
// como efecto colateral, cada vez que alguien abriera la pestaña Agenda se
// acuñaría una credencial viva de 10 minutos en su fila, sin que nadie la
// hubiera pedido — un código que da acceso a la agenda completa (nombres,
// teléfonos, notas), quedando expuesto a cualquiera que mire la pantalla o
// una captura. La generación solo puede ocurrir cuando alguien la pide
// explícitamente, es decir, en el POST que dispara el botón.
//
// El código en sí no sirve de nada sin decir a quién mandárselo, así que la
// mitad de este endpoint es de datos (guardar el código) y la otra mitad es
// instrucción en el panel (ver AgendaManager.tsx): a qué bot escribirle y con
// qué comando. El "/vincular <codigo>" lo procesa el bot en la Task 3 — acá
// solo se genera y se guarda el código, nunca se manda por Telegram.

// 10 minutos de vigencia: es un código de un solo uso que da acceso a la
// agenda completa, así que la ventana de robo tiene que ser corta.
const VIGENCIA_MS = 10 * 60_000;

// crypto.randomInt (no Math.random): el código habilita acceso a la agenda
// de dos personas, así que tiene que salir de un generador criptográfico.
//
// M-3: ocho dígitos, no seis. De las cuatro entradas del sistema, esta es la
// más débil — las otras usan un secreto de 32 bytes (webhook), un uuid v4
// (feed) y CRON_SECRET. `/vincular` tiene que correr ANTES de la autorización
// (justamente sirve para obtenerla), así que no hay a quién limitarle los
// intentos: un código fallido viene de alguien que todavía no es nadie para el
// sistema. Sin contador de intentos, lo único que acota el adivinado es el
// tamaño del espacio, y el bot y el protocolo exacto están publicados en un
// repo público (docs/runbook-bot-telegram.md). Ocho dígitos lo hacen 100 veces
// más grande con la misma ventana de 10 minutos, sin costarle nada a la
// persona: lo copia y lo pega igual.
const DIGITOS_CODIGO = 8;
const TOPE_CODIGO = 10 ** DIGITOS_CODIGO;

function generarCodigo(): string {
  return String(randomInt(0, TOPE_CODIGO)).padStart(DIGITOS_CODIGO, "0");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // El permiso se revalida en el servidor siempre, antes de leer nada del request.
  const caller = await requireAgenda(req);
  if (!caller || !caller.userId) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      // Solo lectura a propósito — ver el comentario de arriba. Nada de
      // update acá, bajo ninguna rama.
      const { data, error } = await db
        .from("app_users")
        .select("telegram_chat_id")
        .eq("user_id", caller.userId)
        .maybeSingle();
      if (error) {
        console.error("agenda/telegram-link: no se pudo leer el estado", error);
        return res.status(500).json({ error: "No se pudo consultar el estado." });
      }
      return res.status(200).json({ vinculado: Boolean(data?.telegram_chat_id) });
    }

    if (req.method === "POST") {
      // Un POST nuevo reemplaza el código anterior — no se acumulan códigos
      // vivos, así que uno que se filtró queda inútil apenas se pide otro.
      const codigo = generarCodigo();
      const expira = new Date(Date.now() + VIGENCIA_MS);
      const { error } = await db
        .from("app_users")
        .update({ telegram_codigo: codigo, telegram_codigo_expira: expira.toISOString() })
        .eq("user_id", caller.userId);
      if (error) {
        console.error("agenda/telegram-link: no se pudo guardar el código", error);
        return res.status(500).json({ error: "No se pudo generar el código." });
      }
      return res.status(200).json({ codigo, expira: expira.toISOString() });
    }

    if (req.method === "DELETE") {
      const { error } = await db
        .from("app_users")
        .update({ telegram_chat_id: null, telegram_codigo: null, telegram_codigo_expira: null })
        .eq("user_id", caller.userId);
      if (error) {
        console.error("agenda/telegram-link: no se pudo desvincular", error);
        return res.status(500).json({ error: "No se pudo desvincular la cuenta." });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("agenda/telegram-link error", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
