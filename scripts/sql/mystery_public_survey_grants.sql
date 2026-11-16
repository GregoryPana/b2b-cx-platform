-- Least-privilege grants the public (DMZ) Mystery Shopper backend needs to run the SURVEY
-- (locations, purposes, questions, visits, answers). Companion to mystery_public_role_grants.sql,
-- which only covers the sign-in tables.
--
-- Symptom when these are missing: after enrolling/signing in, the shopper app shows
-- "Question module scope is unavailable" and /api/questions returns 500, while
-- /api/mystery-shopper/locations and /purposes return 503 ("permission denied" in the DMZ backend log).
--
-- Run as a DBA/owner role on the PRODUCTION database (the same database the DMZ backend uses).
-- Idempotent: safe to run more than once. Tables that do not exist are skipped.
-- Intentionally NOT granted: DELETE anywhere, anything on businesses/analytics/admin tables.

BEGIN;

DO $$
DECLARE
    spec record;
    seq record;
BEGIN
    FOR spec IN
        SELECT * FROM (VALUES
            -- table                              privileges
            ('survey_types',                      'SELECT'),
            ('questions',                         'SELECT'),
            ('mystery_shopper_locations',         'SELECT'),
            ('mystery_shopper_purpose_options',   'SELECT'),
            ('visits',                            'SELECT, INSERT, UPDATE'),
            ('mystery_shopper_assessments',       'SELECT, INSERT, UPDATE'),
            ('mystery_shopper_answers',           'SELECT, INSERT, UPDATE'),
            ('b2b_visit_responses',               'SELECT, INSERT, UPDATE'),
            ('responses',                         'SELECT, INSERT, UPDATE')
        ) AS t(table_name, privs)
    LOOP
        IF to_regclass('public.' || spec.table_name) IS NOT NULL THEN
            EXECUTE format('GRANT %s ON public.%I TO mystery_public', spec.privs, spec.table_name);
        ELSE
            RAISE NOTICE 'skipped (table not found): %', spec.table_name;
        END IF;
    END LOOP;

    -- The backend maps each shopper to a row in the legacy users table (visits.representative_id/created_by).
    -- Column-level grants only: the public role must not read or change roles/other staff data.
    IF to_regclass('public.users') IS NOT NULL THEN
        GRANT SELECT (id, email, name) ON public.users TO mystery_public;
        GRANT INSERT (name, email, role, active) ON public.users TO mystery_public;
        GRANT UPDATE (name) ON public.users TO mystery_public;
    ELSE
        RAISE NOTICE 'skipped (table not found): users';
    END IF;

    -- Inserts into tables with serial/identity ids need the sequence too.
    FOR seq IN
        SELECT DISTINCT n.nspname AS schema_name, s.relname AS sequence_name
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid
                        AND d.classid = 'pg_class'::regclass
                        AND d.refclassid = 'pg_class'::regclass
                        AND d.deptype IN ('a', 'i')
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_namespace n ON n.oid = s.relnamespace
        WHERE s.relkind = 'S'
          AND n.nspname = 'public'
          AND t.relname IN ('users', 'visits', 'mystery_shopper_assessments', 'mystery_shopper_answers',
                            'b2b_visit_responses', 'responses')
    LOOP
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO mystery_public', seq.schema_name, seq.sequence_name);
    END LOOP;
END
$$;

COMMIT;

-- Verify: every row should show true where expected (answers/visits/assessments: select+insert+update;
-- survey_types, questions, locations, purposes: select only).
SELECT t.table_name,
       has_table_privilege('mystery_public', 'public.' || t.table_name, 'SELECT') AS can_select,
       has_table_privilege('mystery_public', 'public.' || t.table_name, 'INSERT') AS can_insert,
       has_table_privilege('mystery_public', 'public.' || t.table_name, 'UPDATE') AS can_update
FROM (VALUES ('survey_types'), ('questions'), ('mystery_shopper_locations'), ('mystery_shopper_purpose_options'),
             ('visits'), ('mystery_shopper_assessments'), ('mystery_shopper_answers'), ('b2b_visit_responses')) AS t(table_name);
