# Coverage Engine Rules

## Inputs
- Businesses marked active.
- Approved visits only.

## Metrics
- Total Active Businesses
- Businesses Visited YTD
- Coverage Percent
- Businesses Not Visited
- Repeat Visits

## Calculation Rules
- Businesses Visited YTD: count distinct businesses with approved visits in current year.
- Coverage Percent: Businesses Visited YTD / Total Active Businesses * 100.
- Businesses Not Visited: Total Active Businesses - Businesses Visited YTD.
- Repeat Visits: count businesses with more than one approved visit in current year.
