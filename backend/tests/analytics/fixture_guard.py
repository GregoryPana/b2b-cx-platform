"""Attestation that the PostgreSQL cluster used by the analytics fixtures is the runner's disposable one.

A Unix-socket URL alone proves nothing (``?host=/var/run/postgresql`` is a shared local server), so the
fixtures refuse to run any DDL unless ALL of the following hold, checked before the first CREATE/DROP:

* the URL is a Unix-socket URL (no network host);
* the runner exported the canonical absolute path of the throw-away data directory and a high-entropy
  nonce, and that data directory holds a marker file containing exactly that nonce (only the runner,
  which created the directory, can have written it);
* the server answers ``SHOW data_directory`` with that same canonical path;
* ``SHOW listen_addresses`` is empty (no TCP listener at all).

``attest_disposable_cluster`` takes an ``engine_factory`` so the guard itself can be tested without a
server; the tests assert no statement other than the two ``SHOW`` queries is ever issued.
"""

from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Callable

from sqlalchemy import text
from sqlalchemy.engine import make_url

PG_URL_ENV = "CWSCX_ANALYTICS_PG_URL"
PG_DATA_ENV = "CWSCX_ANALYTICS_PG_DATA"
PG_NONCE_ENV = "CWSCX_ANALYTICS_PG_NONCE"
MARKER_NAME = "cwscx_analytics_fixture.marker"
MIN_NONCE_LENGTH = 32


class FixtureGuardError(RuntimeError):
    """The target cluster is not the attested disposable cluster; nothing was executed against it."""


def assert_isolated_unix_socket_url(url: str) -> None:
    parsed = make_url(url)
    if not parsed.drivername.startswith("postgresql"):
        raise FixtureGuardError("analytics fixtures require a PostgreSQL URL")
    if parsed.host:
        raise FixtureGuardError("analytics fixtures refuse network hosts; use a Unix-socket cluster")
    socket_dir = str(parsed.query.get("host", ""))
    if not socket_dir.startswith("/"):
        raise FixtureGuardError("analytics fixtures require a Unix-socket directory in the URL host= parameter")


def write_marker(pgdata: Path, nonce: str) -> None:
    """Runner side: stamp the data directory it created."""
    (pgdata / MARKER_NAME).write_text(nonce, encoding="utf-8")


def attest_disposable_cluster(
    url: str,
    pgdata: str | None,
    nonce: str | None,
    engine_factory: Callable = None,
) -> None:
    """Raise FixtureGuardError unless ``url`` points at the runner's disposable cluster."""
    assert_isolated_unix_socket_url(url)

    if not pgdata or not nonce:
        raise FixtureGuardError(f"{PG_DATA_ENV} and {PG_NONCE_ENV} must be exported by the runner")
    if len(nonce) < MIN_NONCE_LENGTH:
        raise FixtureGuardError("fixture nonce is too short to be a runner-generated nonce")
    expected_dir = os.path.realpath(pgdata)
    if os.path.realpath(pgdata) != pgdata or not os.path.isabs(pgdata):
        raise FixtureGuardError("fixture data directory must be an absolute canonical path")
    marker = Path(expected_dir) / MARKER_NAME
    if not marker.is_file():
        raise FixtureGuardError("disposable-cluster marker file is missing from the data directory")
    if not hmac.compare_digest(marker.read_text(encoding="utf-8").strip().encode(), nonce.encode()):
        raise FixtureGuardError("disposable-cluster marker does not match the runner nonce")

    if engine_factory is None:
        from sqlalchemy import create_engine as engine_factory  # noqa: N813

    engine = engine_factory(url, future=True)
    try:
        with engine.connect() as conn:
            reported_dir = conn.execute(text("SHOW data_directory")).scalar()
            listen_addresses = conn.execute(text("SHOW listen_addresses")).scalar()
    finally:
        engine.dispose()
    if os.path.realpath(str(reported_dir)) != expected_dir:
        raise FixtureGuardError("server data_directory does not match the runner's disposable data directory")
    if listen_addresses != "":
        raise FixtureGuardError("server listens on TCP addresses; a disposable cluster must have none")
