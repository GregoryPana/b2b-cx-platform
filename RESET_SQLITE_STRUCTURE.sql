-- SQLite Database Reset and Restructure
-- This will create a clean, proper database structure for B2B platform using SQLite

-- Step 1: Drop all problematic tables and start fresh
DROP TABLE IF EXISTS b2b_visit_responses;
DROP TABLE IF EXISTS b2b_visits;
DROP TABLE IF EXISTS b2b_businesses;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS survey_types;
DROP TABLE IF EXISTS b2b_account_executives;

-- Step 2: Create proper foundation tables
CREATE TABLE b2b_account_executives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE b2b_businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    priority_level TEXT DEFAULT 'medium',
    active INTEGER DEFAULT 1,
    account_executive_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_executive_id) REFERENCES b2b_account_executives(id)
);

CREATE TABLE survey_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_type_id INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    category TEXT,
    is_mandatory INTEGER DEFAULT 1,
    is_nps INTEGER DEFAULT 0,
    input_type TEXT DEFAULT 'text',
    score_min INTEGER,
    score_max INTEGER,
    choices TEXT, -- JSON as TEXT for SQLite
    helper_text TEXT,
    requires_issue INTEGER DEFAULT 0,
    requires_escalation INTEGER DEFAULT 0,
    question_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_type_id) REFERENCES survey_types(id),
    UNIQUE(survey_type_id, question_number)
);

CREATE TABLE b2b_visits (
    id TEXT PRIMARY KEY, -- UUID as TEXT
    business_id INTEGER NOT NULL,
    representative_id INTEGER NOT NULL,
    visit_date DATE NOT NULL,
    visit_type TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES b2b_businesses(id),
    FOREIGN KEY (representative_id) REFERENCES b2b_account_executives(id),
    FOREIGN KEY (created_by) REFERENCES b2b_account_executives(id)
);

