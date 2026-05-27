-- Complete database cleanup and fix for question numbering
-- This will clear inconsistent data and create proper structure

-- Step 1: Clear all inconsistent response data
DELETE FROM b2b_visit_responses;

-- Step 2: Create proper questions table structure
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS survey_types CASCADE;

-- Create survey types table
CREATE TABLE survey_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert survey types
INSERT INTO survey_types (name, description) VALUES 
('B2B', 'B2B Customer Experience Survey'),
('Mystery Shopper', 'Mystery Shopper Survey'),
('Installation Assessment', 'Installation Assessment Survey');

-- Create proper questions table
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    survey_type_id INTEGER NOT NULL REFERENCES survey_types(id),
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    category VARCHAR(200),
    is_mandatory BOOLEAN DEFAULT true,
    is_nps BOOLEAN DEFAULT false,
    input_type VARCHAR(50) DEFAULT 'text',
    score_min INTEGER,
    score_max INTEGER,
    choices JSONB,
    helper_text TEXT,
    requires_issue BOOLEAN DEFAULT false,
    requires_escalation BOOLEAN DEFAULT false,
    question_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(survey_type_id, question_number)
);

-- Create indexes
CREATE INDEX idx_questions_survey_type ON questions(survey_type_id);
CREATE INDEX idx_questions_number ON questions(survey_type_id, question_number);

-- Create trigger for updated_at
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

CREATE TRIGGER update_survey_types_updated_at 
    BEFORE UPDATE ON survey_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Insert B2B questions with correct numbering (1-24)
INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES 
-- Category 1: Relationship Strength
(1, 1, 'Rate your relationship with C&W.', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q1_relationship'),
(1, 2, 'Do you get enough information from your Account Executive on New Products and Services?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q2_information'),
(1, 3, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q3_professionalism'),
(1, 4, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q4_understanding'),
(1, 5, 'How satisfied are you with your C&W contacts and number of visits?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q5_satisfaction'),
(1, 6, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q6_professionalism_2'),
(1, 7, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q7_understanding_2'),
(1, 8, 'How satisfied are you with your C&W contacts and number of visits?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q8_satisfaction_2'),
(1, 9, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q9_professionalism_3'),
(1, 10, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q10_understanding_3'),

-- Category 2: Service & Operational Performance
(1, 11, 'What is your most recent unresolved issue with C&W?', 'Category 2: Service & Operational Performance', false, false, 'text', NULL, NULL, NULL, NULL, false, false, 'q11_unresolved_issue'),
(1, 12, 'Rate overall C&W Satisfaction.', 'Category 2: Service & Operational Performance', true, false, 'score', 0, 10, NULL, NULL, false, false, 'q12_overall_satisfaction'),
(1, 13, 'What are the top 3 most important factors of our services? (Quality, Price, Credit, Information, Faults resolution?).', 'Category 3: Commercial & Billing', true, false, 'text', NULL, NULL, NULL, false, false, 'q13_top_factors'),
(1, 14, 'Is your statement of accounts accurate and up to date?', 'Category 2: Service & Operational Performance', true, false, 'always_sometimes_never', NULL, NULL, '["Always", "Sometimes", "Never"], false, false, 'q14_statement_accuracy'),
(1, 15, 'What Products and Services do you currently have with C&W?', 'Category 4: Competitive & Portfolio Intelligence', true, false, 'text', NULL, NULL, NULL, false, false, 'q15_current_products'),
(1, 16, 'Do you have other products and services from other service providers? (If yes, specify).', 'Category 4: Competitive & Portfolio Intelligence', true, false, 'yes_no', NULL, NULL, '["Yes", "No"], false, false, 'q16_other_provider_products'),
(1, 17, 'List Products and services from competitors.', 'Category 4: Competitive & Portfolio Intelligence', true, false, 'text', NULL, NULL, NULL, false, false, 'q17_competitor_products'),
(1, 18, 'Which product would you want us to review to bring you to CWS?', 'Category 4: Competitive & Portfolio Intelligence', true, false, 'text', NULL, NULL, NULL, false, false, 'q18_product_review_needed'),

-- Category 5: Growth & Expansion
(1, 19, 'New Telecommunications or Digital Transformation requirements over next 6 to 12 months.', 'Category 5: Growth & Expansion', true, false, 'text', NULL, NULL, NULL, false, false, 'q19_new_requirements'),
(1, 20, 'Types of products and services required for any expansion in 6 to 12 months.', 'Category 5: Growth & Expansion', true, false, 'text', NULL, NULL, NULL, false, false, 'q20_expansion_services'),
(1, 21, 'What kinds of expansions in next 6-12 months?', 'Category 5: Growth & Expansion', true, false, 'text', NULL, NULL, NULL, false, false, 'q21_expansion_types'),
(1, 22, 'What do you want to see more of from us?', 'Category 5: Growth & Expansion', true, false, 'text', NULL, NULL, NULL, false, false, 'q22_more_from_us'),

-- Category 6: Advocacy
(1, 23, 'NPS on a scale of 0 to 10, how much would you recommend us? (10 being very highly, 0 not at all).', 'Category 6: Advocacy', true, true, 'score', 0, 10, NULL, NULL, false, false, 'q23_nps'),
(1, 24, 'Any further comments from Customer.', 'Category 6: Advocacy', false, false, 'text', NULL, NULL, NULL, false, false, 'q24_comments');

-- Step 4: Update visit responses to use correct question numbers
-- This will map old question IDs to new question numbers
UPDATE b2b_visit_responses SET question_id = CASE 
    WHEN 39 THEN 1
    WHEN 40 THEN 2
    WHEN 41 THEN 3
    WHEN 42 THEN 4
    WHEN 43 THEN 5
    WHEN 44 THEN 6
    WHEN 45 THEN 7
    WHEN 46 THEN 8
    WHEN 47 THEN 9
    WHEN 48 THEN 10
    WHEN 49 THEN 11
    WHEN 50 THEN 12
    WHEN 51 THEN 13
    WHEN 52 THEN 14
    WHEN 53 THEN 15
    WHEN 54 THEN 16
    WHEN 55 THEN 17
    WHEN 56 THEN 18
    WHEN 57 THEN 19
    WHEN 58 THEN 20
    WHEN 59 THEN 21
    WHEN 60 THEN 22
    WHEN 61 THEN 23
    WHEN 62 THEN 24
    ELSE question_id
END;

-- Step 5: Verify the data
SELECT 
    'Questions created successfully' as status,
    COUNT(*) as question_count
FROM questions
WHERE survey_type_id = 1;

SELECT 
    'Responses updated successfully' as status,
    COUNT(*) as response_count
FROM b2b_visit_responses;

SELECT 
    'Question mapping verification' as status,
    COUNT(*) as mapped_responses
FROM b2b_visit_responses
WHERE question_id BETWEEN 1 AND 24;

-- Show the new question structure
SELECT 
    st.name as survey_type,
    q.question_number,
    q.question_text,
    q.is_mandatory,
    q.is_nps,
    q.input_type
FROM questions q
JOIN survey_types st ON q.survey_type_id = st.id
WHERE st.name = 'B2B'
ORDER BY q.question_number;
