-- Idempotent grants for the restricted DMZ database role used by the public Mystery Shopper backend.
-- Run on the internal Postgres server as a DBA / table owner:
--   psql "<admin connection>" -f scripts/sql/mystery_public_role_grants.sql
-- Safe to re-run. Does NOT grant access to admin tables such as "users".

GRANT SELECT, INSERT, UPDATE ON
  mystery_users,
  mystery_enrollment_tokens,
  mystery_sessions,
  mystery_mfa_challenges
TO mystery_public;

-- Enrollment/recovery replaces a user's recovery codes (DELETE + INSERT).
GRANT SELECT, INSERT, UPDATE, DELETE ON mystery_recovery_codes TO mystery_public;

-- Append-only audit trail.
GRANT INSERT ON mystery_auth_audit TO mystery_public;

-- Verify (expect every row = true):
SELECT t.tbl,
       has_table_privilege('mystery_public', t.tbl, t.priv) AS ok,
       t.priv
FROM (VALUES
  ('mystery_users','SELECT'),('mystery_users','UPDATE'),
  ('mystery_enrollment_tokens','INSERT'),('mystery_enrollment_tokens','UPDATE'),
  ('mystery_sessions','INSERT'),('mystery_sessions','UPDATE'),
  ('mystery_mfa_challenges','INSERT'),('mystery_mfa_challenges','UPDATE'),
  ('mystery_recovery_codes','DELETE'),('mystery_recovery_codes','INSERT'),
  ('mystery_auth_audit','INSERT')
) AS t(tbl, priv);
