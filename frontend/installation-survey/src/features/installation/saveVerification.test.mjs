import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { savedAnswersMatch } from './saveVerification.js';
const submitted = [{ question_number: 1, score: 4 }, { question_number: 2, score: 5 }];
const saved = { survey_id: 'assessment-a', responses: submitted };
test('same assessment and answers verify, independently of response order', () => {
  assert.equal(savedAnswersMatch({ ...saved, responses: [...submitted].reverse() }, 'assessment-a', submitted), true);
});
test('same number of different answers cannot claim verified save', () => {
  assert.equal(savedAnswersMatch({ ...saved, responses: [{ question_number: 1, score: 1 }, submitted[1]] }, 'assessment-a', submitted), false);
});
test('another assessment cannot claim verified save', () => {
  assert.equal(savedAnswersMatch(saved, 'assessment-b', submitted), false);
});
test('duplicate or missing questions cannot claim verified save', () => {
  assert.equal(savedAnswersMatch({ ...saved, responses: [submitted[0], submitted[0]] }, 'assessment-a', submitted), false);
  assert.equal(savedAnswersMatch({ ...saved, responses: [submitted[0]] }, 'assessment-a', submitted), false);
});
test('null scores cannot verify as zero', () => {
  assert.equal(savedAnswersMatch({ survey_id: 'a', responses: [{ question_number: 1, score: null }] }, 'a', [{ question_number: 1, score: 0 }]), false);
});
test('unknown save status warns about duplicates and hides confirmed success', () => {
  const source = readFileSync(new URL('./InstallationSurveyPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /success && success.saveVerified/);
  assert.match(source, /success && !success.saveVerified/);
  assert.match(source, /before submitting again, to avoid a duplicate/);
  assert.doesNotMatch(source, /re-submit to be safe/);
  assert.match(source, /savedAnswersMatch\(verifyData, accepted.survey_id, accepted.snapshot.responses\)/);
});
