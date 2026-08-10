// Aplica la configuración de Supabase Auth desde el repo: SMTP, URLs permitidas
// y plantillas de correo. Existe para que esos ajustes vivan en git y no solo
// en el dashboard, donde nadie recuerda quién los cambió.
//
// Uso:  set -a && . ./.env.local && set +a && node scripts/apply-auth-config.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => readFileSync(resolve(raiz, p), "utf8");

const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, RESEND_API_KEY } = process.env;

for (const [nombre, valor] of Object.entries({
  SUPABASE_ACCESS_TOKEN,
  SUPABASE_PROJECT_ID,
  RESEND_API_KEY,
})) {
  if (!valor) {
    console.error(`Falta ${nombre} en el entorno.`);
    process.exit(1);
  }
}

const SITIO = "https://ecovivadesarrollos.com";

// Todo destino al que Supabase puede redirigir tras un enlace de correo.
// Sin esta lista los enlaces caen en site_url y se pierde el token.
const REDIRECCIONES = [
  `${SITIO}/crear-contrasena`,
  `https://www.ecovivadesarrollos.com/crear-contrasena`,
  `http://localhost:5173/crear-contrasena`,
  // Los previews de Vercel se llaman ecoviva-git-<rama>-<equipo>.vercel.app,
  // así que el comodín va después del nombre del proyecto, no antes.
  `https://ecoviva-*.vercel.app/crear-contrasena`,
];

const config = {
  site_url: SITIO,
  uri_allow_list: REDIRECCIONES.join(","),
  password_min_length: 10,

  // El registro público (POST a /auth/v1/signup con la anon key, que viaja en
  // el bundle del navegador) queda cerrado. Las altas solo pasan por
  // inviteUserByEmail (admin API), que no usa este camino. Sin esto, cualquiera
  // puede registrar de antemano el correo de alguien que todavía no invitamos,
  // eligiendo su propia contraseña.
  disable_signup: true,

  // Resend como SMTP: así inviteUserByEmail y el reset de contraseña salen
  // solos, sin que nosotros escribamos código de envío.
  smtp_host: "smtp.resend.com",
  // La API de Supabase espera smtp_port como string, no como número
  // (con número devuelve 400: "expected string, received number").
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: RESEND_API_KEY,
  smtp_admin_email: "noreply@send.bralto.io",
  smtp_sender_name: "EcoViva Desarrollos",
  // Segundos mínimos entre dos correos al mismo destinatario. El default de 60
  // hace incómodo reenviar un acceso cuando alguien no lo recibió.
  smtp_max_frequency: 20,

  mailer_subjects_invite: "Te dieron acceso a EcoViva",
  mailer_templates_invite_content: leer("supabase/auth-templates/invite.html"),
  mailer_subjects_recovery: "Creá tu contraseña de EcoViva",
  mailer_templates_recovery_content: leer("supabase/auth-templates/recovery.html"),
};

const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth`;
const r = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(config),
});

if (!r.ok) {
  console.error(`Falló (${r.status}):`, await r.text());
  process.exit(1);
}

// Se relee del servidor en vez de confiar en el 200: confirma qué quedó guardado.
const guardado = await (await fetch(url, {
  headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
})).json();

console.log("Configuración aplicada:");
for (const k of [
  "site_url",
  "uri_allow_list",
  "password_min_length",
  "disable_signup",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_admin_email",
  "smtp_sender_name",
  "smtp_max_frequency",
  "mailer_subjects_invite",
  "mailer_subjects_recovery",
]) {
  console.log(`  ${k} = ${JSON.stringify(guardado[k])}`);
}
console.log(`  plantilla invite  = ${String(guardado.mailer_templates_invite_content).length} caracteres`);
console.log(`  plantilla recovery= ${String(guardado.mailer_templates_recovery_content).length} caracteres`);
