-- ==============================================================================
-- TABLE: HARD DISABLED DAYS FOR BOOKINGS & MEETINGS
-- Allows complete hard-disabling of specific days of the week (Monday - Sunday)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS hard_disabled_days (
  id TEXT PRIMARY KEY, -- 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  day_name TEXT NOT NULL,
  day_of_week INT NOT NULL, -- 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default days (Monday through Sunday, initially enabled / not disabled)
INSERT INTO hard_disabled_days (id, day_name, day_of_week, is_disabled)
VALUES
  ('monday', 'Monday', 1, false),
  ('tuesday', 'Tuesday', 2, false),
  ('wednesday', 'Wednesday', 3, false),
  ('thursday', 'Thursday', 4, false),
  ('friday', 'Friday', 5, false),
  ('saturday', 'Saturday', 6, false),
  ('sunday', 'Sunday', 0, false)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE hard_disabled_days ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for booking calendars and meeting pickers)
DROP POLICY IF EXISTS "Allow public read hard_disabled_days" ON hard_disabled_days;
CREATE POLICY "Allow public read hard_disabled_days"
  ON hard_disabled_days FOR SELECT
  USING (true);

-- Allow insert/upsert access
DROP POLICY IF EXISTS "Allow anon insert hard_disabled_days" ON hard_disabled_days;
CREATE POLICY "Allow anon insert hard_disabled_days"
  ON hard_disabled_days FOR INSERT
  WITH CHECK (true);

-- Allow update access
DROP POLICY IF EXISTS "Allow anon update hard_disabled_days" ON hard_disabled_days;
CREATE POLICY "Allow anon update hard_disabled_days"
  ON hard_disabled_days FOR UPDATE
  USING (true);

-- Allow delete access
DROP POLICY IF EXISTS "Allow anon delete hard_disabled_days" ON hard_disabled_days;
CREATE POLICY "Allow anon delete hard_disabled_days"
  ON hard_disabled_days FOR DELETE
  USING (true);
