# Mystery Shopper Operations Guide

## Purpose
Operational checklist for Admin, Reviewer, and Representative users to run Mystery Shopper safely in day-to-day usage.

## 1. First-time Setup
1. Start database and backend.
2. Run Mystery bootstrap once:
   - `POST /mystery-shopper/bootstrap`
3. If this is an existing environment with historical Mystery visits, run:
   - `POST /mystery-shopper/seed-legacy`
4. Start frontends:
   - Dashboard: `http://localhost:5175`
   - Mystery Shopper Survey: `http://localhost:5177`

## 2. Admin Workflow
1. Open Dashboard and select `Mystery Shopper` platform.
2. Open `Locations` tab.
3. Add all Customer Service Centres before representatives start visits.
4. Use **Seed Old Data** to import legacy locations/purposes after migrations or historical data loads.
5. Deactivate locations when needed (do not delete history).

## 3. Representative Workflow
1. Open Mystery Shopper frontend.
2. Enter User ID and role `Representative`.
3. Create/load visit with required header details:
   - location, visit date/time, purpose, staff on duty, shopper name
4. Complete and save section responses.
5. Submit for review when all required questions are saved.

## 4. Reviewer Workflow
1. Open Dashboard and select `Mystery Shopper`.
2. Open `Review Queue`.
3. Review responses and apply action:
   - Approve
   - Needs Changes (with notes)
   - Reject (with notes)

## 5. Analytics Expectations
- Analytics and survey results in Mystery Shopper mode are scoped to Mystery records only.
- Key metrics include:
  - NPS
  - Overall experience averages
  - Service quality averages
  - Waiting time and service-completion distributions
  - Location breakdown and daily trend

## 6. Date Completed Rule
- `report_completed_date` is generated server-side at submit time.
- Timezone basis: UTC+4.

## 7. Troubleshooting
- If locations are missing:
  - Verify bootstrap endpoint succeeded.
  - Verify location records are active.
- If review queue is empty:
  - Check submitted visits are in `Pending` status for Mystery Shopper.
- If analytics look empty:
  - Confirm visits are approved and responses are saved.
