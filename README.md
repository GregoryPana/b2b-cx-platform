# CX B2B Platform

## 🎯 Current Status

This is a customer experience platform with multiple survey applications and a governance dashboard.

### 🏗️ Architecture

- **Governance Dashboard**: Internal admin interface (VPN access only)
- **B2B Survey**: Business relationship surveys (current)
- **Mystery Shopper Survey**: Customer experience surveys (planned)
- **Installation Assessment**: Technical installation surveys (planned)

### 🚀 Quick Start

1. **Setup Database**:
   ```bash
   # Execute response tables schema
   psql -h localhost -U postgres -d cx_b2b_platform < CREATE_RESPONSE_TABLES.sql
   ```

2. **Start Services**:
   ```bash
   # Start backend
   cd backend && python -m uvicorn app.main:app --reload
   
   # Start dashboard frontend
   cd frontend/dashboard && npm run dev -- --port 5175

   # Start survey frontend
   cd frontend/survey && npm run dev
   ```

3. **Access Applications**:
   - Dashboard: http://localhost:5175
   - Survey: http://localhost:5176
   - Backend API: http://localhost:8001

### 🌐 Network Access (Mobile/Tablet Support)

To access the platform from other devices on your local network:

1. **Quick Start (Windows)**:
   ```bash
   # Run the network startup script
   start_network.bat
   ```

2. **Manual Network Setup**:
   ```bash
   # Start backend for network access
   cd backend && python start_network.py
   
   # Start frontends (in separate terminals)
   cd frontend/survey && npm run dev
   cd frontend/dashboard && npm run dev
   ```

3. **Find Your IP Address**:
   - Windows: `ipconfig` (look for "IPv4 Address")
   - Mac: `ipconfig getifaddr en0`
   - Linux: `hostname -I | awk '{print $1}'`

4. **Access from Other Devices**:
   - Survey: `http://YOUR_IP:5176`
   - Dashboard: `http://YOUR_IP:5175`
   - API: `http://YOUR_IP:8001`

📖 **Full Network Guide**: See [NETWORK_ACCESS.md](./NETWORK_ACCESS.md) for detailed instructions and troubleshooting.

### 📁 Project Structure

```
cx-b2b-platform/
├── 📁 backend/                 # FastAPI backend
├── 📁 frontend/               # React frontends
│   ├── 📁 survey/           # B2B survey app
│   ├── 📁 dashboard/        # Governance dashboard (planned)
│   ├── 📁 mystery-shopper/   # Mystery shopper survey (planned)
│   └── 📁 installation/     # Installation assessment (planned)
├── 📄 service_status.py    # Service status checker
├── 📄 UPDATED_PLATFORM_ARCHITECTURE.md  # Architecture documentation
├── 📄 SURVEY_RESPONSE_FIX_REPORT.md # Response fix details
├── 📄 CREATE_RESPONSE_TABLES.sql      # Database schema
└── 📄 Makefile           # Build and deployment commands
```

### 🔧 Current Features

- ✅ Business management and visit scheduling
- ✅ Survey response collection (with database fix)
- ✅ User management and role-based access
- ✅ Analytics and reporting
- 🚧 Survey response saving (fix in progress)

### 🔌 API Notes

- **Draft visits endpoint**: `GET /dashboard-visits/drafts`
  - Returns both `id` and `visit_id` (same value) for frontend compatibility.
  - Includes progress fields: `response_count`, `mandatory_answered_count`, `mandatory_total_count`, `is_started`.

- **Delete draft visit endpoint**: `DELETE /dashboard-visits/{visit_id}`
  - Deletes a visit only when its status is `Draft`.
  - Also deletes any `b2b_visit_responses` rows for the visit.

- **Exact date filtering** (dashboard survey results)
  - When filtering by a single date, the dashboard sends `date_from=YYYY-MM-DD` and `date_to=YYYY-MM-DD`.

- **Survey type codenames**
  - Use `survey_type` (string) as the primary API interface (e.g., `B2B`, `Mystery Shopper`, `Installation Assessment`).
  - `GET /survey-types` lists available survey types.
  - `GET /questions?survey_type=...` returns questions for the selected survey type.
  - `POST /dashboard-visits` accepts `survey_type` in the payload.
  - `GET /dashboard-visits/all` supports `survey_type=...` filtering.

### 🧭 Multi-Platform Dashboard

- When the dashboard loads, users first see a **Platform Selector**.
- After selecting a platform (for now, use **B2B**), the dashboard shows the tools and pages for that platform.
- Other platforms (Mystery Shopper / Installation Assessment) are intentionally separated and will be filled out later.

## 🧑‍🏫 B2B Workflow Guide (Non-Technical)

