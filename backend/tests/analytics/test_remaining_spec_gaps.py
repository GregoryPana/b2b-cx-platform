"""Real PostgreSQL and rendered-report regressions for final boundary review gaps."""
import io
import re

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from test_endpoint_module_boundaries import db, ns, admin_user, run  # noqa: F401
from test_mystery_report import payload


def test_mixed_declared_scales_render_honest_html_and_pdf(db, fx):
    from app.api.mystery_shopper import render_mystery_report_html, render_mystery_report_pdf
    from pypdf import PdfReader

    visit = fx.mystery_visit(fx.location("Mixed scales"), "Approved")
    fx.mystery_scores(visit, nps=9, staff_sat=8, store_sat=7, ms_store_cleanliness=5, ms_space_comfort=1)
    # Same observed value but incompatible max; same max but incompatible min.
    db.execute(text("UPDATE questions SET score_max=3 WHERE question_key='ms_space_comfort'"))
    for key, minimum, maximum, category in [
        ('probe_zero_five', 0, 5, 'Service'),
        ('probe_null_min', None, 5, 'Service'),
        ('probe_one_ten', 1, 10, 'Overall Experience (CSAT & NPS)'),
        ('probe_overall_five', 1, 5, 'Overall Experience (CSAT & NPS)'),
    ]:
        qid = db.execute(text("""INSERT INTO questions (survey_type_id, question_key, question_text,
            input_type, score_min, score_max, category, is_nps)
            SELECT survey_type_id, :key, :key, 'score', :minimum, :maximum, :category, false
            FROM questions WHERE question_key='ms_store_cleanliness' RETURNING id"""),
            dict(key=key, minimum=minimum, maximum=maximum, category=category)).scalar()
        db.execute(text("INSERT INTO mystery_shopper_answers (visit_id, question_id, score) VALUES (CAST(:v AS uuid), :q, 1)"),
                   dict(v=visit, q=qid))
    result = payload(db, 'survey', visit_id=visit)
    assert result['mystery_metrics']['selected_quality'] == 5.0
    assert result['mystery_metrics']['selected_overall_experience'] == 8.0
    assert result['summary']['average_score'] == 8.0
    assert result['visit_details'][0]['avg_score'] == 8.0
    html = render_mystery_report_html(result, 'Regression tester')
    for label, value in [('Service Quality Score', '5.00'), ('Overall Experience Score', '8.00')]:
        assert re.search(re.escape(label) + r'</div>\s*<div[^>]*>' + value + r'</div>', html)
    assert 'declared on the 1–5 scale' in html
    assert 'declared on the 0–10 scale' in html
    assert 'not the NPS index' in html
    pdf = render_mystery_report_pdf(result, 'Regression tester')
    assert pdf.startswith(b'%PDF-')
    pdf_text = ' '.join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)
    compact = re.sub(r'\s+', '', pdf_text).lower()
    # Chromium emits the grid labels before the adjacent row of values.
    assert 'overallexperiencescoreservicequalityscore8.005.00' in compact
    assert 'questionsscored0–5' not in compact
    assert 'incompatiblescalesareexcluded' in compact


def test_no_compatible_scales_render_absence_not_mixed_mean(db, fx):
    from app.api.mystery_shopper import render_mystery_report_html
    visit = fx.mystery_visit(fx.location('No compatible scales'), 'Approved')
    fx.mystery_scores(visit, nps=1, ms_store_cleanliness=1)
    db.execute(text("UPDATE questions SET score_min=1 WHERE question_key='ms_recommend_outlet_nps'"))
    db.execute(text("UPDATE questions SET score_max=3 WHERE question_key='ms_store_cleanliness'"))
    result = payload(db, 'survey', visit_id=visit)
    assert result['mystery_metrics']['selected_quality'] is None
    assert result['mystery_metrics']['selected_overall_experience'] is None
    assert result['summary']['average_score'] is None
    assert result['visit_details'][0]['avg_score'] is None
    html = render_mystery_report_html(result, 'tester')
    for label in ['Service Quality Score', 'Overall Experience Score']:
        assert re.search(re.escape(label) + r'</div>\s*<div[^>]*>—</div>', html)


