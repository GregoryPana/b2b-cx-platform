<!-- ARCHIVED: Historical/superseded document. See docs/ for current documentation. -->

# 🔧 MANUAL SQL EXECUTION GUIDE

## 🎯 Issue

You're getting "Failed to create response" error because the `b2b_visit_responses` table doesn't exist in the database. The backend has been fixed to save responses, but the database table is missing.

## 🔧 Solution Options

### Option 1: Use psql Command (Recommended)
If you have PostgreSQL installed locally:

```bash
# Windows (Command Prompt)
psql -h localhost -U postgres -d cx_b2b_platform < CREATE_RESPONSE_TABLES.sql

# Windows (PowerShell)
Get-Content CREATE_RESPONSE_TABLES.sql | psql -h localhost -U postgres -d cx_b2b_platform

# Mac/Linux
psql -h localhost -U postgres -d cx_b2b_platform < CREATE_RESPONSE_TABLES.sql
```

### Option 2: Use Database GUI Tool
- **pgAdmin**: Open pgAdmin, connect to `localhost:5432` with user `postgres`, database `cx_b2b_platform`
- **DBeaver**: Connect to your database and execute the SQL
- **DataGrip**: Connect and run the SQL file

### Option 3: Python Direct Execution
If you have Python with psycopg2 installed:

```python
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="cx_b2b_platform", 
    user="postgres",
    password="your_password"
)

# Read and execute SQL
with open('CREATE_RESPONSE_TABLES.sql', 'r') as f:
    sql = f.read()

with conn.cursor() as cur:
    cur.execute(sql)
    conn.commit()

print("✅ Response tables created successfully!")
```

## 📋 SQL Content to Execute

The `CREATE_RESPONSE_TABLES.sql` file contains:

```sql
-- Create response tables for survey responses
CREATE TABLE IF NOT EXISTS b2b_visit_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES b2b_visits(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    score INTEGER,
    answer_text TEXT,
    verbatim TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_b2b_visit_responses_visit_id ON b2b_visit_responses(visit_id);
CREATE INDEX IF NOT EXISTS idx_b2b_visit_responses_question_id ON b2b_visit_responses(question_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_b2b_visit_responses_updated_at 
    BEFORE UPDATE ON b2b_visit_responses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify table creation
SELECT 
    'b2b_visit_responses table created successfully' as status,
    COUNT(*) as response_count
FROM b2b_visit_responses;
```

## 🚀 Quick Fix Steps

1. **Execute SQL** using one of the methods above
2. **Restart Backend**:
   ```bash
   cd backend && python -m uvicorn app.main:app --reload
   ```
3. **Test Survey**:
   - Open http://localhost:5176
   - Try to save a survey response
   - Should work without "Failed to create response" error

## ✅ Verification

After executing the SQL, you can verify the table was created:

```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'b2b_visit_responses';
```

## 🎯 Expected Result

Once the table is created:
- ✅ Survey responses will save to database
- ✅ No more "Failed to create response" errors
- ✅ Survey completion logic will work correctly
- ✅ All response data will be available for analytics

---

*Execute the SQL using your preferred method and the survey response saving will be fixed!*
