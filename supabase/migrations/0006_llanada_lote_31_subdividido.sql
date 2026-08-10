-- 0006 · Lomas de la Llanada — el lote #31 se subdividió en 31A y 31B
--
-- Planos visados 2026-61175-C (31A) y 2026-61176-C (31B), topógrafo T.A. 8914 Jorge Mario
-- Guerrero Vargas, junio 2026, sellados por CFIA el 06/07/2026. El #31 figuraba como una sola
-- parcela de 7.533 m²; el levantamiento definitivo la parte en dos de 5.000,00 m² exactos
-- (verificado por el cuadro AREA de cada plano y recalculando el polígono desde el listado de
-- coordenadas CRTM05: 4999.92 y 4999.95 m²).
--
-- Precio ₡13.000/m² en ambas — la tarifa del #32 y #33. El ₡13.275/m² anterior existía solo
-- para que el #31 cerrara en ₡100.000.575, y con la parcela partida ese ancla ya no aplica.
--
-- La identidad del lote pasa a ser (número + sufijo): lot_number sigue siendo entero, así que
-- el orden numérico de la lista y las búsquedas de ECO por "lote 31" siguen funcionando —
-- ahora devuelven las dos parcelas.
--
-- NO toca status (la fuente de verdad es el panel admin): la 31B nace con el estado que tenga
-- la 31A al momento de correr esto.
-- Idempotente: re-ejecutable sin efectos secundarios.

alter table public.lots add column if not exists lot_suffix text;

-- El unique (project, lot_number) impide que 31A y 31B convivan. Se reemplaza por uno que
-- incluye el sufijo. Se busca por columnas y no por nombre para no depender de cómo lo bautizó
-- Postgres al crear la tabla.
do $$
declare nombre text;
begin
  select con.conname into nombre
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname = 'lots' and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname)
      from unnest(con.conkey) k
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
    ) = array['lot_number','project'];
  if nombre is not null then
    execute format('alter table public.lots drop constraint %I', nombre);
  end if;
end $$;

create unique index if not exists lots_project_lot_unique
  on public.lots (project, lot_number, coalesce(lot_suffix, ''));

-- #31 (7.533 m²) pasa a ser la 31A de 5.000 m².
update public.lots set
  lot_suffix       = 'A',
  size_m2          = 5000.00,
  price_per_m2     = 13000,
  plano_visado_url = '/planos/llanada/lote-31A.pdf',
  updated_at       = now()
where project = 'llanada' and lot_number = 31 and lot_suffix is null;

-- 31B: hereda sección y estado de la 31A para no inventar disponibilidad.
insert into public.lots
  (project, section, lot_number, lot_suffix, size_m2, price_per_m2, currency,
   status, requires_prima, prima_pct, plano_visado_url)
select 'llanada', section, 31, 'B', 5000.00, 13000, 'CRC',
       status, requires_prima, prima_pct, '/planos/llanada/lote-31B.pdf'
from public.lots
where project = 'llanada' and lot_number = 31 and lot_suffix = 'A'
on conflict (project, lot_number, coalesce(lot_suffix, '')) do nothing;
