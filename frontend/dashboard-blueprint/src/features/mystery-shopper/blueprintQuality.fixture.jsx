import React from 'react';
import { createRoot } from 'react-dom/client';
import Mystery from './components/MysteryAnalyticsSummarySection';
import InfoHint from '../../components/shared/InfoHint';
import { summarizeMysteryQuestions } from './mysteryPresentation';
const mode = location.hash.slice(1);
const questions = mode === 'empty' ? [] : [
  { category: 'External Environment & First Impression', score_min: 1, score_max: 5, average_score: 4, response_count: 2 },
  { category: 'Overall Experience (CSAT & NPS)', score_min: 0, score_max: 10, average_score: mode === 'zero' ? 0 : 8.5, response_count: 3 },
  { category: 'External Environment & First Impression', score_min: 0, score_max: 5, average_score: 2, response_count: 1 },
].map((q, i) => ({ ...q, question_id: i + 1, question_number: 2001 + i }));
const text = 'B2B CSAT is the percentage of valid satisfaction ratings that are positive. Counts are ratings, not visits. This help must remain readable on small screens.';
createRoot(document.getElementById('root')).render(<main style={{ padding: 24, maxWidth: 1200, margin: 'auto' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <InfoHint label="B2B score help at left edge" text={text} />
    <InfoHint label="B2B score help at right edge" text={text} />
  </div>
  <Mystery analytics={{ visits: { approved: mode === 'empty' ? 0 : 1 }, mystery_shopper: { csat_average: mode === 'zero' ? 0 : 8.5, csat_response_count: mode === 'empty' ? 0 : 3 } }} questionAverages={questions} mysteryAnalyticsSummary={summarizeMysteryQuestions(questions)} />
  <div style={{ position: 'fixed', right: 8, bottom: 8 }}><InfoHint label="B2B help at bottom edge" text={text} /></div>
</main>);
