# NPS Engine Rules

## Inputs
- Approved visits only.
- Classic NPS question score (0-10).

## Classification
- Promoter: 9-10
- Passive: 7-8
- Detractor: 0-6

## Calculation
- Promoters percent = promoters / total approved responses * 100
- Detractors percent = detractors / total approved responses * 100
- NPS = promoters percent - detractors percent

## Constraints
- No category weighting in Phase 1.
- If no approved responses, return NPS as null with zero counts.
