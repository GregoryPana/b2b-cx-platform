-- Cleanup all B2B survey responses (old data that no longer matches current questions)
-- This script is idempotent and safe to run multiple times.
-- It removes b2b_visit_responses only (the table you are using), but keeps visits and questions intact.

-- Reset any failed transaction state first
ROLLBACK;

-- Show what will be deleted (dry-run preview)
SELECT 
    'About to delete the following counts:' as info,
    (SELECT COUNT(*) FROM b2b_visit_responses WHERE visit_id IN (SELECT id FROM visits WHERE survey_type_id = (SELECT id FROM survey_types WHERE name = 'B2B'))) as b2b_responses;

-- Delete b2b_visit_responses (main responses table)
DELETE FROM b2b_visit_responses
WHERE visit_id IN (
    SELECT v.id FROM visits v
    JOIN survey_types st ON v.survey_type_id = st.id
    WHERE st.name = 'B2B'
);

-- Show results after deletion
SELECT 
    'After cleanup:' as info,
    (SELECT COUNT(*) FROM b2b_visit_responses WHERE visit_id IN (SELECT id FROM visits WHERE survey_type_id = (SELECT id FROM survey_types WHERE name = 'B2B'))) as b2b_responses_remaining;

-- Verify visits and questions are intact
SELECT 
    'Visits and questions are preserved:' as info,
    (SELECT COUNT(*) FROM visits WHERE survey_type_id = (SELECT id FROM survey_types WHERE name = 'B2B')) as b2b_visits,
    (SELECT COUNT(*) FROM questions WHERE survey_type_id = (SELECT id FROM survey_types WHERE name = 'B2B')) as b2b_questions;
