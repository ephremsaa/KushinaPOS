-- ============================================================
-- kushinaPOS — Migration 0004: Enable Row Level Security (RLS)
-- Enables RLS on all existing tables in the public schema.
-- ============================================================

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END;
$$;
