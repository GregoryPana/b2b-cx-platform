# Workflow & Business Logic

## Visit Lifecycle

Draft → Pending Review → Needs Changes / Approved / Rejected

Only Approved:
- Counts toward coverage
- Feeds dashboards
- Included in NPS calculation

Needs Changes:
- Requires reviewer change notes
- Editable by reviewer and representative
- Must return to Pending Review for approval

Approved:
- May include approval notes

Rejected:
- Requires rejection notes

---

## NPS Calculation

For approved visits only:

Promoters = % of scores 9–10  
Detractors = % of scores 0–6  

NPS = Promoters − Detractors

---

## Coverage Calculation

Metrics:

- Total Active Businesses
- Businesses Visited YTD
- Coverage %
- Businesses Not Visited
- Repeat Visits

---

## Action Required Logic

If action_required is filled:
- action_target required
- priority_level required
