-- Seed de lots con inventario real (datos corregidos por el cliente 2026-06-01)
-- Río Celeste pequeños: $40/m² (corregido, la web mostraba $45) · grandes: $30/m²
-- Llanada frente a calle: ₡40.000/m² (corregido, la web mostraba ₡45.000) + 25% prima
-- Idempotente: upsert por (project, lot_number)

insert into public.lots
  (project, section, lot_number, size_m2, price_per_m2, currency, status, requires_prima, prima_pct, plano_visado_url, notes)
values
  -- ── Lomas de la Llanada · FRENTE A CALLE (CRC, ₡40.000/m², 25% prima en #1-#8) ──
  ('llanada','frente_a_calle', 1, 1300, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 2, 1300, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 3, 1404, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 4,  696, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 5,  690, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 6,  690, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 7,  690, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle', 8,  690, 40000, 'CRC','not_available', true, 25, null, null),
  ('llanada','frente_a_calle',12, 1987, 27000, 'CRC','not_available', false, 0, null, 'Precio/prima por confirmar (PDF frente a calle en revisión)'),

  -- ── Lomas de la Llanada · BLOQUE 1 (CRC, sin prima) ──
  ('llanada','bloque_1',13, 6947, 15000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',14, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',15, 5400, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',16, 6009, 17000, 'CRC','reserved',   false, 0, null, null),
  ('llanada','bloque_1',17, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',18, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',19, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',20, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',21, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',22, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',23, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',24, 5000, 17000, 'CRC','sold',       false, 0, null, null),
  ('llanada','bloque_1',25, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',26, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',27, 5179, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',28, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',29, 5300, 17000, 'CRC','sold',       false, 0, null, null),
  ('llanada','bloque_1',30, 5265, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',31, 7533, 13275, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',32, 6542, 13000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',33, 8141, 13000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',34, 5000, 17000, 'CRC','reserved',   false, 0, null, null),
  ('llanada','bloque_1',35, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',36, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',37, 5000, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',38, 5520, 17000, 'CRC','sold',       false, 0, null, null),
  ('llanada','bloque_1',39, 5416, 17000, 'CRC','available',  false, 0, null, null),
  ('llanada','bloque_1',40, 5416, 17000, 'CRC','available',  false, 0, null, null),

  -- ── Oasis Río Celeste (USD, sin prima; pequeños $40, grandes $30) ──
  ('rio_celeste','general', 2, 1706.44, 40, 'USD','available',     false, 0, null, null),
  ('rio_celeste','general', 3, 1620.26, 40, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f6803fc45e31.pdf', null),
  ('rio_celeste','general', 4, 1935.31, 40, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b710efd660795e1e98.pdf', null),
  ('rio_celeste','general', 1, 5000,    30, 'USD','not_available', false, 0, null, null),
  ('rio_celeste','general', 5, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7cab0330346a3.pdf', null),
  ('rio_celeste','general', 6, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7caf78c03469e.pdf', null),
  ('rio_celeste','general', 7, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b77675770f0e3e8a77.pdf', null),
  ('rio_celeste','general', 8, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b718ecce76ce26b5e1.pdf', null),
  ('rio_celeste','general', 9, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7767577e8b83e8a7d.pdf', null),
  ('rio_celeste','general',10, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b7f7a87780474e9c07.pdf', null),
  ('rio_celeste','general',11, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f65290c45e33.pdf', null),
  ('rio_celeste','general',12, 6000,    30, 'USD','not_available', false, 0, null, null),
  ('rio_celeste','general',13, 5000,    30, 'USD','available',     false, 0, null, null),
  ('rio_celeste','general',14, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757794463e8a7e.pdf', null),
  ('rio_celeste','general',15, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b8f7a87718884e9c0b.pdf', null),
  ('rio_celeste','general',16, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b83c458e581bd62b57.pdf', null),
  ('rio_celeste','general',17, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf', null),
  ('rio_celeste','general',18, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b71311f678e1c45e32.pdf', null),
  ('rio_celeste','general',19, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b776757707553e8a78.pdf', null),
  ('rio_celeste','general',20, 5000,    30, 'USD','available',     false, 0, 'https://storage.googleapis.com/msgsndr/uLX0pzqaYQx8jI6PxNTT/media/6980e7b766e7ca56f70346a2.pdf', null)
on conflict (project, lot_number) do update set
  section = excluded.section,
  size_m2 = excluded.size_m2,
  price_per_m2 = excluded.price_per_m2,
  currency = excluded.currency,
  status = excluded.status,
  requires_prima = excluded.requires_prima,
  prima_pct = excluded.prima_pct,
  plano_visado_url = excluded.plano_visado_url,
  notes = excluded.notes;
