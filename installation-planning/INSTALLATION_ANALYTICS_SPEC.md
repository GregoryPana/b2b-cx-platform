# Installation Analytics Specification

## Scope
- Applies to Installation Assessment only.
- Default scope: `status = 'Approved'`.
- Filterable by `date_from`, `date_to`, `customer_type`, `execution_party`.
- No analytics by location (address is unique per customer).
- No on-time review SLA metrics.

## Core Calculations
- Overall score per assessment:
  - `overall_score = SUM(question_scores) / 7.0`
- Category score per assessment:
  - `category_score = AVG(scores for questions in category)`

## Threshold Bands (Overall Score)
- `>= 4.0` → Pass - Excellent
- `>= 3.0 and < 4.0` → Pass - Needs Improvement
- `>= 2.0 and < 3.0` → Fail - Rework Required
- `< 2.0` → Critical Fail

## Risk Flags
- `any_question_score <= 2` → risk_flag = true
- `safety_question_score <= 2` (Safety & Infrastructure Integrity) → safety_critical_flag = true

## Dashboard KPIs
- Total assessments
- Average overall score
- Median overall score
- Pass rate (overall_score >= 3.0)
- Rework rate (overall_score < 3.0)
- Critical fail rate (overall_score < 2.0)
- Safety-critical count and rate (safety question score <= 2)
- Completion rate (% with all 7 answers)

## Segment Analytics
- Average overall score by:
  - execution_party (Field Team vs Contractor)
  - customer_type (B2B vs B2C)
- Threshold band distribution by segment
- Delta comparisons:
  - avg(Field Team) - avg(Contractor)
  - avg(B2B) - avg(B2C)

## Category Analytics
- Overall category averages
- Category averages by:
  - execution_party
  - customer_type

## Trend Analytics
- Weekly/monthly trend:
  - average overall score
  - pass/rework/critical rates
  - assessment volume
- Trend splits by execution_party and customer_type

## Suggested API Contract
`GET /dashboard/installation/analytics`

Query params:
- `date_from` (YYYY-MM-DD, optional)
- `date_to` (YYYY-MM-DD, optional)
- `customer_type` (B2B/B2C, optional)
- `execution_party` (Field Team/Contractor, optional)

Response shape (example):
```json
{
  "kpis": {
    "total_assessments": 128,
    "average_overall_score": 3.84,
    "median_overall_score": 3.9,
    "pass_rate": 0.87,
    "rework_rate": 0.13,
    "critical_fail_rate": 0.02,
    "safety_critical_count": 4,
    "safety_critical_rate": 0.03,
    "completion_rate": 0.98
  },
  "segment_breakdown": {
    "execution_party": [
      {
        "label": "Field Team",
        "count": 74,
        "average_overall_score": 3.95,
        "threshold_bands": {
          "excellent": 0.44,
          "needs_improvement": 0.46,
          "rework": 0.09,
          "critical": 0.01
        }
      },
      {
        "label": "Contractor",
        "count": 54,
        "average_overall_score": 3.68,
        "threshold_bands": {
          "excellent": 0.31,
          "needs_improvement": 0.49,
          "rework": 0.17,
          "critical": 0.03
        }
      }
    ],
    "customer_type": [
      {
        "label": "B2B",
        "count": 51,
        "average_overall_score": 3.90,
        "threshold_bands": {
          "excellent": 0.47,
          "needs_improvement": 0.43,
          "rework": 0.08,
          "critical": 0.02
        }
      },
      {
        "label": "B2C",
        "count": 77,
        "average_overall_score": 3.78,
        "threshold_bands": {
          "excellent": 0.38,
          "needs_improvement": 0.48,
          "rework": 0.12,
          "critical": 0.02
        }
      }
    ],
    "delta": {
      "execution_party": 0.27,
      "customer_type": 0.12
    }
  },
  "category_breakdown": {
    "overall": [
      {
        "category": "Technical Performance & Network Standards",
        "average_score": 3.92
      },
      {
        "category": "Physical Routing & Aesthetic Quality",
        "average_score": 3.81
      },
      {
        "category": "Safety & Infrastructure Integrity",
        "average_score": 3.75
      },
      {
        "category": "Site Cleanliness & Property Damage",
        "average_score": 3.86
      }
    ],
    "by_execution_party": [
      {
        "category": "Technical Performance & Network Standards",
        "Field Team": 4.01,
        "Contractor": 3.79
      }
    ],
    "by_customer_type": [
      {
        "category": "Safety & Infrastructure Integrity",
        "B2B": 3.82,
        "B2C": 3.70
      }
    ]
  },
  "trends": {
    "interval": "week",
    "series": [
      {
        "period": "2026-02-10",
        "count": 12,
        "average_overall_score": 3.72,
        "pass_rate": 0.83,
        "rework_rate": 0.17,
        "critical_rate": 0.00
      }
    ],
    "by_execution_party": [
      {
        "period": "2026-02-10",
        "Field Team": 3.82,
        "Contractor": 3.61
      }
    ],
    "by_customer_type": [
      {
        "period": "2026-02-10",
        "B2B": 3.79,
        "B2C": 3.69
      }
    ]
  }
}
```

