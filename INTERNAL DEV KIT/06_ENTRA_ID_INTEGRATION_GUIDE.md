# Entra ID Integration Guide

This guide explains how to register and integrate a new internal bespoke application with Microsoft Entra ID.

It is written for both technical users and beginners.

## 1. What Entra ID is doing in our apps

Entra ID is the login system.

It is responsible for:
- signing users in
- issuing tokens
- carrying user identity and role claims

Our applications then use those tokens to decide:
- who the user is
- what the user can do

## 2. Standard auth model

For internal DTO apps:
- frontend uses MSAL with redirect login flow
- backend validates bearer tokens
- roles are enforced in the backend
- frontend hides or shows features for convenience only

Backend authorization is authoritative.

## 3. Before you begin

You need:
- access to the Entra admin portal
- permission to create or manage app registrations
- the planned application URLs
- the list of roles the app needs

Current CWS dependency note:
- Entra admin access is managed outside DTO by the IT infrastructure / Microsoft 365 administration function
- if a DTO developer does not personally hold Entra admin rights, a request must be raised to that team before app registration work starts
- document the local request path used by your organisation in each application handover pack

## 4. Standard application design in Entra

Use one app registration per deployed application, regardless of the number of SPAs within that application, unless a reviewed exception is approved.

At minimum define:
- application name
- redirect URLs
- logout URL if used
- app roles
- API scope if frontend calls backend API with tokens

## 5. Beginner step-by-step: register a new application

### Step 1: open Entra

Go to the Microsoft Entra admin center.

### Step 2: open App registrations

Navigate to:
- `Applications`
- `App registrations`

### Step 3: create the new app

Click:
- `New registration`

Fill in:
- Name: use a clear internal name such as `Customer Feedback Platform`
- Supported account types: usually `Accounts in this organizational directory only`

Click `Register`.

### Step 4: record the IDs

After creation, record:
- Application (client) ID
- Directory (tenant) ID

You will need these in the app `.env` files.

## 6. Configure redirect URLs

### Why this matters

If redirect URLs are wrong or missing, users may fail to sign in correctly.

### Standard rule

Register the exact SPA base URLs used in the browser.

Examples:
- `https://appname-preprod.example.internal/app/`
- `https://appname.example.internal/app/`
- `https://appname.example.internal/dashboard/`

If you use multiple SPAs, add each real SPA URL.

### Beginner steps

1. Open the app registration
2. Open `Authentication`
3. Under `Single-page application`, add each redirect URL
4. Add post-logout URL if your frontend uses it
5. Save

## 7. Define app roles

### Why roles matter

Roles let the application know what a user is allowed to do.

### Standard role pattern

Every app should define clear roles.

Example pattern:
- `APP_SUPER_ADMIN`
- `APP_ADMIN`
- `APP_EDITOR`
- `APP_VIEWER`

If the app has separate functional programs, define program-scoped roles carefully.

### Beginner steps

1. Open the app registration
2. Open `App roles`
3. Click `Create app role`
4. Fill in:
   - Display name
   - Allowed member types
   - Value
   - Description
5. Save

Role value example:
- `APP_ADMIN`

## 8. Expose an API scope

If the frontend needs to call the backend with an access token, expose an API permission.

### Standard pattern

Use a scope like:
- `access_as_user`

Audience pattern often looks like:
- `api://<client-id>`

### Beginner steps

1. Open `Expose an API`
2. Set the application ID URI if not already set
3. Add a scope named `access_as_user`
4. Save

## 9. Assign users and groups

### Why this matters

Creating roles is not enough. Users or groups must also be assigned to the application.

### Recommended approach

Assign Entra groups where possible, not individual users one by one.

### Beginner steps

1. Open `Enterprise applications`
2. Find your application
3. Open `Users and groups`
4. Click `Add user/group`
5. Select the user or group
6. Select the role
7. Save

## 10. Backend environment variables

Typical backend auth variables:

```text
ENTRA_TENANT_ID=
ENTRA_CLIENT_ID=
ENTRA_AUTHORITY=https://login.microsoftonline.com/${ENTRA_TENANT_ID}
ENTRA_ISSUER=https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0
ENTRA_AUDIENCE=api://${ENTRA_CLIENT_ID}
ENTRA_JWKS_URL=
```

Important rule from CWSCX:
- blank optional values such as `ENTRA_JWKS_URL` must be treated safely by the app

## 11. Frontend environment variables

Typical frontend variables:

```text
VITE_ENTRA_TENANT_ID=
VITE_ENTRA_CLIENT_ID=
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/${VITE_ENTRA_TENANT_ID}
VITE_ENTRA_API_SCOPE=api://${VITE_ENTRA_CLIENT_ID}/access_as_user
```

## 12. Frontend implementation pattern

Standard frontend behavior:
- use MSAL redirect flow
- redirect URI should match deployed SPA base URL
- logout redirect should also be explicit
- keep token acquisition centralized
- bootstrap initial app access from token claims and local auth state, not from a mandatory `/auth/me` dependency

Important lessons from CWSCX:
- redirect paths must match the deployed app path
- wrong audience or wrong scope will produce backend `401` errors
- auth issues can look like application issues if token validation is misconfigured
- frontend startup should not be blocked on a backend profile bootstrap call when the token already contains the needed identity and role claims

## 13. Backend validation rules

The backend should validate:
- signature
- issuer
- audience
- expiration
- role claims

Production rule:
- do not rely on staging-only fallback validation behavior unless it is explicitly documented, time-limited, and approved

The backend should return:
- `401` for missing or invalid token
- `403` for valid token without required role

## 14. Standard role enforcement pattern

- backend endpoint declares required roles
- request token is validated
- user roles are extracted
- access is granted or denied

Do not rely on hiding buttons in the frontend as the real security control.

## 15. Session behavior

Recommended:
- use session-oriented token cache behavior for internal apps where practical
- use Entra Conditional Access sign-in frequency policies where required

See existing session policy lessons from CWSCX:
- re-authentication windows
- frontend handling of expired sessions

## 16. Troubleshooting

### Problem: sign-in succeeds but API calls return `401`

Likely causes:
- wrong audience
- wrong issuer
- wrong API scope
- backend auth config mismatch
- redirect/login flow tied to the wrong app registration

### Problem: backend error says token validation URL is invalid

Likely cause:
- optional auth URL env var is blank but treated as real

Required fix:
- treat blank optional values as unset and fall back safely

### Problem: user can sign in but sees no access

Likely causes:
- no role assignment
- wrong group assignment
- role not present in token

### Problem: login keeps looping or returning to wrong page

Likely causes:
- redirect URI mismatch
- post-logout redirect mismatch
- base path mismatch between app and Entra config

## 17. Beginner verification checklist

After setup, confirm:
- app registration exists
- redirect URLs are correct
- logout URL is correct
- app roles exist
- users/groups are assigned
- frontend env values are set
- backend env values are set
- login works
- protected API call works
- users without role are denied correctly

## 18. Recommended documentation to keep for each app

Record:
- app registration name
- client ID
- tenant ID
- defined app roles
- redirect URLs for each environment
- enterprise app name
- support owner

Use this format in the application's `EXIT.md`:

```md
## Entra Registration Record

- App registration name:
- Enterprise application name:
- Tenant ID:
- Client ID:
- Application ID URI:
- API scope(s):
- Redirect URLs:
- Post-logout URLs:
- App roles:
- Assigned groups:
- Request/approval reference:
- Support owner:
```
