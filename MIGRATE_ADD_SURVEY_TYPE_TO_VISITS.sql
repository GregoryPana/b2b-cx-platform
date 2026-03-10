-- Migration: add survey_type_id to visits for multi-survey support
-- This enables a single unified dashboard across B2B / Mystery Shopper / Installation Assessment / future surveys.

-- 1) Add column (nullable initially for backward compatibility)
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS survey_type_id INTEGER;

-- 2) Add foreign key constraint (if it does not already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'fk_visits_survey_type_id'
    ) THEN
        ALTER TABLE visits
        ADD CONSTRAINT fk_visits_survey_type_id
        FOREIGN KEY (survey_type_id)
        REFERENCES survey_types(id);
    END IF;
END $$;

-- 3) Backfill existing rows to B2B survey type (if not already set)
UPDATE visits v
SET survey_type_id = st.id
FROM survey_types st
WHERE st.name = 'B2B'
  AND v.survey_type_id IS NULL;

-- 4) Index for filtering/reporting
CREATE INDEX IF NOT EXISTS idx_visits_survey_type_id ON visits(survey_type_id);