## Pseudo-SQL Building Blocks

### 1) Base filtered visits (Installation only)
```sql
WITH installation_visits AS (
  SELECT v.id AS visit_id,
         v.status,
         ia.customer_type,
         ia.execution_party,
         ia.work_date
  FROM visits v
  JOIN installation_assessments ia ON ia.visit_id = v.id
  JOIN survey_types st ON st.id = v.survey_type_id
  WHERE st.name = 'Installation Assessment'
    AND v.status = 'Approved'
    AND (:date_from IS NULL OR ia.work_date >= :date_from)
    AND (:date_to IS NULL OR ia.work_date <= :date_to)
    AND (:customer_type IS NULL OR ia.customer_type = :customer_type)
    AND (:execution_party IS NULL OR ia.execution_party = :execution_party)
)
```

### 2) Per-visit overall score
```sql
, visit_overall AS (
  SELECT iv.visit_id,
         AVG(r.score)::float AS overall_score,
         COUNT(r.id) AS answered_count
  FROM installation_visits iv
  JOIN responses r ON r.visit_id = iv.visit_id
  JOIN questions q ON q.id = r.question_id
  GROUP BY iv.visit_id
)
```

### 3) Threshold band per visit
```sql
, visit_band AS (
  SELECT vo.visit_id,
         vo.overall_score,
         CASE
           WHEN vo.overall_score >= 4.0 THEN 'excellent'
           WHEN vo.overall_score >= 3.0 THEN 'needs_improvement'
           WHEN vo.overall_score >= 2.0 THEN 'rework'
           ELSE 'critical'
         END AS band
  FROM visit_overall vo
)
```

### 4) KPI aggregation
```sql
SELECT
  COUNT(*) AS total_assessments,
  AVG(vo.overall_score)::float AS average_overall_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vo.overall_score) AS median_overall_score,
  AVG(CASE WHEN vo.overall_score >= 3.0 THEN 1 ELSE 0 END)::float AS pass_rate,
  AVG(CASE WHEN vo.overall_score < 3.0 THEN 1 ELSE 0 END)::float AS rework_rate,
  AVG(CASE WHEN vo.overall_score < 2.0 THEN 1 ELSE 0 END)::float AS critical_fail_rate,
  AVG(CASE WHEN vo.answered_count = 7 THEN 1 ELSE 0 END)::float AS completion_rate
FROM visit_overall vo;
```

### 5) Segment averages (execution party, customer type)
```sql
SELECT iv.execution_party AS label,
       COUNT(*) AS count,
       AVG(vo.overall_score)::float AS average_overall_score,
       AVG(CASE WHEN vb.band = 'excellent' THEN 1 ELSE 0 END)::float AS excellent_rate,
       AVG(CASE WHEN vb.band = 'needs_improvement' THEN 1 ELSE 0 END)::float AS needs_improvement_rate,
       AVG(CASE WHEN vb.band = 'rework' THEN 1 ELSE 0 END)::float AS rework_rate,
       AVG(CASE WHEN vb.band = 'critical' THEN 1 ELSE 0 END)::float AS critical_rate
FROM installation_visits iv
JOIN visit_overall vo ON vo.visit_id = iv.visit_id
JOIN visit_band vb ON vb.visit_id = iv.visit_id
GROUP BY iv.execution_party;
```

### 6) Category averages
```sql
SELECT q.category,
       AVG(r.score)::float AS average_score
FROM installation_visits iv
JOIN responses r ON r.visit_id = iv.visit_id
JOIN questions q ON q.id = r.question_id
GROUP BY q.category
ORDER BY q.category;
```

### 7) Trend series (weekly)
```sql
SELECT date_trunc('week', ia.work_date) AS period,
       COUNT(*) AS count,
       AVG(vo.overall_score)::float AS average_overall_score,
       AVG(CASE WHEN vo.overall_score >= 3.0 THEN 1 ELSE 0 END)::float AS pass_rate,
       AVG(CASE WHEN vo.overall_score < 3.0 THEN 1 ELSE 0 END)::float AS rework_rate,
       AVG(CASE WHEN vo.overall_score < 2.0 THEN 1 ELSE 0 END)::float AS critical_rate
FROM installation_visits iv
JOIN installation_assessments ia ON ia.visit_id = iv.visit_id
JOIN visit_overall vo ON vo.visit_id = iv.visit_id
GROUP BY date_trunc('week', ia.work_date)
ORDER BY period;
```

## Notes
- Segment aggregations should use per-visit `overall_score` to avoid over-weighting assessments.
- Category averages should use question-level rows.
- Safety-critical flag uses the Safety & Infrastructure Integrity question score.
