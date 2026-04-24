-- Migration 005: Reconcile itinerary_days Phase 1 → Phase 2
--
-- The Phase 1 table has: id, trip_id, date, city, country, title, plan,
--   intensity, is_special, special_label, created_at, updated_at
-- The Phase 2 Pydantic model (app/models/itinerary.py) expects:
--   id, trip_id, position, date, city, day_type, notes, created_at, updated_at
--
-- This migration adds the missing Phase 2 columns without dropping any Phase 1
-- columns (dropping is a separate cleanup story). All ALTER statements are
-- idempotent via IF NOT EXISTS / DO $$ guards.

-- ── Step 1: Add missing columns (nullable so existing rows are unaffected) ────

ALTER TABLE itinerary_days
    ADD COLUMN IF NOT EXISTS position   integer,
    ADD COLUMN IF NOT EXISTS day_type   text,
    ADD COLUMN IF NOT EXISTS notes      text,
    ADD COLUMN IF NOT EXISTS created_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ── Step 2: Backfill position — 1..N per trip ordered by date ─────────────────

UPDATE itinerary_days AS d
SET    position = sub.rn
FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY date) AS rn
    FROM   itinerary_days
) AS sub
WHERE d.id = sub.id
  AND d.position IS NULL;

-- ── Step 3: Backfill day_type ─────────────────────────────────────────────────

UPDATE itinerary_days
SET    day_type = 'exploration'
WHERE  day_type IS NULL;

-- ── Step 4: Backfill notes from plan column ───────────────────────────────────

UPDATE itinerary_days
SET    notes = plan
WHERE  notes IS NULL
  AND  plan  IS NOT NULL;

-- ── Step 5: Backfill created_at and updated_at ────────────────────────────────

UPDATE itinerary_days
SET    created_at = now()
WHERE  created_at IS NULL;

UPDATE itinerary_days
SET    updated_at = now()
WHERE  updated_at IS NULL;

-- ── Step 6: Enforce NOT NULL on position and day_type after backfill ──────────

ALTER TABLE itinerary_days
    ALTER COLUMN position SET NOT NULL,
    ALTER COLUMN day_type SET NOT NULL;

-- ── Step 7: Add day_type CHECK constraint (idempotent) ────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname  = 'itinerary_days_day_type_check'
          AND  conrelid = 'itinerary_days'::regclass
    ) THEN
        ALTER TABLE itinerary_days
            ADD CONSTRAINT itinerary_days_day_type_check
            CHECK (day_type IN ('exploration', 'rest', 'transit'));
    END IF;
END;
$$;

-- ── Step 8: Add UNIQUE (trip_id, position) if not already present ─────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname  = 'itinerary_days_trip_id_position_key'
          AND  conrelid = 'itinerary_days'::regclass
    ) THEN
        ALTER TABLE itinerary_days
            ADD CONSTRAINT itinerary_days_trip_id_position_key
            UNIQUE (trip_id, position);
    END IF;
END;
$$;

-- ── Step 9: Verify updated_at trigger exists (should have been created in 004) ─

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'itinerary_days_updated_at'
    ) THEN
        CREATE TRIGGER itinerary_days_updated_at
            BEFORE UPDATE ON itinerary_days
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;
