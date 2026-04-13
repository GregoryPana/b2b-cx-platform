# Installation Database Setup

The installation assessment API expects the official `cwscx-postgres` dump that ships with the operations data model. Because the dump is a binary `pg_restore` file, keep it outside of git and place it at the project root as `cwscx-postgres.dump` when needed.

## Restore locally

1. Ensure the Postgres CLI tools are available (`psql`, `pg_restore`). On macOS or Linux install via Homebrew/apt; on Windows install the [official Postgres binaries](https://www.postgresql.org/download/).
2. Create (or drop/recreate) the target database:

   ```bash
   createdb cwscx-postgres
   # or: dropdb cwscx-postgres && createdb cwscx-postgres
   ```

3. Restore the dump:

   ```bash
   pg_restore --clean --if-exists --no-owner --dbname cwscx-postgres cwscx-postgres.dump
   ```

4. Point the backend at the restored database:

   ```bash
   set DATABASE_URL=postgresql://cxadmin:<your-password>@localhost:5432/cwscx-postgres
   # or add to .env
   ```

5. Run `scripts/powershell/run_backend.ps1` (or the Linux equivalent). The `installation/questions` endpoint will now stream the seeded checklist directly from Postgres.

> **Note:** The raw dump contains binary/null bytes. If you need to exchange it in chat or over email, compress it or share a cloud link; copying the raw bytes into plain text will corrupt the file.