CREATE TABLE b2b_visit_responses (
    id TEXT PRIMARY KEY, -- UUID as TEXT
    visit_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    score INTEGER,
    answer_text TEXT,
    verbatim TEXT,
    actions TEXT, -- JSON as TEXT for SQLite
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES b2b_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_b2b_businesses_active ON b2b_businesses(active);
CREATE INDEX idx_b2b_visits_business ON b2b_visits(business_id);
CREATE INDEX idx_b2b_visits_status ON b2b_visits(status);
CREATE INDEX idx_b2b_visits_date ON b2b_visits(visit_date);
CREATE INDEX idx_b2b_visit_responses_visit ON b2b_visit_responses(visit_id);
CREATE INDEX idx_b2b_visit_responses_question ON b2b_visit_responses(question_id);
CREATE INDEX idx_questions_survey_type ON questions(survey_type_id);
CREATE INDEX idx_questions_number ON questions(survey_type_id, question_number);

-- Step 4: Insert initial data
-- Survey types
INSERT INTO survey_types (name, description) VALUES 
('B2B', 'B2B Customer Experience Survey'),
('Mystery Shopper', 'Mystery Shopper Survey'),
('Installation Assessment', 'Installation Assessment Survey');

-- Account executives
INSERT INTO b2b_account_executives (name, email) VALUES 
('John Smith', 'john.smith@example.com'),
('Jane Doe', 'jane.doe@example.com'),
('Mike Johnson', 'mike.johnson@example.com'),
('Sarah Wilson', 'sarah.wilson@example.com');

-- Sample businesses
INSERT INTO b2b_businesses (name, location, priority_level, active, account_executive_id) VALUES 
('Test Business 1', 'Location 1', 'high', 1, 1),
('Test Business 2', 'Location 2', 'medium', 1, 2),
('Test Business 3', 'Location 3', 'low', 1, 3),
('Retired Business', 'Location 4', 'medium', 0, 4);

-- B2B Questions (1-24) with proper numbering
INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, question_key) VALUES 
-- Category 1: Relationship Strength
(1, 1, 'Rate your relationship with C&W.', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q1_relationship'),
(1, 2, 'Do you get enough information from your Account Executive on New Products and Services?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q2_information'),
(1, 3, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q3_professionalism'),
(1, 4, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q4_understanding'),
(1, 5, 'How satisfied are you with your C&W contacts and number of visits?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q5_satisfaction'),
(1, 6, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q6_professionalism_2'),
(1, 7, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q7_understanding_2'),
(1, 8, 'How satisfied are you with your C&W contacts and number of visits?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q8_satisfaction_2'),
(1, 9, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q9_professionalism_3'),
(1, 10, 'Does the C&W Account Executive understand your business?', 'Category 1: Relationship Strength', 1, 0, 'score', 0, 10, NULL, NULL, 'q10_understanding_3'),

-- Category 2: Service & Operational Performance
(1, 11, 'What is your most recent unresolved issue with C&W?', 'Category 2: Service & Operational Performance', 0, 0, 'text', NULL, NULL, NULL, NULL, 'q11_unresolved_issue'),
(1, 12, 'Rate overall C&W Satisfaction.', 'Category 2: Service & Operational Performance', 1, 0, 'score', 0, 10, NULL, NULL, 'q12_overall_satisfaction'),

-- Category 3: Commercial & Billing
(1, 13, 'What are the top 3 most important factors of our services? (Quality, Price, Credit, Information, Faults resolution?)', 'Category 3: Commercial & Billing', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q13_top_factors'),
(1, 14, 'Is your statement of accounts accurate and up to date?', 'Category 3: Commercial & Billing', 1, 0, 'always_sometimes_never', NULL, NULL, '["Always", "Sometimes", "Never"]', 'Choose: Always, Sometimes, or Never', 'q14_statement_accuracy'),

-- Category 4: Competitive & Portfolio Intelligence
(1, 15, 'What Products and Services do you currently have with C&W?', 'Category 4: Competitive & Portfolio Intelligence', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q15_current_products'),
(1, 16, 'Do you have other products and services from other service providers? (If yes, specify).', 'Category 4: Competitive & Portfolio Intelligence', 1, 0, 'yes_no', NULL, NULL, '["Yes", "No"]', 'Select Yes or No', 'q16_other_provider_products'),
(1, 17, 'List Products and services from competitors.', 'Category 4: Competitive & Portfolio Intelligence', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q17_competitor_products'),
(1, 18, 'Which product would you want us to review to bring you to CWS?', 'Category 4: Competitive & Portfolio Intelligence', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q18_product_review_needed'),

-- Category 5: Growth & Expansion
(1, 19, 'New Telecommunications or Digital Transformation requirements over next 6 to 12 months.', 'Category 5: Growth & Expansion', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q19_new_requirements'),
(1, 20, 'Types of products and services required for any expansion in 6 to 12 months.', 'Category 5: Growth & Expansion', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q20_expansion_services'),
(1, 21, 'What kinds of expansions in next 6-12 months?', 'Category 5: Growth & Expansion', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q21_expansion_types'),
(1, 22, 'What do you want to see more of from us?', 'Category 5: Growth & Expansion', 1, 0, 'text', NULL, NULL, NULL, NULL, 'q22_more_from_us'),

-- Category 6: Advocacy
(1, 23, 'NPS on a scale of 0 to 10, how much would you recommend us? (10 being very highly, 0 not at all).', 'Category 6: Advocacy', 1, 1, 'score', 0, 10, NULL, NULL, 'q23_nps'),
(1, 24, 'Any further comments from Customer.', 'Category 6: Advocacy', 0, 0, 'text', NULL, NULL, NULL, NULL, 'q24_comments');

-- Step 5: Verify the structure
SELECT 
    'SQLite Database reset completed successfully' as status,
    datetime('now') as timestamp;

-- Show the new structure
SELECT 
    'Account Executives' as table_name,
    COUNT(*) as record_count
FROM b2b_account_executives

UNION ALL

SELECT 
    'Businesses' as table_name,
    COUNT(*) as record_count
FROM b2b_businesses

UNION ALL

SELECT 
    'Survey Types' as table_name,
    COUNT(*) as record_count
FROM survey_types

UNION ALL

SELECT 
    'Questions' as table_name,
    COUNT(*) as record_count
FROM questions

UNION ALL

SELECT 
    'Visits' as table_name,
    COUNT(*) as record_count
FROM b2b_visits

UNION ALL

SELECT 
    'Responses' as table_name,
    COUNT(*) as record_count
FROM b2b_visit_responses;

-- Show B2B questions with correct numbering
SELECT 
    q.question_number,
    q.question_text,
    q.is_mandatory,
    q.is_nps,
    q.input_type
FROM questions q
JOIN survey_types st ON q.survey_type_id = st.id
WHERE st.name = 'B2B'
ORDER BY q.question_number
LIMIT 10;
