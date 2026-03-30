1️⃣ EXTENSIONS (Recommended)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
2️⃣ CORE TABLES
2.1 survey_versions

Tracks versioned question sets.

CREATE TABLE survey_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number VARCHAR(20) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMP
);
2.2 survey_responses

Main survey submission record.

CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    survey_version_id UUID NOT NULL REFERENCES survey_versions(id),

    customer_id UUID NOT NULL,
    submitted_by_user_id UUID,
    
    interaction_type VARCHAR(50) NOT NULL,
    escalation_occurred BOOLEAN NOT NULL,
    issue_experienced BOOLEAN NOT NULL,
    
    survey_mode VARCHAR(20) NOT NULL, -- online / offline / mobile_data
    
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
3️⃣ QUESTION RESPONSE FIELDS (STRUCTURED MODEL)

All questions stored as explicit columns for performance & reporting.

ALTER TABLE survey_responses

-- SECTION 1: Loyalty
ADD COLUMN q1_nps INTEGER NOT NULL CHECK (q1_nps BETWEEN 0 AND 10),
ADD COLUMN q2_overall_sat INTEGER NOT NULL CHECK (q2_overall_sat BETWEEN 1 AND 5),

-- SECTION 2: Relationship & Trust
ADD COLUMN q3_trust INTEGER NOT NULL CHECK (q3_trust BETWEEN 1 AND 5),
ADD COLUMN q4_understanding INTEGER NOT NULL CHECK (q4_understanding BETWEEN 1 AND 5),
ADD COLUMN q5_proactive INTEGER NOT NULL CHECK (q5_proactive BETWEEN 1 AND 5),
ADD COLUMN q6_partnership_value INTEGER NOT NULL CHECK (q6_partnership_value BETWEEN 1 AND 5),

-- SECTION 3: Service Delivery
ADD COLUMN q7_service_quality INTEGER NOT NULL CHECK (q7_service_quality BETWEEN 1 AND 5),
ADD COLUMN q8_responsiveness INTEGER NOT NULL CHECK (q8_responsiveness BETWEEN 1 AND 5),
ADD COLUMN q9_timeliness INTEGER NOT NULL CHECK (q9_timeliness BETWEEN 1 AND 5),
ADD COLUMN q10_reliability INTEGER NOT NULL CHECK (q10_reliability BETWEEN 1 AND 5),

-- SECTION 4: Technical & Operational
ADD COLUMN q11_technical_competence INTEGER NOT NULL CHECK (q11_technical_competence BETWEEN 1 AND 5),
ADD COLUMN q12_problem_solving INTEGER NOT NULL CHECK (q12_problem_solving BETWEEN 1 AND 5),
ADD COLUMN q13_first_time_fix INTEGER CHECK (q13_first_time_fix BETWEEN 1 AND 5),
ADD COLUMN q14_health_safety INTEGER CHECK (q14_health_safety BETWEEN 1 AND 5),

-- SECTION 5: Communication
ADD COLUMN q15_clarity INTEGER NOT NULL CHECK (q15_clarity BETWEEN 1 AND 5),
ADD COLUMN q16_professionalism INTEGER NOT NULL CHECK (q16_professionalism BETWEEN 1 AND 5),
ADD COLUMN q17_escalation_handling INTEGER CHECK (q17_escalation_handling BETWEEN 1 AND 5),

-- SECTION 6: Issue Handling
ADD COLUMN q19_ease_raise_issue INTEGER CHECK (q19_ease_raise_issue BETWEEN 1 AND 5),
ADD COLUMN q20_speed_resolution INTEGER CHECK (q20_speed_resolution BETWEEN 1 AND 5),
ADD COLUMN q21_resolution_satisfaction INTEGER CHECK (q21_resolution_satisfaction BETWEEN 1 AND 5),

-- SECTION 7: Commercial Perception
ADD COLUMN q22_value_for_money INTEGER CHECK (q22_value_for_money BETWEEN 1 AND 5),
ADD COLUMN q23_competitiveness INTEGER CHECK (q23_competitiveness BETWEEN 1 AND 5),

