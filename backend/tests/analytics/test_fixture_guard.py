"""The fixture safety guard: shared / mismatched clusters are rejected before ANY DDL (no database needed)."""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

from fixture_guard import (
    MARKER_NAME,
    FixtureGuardError,
    assert_isolated_unix_socket_url,
    attest_disposable_cluster,
    write_marker,
)

NONCE = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
SOCKET_URL = "postgresql://postgres:@/postgres?host={sock}"


class FakeEngine:
    """Records every statement; answers only the two SHOW attestation queries."""

    def __init__(self, answers: dict[str, str], log: list[str]):
        self.answers, self.log = answers, log
        self.disposed = False

    def connect(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, statement, *args, **kwargs):
        sql = str(statement).strip()
        self.log.append(sql)
        return _Result(self.answers.get(sql))

    def dispose(self):
        self.disposed = True


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


@pytest.fixture()
def cluster(tmp_path):
    pgdata = Path(os.path.realpath(tmp_path / "pgdata"))
    pgdata.mkdir()
    write_marker(pgdata, NONCE)
    return pgdata


def factory_for(answers, log, calls=None):
    def make(url, **kwargs):
        if calls is not None:
            calls.append(url)
        return FakeEngine(answers, log)

    return make


def good_answers(pgdata):
    return {"SHOW data_directory": str(pgdata), "SHOW listen_addresses": ""}


def attest(pgdata, url=None, *, nonce=NONCE, path=None, answers=None, calls=None):
    log: list[str] = []
    url = url or SOCKET_URL.format(sock=pgdata.parent)
    attest_disposable_cluster(
        url,
        str(pgdata) if path is None else path,
        nonce,
        engine_factory=factory_for(answers if answers is not None else good_answers(pgdata), log, calls),
    )
    return log


def test_attested_disposable_cluster_is_accepted_and_only_runs_show_queries(cluster):
    log = attest(cluster)
    assert log == ["SHOW data_directory", "SHOW listen_addresses"]


def test_network_host_is_rejected_before_any_connection(cluster):
    calls: list[str] = []
    with pytest.raises(FixtureGuardError, match="network"):
        attest(cluster, url="postgresql://u:p@db.example.com:5432/app", calls=calls)
    assert calls == []


def test_non_postgres_and_hostless_urls_are_rejected(cluster):
    with pytest.raises(FixtureGuardError):
        assert_isolated_unix_socket_url("sqlite:///:memory:")
    with pytest.raises(FixtureGuardError, match="Unix-socket directory"):
        assert_isolated_unix_socket_url("postgresql://postgres@/postgres")


def test_shared_unix_socket_cluster_is_rejected_even_with_runner_env(cluster):
    """`?host=/var/run/postgresql` is a Unix socket but a shared server: its data_directory differs."""
    log: list[str] = []
    shared = {"SHOW data_directory": "/var/lib/postgresql/16/main", "SHOW listen_addresses": "localhost"}
    with pytest.raises(FixtureGuardError, match="data_directory"):
        attest_disposable_cluster(
            "postgresql://u@/x?host=/var/run/postgresql", str(cluster), NONCE,
            engine_factory=factory_for(shared, log),
        )
    assert log == ["SHOW data_directory", "SHOW listen_addresses"]  # nothing but attestation reads ran


def test_shared_socket_without_runner_attestation_is_rejected_before_connecting():
    calls: list[str] = []
    with pytest.raises(FixtureGuardError, match="exported by the runner"):
        attest_disposable_cluster(
            "postgresql://u@/x?host=/var/run/postgresql", None, None,
            engine_factory=factory_for({}, [], calls),
        )
    assert calls == []


def test_data_directory_path_mismatch_is_rejected(cluster, tmp_path):
    other = Path(os.path.realpath(tmp_path / "other"))
    other.mkdir()
    answers = {"SHOW data_directory": str(other), "SHOW listen_addresses": ""}
    with pytest.raises(FixtureGuardError, match="data_directory"):
        attest(cluster, answers=answers)


def test_listening_server_is_rejected(cluster):
    answers = {"SHOW data_directory": str(cluster), "SHOW listen_addresses": "localhost"}
    with pytest.raises(FixtureGuardError, match="TCP"):
        attest(cluster, answers=answers)


def test_wrong_short_or_missing_nonce_is_rejected(cluster):
    calls: list[str] = []
    with pytest.raises(FixtureGuardError, match="does not match"):
        attest(cluster, nonce="f" * 64, calls=calls)
    with pytest.raises(FixtureGuardError, match="too short"):
        attest(cluster, nonce="abc", calls=calls)
    with pytest.raises(FixtureGuardError, match="exported by the runner"):
        attest(cluster, nonce="", calls=calls)
    assert calls == []


def test_missing_marker_is_rejected(cluster):
    (cluster / MARKER_NAME).unlink()
    with pytest.raises(FixtureGuardError, match="marker file is missing"):
        attest(cluster)


def test_non_canonical_or_relative_data_directory_is_rejected(cluster):
    with pytest.raises(FixtureGuardError, match="canonical"):
        attest(cluster, path=str(cluster) + "/../" + cluster.name)
    with pytest.raises(FixtureGuardError, match="canonical"):
        attest(cluster, path=cluster.name)


def test_symlinked_data_directory_is_rejected(cluster, tmp_path):
    link = tmp_path / "link"
    link.symlink_to(cluster)
    with pytest.raises(FixtureGuardError, match="canonical"):
        attest(cluster, path=str(link))


def test_fixture_attests_before_any_create_or_drop_database():
    source = (Path(__file__).parent / "conftest.py").read_text()
    attest_at = source.index("attest_disposable_cluster(url")
    assert attest_at < source.index("CREATE DATABASE")
    assert attest_at < source.index("DROP DATABASE")
    # only the uniquely named, fixture-created database is ever dropped; never a fixed or supplied name
    assert re.search(r'db_name = f"analytics_fixture_\{uuid\.uuid4\(\)\.hex', source)
    assert "DROP DATABASE IF EXISTS \"{db_name}\"" in source
    assert source.count("DROP DATABASE") == 1
