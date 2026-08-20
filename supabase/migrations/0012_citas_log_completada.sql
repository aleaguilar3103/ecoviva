-- M-7: agrega la acción "completada" al check de citas_log.accion.
--
-- El cron (api/cron/agenda.ts) cierra todos los días las citas que ya pasaron
-- con un `update estado='completada'`, y ese cambio no dejaba ningún rastro en
-- la bitácora: iba directo contra la tabla `citas`, sin pasar por `registrar`.
-- Es el ÚNICO cambio de estado automático del sistema — el que nadie hizo a
-- mano — y era justo el invisible en la tabla que existe para responder "yo no
-- moví eso". La migración 0008 ya había previsto `origen='cron'` en su propio
-- check, así que el diseño contemplaba entradas del cron desde el principio;
-- lo que faltaba era la acción.
--
-- Mismo criterio que la 0009 con 'reenviada': se amplía el check en vez de
-- forzarla dentro de 'editada', que implicaría falsamente que alguien editó
-- algo de la cita.

alter table public.citas_log drop constraint if exists citas_log_accion_check;
alter table public.citas_log add constraint citas_log_accion_check
  check (accion in ('creada','movida','editada','cancelada','reenviada','completada'));
