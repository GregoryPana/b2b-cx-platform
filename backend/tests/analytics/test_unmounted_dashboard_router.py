"""routers/dashboard.py is dead, unmountable legacy code: keep it unmounted and free of the COUNT/ELSE 0 hazard."""

from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app"


def test_dashboard_router_is_not_mounted_anywhere():
    for path in APP.rglob("*.py"):
        if path.name == "dashboard.py" and path.parent.name == "routers":
            continue
        source = path.read_text(encoding="utf-8", errors="ignore")
        assert not re.search(r"routers\.dashboard\b|from\s+\.dashboard\s+import|routers\s+import\s+[^\n]*\bdashboard\b", source), path
    main = (APP / "main.py").read_text(encoding="utf-8")
    assert "app.routers.dashboard" not in main


def test_mounted_app_exposes_no_endpoint_from_the_legacy_router():
    from app.main import create_app

    modules = {getattr(getattr(route, "endpoint", None), "__module__", "") for route in create_app().routes}
    assert "app.routers.dashboard" not in modules


def test_legacy_router_source_hazards_are_removed():
    source = (APP / "routers" / "dashboard.py").read_text(encoding="utf-8")
    assert not re.search(r"COUNT\(\s*CASE[^)]*ELSE\s+0", source, re.S | re.I)
    assert re.search(r"from sqlalchemy import [^\n]*\btext\b", source)
    assert "survey_types" in source  # NPS is pinned to the B2B module
