# B2B Report ↔ Survey Question Contract Testing

Purpose: every generated B2B report HTML/email must match the actual survey questions used by the survey runtime and database.

## Required test rule

A report test **fails** if generated HTML does not match the actual survey questions. The report renderer must use the canonical `questions.question_number` and `questions.question_text` values for the selected survey/visit; it must not infer display numbers from array indexes, response IDs, action IDs, or `order_index` offsets.

## Minimum assertions for survey report generated HTML

For any selected-survey report fixture, assert that:

1. The generated HTML contains the survey date.
2. The generated HTML contains the survey business name, not a user-facing business ID.
3. The generated HTML contains team members and the account executive.
4. The generated HTML contains the number of action points.
5. Question labels are exactly `Q<questions.question_number>`.
6. Question text exactly matches the current survey question text.
7. Moved/reordered questions such as Q17-Q20 appear using their actual question numbers and current text.
8. No response ID, action ID, or database row ID is rendered as a question number, for example a response/action ID `536` must not appear as `Q536`.

If any of these checks fail, treat the report/email as failed even if the email sends successfully. Email delivery only proves transport; it does not prove report correctness.

## Local command

```bash
cd backend
PYTHONPATH=. pytest tests/test_b2b_report_contract.py -v
```

## Manual inspection fallback

If a full database-backed test is unavailable, export/generate the HTML for one known survey and inspect it before deployment. The HTML must visibly show the same question numbering and wording as the survey form.
