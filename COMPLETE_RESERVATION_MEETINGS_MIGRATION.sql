-- ==============================================================================
-- SMART SERVE / HALDEN'S CATERING: COMPLETE CONSOLIDATED DATABASE MIGRATION
-- Run this in your Supabase SQL Editor (Primary & Backup projects)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADMIN MEETING AVAILABILITY TABLE
-- Stores admin's weekly time slot configuration and day toggle statuses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_meeting_availability (
    id TEXT PRIMARY KEY,
    day_name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL UNIQUE,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safely cleanup legacy duplicate prefix rows (e.g. day_0..day_6)
DELETE FROM public.admin_meeting_availability WHERE id LIKE 'day_%';

-- Seed canonical days (Sunday to Saturday) with standard 1:00 PM to 5:00 PM availability
INSERT INTO public.admin_meeting_availability (id, day_name, day_of_week, is_disabled, time_slots)
VALUES
    ('sunday', 'Sunday', 0, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('monday', 'Monday', 1, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('tuesday', 'Tuesday', 2, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('wednesday', 'Wednesday', 3, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('thursday', 'Thursday', 4, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('friday', 'Friday', 5, false, '["1:00 PM to 5:00 PM"]'::jsonb),
    ('saturday', 'Saturday', 6, false, '["1:00 PM to 5:00 PM"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    day_name = EXCLUDED.day_name,
    day_of_week = EXCLUDED.day_of_week;

-- ------------------------------------------------------------------------------
-- 2. DISABLED CALENDAR DATES TABLE
-- Stores specific dates disabled by admin on the Approved Calendar
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disabled_calendar_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL UNIQUE,
    is_disabled BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT DEFAULT 'Disabled by admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_disabled_calendar_dates_date ON public.disabled_calendar_dates(date);

-- ------------------------------------------------------------------------------
-- 3. ACTIVE SELECTION DRAFTS TABLE
-- Real-time cross-client draft tracking (conflict bubble & yellow highlighting)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.active_selection_drafts (
    id TEXT PRIMARY KEY,
    event_date TEXT,
    meeting_date TEXT,
    meeting_time TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_active_drafts_updated ON public.active_selection_drafts(updated_at);

-- ------------------------------------------------------------------------------
-- 4. MEETINGS TABLE COLUMNS & CONSTRAINTS
-- Scheduled meetings for contract finalization and consultations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID,
    "reservationId" TEXT,
    "packageName" TEXT,
    package_name TEXT,
    topic TEXT DEFAULT 'Contract finalization',
    agenda TEXT DEFAULT 'Contract finalization',
    status TEXT DEFAULT 'scheduled',
    date TEXT,
    time TEXT,
    "timeEnd" TEXT,
    time_end TEXT,
    "clientName" TEXT,
    "customerName" TEXT,
    customer_name TEXT,
    "customerEmail" TEXT,
    customer_email TEXT,
    notes TEXT,
    meeting_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "createdAt" TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    "updatedAt" TEXT
);

-- Safely add missing columns to any existing meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS reservation_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "packageName" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'Contract finalization';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS agenda TEXT DEFAULT 'Contract finalization';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "timeEnd" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS time_end TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;

-- ------------------------------------------------------------------------------
-- 5. RESERVATIONS & RESERVATION ITEMS SCHEMA ENHANCEMENTS
-- Customizations, item portions, and meeting references
-- ------------------------------------------------------------------------------
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS custom_items JSONB;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS proposed_meeting_times JSONB;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS meeting_times JSONB;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS selected_meeting_date TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS selected_meeting_time TEXT;

ALTER TABLE public.reservation_items ADD COLUMN IF NOT EXISTS custom_pax INTEGER;
ALTER TABLE public.reservation_items ADD COLUMN IF NOT EXISTS specifications TEXT;
ALTER TABLE public.reservation_items ADD COLUMN IF NOT EXISTS portion_pax INTEGER;
ALTER TABLE public.reservation_items ADD COLUMN IF NOT EXISTS portion_specs TEXT;

-- ------------------------------------------------------------------------------
-- 6. AI RULES TABLE
-- Stores dynamic AI Planner instructions and budgeting rules
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_rules (
    id TEXT PRIMARY KEY DEFAULT 'default',
    rules TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 7. RESERVATION EXECUTION PROCUREMENT & LOGISTICS STATUS TABLE
-- Tracks sorted status of food, equipment, personnel, decor, staff, transport
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_exec_sorted (
    reservation_id TEXT PRIMARY KEY,
    sorted_food BOOLEAN DEFAULT FALSE,
    sorted_equipment BOOLEAN DEFAULT FALSE,
    sorted_decoration BOOLEAN DEFAULT FALSE,
    sorted_personnel BOOLEAN DEFAULT FALSE,
    sorted_staff_allocation BOOLEAN DEFAULT FALSE,
    sorted_transportation BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Grant full anon and authenticated access for seamless web application workflow
-- ------------------------------------------------------------------------------
ALTER TABLE public.admin_meeting_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disabled_calendar_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_selection_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access on admin_meeting_availability" ON public.admin_meeting_availability;
CREATE POLICY "Public access on admin_meeting_availability" ON public.admin_meeting_availability FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on disabled_calendar_dates" ON public.disabled_calendar_dates;
CREATE POLICY "Public access on disabled_calendar_dates" ON public.disabled_calendar_dates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on active_selection_drafts" ON public.active_selection_drafts;
CREATE POLICY "Public access on active_selection_drafts" ON public.active_selection_drafts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on meetings" ON public.meetings;
CREATE POLICY "Public access on meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on ai_rules" ON public.ai_rules;
CREATE POLICY "Public access on ai_rules" ON public.ai_rules FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.reservation_exec_sorted ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access on reservation_exec_sorted" ON public.reservation_exec_sorted;
CREATE POLICY "Public access on reservation_exec_sorted" ON public.reservation_exec_sorted FOR ALL USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 9. REALTIME REPLICATION CONFIGURATION
-- Enables instant real-time synchronization across admin and client tabs
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_meeting_availability;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disabled_calendar_dates;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_selection_drafts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_rules;
EXCEPTION WHEN OTHERS THEN NULL;
END $;

DO $
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_exec_sorted;
EXCEPTION WHEN OTHERS THEN NULL;
END $;

-- ------------------------------------------------------------------------------
-- 10. CANCELLATION REQUESTS TABLE
-- Tracks customer cancellation submissions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access on cancellation_requests" ON public.cancellation_requests;
CREATE POLICY "Public access on cancellation_requests" ON public.cancellation_requests FOR ALL USING (true) WITH CHECK (true);

DO $
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cancellation_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $;
