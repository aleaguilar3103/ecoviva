-- I3: agrega la acción "reenviada" al check de citas_log.accion.
--
-- El spec exige una salida cuando el correo de confirmación falla tras
-- guardar la cita (Resend caído, etc.): un botón "Reenviar correo" que
-- vuelve a mandar la confirmación sin tocar la fila ni la secuencia. Esa
-- acción no encaja en ninguna de las cuatro que ya existían ('creada',
-- 'movida', 'editada', 'cancelada'), así que se amplía el check en vez de
-- forzarla dentro de 'editada' (que implicaría, falsamente, que algo de la
-- cita cambió).

alter table public.citas_log drop constraint if exists citas_log_accion_check;
alter table public.citas_log add constraint citas_log_accion_check
  check (accion in ('creada','movida','editada','cancelada','reenviada'));
