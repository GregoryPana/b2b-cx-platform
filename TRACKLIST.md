# TRACKLIST

## Session: TDD Baseline Setup

### Scope

- Add a standard TDD protocol and repeatable verification workflow.
- Require TODO + tracklist updates for each change cycle.

### Actions

1. Added `docs/TDD_EXECUTION_PROTOCOL.md`.
2. Added `TODO.md` for session task state tracking.
3. Added `scripts/powershell/tdd_verify.ps1` for repeatable checks.
4. Added `scripts/powershell/tdd_cycle.ps1` for controlled stop/start + verify workflow.
5. Updated `scripts/powershell/tdd_verify.ps1` to auto-append verification output into `TRACKLIST.md`.

### Verification

- Pending: run `scripts/powershell/tdd_cycle.ps1 -UseDevBypass` (or with real token) to append full output automatically.

### Result

- Status: `in_progress`

## Session: Dashboard Stability + Yes/No Chart Redesign

### Scope

- Stabilize dashboard view persistence after initial load.
- Remove old Yes/No summary/by-question layout.
- Add dedicated per-question yes/no charts for Questions 4, 6, 9, and 16.
- Remove React Router v7 deprecation warnings and reduce chart container warnings.

### Actions

1. Updated `frontend/dashboard-blueprint/src/App.jsx` to avoid clearing `activePlatform` before Entra roles are available.
2. Updated `frontend/dashboard-blueprint/src/main.jsx` with React Router `future` flags for v7 warning suppression.
3. Updated `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx`:
   - Removed old yes/no summary/by-question block.
   - Added new "Yes/No Question Results" section with 4 cards (Q4/Q6/Q9/Q16), each with chart + percentages.
   - Added `minWidth/minHeight` on responsive charts to reduce width/height warnings.

### Verification

- Pending: run `scripts/powershell/tdd_verify.ps1` and append verbatim outputs.

### Result

- Status: `in_progress`

## Session: Staging Auth Session Stability

### Scope

- Prevent dashboard data from disappearing after token expiry/refresh in staging mode.
- Normalize analytics formula strings to ASCII-safe output.

### Actions

1. Updated `frontend/dashboard-blueprint/src/App.jsx`:
   - Added JWT expiry parser.
   - Added timed token refresh before expiry using `acquireTokenSilent(..., forceRefresh: true)`.
   - Added 401 recovery path on `/auth/me` to force token refresh and retry state.
2. Updated `backend/app/routers/analytics.py` formula strings to `/` (ASCII) for stable rendering/logging.

### Verification

- Pending: restart backend + dashboard and run `tdd_verify.ps1` with fresh Entra token.

### Result

- Status: `in_progress`

## Session: TDD Verify 2026-03-27 16:01:58

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: dev-bypass

### Results

- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"dev"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) ++ (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services ++ Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":24,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[{"location_name":"Air Seychelles","visits":1,"csat_average":null}],"visit_trend":[{"visit_date":"2026-03-12","visit_count":1}]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-24","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```

## Session: TDD Verify 2026-03-27 16:04:15

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: dev-bypass

### Results

- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"dev"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) ++ (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services ++ Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":24,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[{"location_name":"Air Seychelles","visits":1,"csat_average":null}],"visit_trend":[{"visit_date":"2026-03-12","visit_count":1}]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-24","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```

## Session: TDD Verify 2026-03-27 16:07:52

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: dev-bypass

### Results

- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"dev"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) ++ (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services ++ Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":24,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[{"location_name":"Air Seychelles","visits":1,"csat_average":null}],"visit_trend":[{"visit_date":"2026-03-12","visit_count":1}]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-24","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```

## Session: TDD Verify 2026-03-27 16:08:22

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: dev-bypass

### Results

- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"dev"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) ++ (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services ++ Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":24,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[{"location_name":"Air Seychelles","visits":1,"csat_average":null}],"visit_trend":[{"visit_date":"2026-03-12","visit_count":1}]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-24","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```

## Session: TDD Verify 2026-03-27 16:14:45

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: dev-bypass

### Results

- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 000
- Visits HTTP: 000

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"dev"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) ++ (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services ++ Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":24,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[{"location_name":"Air Seychelles","visits":1,"csat_average":null}],"visit_trend":[{"visit_date":"2026-03-12","visit_count":1}]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
curl: (28) Operation timed out after 12005 milliseconds with 0 bytes received
```

#### Dashboard Visits
```
curl: (28) Operation timed out after 12002 milliseconds with 0 bytes received
```

## Session: TDD Verify 2026-03-27 16:27:28

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Health HTTP: 000
- Analytics HTTP: 000
- NPS HTTP: 000
- Visits HTTP: 000

### Verbatim Output

#### Health
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2041 ms: Could not connect to server
HTTP_STATUS:000
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2030 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard NPS
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2042 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard Visits
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2030 ms: Could not connect to server

HTTP_STATUS:000
```

## Session: TDD Verify 2026-03-27 16:29:52

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: pass
- Health HTTP: 200
- Analytics HTTP: 401
- NPS HTTP: 401
- Visits HTTP: 401

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"staging"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"detail":"Invalid access token: Signature has expired"}
HTTP_STATUS:401
```

#### Dashboard NPS
```
{"detail":"Invalid access token: Signature has expired"}
HTTP_STATUS:401
```

#### Dashboard Visits
```
{"detail":"Invalid access token: Signature has expired"}
HTTP_STATUS:401
```

## Session: TDD Verify 2026-03-27 16:32:46

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: fail
- Health HTTP: 000
- Analytics HTTP: 000
- NPS HTTP: 000
- Visits HTTP: 000

### Verbatim Output

#### Health
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2021 ms: Could not connect to server

HTTP_STATUS:000
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2008 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard NPS
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2035 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard Visits
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2029 ms: Could not connect to server

HTTP_STATUS:000
```

