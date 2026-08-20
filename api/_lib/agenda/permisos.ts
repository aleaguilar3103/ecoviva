// api/_lib/agenda/permisos.ts
//
// ── LA ÚNICA DEFINICIÓN de "esta persona tiene acceso a la agenda" ──
//
// Esta regla se aplica en CINCO lugares distintos, cada uno con su propia forma
// de encontrar la fila de app_users:
//
//   1. El panel      — `requireAgenda` (api/_lib/supabase.ts), por user_id del JWT.
//   2. El bot        — `autorizar` (api/telegram/webhook.ts), por telegram_chat_id.
//   3. El feed .ics  — api/agenda/feed.ts, por feed_token.
//   4. Los avisos    — `destinatarios` (api/_lib/agenda/avisos.ts), a todos a la vez.
//   5. /api/me       — api/me.ts, que es lo que el panel usa para decidir si le
//                      pinta a la persona la pestaña Agenda.
//
// Antes la regla estaba ESCRITA en los cinco, y divergieron: el bot exigía las
// tres condiciones, el feed se olvidaba de `role`, los avisos solo miraban
// `agenda`, y /api/me le contestaba `agenda: true` a un vendedor con la bandera
// puesta. La consecuencia real (hallazgos C-1 y C-2 de la revisión final) es
// que deshabilitar a alguien desde el panel la sacaba del panel, del bot y del
// feed, pero le seguía mandando a su Telegram personal cada aviso de cita y la
// agenda diaria completa —con nombres, teléfonos y notas internas de clientes—
// sin ninguna forma de cortarlo desde el producto.
//
// El defecto no fue que alguien escribiera mal un filtro: fue que existieran
// cinco lugares donde escribirlo. Por eso la regla vive ACÁ y en ningún otro
// lado. Si mañana hay que agregarle una condición (o sacarle una), se toca
// `ACCESO_AGENDA` y las cinco puertas la heredan solas — `tieneAccesoAgenda`,
// `filtrarAccesoAgenda` y `COLUMNAS_ACCESO_AGENDA` se derivan del objeto, no
// repiten sus campos a mano.
//
// Dos precisiones, para que este comentario no prometa más de lo que el código
// cumple:
//
//   - `requireAgenda` y `/api/me` la evalúan en dos mitades: `status` y `role`
//     ya los resolvió `requireUser`, y para los BASE_ADMINS lo hace por encima
//     de lo que diga la fila (eso es el break-glass, y es a propósito). Contra
//     la fila real se evalúa la bandera. Está comentado en los dos.
//   - `requireAgenda` además corta temprano si el rol no es admin, ANTES de
//     consultar. Es un atajo para ahorrarse una consulta, no una segunda copia
//     de la regla: el predicado de acá abajo corre igual después y da la misma
//     respuesta, así que los dos no pueden divergir.
//
// Vive en api/_lib/agenda/ y no en api/_lib/supabase.ts porque es una regla de
// ESTE dominio (quién comparte la agenda de Alina y Alejandro), no del control
// de acceso general del panel. Y no importa nada: así cualquiera de las cuatro
// puertas puede consumirla sin arrastrar dependencias ni crear un ciclo con
// supabase.ts, que sí la importa.

// Las condiciones, como pares columna → valor esperado. Es la única línea del
// repo donde la regla está escrita.
export const ACCESO_AGENDA = {
  status: "active",
  role: "admin",
  agenda: true,
} as const;

// Las columnas de app_users que hay que traer en el `select` para poder
// evaluar la regla. Derivado del objeto de arriba: una condición nueva se
// selecciona sola.
export const COLUMNAS_ACCESO_AGENDA = Object.keys(ACCESO_AGENDA).join(", ");

// Forma mínima de una fila de app_users para efectos de esta regla. Los campos
// van opcionales a propósito: una fila a la que le falte una columna (porque
// el `select` se quedó corto) NO tiene acceso — falla cerrado.
export type FilaAccesoAgenda = Partial<Record<keyof typeof ACCESO_AGENDA, unknown>>;

// Para las puertas que ya tienen la fila en la mano (panel, bot, feed).
//
// Devuelve un type predicate y no un `boolean` pelado para que quien la llama
// se quede con la fila ya estrechada a "no es null": si la persona tiene
// acceso, la fila existe, y no hace falta volver a chequearlo aparte.
export function tieneAccesoAgenda<T extends FilaAccesoAgenda>(
  fila: T | null | undefined,
): fila is T {
  if (!fila) return false;
  return Object.entries(ACCESO_AGENDA).every(
    ([columna, esperado]) => (fila as Record<string, unknown>)[columna] === esperado,
  );
}

// Para la puerta que consulta VARIAS filas de una (los avisos). Ahí la regla no
// se puede aplicar como predicado después de traer los datos: eso significaría
// traerse toda app_users a memoria para descartarla. Se aplica dentro del
// `where`, con los mismos pares de arriba.
export function filtrarAccesoAgenda<Q extends { eq(columna: string, valor: unknown): Q }>(
  consulta: Q,
): Q {
  let q = consulta;
  for (const [columna, esperado] of Object.entries(ACCESO_AGENDA)) {
    q = q.eq(columna, esperado);
  }
  return q;
}
