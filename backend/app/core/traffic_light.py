from __future__ import annotations


TRAFFIC_LIGHT_STYLES = {
    "good": {
        "label": "Healthy",
        "background": "#f0fdf4",
        "border": "#86efac",
        "text": "#166534",
        "muted_text": "#166534",
    },
    "warning": {
        "label": "Watch",
        "background": "#fffbeb",
        "border": "#fcd34d",
        "text": "#b45309",
        "muted_text": "#92400e",
    },
    "bad": {
        "label": "Needs attention",
        "background": "#fff1f2",
        "border": "#fda4af",
        "text": "#be123c",
        "muted_text": "#9f1239",
    },
    "neutral": {
        "label": "No data",
        "background": "#f8fafc",
        "border": "#cbd5e1",
        "text": "#0f172a",
        "muted_text": "#475569",
    },
}


def _to_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except Exception:
        return None


def get_b2b_metric_grade(metric: str, value):
    numeric_value = _to_float(value)
    tone = "neutral"
    label = TRAFFIC_LIGHT_STYLES[tone]["label"]

    if numeric_value is None:
        style = TRAFFIC_LIGHT_STYLES[tone].copy()
        style["tone"] = tone
        style["label"] = label
        return style

    if metric == "nps":
        if numeric_value >= 50:
            tone, label = "good", "Healthy"
        elif numeric_value >= 0:
            tone, label = "warning", "Watch"
        else:
            tone, label = "bad", "Needs attention"
    elif metric in {"csat", "relationship_score"}:
        if numeric_value >= 80:
            tone, label = "good", "Healthy"
        elif numeric_value >= 60:
            tone, label = "warning", "Watch"
        else:
            tone, label = "bad", "Needs attention"
    elif metric == "competitor_exposure":
        if numeric_value <= 20:
            tone, label = "good", "Low exposure"
        elif numeric_value <= 40:
            tone, label = "warning", "Moderate exposure"
        else:
            tone, label = "bad", "High exposure"

    style = TRAFFIC_LIGHT_STYLES[tone].copy()
    style["tone"] = tone
    style["label"] = label
    return style


def get_installation_metric_grade(value):
    numeric_value = _to_float(value)
    tone = "neutral"
    label = TRAFFIC_LIGHT_STYLES[tone]["label"]

    if numeric_value is not None:
        if numeric_value >= 4:
            tone, label = "good", "Pass"
        elif numeric_value >= 3:
            tone, label = "warning", "Watch"
        else:
            tone, label = "bad", "Fail"

    style = TRAFFIC_LIGHT_STYLES[tone].copy()
    style["tone"] = tone
    style["label"] = label
    return style
