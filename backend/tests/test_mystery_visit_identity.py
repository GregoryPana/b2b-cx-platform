import asyncio
from typing import Any, cast

import pytest

from app.api import mystery_shopper
from app.core.auth.entra import AuthUser


class _Result:
    def __init__(self, *, scalar_value=None, row=None):
        self._scalar_value = scalar_value
        self._row = row

    def scalar(self):
        return self._scalar_value

    def fetchone(self):
        return self._row


class _VisitCreateDb:
    def __init__(self):
        self.visit_insert_params = None
        self.committed = False

    def execute(self, statement, params=None):
        sql = str(statement)
        if "FROM mystery_shopper_purpose_options" in sql:
            return _Result(scalar_value=1)
        if "FROM mystery_shopper_locations" in sql:
            return _Result(row=(1, True))
        if "JOIN mystery_shopper_assessments" in sql:
            return _Result(scalar_value=None)
        if "INSERT INTO visits" in sql:
            self.visit_insert_params = dict(params or {})
            return _Result(scalar_value="visit-1")
        if "INSERT INTO mystery_shopper_assessments" in sql:
            return _Result()
        raise AssertionError(f"Unexpected SQL: {sql}")

    def commit(self):
        self.committed = True


def _user(*, auth_mode):
    return AuthUser(
        sub="session-user",
        name="Session User",
        preferred_username="session.user@example.com",
        roles=("MYSTERY_SURVEYOR",),
        claims={"auth_mode": auth_mode},
    )


def _payload(representative_id):
    return mystery_shopper.MysteryVisitCreate(
        location_id=1,
        representative_id=representative_id,
        created_by=888,
        visit_date="2026-09-23",
        visit_type="Planned",
        visit_time="10:00",
        purpose_of_visit="General Enquiry",
        staff_on_duty="Staff Member",
        shopper_name="Session User",
    )


async def _create(monkeypatch, *, auth_mode, representative_id):
    db = _VisitCreateDb()
    monkeypatch.setattr(mystery_shopper, "_ensure_mystery_shopper_schema", lambda _db: 7)
    monkeypatch.setattr(mystery_shopper, "resolve_mystery_actor_user_id", lambda _db, _user: 41)

    result = await mystery_shopper.create_mystery_visit(
        payload=_payload(representative_id),
        db=cast(Any, db),
        current_user=_user(auth_mode=auth_mode),
    )
    return db, result


@pytest.mark.parametrize("requested_representative_id", [999, 41, None])
def test_public_visit_creation_is_always_owned_by_authenticated_session(
    monkeypatch, requested_representative_id
):
    db, result = asyncio.run(
        _create(
            monkeypatch,
            auth_mode="mystery_public",
            representative_id=requested_representative_id,
        )
    )

    assert db.visit_insert_params is not None
    assert db.visit_insert_params["representative_id"] == 41
    assert db.visit_insert_params["created_by"] == 41
    assert result["created_by"]["user_id"] == 41
    assert db.committed is True


def test_internal_entra_visit_creation_retains_explicit_assignment(monkeypatch):
    db, _ = asyncio.run(
        _create(monkeypatch, auth_mode="entra", representative_id=999)
    )

    assert db.visit_insert_params is not None
    assert db.visit_insert_params["representative_id"] == 999
    assert db.visit_insert_params["created_by"] == 41
