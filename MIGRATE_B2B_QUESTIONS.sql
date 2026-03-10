-- Migration script for B2B questions
-- This will populate the questions table with proper B2B questions

-- First create the tables (run CREATE_QUESTIONS_TABLE.sql first)

-- Insert B2B questions with correct numbering
INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 1, 'Rate your relationship with C&W.', 'Category 1: Relationship Strength', True, False, 'score', 0, 10, NULL, NULL, False, False, 'q01_relationship_strength')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 2, 'Do you get enough information from your Account Executive on New Products and Services?.', 'Category 1: Relationship Strength', True, False, 'score', 0, 10, NULL, NULL, False, False, 'q02_ae_information_updates')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 3, 'How would you rate the level of professionalism when dealing with your C&W Account Executive?.', 'Category 1: Relationship Strength', True, False, 'score', 0, 10, NULL, NULL, False, False, 'q03_ae_professionalism')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 4, 'Does the C&W Account Executive understand your business?.', 'Category 1: Relationship Strength', True, False, 'yes_no', NULL, NULL, '["Yes", "No"]'::jsonb, 'Select Yes or No', False, False, 'q04_ae_business_understanding')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 5, 'How satisfied are you with your C&W contacts and number of visits?.', 'Category 1: Relationship Strength', True, False, 'score', 0, 10, NULL, NULL, False, False, 'q05_contacts_visit_satisfaction')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 6, 'Are you receiving regular updates on your account? (Y or N).', 'Category 1: Relationship Strength', True, False, 'yes_no', NULL, NULL, '["Yes", "No"]'::jsonb, 'Select Yes or No', False, False, 'q06_regular_updates')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 7, 'List your top 3 C&W services most satisfied with in the past 6 months.', 'Category 2: Service & Operational Performance', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q07_top_3_satisfied_services')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 8, 'List 3 instances you have not been satisfied with C&W if any (Network Quality, Fault resolution, Visits, billing etc) if any be specific..', 'Category 2: Service & Operational Performance', False, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q08_top_3_unsatisfied_instances')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 9, 'Are Issues resolved on time?', 'Category 2: Service & Operational Performance', True, False, 'always_sometimes_never', NULL, NULL, '["Always", "Sometimes", "Never"]'::jsonb, 'Choose: Always, Sometimes, or Never', False, False, 'q09_issues_resolved_on_time')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 10, 'How often do you need to call C&W to install new products or resolve issues?', 'Category 2: Service & Operational Performance', True, False, 'always_sometimes_never', NULL, NULL, '["Always", "Sometimes", "Never"]'::jsonb, 'Choose: Always, Sometimes, or Never', False, False, 'q10_call_frequency')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 11, 'What is your most recent unresolved issue with C&W?.', 'Category 2: Service & Operational Performance', False, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q11_recent_unresolved_issue')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 12, 'Rate your overall C&W Satisfaction. (Very Satisfied).', 'Category 2: Service & Operational Performance', True, False, 'score', 0, 10, NULL, NULL, False, False, 'q12_overall_satisfaction')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 13, 'What are the top 3 most important factors of our services? (e.g.Quality Price, Credit, Information, Faults resolution?)', 'Category 3: Commercial & Billing', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q13_top_3_important_factors')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 14, 'Is your statement of accounts accurate and up to date?.', 'Category 3: Commercial & Billing', True, False, 'always_sometimes_never', NULL, NULL, '["Always", "Sometimes", "Never"]'::jsonb, 'Choose: Always, Sometimes, or Never', False, False, 'q14_statement_accuracy')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 15, 'What Products and Services do you currently have with C&W?.', 'Category 4: Competitive & Portfolio Intelligence', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q15_current_products_services')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 16, 'Do you have other products and services from other service providers? (Yes or No)', 'Category 4: Competitive & Portfolio Intelligence', True, False, 'yes_no', NULL, NULL, '["Yes", "No"]'::jsonb, 'Select Yes or No', False, False, 'q16_other_provider_products')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 17, 'If so, list Products and services from competitor. (Conditional on previous)', 'Category 4: Competitive & Portfolio Intelligence', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q17_competitor_products_services')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 18, 'Which product would you want us to review to bring you to CWS?.', 'Category 4: Competitive & Portfolio Intelligence', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q18_product_review_needed')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 19, 'Do you have any new Telecommunications, or Digital Transformation requirements over next 6 to 12 months.', 'Category 5: Growth & Expansion', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q19_new_requirements')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 20, 'What kinds of expansions are you plannning for in the next 6-12 months.', 'Category 5: Growth & Expansion', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q21_expansion_types')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 21, 'Types of products and services are required for any expansion in 6 to 12 months.', 'Category 5: Growth & Expansion', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q20_expansion_services_required')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 22, 'What do you want to see more of from us?.', 'Category 5: Growth & Expansion', True, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q22_more_from_us')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 23, 'NPS on a scale of 0 to 10, how much would you recommend us? 10 be very highly. 0 not at all.', 'Category 6: Advocacy', True, True, 'score', 0, 10, NULL, NULL, False, False, 'q23_nps')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key)
VALUES (1, 24, 'Any further comments from Customer.', 'Category 6: Advocacy', False, False, 'text', NULL, NULL, NULL, NULL, False, False, 'q24_comments')
ON CONFLICT (survey_type_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    category = EXCLUDED.category,
    is_mandatory = EXCLUDED.is_mandatory,
    is_nps = EXCLUDED.is_nps,
    input_type = EXCLUDED.input_type,
    score_min = EXCLUDED.score_min,
    score_max = EXCLUDED.score_max,
    choices = EXCLUDED.choices,
    helper_text = EXCLUDED.helper_text,
    requires_issue = EXCLUDED.requires_issue,
    requires_escalation = EXCLUDED.requires_escalation,
    question_key = EXCLUDED.question_key,
    updated_at = NOW();

-- Verify the migration
SELECT 
    q.question_number,
    q.question_text,
    q.category,
    q.is_mandatory,
    q.is_nps,
    q.input_type
FROM questions q
JOIN survey_types st ON q.survey_type_id = st.id
WHERE st.name = 'B2B'
ORDER BY q.question_number;
