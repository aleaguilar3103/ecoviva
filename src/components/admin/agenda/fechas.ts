// Helpers de fecha de la agenda. Todo lo puro vive acá: no importa React ni
// toca la red, así que se prueba directo, sin montar componentes.
//
// Costa Rica es UTC−6 fijo (sin horario de verano). Esa constante es la única
// razón por la que estos cálculos pueden hacerse con aritmética simple en vez
// de con una librería de husos: si algún día hubiera que soportar otro país,
// esto se cambia por Intl y no al revés.

import type { CitaRow } from "../../../lib/adminApi";

export const OFFSET_CR_MS = -6 * 60 * 60_000;

// valor = "2026-09-01T10:30" tal como lo entrega el <input type="datetime-local">,
// interpretado como hora de Costa Rica (NO como hora local del navegador).
// El input trabaja en la hora del equipo, que puede no ser la tica si alguien
// viaja; se convierte explícitamente para que la cita quede siempre guardada
// en hora de Costa Rica, sin depender de dónde esté sentada la persona.
export function isoDesdeLocalCR(valor: string): string {
  const [fecha, hora] = valor.split("T");
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_CR_MS).toISOString();
}

// Inverso: de un ISO guardado a "YYYY-MM-DDTHH:mm" en hora de Costa Rica, que
// es lo que el input datetime-local espera como value.
export function localCRDesdeIso(iso: string): string {
  const d = new Date(new Date(iso).getTime() + OFFSET_CR_MS);
  return d.toISOString().slice(0, 16);
}

// La clave del día ("2026-08-30") en hora de Costa Rica. Es lo que agrupa las
// citas en el calendario: una cita de las 11 p.m. tica cae el día tico, no el
// del día siguiente en UTC — que es justo el error que haría que una cita
// aparezca en la casilla equivocada del mes.
export function claveDiaCR(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_CR_MS).toISOString().slice(0, 10);
}

// La clave del día de HOY en Costa Rica.
export function hoyCR(): string {
  return claveDiaCR(new Date().toISOString());
}

// "2026-08-30" → Date del mediodía UTC de ese día. Mediodía y no medianoche a
// propósito: deja doce horas de margen a cada lado, así ningún corrimiento de
// huso puede empujar la fecha al día anterior o al siguiente al formatear.
export function fechaDesdeClave(clave: string): Date {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function soloHora(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(iso));
}

export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(iso));
}

// "Domingo 30 de agosto" — el encabezado del día elegido. Sin hora y sin año:
// el año ya lo dice el calendario de arriba.
export function diaLargo(clave: string): string {
  const texto = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(fechaDesdeClave(clave));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "agosto 2026", para el encabezado del calendario.
export function mesLargo(ancla: Date): string {
  const texto = new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(ancla);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Solo la hora, para la expiración del código de Telegram: no hace falta la
// fecha porque el código vive nada más 10 minutos.
export function horaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  }).format(new Date(iso));
}

// mm:ss para la cuenta regresiva del código de Telegram.
export function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// I2: el rango que trae getCitas (-7d..+90d) hace que las citas pasadas
// convivan con las futuras. Antes no había forma de distinguirlas: mismo
// estilo, mismos botones de Editar/Cancelar activos. Un clic en Cancelar ahí
// mandaba "Tu cita fue cancelada" por una visita que el cliente ya hizo.
// `estado === "completada"` es lo normal (el cron ya la cerró); el chequeo por
// hora cubre la ventana entre que la cita pasó y que el cron corre.
//
// N3: la comparación es contra la hora de FIN (inicio + duración), no la de
// inicio. Con la hora de inicio, una visita de 60 minutos que arranca a las
// 10:00 quedaba marcada "Pasada" —y sin Editar ni Cancelar— desde las 10:01,
// cuando la cita todavía está en curso. Mover o cancelar una cita que acaba de
// empezar es legítimo y común (el cliente avisa que se atrasó, o que no
// llega); el servidor ya lo permite mientras el cron no la haya cerrado.
export function esPasadaOCompletada(c: CitaRow): boolean {
  const fin = new Date(c.inicio).getTime() + c.duracion_min * 60_000;
  return c.estado === "completada" || fin < Date.now();
}

// La grilla del mes que se dibuja: siempre semanas completas de lunes a
// domingo, rellenando con los días del mes anterior y el siguiente para que la
// cuadrícula no quede coja. `delMes` distingue unos de otros.
export interface DiaGrilla {
  clave: string;
  numero: number;
  delMes: boolean;
}

export function grillaDelMes(ancla: Date): DiaGrilla[] {
  const y = ancla.getUTCFullYear();
  const m = ancla.getUTCMonth();

  const primero = new Date(Date.UTC(y, m, 1, 12));
  // getUTCDay() da 0=domingo; se corre para que 0=lunes, que es como se lee un
  // calendario acá.
  const corrimiento = (primero.getUTCDay() + 6) % 7;

  const dias: DiaGrilla[] = [];
  const arranque = new Date(primero.getTime() - corrimiento * 24 * 60 * 60_000);

  // 6 semanas siempre: así el calendario no cambia de alto al pasar de mes y
  // el contenido de abajo no salta.
  for (let i = 0; i < 42; i++) {
    const d = new Date(arranque.getTime() + i * 24 * 60 * 60_000);
    dias.push({
      clave: d.toISOString().slice(0, 10),
      numero: d.getUTCDate(),
      delMes: d.getUTCMonth() === m,
    });
  }
  return dias;
}