@pytest.mark.parametrize('module', ['B2B', 'Mystery Shopper'])
@pytest.mark.parametrize('status', ['Draft', 'Needs Changes'])
def test_empty_module_questionnaire_rejects_submit_preserves_status(db, fx, ns, admin_user, module, status):
    from app.api.visits_dashboard import submit_visit
    from app.api.mystery_shopper import submit_mystery_visit
    visit = ns.v5 if module == 'B2B' else ns.m4
    # Other module's questions and orphaned/mirrored answers cannot satisfy this guard.
    db.execute(text("UPDATE visits SET status=:status WHERE id=CAST(:v AS uuid)"), dict(status=status, v=visit))
    db.execute(text("UPDATE questions SET survey_type_id=(SELECT id FROM survey_types WHERE name=:other) "
                    "WHERE survey_type_id=(SELECT id FROM survey_types WHERE name=:module) OR survey_type_id IS NULL"),
               dict(module=module, other='Mystery Shopper' if module == 'B2B' else 'B2B'))
    db.commit()
    with pytest.raises(HTTPException) as err:
        if module == 'B2B':
            submit_visit(visit, {}, db=db, current_user=admin_user)
        else:
            run(submit_mystery_visit(visit, db=db, current_user=admin_user))
    assert err.value.status_code == (422 if module == 'B2B' else 500)
    assert ('questionnaire' if module == 'B2B' else 'questions are not initialized') in err.value.detail
    assert db.execute(text("SELECT status::text FROM visits WHERE id=CAST(:v AS uuid)"), dict(v=visit)).scalar() == status


def test_legacy_null_mandatory_question_counts_missing_and_valid_submission(db, fx, ns, admin_user):
    from app.api.visits_dashboard import (get_all_visits, get_draft_visits, get_visit_detail,
                                         create_response, submit_visit)
    # Isolate one legacy mandatory B2B question while retaining foreign mandatory questions.
    db.execute(text("UPDATE questions SET is_mandatory=false WHERE survey_type_id=(SELECT id FROM survey_types WHERE name='B2B')"))
    qid = fx.qid('q12_overall_satisfaction')
    db.execute(text("UPDATE questions SET survey_type_id=NULL, is_mandatory=true WHERE id=:q"), dict(q=qid))
    db.commit()
    for rows in [get_all_visits(db=db), get_draft_visits(db=db)]:
        row = next(r for r in rows if str(r['id']) == ns.v5)
        assert row['mandatory_total_count'] == 1
        assert row['mandatory_answered_count'] == 0
    detail = get_visit_detail(ns.v5, db=db, current_user=admin_user)
    assert detail['mandatory_total_count'] == 1
    assert detail['mandatory_answered_count'] == 0
    with pytest.raises(HTTPException) as err:
        submit_visit(ns.v5, {}, db=db, current_user=admin_user)
    assert err.value.status_code == 422
    assert len(err.value.detail['missing_questions']) == 1
    assert err.value.detail['missing_questions'][0]['question_text'] == db.execute(text('SELECT question_text FROM questions WHERE id=:q'), dict(q=qid)).scalar()
    assert db.execute(text('SELECT status::text FROM visits WHERE id=CAST(:v AS uuid)'), dict(v=ns.v5)).scalar() == 'Draft'
    create_response(ns.v5, {'question_id': qid, 'score': 9}, db=db, current_user=admin_user)
    detail = get_visit_detail(ns.v5, db=db, current_user=admin_user)
    assert detail['mandatory_total_count'] == detail['mandatory_answered_count'] == 1
    assert any(r['question_id'] == qid for r in detail['responses'])
    assert submit_visit(ns.v5, {}, db=db, current_user=admin_user)['status'] == 'Pending'
    assert db.execute(text('SELECT status::text FROM visits WHERE id=CAST(:v AS uuid)'), dict(v=ns.v5)).scalar() == 'Pending'
