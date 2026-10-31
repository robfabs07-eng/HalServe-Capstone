-- ==============================================================================
-- CALIBRATED HISTORICAL RESERVATIONS FOR 3-YEAR WEIGHTED MOVING AVERAGE (2022-2026)
-- Halden Catering Services - System Seed
--
-- Compliance Specifications:
-- 1. Date Range: Strictly 2022-01-01 to 2026-10-31 (Nov 2026 onwards has 0 records)
-- 2. Single Digits: Monthly bookings are single digits (Dec max 12 bookings)
-- 3. Realistic Variances: Multi-factor distribution ({0, +1, -1, +2, -2}), NOT artificial +/- 1!
-- 4. Target Accuracy: Total Window Accuracy >= 85%-87%, authentic dips (50%-67%) & hits (100%)
-- ==============================================================================

-- 1. Purge all legacy pre-2022 records (explicit ::text cast to avoid operator text = uuid errors)
DELETE FROM reservation_payments WHERE reservation_id::text IN (SELECT id::text FROM reservations WHERE date::text < '2022-01-01');
DELETE FROM reservations WHERE date::text < '2022-01-01';

-- 2. Purge any reservations in November 2026 onwards (0 records beyond October 2026)
DELETE FROM reservation_payments WHERE reservation_id::text IN (SELECT id::text FROM reservations WHERE date::text >= '2026-11-01');
DELETE FROM reservations WHERE date::text >= '2026-11-01';

-- 3. Calibrate historical months to realistic volume caps
WITH ranked AS (
  SELECT id, date,
         ROW_NUMBER() OVER (
           PARTITION BY substr(date::text, 1, 7) 
           ORDER BY date ASC, created_at ASC
         ) as rn
  FROM reservations
  WHERE (LOWER(status) = 'completed' OR LOWER(ops_status) = 'completed')
    AND date::text >= '2022-01-01' AND date::text < '2026-11-01'
)
UPDATE reservations
SET status = 'cancelled', ops_status = 'cancelled'
WHERE id::text IN (
  SELECT id::text FROM ranked
  WHERE (
    -- 2022
    (date::text LIKE '2022-03%' AND rn > 5) OR
    (date::text LIKE '2022-04%' AND rn > 4) OR
    (date::text LIKE '2022-06%' AND rn > 4) OR
    (date::text LIKE '2022-07%' AND rn > 4) OR
    (date::text LIKE '2022-08%' AND rn > 4) OR
    -- 2023
    (date::text LIKE '2023-01%' AND rn > 5) OR
    (date::text LIKE '2023-02%' AND rn > 4) OR
    (date::text LIKE '2023-04%' AND rn > 5) OR
    (date::text LIKE '2023-06%' AND rn > 5) OR
    -- 2024
    (date::text LIKE '2024-02%' AND rn > 4) OR
    (date::text LIKE '2024-04%' AND rn > 4) OR
    (date::text LIKE '2024-06%' AND rn > 4) OR
    (date::text LIKE '2024-08%' AND rn > 4) OR
    (date::text LIKE '2024-12%' AND rn > 12) OR
    -- 2025
    (date::text LIKE '2025-05%' AND rn > 5) OR
    (date::text LIKE '2025-12%' AND rn > 11)
  )
);

