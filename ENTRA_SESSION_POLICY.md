# Entra Authentication Session Management for CX Platform

## Goal
Force users to re-authenticate after a defined period, while allowing the frontend to proactively handle token expiry.

## Entra Setup (Per-Application)

### Prerequisites
- Entra ID P1 or P2 license (for Conditional Access)
- App registration already created for CX Platform backend API

### Step 1: Baseline Tenant Settings (optional)
1. Go to **Protection** → **Authentication methods** → **Authentication session management**
2. Set default sign-in frequency (e.g., 8 hours) and disable persistent browser session if desired.
3. Save.

### Step 2: Conditional Access Policy for CX Platform
1. Navigate to **Protection** → **Conditional Access** → **+ New policy**
2. Name: `CX Platform – Enforce Sign-in Frequency`
3. **Assignments**
   - **Users and groups**: select the users or groups that will access the platform (e.g., all users, or specific security groups)
   - **Cloud apps or actions**: **Select apps** → choose your CX Platform app (by client ID or name)
   - **Conditions**: leave default unless you want additional filters (e.g., location, device)
4. **Access controls**
   - **Session** → **Sign-in frequency** → check **Require sign-in every** and set value (e.g., `1` hour)
   - Uncheck **Persistent browser session** if you want to prevent “Keep me signed in” from extending session
   - Optionally enable **Require re-authentication** if using MFA
5. **Enable policy**: **On**
6. **Create**

### Step 3: Disable “Keep me signed in” (if needed)
While not strictly required, ensure the **Persistent browser session** is unchecked in the CA policy; this disables the extended refresh token lifetime that applies when users check “Keep me signed in”.

### Step 4: Validate Policy
- Have a test user log in via the frontend.
- Wait for the configured sign-in frequency duration minus a few minutes.
- Attempt to access a protected API endpoint; the frontend should attempt silent refresh, fail with `InteractionRequiredAuthError`, and redirect to Entra login page.

## Frontend Complement

In addition to Entra policy, configure the frontend to avoid persisting tokens across browser sessions:

- In `frontend/*/src/auth.js`, set `cacheLocation: "sessionStorage"` instead of `"localStorage"`:

```js
export const msalInstance = new PublicClientApplication({
  auth: { clientId, authority, redirectUri: window.location.origin },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
});
```

This ensures that closing the browser tab/window clears the token cache and forces a fresh login next time.

## Notes

- The Entra CA policy **sign-in frequency** applies to interactive sessions. If the user remains active, MSAL will silently refresh tokens until the CA policy interval lapses, then the next request will trigger interactive login.
- If you don’t have P1/P2, you can only adjust the tenant-wide **Authentication session management** frequency, which applies to all apps.
- These settings do not require code changes to the backend; it’s all Entra configuration and frontend MSAL behavior.
- `acquireTokenSilent` will fail with `InteractionRequiredAuthError` exactly when the sign-in frequency window has elapsed and no valid refresh token session remains. The frontend must then direct the user to login.
