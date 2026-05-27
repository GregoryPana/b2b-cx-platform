-- Create proper questions table structure for multiple survey types
-- This will fix question numbering and support future survey types

-- Create survey types table first
CREATE TABLE IF NOT EXISTS survey_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial survey types
INSERT INTO survey_types (name, description) VALUES 
('B2B', 'B2B Customer Experience Survey'),
('Mystery Shopper', 'Mystery Shopper Survey'),
('Installation Assessment', 'Installation Assessment Survey')
ON CONFLICT (name) DO NOTHING;

-- Create proper questions table with survey type support
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    survey_type_id INTEGER NOT NULL REFERENCES survey_types(id),
    question_number INTEGER NOT NULL, -- This will be 1-24 for B2B
    question_text TEXT NOT NULL,
    category VARCHAR(200),
    is_mandatory BOOLEAN DEFAULT true,
    is_nps BOOLEAN DEFAULT false,
    input_type VARCHAR(50) DEFAULT 'text',
    score_min INTEGER,
    score_max INTEGER,
    choices JSONB, -- For multiple choice questions
    helper_text TEXT,
    requires_issue BOOLEAN DEFAULT false,
    requires_escalation BOOLEAN DEFAULT false,
    question_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_type_id, question_number) -- Ensure unique numbering within each survey type
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_questions_survey_type ON questions(survey_type_id);
CREATE INDEX IF NOT EXISTS idx_questions_number ON questions(survey_type_id, question_number);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_questions_updated_at 
    BEFORE UPDATE ON questions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update survey_types trigger
CREATE TRIGGER update_survey_types_updated_at 
    BEFORE UPDATE ON survey_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing B2B questions to new structure
INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
SELECT 
    st.id,
    q.order_index,
    q.question_text,
    q.category,
    q.is_mandatory,
    q.is_nps,
    q.input_type,
    q.score_min,
    q.score_max,
    q.choices::jsonb,
    q.helper_text,
    q.requires_issue,
    q.requires_escalation,
    q.question_key
FROM survey_types st
CROSS JOIN (
    -- This would be the existing questions data - in a real migration, you'd pull from the old table
    SELECT 1 as order_index, 'Sample question 1' as question_text, 'Category 1' as category, true as is_mandatory, false as is_nps, 'text' as input_type, null as score_min, null as score_max, null::jsonb as choices, null as helper_text, false as requires_issue, false as requires_escalation, 'q1_sample' as question_key
    UNION ALL SELECT 2, 'Sample question 2', 'Category 1', true, false, 'text', null, null, null, null, null, false, false, 'q2_sample'
    -- ... continue for all 24 questions
) q
WHERE st.name = 'B2B'
ON CONFLICT (survey_type_id, question_number) DO NOTHING;

-- Verify the structure
SELECT 
    'questions table created successfully' as status,
    COUNT(*) as question_count
FROM questions;

-- Show B2B questions with correct numbering
SELECT 
    q.id,
    st.name as survey_type,
    q.question_number,
    q.question_text,
    q.category,
    q.is_mandatory
FROM questions q
JOIN survey_types st ON q.survey_type_id = st.id
WHERE st.name = 'B2B'
ORDER BY q.question_number;
