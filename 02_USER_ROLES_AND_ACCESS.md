# User Roles & Access Control

## Roles

### Representative
- Create visits
- Edit draft visits
- Edit visits marked Needs Changes
- Submit visits
- View own submissions
- Cannot access dashboards
- Cannot approve/reject

### Reviewer
- View pending visits
- Edit pending visits
- Mark visits as Needs Changes with comments
- Approve visits (optional approval notes)
- Reject visits (rejection notes required)

### Manager
- View dashboards
- Filter by:
  - Date
  - Account Executive
  - Category
- View coverage analytics

### Admin
- Manage users
- Manage businesses
- Manage question set
- Override approval state
- Access all dashboards

---

## Authorization Rules

Authorization is enforced strictly at the backend (FastAPI).

Frontend role-based rendering is secondary.

No endpoint relies solely on network restriction.
