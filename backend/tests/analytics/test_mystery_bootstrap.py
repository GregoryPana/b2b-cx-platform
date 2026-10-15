"""Reference-question bootstrap must be repeatable without changing answer counts."""
from sqlalchemy import text


def test_mystery_bootstrap_is_idempotent_with_order_index(db, fx):
    from app.api.mystery_shopper import _bootstrap_mystery_shopper_schema

    before = db.execute(text("SELECT id, question_key, order_index FROM questions ORDER BY id")).all()
    _bootstrap_mystery_shopper_schema(db)
    after = db.execute(text("SELECT id, question_key, order_index FROM questions ORDER BY id")).all()
    assert after == before
    assert db.execute(text("SELECT COUNT(*) FROM mystery_shopper_answers")).scalar() == 0
