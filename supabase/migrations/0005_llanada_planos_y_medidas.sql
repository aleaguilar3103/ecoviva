-- 0005 · Lomas de la Llanada — medidas reales (planos visados, mayo 2026) + planos descargables
--
-- size_m2 corregido contra la casilla "AREA" del plano visado de cada lote (topógrafo T.A. 8914,
-- Jorge Mario Guerrero Vargas, mayo 2026). price_per_m2 NO se toca; price_total es columna generada
-- (round(size_m2 * price_per_m2)), así que el total se recalcula solo al corregir el área.
-- plano_visado_url apunta al PDF servido por Vercel desde /public/planos/llanada/.
--
-- NO toca: status, section, currency, requires_prima, prima_pct (la fuente de verdad es el panel admin).
-- Idempotente: re-ejecutable sin efectos secundarios (UPDATE por project + lot_number).

update public.lots as l set
  size_m2          = v.size_m2,
  plano_visado_url = v.plano,
  updated_at       = now()
from (values
  -- lote, área real (m²), URL del plano
  ( 1, 1300.00::numeric, '/planos/llanada/lote-1.pdf'),
  ( 2, 1222.94::numeric, '/planos/llanada/lote-2.pdf'),
  ( 3, 1379.41::numeric, '/planos/llanada/lote-3.pdf'),
  ( 4,  775.02::numeric, '/planos/llanada/lote-4.pdf'),
  ( 5,  675.00::numeric, '/planos/llanada/lote-5.pdf'),
  ( 6,  675.00::numeric, '/planos/llanada/lote-6.pdf'),
  ( 7,  675.00::numeric, '/planos/llanada/lote-7.pdf'),
  ( 8,  676.15::numeric, '/planos/llanada/lote-8.pdf'),
  (12, 1810.36::numeric, '/planos/llanada/lote-12.pdf'),
  (13, 5000.00::numeric, '/planos/llanada/lote-13.pdf'),
  (14, 5000.00::numeric, '/planos/llanada/lote-14.pdf'),
  (15, 5063.72::numeric, '/planos/llanada/lote-15.pdf'),
  (16, 5403.38::numeric, '/planos/llanada/lote-16.pdf'),
  (17, 5000.00::numeric, '/planos/llanada/lote-17.pdf'),
  (18, 5000.00::numeric, '/planos/llanada/lote-18.pdf'),
  (19, 5000.00::numeric, '/planos/llanada/lote-19.pdf'),
  (20, 5000.00::numeric, '/planos/llanada/lote-20.pdf'),
  (21, 5000.00::numeric, '/planos/llanada/lote-21.pdf'),
  (22, 5000.00::numeric, '/planos/llanada/lote-22.pdf'),
  (23, 5000.00::numeric, '/planos/llanada/lote-23.pdf'),
  (24, 5000.00::numeric, '/planos/llanada/lote-24.pdf'),
  (25, 5000.00::numeric, '/planos/llanada/lote-25.pdf'),
  (26, 5322.67::numeric, '/planos/llanada/lote-26.pdf'),
  (27, 5686.71::numeric, '/planos/llanada/lote-27.pdf'),
  (28, 5101.85::numeric, '/planos/llanada/lote-28.pdf'),
  (29, 5254.74::numeric, '/planos/llanada/lote-29.pdf'),
  (30, 5579.93::numeric, '/planos/llanada/lote-30.pdf'),
  (31, 7533.00::numeric, '/planos/llanada/lote-31.pdf'),
  (32, 5333.66::numeric, '/planos/llanada/lote-32.pdf'),
  (33, 7563.75::numeric, '/planos/llanada/lote-33.pdf'),
  (34, 5000.00::numeric, '/planos/llanada/lote-34.pdf'),
  (35, 5000.00::numeric, '/planos/llanada/lote-35.pdf'),
  (36, 5000.00::numeric, '/planos/llanada/lote-36.pdf'),
  (37, 5028.76::numeric, '/planos/llanada/lote-37.pdf'),
  (38, 5022.91::numeric, '/planos/llanada/lote-38.pdf'),
  (39, 5454.22::numeric, '/planos/llanada/lote-39.pdf'),
  (40, 5405.63::numeric, '/planos/llanada/lote-40.pdf')
) as v(lot_number, size_m2, plano)
where l.project = 'llanada' and l.lot_number = v.lot_number;