-- 4. Insert calibrated supplementary reservations for realistic variance mix
-- Insert Joshua Villanueva (2022-05-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '8cd26d96-e406-4f93-b2e2-b9a7a108b6b4', 'Joshua Villanueva', 'Joshua Villanueva', 'joshua.villanueva@gmail.com', '09170000001', '2022-05-15', '12:00 PM to 5:00 PM', 'Don Bautista Pavillion', 'Malabon',
  60, 'Celebration', 'Pastel Gold Celebration', 'Celebration Package A for 60 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 55000, 55000, 'cash',
  'paid', 'Celebration Package A', 'majorly_set', 5000, true, 'paid',
  27500, 'paid', 22500, 'paid', true, 0, '2022-05-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  'ce4ad7a2-8f97-4bbc-abb0-bcc19be6262c', '8cd26d96-e406-4f93-b2e2-b9a7a108b6b4', 55000, 5000, 'paid', 'cash', 5000,
  27500, 'paid', 'cash', 27500, 22500, 'paid', 'cash', 22500
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Samantha Perez (2022-09-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'f59f7b43-c507-4b18-b267-37b058642ce5', 'Samantha Perez', 'Samantha Perez', 'samantha.perez@gmail.com', '09170000002', '2022-09-15', '12:00 PM to 5:00 PM', 'Haldens Grand Ballroom', 'Valenzuela',
  80, 'Celebration', 'Modern Floral Elegance', 'Celebration Package B for 80 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 72000, 72000, 'cash',
  'paid', 'Celebration Package B', 'majorly_set', 5000, true, 'paid',
  36000, 'paid', 31000, 'paid', true, 0, '2022-09-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '1ca3e981-772d-4338-985e-74f84f8bc27e', 'f59f7b43-c507-4b18-b267-37b058642ce5', 72000, 5000, 'paid', 'cash', 5000,
  36000, 'paid', 'cash', 36000, 31000, 'paid', 'cash', 31000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Kristoff De Leon (2022-10-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '7a9c8350-d0f8-44e4-b367-12b39b3f8d5e', 'Kristoff De Leon', 'Kristoff De Leon', 'kristoff.de.leon@gmail.com', '09170000003', '2022-10-15', '12:00 PM to 5:00 PM', 'The Glass Garden', 'Pasig',
  50, 'Christening', 'Angelic White and Gold', 'Christening Package A for 50 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 45000, 45000, 'cash',
  'paid', 'Christening Package A', 'majorly_set', 5000, true, 'paid',
  22500, 'paid', 17500, 'paid', true, 0, '2022-10-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '34c1871f-e343-404c-98b3-5e4315c2d15e', '7a9c8350-d0f8-44e4-b367-12b39b3f8d5e', 45000, 5000, 'paid', 'cash', 5000,
  22500, 'paid', 'cash', 22500, 17500, 'paid', 'cash', 17500
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Beatriz Concepcion (2022-12-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'cf4fefdc-2c06-479b-8136-996916e472c5', 'Beatriz Concepcion', 'Beatriz Concepcion', 'beatriz.concepcion@gmail.com', '09170000004', '2022-12-15', '12:00 PM to 5:00 PM', 'Fernwood Gardens', 'Quezon City',
  70, 'Kiddie Party', 'Playful Carnival Fun', 'Kiddie Party Package 1 for 70 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 60000, 60000, 'cash',
  'paid', 'Kiddie Party Package 1', 'majorly_set', 5000, true, 'paid',
  30000, 'paid', 25000, 'paid', true, 0, '2022-12-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  'd83862cb-60d3-4cb9-96aa-ccf71f763394', 'cf4fefdc-2c06-479b-8136-996916e472c5', 60000, 5000, 'paid', 'cash', 5000,
  30000, 'paid', 'cash', 30000, 25000, 'paid', 'cash', 25000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Teodoro Valderrama (2023-12-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '9840c41c-d14f-441f-9ab5-1f2c437096ee', 'Teodoro Valderrama', 'Teodoro Valderrama', 'teodoro.valderrama@gmail.com', '09170000005', '2023-12-15', '12:00 PM to 5:00 PM', 'Oasis Manila', 'San Juan',
  100, 'Debut', 'Enchanted Fairytale Debut', 'Debut Grand Package for 100 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 88000, 88000, 'cash',
  'paid', 'Debut Grand Package', 'majorly_set', 5000, true, 'paid',
  44000, 'paid', 39000, 'paid', true, 0, '2023-12-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '8a9af8a9-6063-4577-942c-1e4dcb6895e9', '9840c41c-d14f-441f-9ab5-1f2c437096ee', 88000, 5000, 'paid', 'cash', 5000,
  44000, 'paid', 'cash', 44000, 39000, 'paid', 'cash', 39000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Cecilia Montemayor (2024-01-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '9b1e22eb-ef19-4f7c-8196-60ef19793a38', 'Cecilia Montemayor', 'Cecilia Montemayor', 'cecilia.montemayor@gmail.com', '09170000006', '2024-01-15', '12:00 PM to 5:00 PM', 'Light of Love Events Place', 'Quezon City',
  80, 'Anniversary', 'Silver Jubilee Romance', 'Anniversary Celebration Package for 80 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 68000, 68000, 'cash',
  'paid', 'Anniversary Celebration Package', 'majorly_set', 5000, true, 'paid',
  34000, 'paid', 29000, 'paid', true, 0, '2024-01-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  'bac702d7-ce08-4752-92fb-73c006418c03', '9b1e22eb-ef19-4f7c-8196-60ef19793a38', 68000, 5000, 'paid', 'cash', 5000,
  34000, 'paid', 'cash', 34000, 29000, 'paid', 'cash', 29000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Victorino Salcedo (2025-02-14) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'efd1efa0-eb47-4f6b-9831-8f598d04cb02', 'Victorino Salcedo', 'Victorino Salcedo', 'victorino.salcedo@gmail.com', '09170000007', '2025-02-14', '12:00 PM to 5:00 PM', 'Polo Pavilion', 'Valenzuela',
  60, 'Reunion', 'Warm Festive Warmth', 'Holiday Family Reunion Package for 60 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 52000, 52000, 'cash',
  'paid', 'Holiday Family Reunion Package', 'majorly_set', 5000, true, 'paid',
  26000, 'paid', 21000, 'paid', true, 0, '2025-02-14 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '23fab2f4-5b7d-41b1-9926-8a0a11ec2fe2', 'efd1efa0-eb47-4f6b-9831-8f598d04cb02', 52000, 5000, 'paid', 'cash', 5000,
  26000, 'paid', 'cash', 26000, 21000, 'paid', 'cash', 21000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Carmela Pangilinan (2025-04-10) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '982070d1-de8d-486d-92a8-7ae1b07bcf69', 'Carmela Pangilinan', 'Carmela Pangilinan', 'carmela.pangilinan@gmail.com', '09170000008', '2025-04-10', '12:00 PM to 5:00 PM', 'Sitio Elena Events Venue', 'Rizal',
  120, 'Corporate', 'Black Tie Corporate Gala', 'Executive Gala Package for 120 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 110000, 110000, 'cash',
  'paid', 'Executive Gala Package', 'majorly_set', 5000, true, 'paid',
  55000, 'paid', 50000, 'paid', true, 0, '2025-04-10 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '471d895e-e61a-4db3-9094-953b998ce287', '982070d1-de8d-486d-92a8-7ae1b07bcf69', 110000, 5000, 'paid', 'cash', 5000,
  55000, 'paid', 'cash', 55000, 50000, 'paid', 'cash', 50000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Wilfredo Abellanosa (2025-04-21) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'fd4b1887-874d-4afa-b6a2-872afb094dd9', 'Wilfredo Abellanosa', 'Wilfredo Abellanosa', 'wilfredo.abellanosa@gmail.com', '09170000009', '2025-04-21', '12:00 PM to 5:00 PM', 'Sampaguita Gardens', 'Quezon City',
  60, 'Celebration', 'Pastel Gold Celebration', 'Celebration Package A for 60 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 55000, 55000, 'cash',
  'paid', 'Celebration Package A', 'majorly_set', 5000, true, 'paid',
  27500, 'paid', 22500, 'paid', true, 0, '2025-04-21 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '58c4bf46-f8a8-437e-b371-d1ae6be2bd4e', 'fd4b1887-874d-4afa-b6a2-872afb094dd9', 55000, 5000, 'paid', 'cash', 5000,
  27500, 'paid', 'cash', 27500, 22500, 'paid', 'cash', 22500
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Clarisse Ong (2025-07-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '47721550-1e7b-4082-8080-bb9a2a9a4045', 'Clarisse Ong', 'Clarisse Ong', 'clarisse.ong@gmail.com', '09170000010', '2025-07-15', '12:00 PM to 5:00 PM', 'The Blue Leaf Cosmopolitan', 'Quezon City',
  80, 'Celebration', 'Modern Floral Elegance', 'Celebration Package B for 80 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 72000, 72000, 'cash',
  'paid', 'Celebration Package B', 'majorly_set', 5000, true, 'paid',
  36000, 'paid', 31000, 'paid', true, 0, '2025-07-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '17dcc936-715f-41d7-9b7a-5a3ac30a15f0', '47721550-1e7b-4082-8080-bb9a2a9a4045', 72000, 5000, 'paid', 'cash', 5000,
  36000, 'paid', 'cash', 36000, 31000, 'paid', 'cash', 31000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Mateo Capistrano (2026-01-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'eac83d12-9270-4972-867c-74fadc51c0fb', 'Mateo Capistrano', 'Mateo Capistrano', 'mateo.capistrano@gmail.com', '09170000011', '2026-01-15', '12:00 PM to 5:00 PM', 'Don Bautista Pavillion', 'Malabon',
  50, 'Christening', 'Angelic White and Gold', 'Christening Package A for 50 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 45000, 45000, 'cash',
  'paid', 'Christening Package A', 'majorly_set', 5000, true, 'paid',
  22500, 'paid', 17500, 'paid', true, 0, '2026-01-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '1838e38a-9612-44f3-9bee-8960ee653e6a', 'eac83d12-9270-4972-867c-74fadc51c0fb', 45000, 5000, 'paid', 'cash', 5000,
  22500, 'paid', 'cash', 22500, 17500, 'paid', 'cash', 17500
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Teresita Dimaculangan (2026-03-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'f5abc20b-1a10-4e34-a714-995c171d680a', 'Teresita Dimaculangan', 'Teresita Dimaculangan', 'teresita.dimaculangan@gmail.com', '09170000012', '2026-03-15', '12:00 PM to 5:00 PM', 'Haldens Grand Ballroom', 'Valenzuela',
  70, 'Kiddie Party', 'Playful Carnival Fun', 'Kiddie Party Package 1 for 70 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 60000, 60000, 'cash',
  'paid', 'Kiddie Party Package 1', 'majorly_set', 5000, true, 'paid',
  30000, 'paid', 25000, 'paid', true, 0, '2026-03-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '46123537-7ca7-4f32-b03b-7e47942a3f6a', 'f5abc20b-1a10-4e34-a714-995c171d680a', 60000, 5000, 'paid', 'cash', 5000,
  30000, 'paid', 'cash', 30000, 25000, 'paid', 'cash', 25000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Arturo Casimiro (2026-06-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  '9b84fec1-63a5-4cc9-a780-e4307b3b4e1e', 'Arturo Casimiro', 'Arturo Casimiro', 'arturo.casimiro@gmail.com', '09170000013', '2026-06-15', '12:00 PM to 5:00 PM', 'The Glass Garden', 'Pasig',
  100, 'Debut', 'Enchanted Fairytale Debut', 'Debut Grand Package for 100 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 88000, 88000, 'cash',
  'paid', 'Debut Grand Package', 'majorly_set', 5000, true, 'paid',
  44000, 'paid', 39000, 'paid', true, 0, '2026-06-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  'cbe3d757-e0ce-4249-8b3f-742b8e965f32', '9b84fec1-63a5-4cc9-a780-e4307b3b4e1e', 88000, 5000, 'paid', 'cash', 5000,
  44000, 'paid', 'cash', 44000, 39000, 'paid', 'cash', 39000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;

-- Insert Beatrice Macapagal (2026-08-15) in reservations
INSERT INTO reservations (
  id, client_name, client, client_email, client_phone, date, timeframe, venue, venue_location,
  pax, type, theme, description, status, ops_status, amount, base_price, payment_method,
  payment_status, package_name, pricing_mode, initial_fee, initial_fee_paid, initial_fee_status,
  downpayment_amount, downpayment_status, final_payment_amount, final_payment_status, settled, settlement_amount, created_at
) VALUES (
  'e7b97a05-2d5a-4698-b223-22f6cf444887', 'Beatrice Macapagal', 'Beatrice Macapagal', 'beatrice.macapagal@gmail.com', '09170000014', '2026-08-15', '12:00 PM to 5:00 PM', 'Fernwood Gardens', 'Quezon City',
  80, 'Anniversary', 'Silver Jubilee Romance', 'Anniversary Celebration Package for 80 Pax with Catering and Full Venue Styling included.', 'completed', 'completed', 68000, 68000, 'cash',
  'paid', 'Anniversary Celebration Package', 'majorly_set', 5000, true, 'paid',
  34000, 'paid', 29000, 'paid', true, 0, '2026-08-15 09:00:00+00'
) ON CONFLICT (id) DO UPDATE SET status = 'completed', ops_status = 'completed';

INSERT INTO reservation_payments (
  id, reservation_id, total_contract_value, initial_fee_amount, initial_fee_status, initial_fee_method, initial_fee_received,
  downpayment_amount, downpayment_status, downpayment_method, downpayment_received,
  final_payment_amount, final_payment_status, final_method, final_received
) VALUES (
  '025aace0-0d80-41fa-b07f-4a481badca4f', 'e7b97a05-2d5a-4698-b223-22f6cf444887', 68000, 5000, 'paid', 'cash', 5000,
  34000, 'paid', 'cash', 34000, 29000, 'paid', 'cash', 29000
) ON CONFLICT (id) DO UPDATE SET total_contract_value = EXCLUDED.total_contract_value;