This section explains the end-to-end B2B workflow in simple steps.

### 1) Start the system

You will run 3 services (Backend API + Dashboard + Survey).

- **Backend API** (FastAPI)
  - Start from the `backend` folder.
  - Runs at: `http://localhost:8001`

- **Dashboard** (Managers/Admins)
  - Start from the `frontend/dashboard` folder.
  - Runs at: `http://localhost:5175`

- **Survey App** (Representatives)
  - Start from the `frontend/survey` folder.
  - Runs at: `http://localhost:5176`

### 2) Choose the platform

When the dashboard loads, select **B2B**.

### 3) Create or manage businesses (Manager/Admin)

In the dashboard:

- Go to **Businesses**.
- Create a business (name, location, priority).
- Retire a business when it should no longer be visited.

### 4) Plan a visit (Manager/Admin)

In the dashboard:

- Go to **Visits**.
- Create a **Draft Visit** by selecting:
  - Business
  - Representative
  - Visit date

This creates a planned visit that the representative will see in the Survey App.

### 5) Complete the survey (Representative)

In the survey app:

- Open a planned visit.
- Answer questions.
- Save responses as you go.

### 6) Submit the visit for review (Representative)

When all required questions are completed:

- Click **Submit for Review**.

The visit moves to **Pending** status.

### 7) Review and approve/reject (Reviewer/Admin)

In the dashboard:

- Go to **Review Queue**.
- Open the pending visit.
- Choose:
  - **Approve** (visit becomes Approved/Completed)
  - **Reject** (visit becomes Rejected)
  - **Needs Changes** (representative must update the visit)

### 8) View results and analytics (Manager/Admin)

In the dashboard:

- **Survey Results**
  - Shows visits and progress counts.
  - Use filters like date and business.

- **Analytics**
  - Shows NPS, coverage, and category trends based on **Approved** visits.

## 📊 Retired Businesses and Analytics

- When a business is retired, set `businesses.active = false`.
- **Analytics pages** (NPS, coverage, category breakdown) only include visits for **active businesses**.
- **Survey Results** can still show retired businesses when you search/filter for that business (historical view).

## � Postman Collection (API Testing)

A ready-to-import Postman collection is included:

- `postman/CX-B2B-Platform.postman_collection.json`

### Import steps

1. Import the collection into Postman.
2. Set the collection variables:
   - `baseUrl` (default: `http://localhost:8001`)
   - `token` (optional; for dev mode the backend uses a mock user)
   - `surveyType` (default: `B2B`)
3. Run requests in order starting from **Health**, then **Survey**, then **Dashboard Visits**.

## �🧹 Remove Old Test Visits (Admin Only)

If you created test visits in the past and want to remove them (including any responses), you can use the admin purge endpoint.

### Safety first

- This action **deletes data permanently**.
- Always run a **dry run** first to preview how many visits/responses will be deleted.

### Step 1: Dry run (preview only)

Call:

`DELETE /admin-dashboard/visits/purge?before_date=YYYY-MM-DD&dry_run=true`

Example (delete anything before today):

`DELETE /admin-dashboard/visits/purge?before_date=2026-03-09&dry_run=true`

### Step 2: Execute deletion

If the dry run looks correct, run:

`DELETE /admin-dashboard/visits/purge?before_date=YYYY-MM-DD&dry_run=false`

### Optional: only purge a single survey type

You can limit deletion to a single platform:

`DELETE /admin-dashboard/visits/purge?before_date=YYYY-MM-DD&dry_run=true&survey_type=B2B`

### Delete a single visit (any status)

If you need to delete one specific visit (even if it is **Pending** or **Approved**) and also remove all its related response data, use:

`DELETE /admin-dashboard/visits/{visit_id}`

This will remove:

- The visit row
- Any related `b2b_visit_responses`
- Any related `responses` / `response_actions` (if present)

### Which one should I use?

- **Use purge-by-date** when you want to clean up many old test visits in one go.
- **Use delete-by-id** when you want to remove one specific visit that was created by mistake.

### 📋 Next Steps

1. **Fix Survey Responses**: Execute CREATE_RESPONSE_TABLES.sql and restart backend
2. **Develop Governance Dashboard**: Build unified admin interface
3. **Create New Surveys**: Mystery Shopper and Installation Assessment
4. **Deploy Production**: Set up proper hosting and access controls

### 📞 Documentation

- `UPDATED_PLATFORM_ARCHITECTURE.md` - Complete platform architecture
- `SURVEY_RESPONSE_FIX_REPORT.md` - Survey response fix details
- `CREATE_RESPONSE_TABLES.sql` - Database schema for responses

---

*Repository cleaned and organized for development*  
*Last updated: 2026-03-04*