## Session: TDD Verify 2026-03-27 16:34:20

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: none

### Results

- Verify Status: pass
- Health HTTP: 200
- Analytics HTTP: 401
- NPS HTTP: 401
- Visits HTTP: 401

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"staging"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"detail":"Missing bearer token"}
HTTP_STATUS:401
```

#### Dashboard NPS
```
{"detail":"Missing bearer token"}
HTTP_STATUS:401
```

#### Dashboard Visits
```
{"detail":"Missing bearer token"}
HTTP_STATUS:401
```

## Session: TDD Verify 2026-03-27 16:36:49

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: pass
- Health HTTP: 200
- Analytics HTTP: 401
- NPS HTTP: 401
- Visits HTTP: 401

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"staging"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"detail":"Invalid access token: Invalid crypto padding"}
HTTP_STATUS:401
```

#### Dashboard NPS
```
{"detail":"Invalid access token: Invalid crypto padding"}
HTTP_STATUS:401
```

#### Dashboard Visits
```
{"detail":"Invalid access token: Invalid crypto padding"}
HTTP_STATUS:401
```

## Session: TDD Verify 2026-03-30 09:28:12

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: fail
- Health HTTP: 000
- Analytics HTTP: 000
- NPS HTTP: 000
- Visits HTTP: 000

### Verbatim Output

#### Health
```
curl: (28) Operation timed out after 8002 milliseconds with 0 bytes received
HTTP_STATUS:000
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2027 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard NPS
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2020 ms: Could not connect to server

HTTP_STATUS:000
```

#### Dashboard Visits
```
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 2036 ms: Could not connect to server

HTTP_STATUS:000
```

## Session: TDD Verify 2026-03-30 10:24:43

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: pass
- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"staging"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) / (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services / Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":0,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[],"visit_trend":[]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-24","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```

## Session: TDD Verify 2026-03-30 10:56:25

### Config

- API Base: http://127.0.0.1:8001
- DB URL: postgresql://b2b:b2b@127.0.0.1:5432/b2b
- Auth Mode: bearer-token

### Results

- Verify Status: pass
- Health HTTP: 200
- Analytics HTTP: 200
- NPS HTTP: 200
- Visits HTTP: 200

### Verbatim Output

#### Health
```
{"status":"healthy","platform":"CX Assessment Platform","mode":"staging"}
HTTP_STATUS:200
```

#### Database Counts
```
users: 4
businesses: 4
questions: 24
visits: 4
responses: 91
b2b_visit_responses: 91
survey_types: 3
```

#### Analytics
```
{"visits":{"total":4,"draft":1,"pending":1,"completed":1,"approved":1,"rejected":1},"responses":{"text_responses":91},"nps":{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1,"promoter_percentage":100.0,"detractor_percentage":0.0,"passive_percentage":0.0},"customer_satisfaction":{"avg_score":9.0,"response_count":1,"csat_score":100.0,"csat_formula":"(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100","question_text":"Rate your overall C&W Satisfaction (from question 12)","score_distribution":{"very_dissatisfied":0,"dissatisfied":0,"neutral":0,"satisfied":0,"very_satisfied":1}},"relationship_score":{"score":90.0,"avg_score":9.0,"total_score":36.0,"possible_score":40.0,"questions_answered":4,"formula":"(Sum of Relationship Question Scores) / (Sum of Max Scores for Answered Relationship Questions) * 100","scale":"0-100"},"competitive_exposure":{"exposure_rate":100.0,"total_accounts":1,"accounts_using_competitors":1,"formula":"Accounts Using Competitor Services / Total Accounts Surveyed","scale":"Percentage"},"mystery_shopper":{"csat_average":null,"csat_response_count":0,"waiting_time_distribution":[],"service_completion_distribution":[],"location_breakdown":[],"visit_trend":[]}}
HTTP_STATUS:200
```

#### Dashboard NPS
```
{"nps":100.0,"promoters":1,"detractors":0,"passives":0,"total_responses":1}
HTTP_STATUS:200
```

#### Dashboard Visits
```
[{"id":"e4242cf8-770a-4358-85e6-b924b2b98c25","business_id":7,"business_name":"State House","representative_id":8,"representative_name":"Representative","visit_date":"2026-04-01","visit_type":"Unplanned","status":"Draft","business_priority":"medium","submitted_by_name":null,"submitted_by_email":null,"submitted_at":null,"response_count":19,"mandatory_answered_count":16,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"921e621f-ba65-4f2b-a1f8-dcc6a395fc57","business_id":8,"business_name":"Hilton","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-25","visit_type":"Planned","status":"Rejected","business_priority":"low","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.418300+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"04756400-dd30-461b-951a-773951685b8e","business_id":6,"business_name":"Four Seasons","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-19","visit_type":"Planned","status":"Pending","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.380585+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false},{"id":"9846e7b7-36ff-462b-8491-6400033ccdc5","business_id":5,"business_name":"Air Seychelles","representative_id":8,"representative_name":"Representative","visit_date":"2026-03-12","visit_type":"Planned","status":"Approved","business_priority":"high","submitted_by_name":"Representative","submitted_by_email":"rep@local","submitted_at":"2026-03-25T11:45:56.354279+00:00","response_count":24,"mandatory_answered_count":21,"mandatory_total_count":21,"is_started":true,"is_completed":false}]
HTTP_STATUS:200
```
