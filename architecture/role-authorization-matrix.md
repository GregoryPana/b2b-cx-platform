# Role Authorization Matrix

## Representative
- Create visit
- Edit draft visit
- Edit visit with status Needs Changes
- Submit visit
- View own submissions

## Reviewer
- View pending visits
- Edit pending visits
- Mark visit as Needs Changes (with notes)
- Approve visit
- Reject visit (with comments)

## Manager
- View dashboards
- Filter by date, account executive, category
- View coverage analytics

## Admin
- Manage users
- Manage businesses
- Manage question set
- Override approval state
- Access all dashboards

## Enforcement
- Backend is authoritative; frontend rendering is secondary.
- No endpoint relies on network restriction alone.
