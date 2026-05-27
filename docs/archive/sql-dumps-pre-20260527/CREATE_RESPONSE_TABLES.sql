-- Create response tables for survey responses
-- This will enable proper storage and retrieval of survey responses

-- Create visit responses table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_b2b_visit_responses_visit_id ON b2b_visit_responses(visit_id);
CREATE INDEX IF NOT EXISTS idx_b2b_visit_responses_question_id ON b2b_visit_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_b2b_visit_responses_created_at ON b2b_visit_responses(created_at);

-- Create trigger to automatically update updated_at
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

-- Verify table was created successfully
SELECT 
    'b2b_visit_responses table created successfully' as status,
    COUNT(*) as response_count
FROM b2b_visit_responses;
