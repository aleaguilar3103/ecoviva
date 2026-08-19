// Cliente de la API HTTP de Resend. Se usa la API y no el SMTP porque el SMTP
// no puede programar envíos, y los recordatorios dependen de eso.

const BASE = "https://api.resend.com";
const REMITENTE = "EcoViva Desarrollos <noreply@send.bralto.io>";

function apiKey(): string {
  const k = process.env.RESEND_API_KEY;
  if (!k) throw new Error("Falta RESEND_API_KEY");
  return k;
}

export interface Adjunto {
  filename: string;
  content: string; // base64
  contentType?: string;
}

async function pedir(path: string, method: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status} ${method} ${path}: ${texto.slice(0, 500)}`);
  return texto ? JSON.parse(texto) : null;
}

export async function enviarCorreo(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Adjunto[];
  cuando?: Date; // si viene, se programa en vez de enviarse ya
}): Promise<string> {
  const body: Record<string, unknown> = {
    from: REMITENTE,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  // Que el cliente pueda responder y le llegue a una persona, no al buzón nulo.
  if (process.env.AGENDA_REPLY_TO) body.reply_to = [process.env.AGENDA_REPLY_TO];
  if (opts.attachments?.length) body.attachments = opts.attachments;
  if (opts.cuando) body.scheduled_at = opts.cuando.toISOString();

  const json = await pedir("/emails", "POST", body);
  return String((json as { id: string }).id);
}

export async function reprogramarCorreo(id: string, cuando: Date): Promise<void> {
  await pedir(`/emails/${id}`, "PATCH", { scheduled_at: cuando.toISOString() });
}

export async function cancelarCorreo(id: string): Promise<void> {
  // Un correo cancelado NO se puede reprogramar después: hay que crear otro.
  // Por eso quien cancela debe poner el id en null en la fila.
  await pedir(`/emails/${id}/cancel`, "POST");
}
