from datetime import datetime, timedelta, timezone

from app.api.mystery_auth import LOCKOUT_THRESHOLD, _apply_lockout

NOW = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)


def test_a_few_typos_do_not_lock_the_account():
    for failures in range(1, LOCKOUT_THRESHOLD):
        assert _apply_lockout(NOW, failures) is None


def test_lockout_starts_at_threshold_and_escalates():
    assert _apply_lockout(NOW, LOCKOUT_THRESHOLD) == NOW + timedelta(minutes=1)
    assert _apply_lockout(NOW, LOCKOUT_THRESHOLD + 1) == NOW + timedelta(minutes=2)
    assert _apply_lockout(NOW, LOCKOUT_THRESHOLD + 2) == NOW + timedelta(minutes=4)


def test_lockout_is_capped_at_one_hour():
    assert _apply_lockout(NOW, 50) == NOW + timedelta(minutes=60)
