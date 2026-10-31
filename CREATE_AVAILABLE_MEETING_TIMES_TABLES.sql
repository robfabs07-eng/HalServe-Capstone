-- ==============================================================================
-- MIGRATION: AVAILABLE MEETING TIMES & CALENDAR DATE LOCKING SYSTEM
-- Halden's Catering Services
-- ==============================================================================

-- 1. Table for weekly recurring meeting availability configured by admin
CREATE TABLE IF NOT EXISTS admin_meeting_availability (
  id TEXT PRIMARY KEY, -- 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  day_name TEXT NOT NULL,
  day_of_week INT NOT NULL, -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default days if not already present
INSERT INTO admin_meeting_availability (id, day_name, day_of_week, is_disabled, time_slots)
VALUES
  ('sunday', 'Sunday', 0, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('monday', 'Monday', 1, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('tuesday', 'Tuesday', 2, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('wednesday', 'Wednesday', 3, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('thursday', 'Thursday', 4, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('friday', 'Friday', 5, false, '["1:00 PM to 5:00 PM"]'::jsonb),
  ('saturday', 'Saturday', 6, false, '["1:00 PM to 5:00 PM"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS and permissive policies for anon / client-side sync
ALTER TABLE admin_meeting_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_meeting_availability' AND policyname = 'Public read admin_meeting_availability') THEN
    CREATE POLICY "Public read admin_meeting_availability" ON admin_meeting_availability FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_meeting_availability' AND policyname = 'Public insert admin_meeting_availability') THEN
    CREATE POLICY "Public insert admin_meeting_availability" ON admin_meeting_availability FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_meeting_availability' AND policyname = 'Public update admin_meeting_availability') THEN
    CREATE POLICY "Public update admin_meeting_availability" ON admin_meeting_availability FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_meeting_availability' AND policyname = 'Public delete admin_meeting_availability') THEN
    CREATE POLICY "Public delete admin_meeting_availability" ON admin_meeting_availability FOR DELETE USING (true);
  END IF;
END $$;

-- 2. Table for specific calendar dates disabled by admin
CREATE TABLE IF NOT EXISTS disabled_calendar_dates (
  date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'
  is_disabled BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT DEFAULT 'Disabled by admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE disabled_calendar_dates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disabled_calendar_dates' AND policyname = 'Public read disabled_calendar_dates') THEN
    CREATE POLICY "Public read disabled_calendar_dates" ON disabled_calendar_dates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disabled_calendar_dates' AND policyname = 'Public insert disabled_calendar_dates') THEN
    CREATE POLICY "Public insert disabled_calendar_dates" ON disabled_calendar_dates FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disabled_calendar_dates' AND policyname = 'Public update disabled_calendar_dates') THEN
    CREATE POLICY "Public update disabled_calendar_dates" ON disabled_calendar_dates FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disabled_calendar_dates' AND policyname = 'Public delete disabled_calendar_dates') THEN
    CREATE POLICY "Public delete disabled_calendar_dates" ON disabled_calendar_dates FOR DELETE USING (true);
  END IF;
END $$;

-- 3. Table for active customer selection drafts (for real-time collision detection / yellow glow)
CREATE TABLE IF NOT EXISTS active_selection_drafts (
  id TEXT PRIMARY KEY, -- session_id or user_id
  event_date TEXT,
  meeting_date TEXT,
  meeting_time TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_selection_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_selection_drafts' AND policyname = 'Public read active_selection_drafts') THEN
    CREATE POLICY "Public read active_selection_drafts" ON active_selection_drafts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_selection_drafts' AND policyname = 'Public insert active_selection_drafts') THEN
    CREATE POLICY "Public insert active_selection_drafts" ON active_selection_drafts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_selection_drafts' AND policyname = 'Public update active_selection_drafts') THEN
    CREATE POLICY "Public update active_selection_drafts" ON active_selection_drafts FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_selection_drafts' AND policyname = 'Public delete active_selection_drafts') THEN
    CREATE POLICY "Public delete active_selection_drafts" ON active_selection_drafts FOR DELETE USING (true);
  END IF;
END $$;

-- 4. Enable Supabase Realtime for instant synchronization across clients
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_meeting_availability;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE disabled_calendar_dates;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_selection_drafts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