-- SECTION 8: Open Feedback
ADD COLUMN q24_reason_nps TEXT NOT NULL,
ADD COLUMN q25_do_well TEXT,
ADD COLUMN q26_improve TEXT;
4️⃣ CONDITIONAL VALIDATION (DATABASE-LEVEL CONSTRAINTS)
4.1 Issue-Based Conditional Logic

If issue_experienced = FALSE:

q13_first_time_fix must be NULL

q19_ease_raise_issue must be NULL

q20_speed_resolution must be NULL

q21_resolution_satisfaction must be NULL

If issue_experienced = TRUE:

q19, q20, q21 must NOT be NULL

ALTER TABLE survey_responses
ADD CONSTRAINT chk_issue_logic
CHECK (
    (
        issue_experienced = FALSE AND
        q13_first_time_fix IS NULL AND
        q19_ease_raise_issue IS NULL AND
        q20_speed_resolution IS NULL AND
        q21_resolution_satisfaction IS NULL
    )
    OR
    (
        issue_experienced = TRUE AND
        q19_ease_raise_issue IS NOT NULL AND
        q20_speed_resolution IS NOT NULL AND
        q21_resolution_satisfaction IS NOT NULL
    )
);
4.2 Escalation Conditional Logic

If escalation_occurred = FALSE:

q17_escalation_handling must be NULL

If escalation_occurred = TRUE:

q17_escalation_handling must NOT be NULL

ALTER TABLE survey_responses
ADD CONSTRAINT chk_escalation_logic
CHECK (
    (
        escalation_occurred = FALSE AND
        q17_escalation_handling IS NULL
    )
    OR
    (
        escalation_occurred = TRUE AND
        q17_escalation_handling IS NOT NULL
    )
);
5️⃣ DERIVED ANALYTICS VIEW (RECOMMENDED)
5.1 NPS Classification View
CREATE VIEW survey_response_analytics AS
SELECT
    id,
    customer_id,
    submitted_at,
    q1_nps,
    CASE
        WHEN q1_nps BETWEEN 0 AND 6 THEN 'Detractor'
        WHEN q1_nps BETWEEN 7 AND 8 THEN 'Passive'
        WHEN q1_nps BETWEEN 9 AND 10 THEN 'Promoter'
    END AS nps_category
FROM survey_responses;
6️⃣ INDEXING STRATEGY
CREATE INDEX idx_survey_customer ON survey_responses(customer_id);
CREATE INDEX idx_survey_submitted_at ON survey_responses(submitted_at);
CREATE INDEX idx_survey_version ON survey_responses(survey_version_id);
CREATE INDEX idx_survey_issue ON survey_responses(issue_experienced);
7️⃣ OPTIONAL: NORMALISED ANSWER MODEL (Alternative Approach)

If you want extreme flexibility for future dynamic surveys:

survey_questions
survey_answers

However, for analytics-heavy dashboards, the structured column approach above is superior for:

Performance

Simpler BI queries

Aggregations

Faster NPS computation

8️⃣ OFFLINE SYNC CONSIDERATIONS

Recommended additional fields:

ALTER TABLE survey_responses
ADD COLUMN device_id VARCHAR(100),
ADD COLUMN offline_created_at TIMESTAMP,
ADD COLUMN sync_batch_id UUID;
9️⃣ DATA GOVERNANCE

Do NOT allow default numeric values for nullable conditional fields.

Enforce NOT NULL strictly for required questions.

All validation must be duplicated at:

Frontend

API layer (FastAPI Pydantic validation)

Database constraints (as above)

🔟 SUMMARY OF FIELD TYPES
Field Type	Count
Integer 0–10	1
Integer 1–5 Required	14
Integer 1–5 Conditional	5
Integer 1–5 Optional	3
Boolean	2
Text Required	1
Text Optional