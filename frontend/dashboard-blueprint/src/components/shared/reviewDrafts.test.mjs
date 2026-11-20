import test from 'node:test';
import assert from 'node:assert/strict';
import { isReviewResponseDirty, dirtyReviewResponseIds } from './reviewDrafts.js';

const response = { response_id: 1, answer_text: 'Fine', verbatim: '', score: null, actions: [{ action_required: 'Call back', action_owner: 'Sam' }] };
const same = { answer_text: 'Fine', verbatim: '', actions: [{ action_required: 'Call back', action_owner: 'Sam', action_timeframe: '' }] };

test('an untouched draft is not dirty, and neither is a missing one', () => {
  assert.equal(isReviewResponseDirty(response, same), false);
  assert.equal(isReviewResponseDirty(response, undefined), false);
});
test('whitespace-only and null-versus-empty differences are not edits', () => {
  assert.equal(isReviewResponseDirty({ ...response, verbatim: null }, { ...same, verbatim: ' ' }), false);
});
test('a changed answer, verbatim, or action field is dirty', () => {
  assert.equal(isReviewResponseDirty(response, { ...same, answer_text: 'Poor' }), true);
  assert.equal(isReviewResponseDirty(response, { ...same, verbatim: 'Rude' }), true);
  assert.equal(isReviewResponseDirty(response, { ...same, actions: [{ ...same.actions[0], action_owner: 'Alex' }] }), true);
});
test('adding or removing an action is dirty', () => {
  assert.equal(isReviewResponseDirty(response, { ...same, actions: [...same.actions, { action_required: '' }] }), true);
  assert.equal(isReviewResponseDirty(response, { ...same, actions: [] }), true);
});
test('a scored question with an empty draft answer is not an edit', () => {
  assert.equal(isReviewResponseDirty({ ...response, score: 7, answer_text: null, actions: [] }, { answer_text: '', verbatim: '', actions: [] }), false);
});
test('dirtyReviewResponseIds lists only the edited responses, as strings', () => {
  const visit = { responses: [response, { ...response, response_id: 2 }] };
  assert.deepEqual(dirtyReviewResponseIds(visit, { 1: same, 2: { ...same, verbatim: 'x' } }), ['2']);
  assert.deepEqual(dirtyReviewResponseIds(null, {}), []);
});
