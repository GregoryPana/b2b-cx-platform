# DMZ → Internal DB Connectivity Checklist

Run through these in order. Each step blocks the next — don't skip ahead.

---

## 1. Network path

From the **DMZ VM**, confirm a route exists to the internal DB host on the Postgres port:

```bash
nc -zv <internal-db-host> 5433
```

Expected: `Connection to <host> 5433 port [tcp] succeeded`

If this fails, stop — get ops to open the firewall rule (DMZ host → internal host, port 5433, source IP locked to the DMZ backend's address) before continuing.

---

## 2. Create the restricted DB role

Run once, on the internal Postgres server, as a DBA:

```sql
CREATE USER mystery_public WITH PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE "cwscx-postgres" TO mystery_public;
GRANT USAGE ON SCHEMA public TO mystery_public;
GRANT SELECT, INSERT, UPDATE ON
  visits, mystery_shopper_assessments, mystery_shopper_answers,
  questions, mystery_shopper_locations, mystery_shopper_purpose_options,
  mystery_users, mystery_enrollment_tokens,
  mystery_sessions, mystery_mfa_challenges
TO mystery_public;
-- Enrollment replaces recovery codes (DELETE + INSERT); the audit log is append-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON mystery_recovery_codes TO mystery_public;
GRANT INSERT ON mystery_auth_audit TO mystery_public;
```

> The original list omitted `mystery_recovery_codes`, `mystery_sessions`, `mystery_mfa_challenges` and
> `mystery_auth_audit`. Without them, `POST /api/auth/enroll/confirm` and sign-in fail with HTTP 500/503
> (`permission denied for table ...` in the DMZ backend journal). Existing roles can be repaired with
> `scripts/sql/mystery_public_role_grants.sql`.

Confirm `listen_addresses` in `postgresql.conf` includes the interface reachable from the DMZ, and `pg_hba.conf` has a line allowing the DMZ host's IP to connect as `mystery_public` over SSL.

---

## 3. Connection tests (run from the DMZ VM)

**a. Can it connect and read mystery tables?**
```bash
psql "postgresql://mystery_public:<password>@<internal-host>:5433/cwscx-postgres?sslmode=require" \
  -c "SELECT COUNT(*) FROM mystery_shopper_locations;"
```
Expected: a row count, no error.

**b. Is it correctly locked out of admin tables?**
```bash
psql "postgresql://mystery_public:<password>@<internal-host>:5433/cwscx-postgres?sslmode=require" \
  -c "SELECT COUNT(*) FROM users;"
```
Expected: `ERROR: permission denied for table users`. If this succeeds, the grants are too broad — fix before proceeding.

**c. Is the connection actually using SSL?**
```bash
psql "postgresql://mystery_public:<password>@<internal-host>:5433/cwscx-postgres?sslmode=require" \
  -c "SELECT ssl, client_addr FROM pg_stat_ssl WHERE pid = pg_backend_pid();"
```
Expected: `ssl` column is `t`.

---

## 4. Wire up the DMZ backend

`/opt/cwscx-mystery-public/backend/.env`:
```
DATABASE_URL=postgresql://mystery_public:<password>@<internal-host>:5433/cwscx-postgres?sslmode=require
AUTH_MODE=mystery_public
MYSTERY_PUBLIC_BASE_URL=https://<dmz-public-url>
MYSTERY_AUTH_SECRET_KEY=<must match the internal backend's key exactly>
```

The secret key must be identical to the internal backend's — enrollment tokens are encrypted with it, and the DMZ backend needs to decrypt them.

Restart the DMZ backend, then check its own health endpoint reports `database: ok`.

---

## 5. End-to-end flow test

1. **Internal dashboard**: enroll a test shopper (issues an enrollment token in the DB)
2. **DMZ** (`/surveys/mystery-shopper/`): open the enrollment link → complete 2FA setup → sign in
3. **DMZ**: complete and submit a test survey visit
4. **Internal dashboard**: Mystery Shopper → Review Queue → confirm the visit appears immediately (no sync delay expected — same DB)

If all four pass, DMZ is ready for the `deploy-mystery-public` GitHub Actions workflow.
