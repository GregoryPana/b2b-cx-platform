# Entra Authentication Session Management for CX Platform

## Goal
Trusted admin/staff devices (dashboard, B2B survey, installation survey) stay signed in indefinitely — no surprise interactive re-login from a stale email link, an idle tab, or a different tab on the same device. Frontend already persists the MSAL cache to `localStorage` and silently refreshes tokens in the background (see `frontend/*/src/auth.js|ts` and the refresh effects in each app's `App.jsx`/`App.tsx`). The remaining lever is Entra's session/sign-in-frequency policy, which can force interactive re-auth regardless of what the frontend does.

> Previous revision of this doc recommended the opposite (short sign-in frequency, `sessionStorage` cache, disabling persistent browser sessions). That guidance was for a stricter security posture and is **not** what we want for the low-risk, single-account admin devices this doc now targets. If a stricter policy is ever needed for a different user population, scope it to a separate Conditional Access policy/group — don't reapply it here.

## Entra Setup (Per-Application)

### Prerequisites
- Entra ID P1 or P2 license (for Conditional Access) if you want to scope this to a specific group/app instead of the whole tenant.
- App registration already created for the CX Platform backend API.

### Step 1: Baseline Tenant Settings
1. Go to **Protection** → **Authentication methods** → **Authentication session management**.
2. Leave **sign-in frequency** unset (defaults to the Microsoft default of ~90 days backed by refresh token rotation) and ensure **persistent browser session** is allowed (not forced off).
3. Save.

### Step 2 (Optional, only if you have P1/P2): Conditional Access Policy for admin devices
If you want this scoped to specific accounts rather than tenant-wide:
1. Navigate to **Protection** → **Conditional Access** → **+ New policy**.
2. Name: `CX Platform – Persistent Admin Sessions`.
3. **Assignments**
   - **Users and groups**: the specific admin accounts/group used on these dedicated devices.
   - **Cloud apps or actions**: the CX Platform app registration.
4. **Access controls** → **Session**:
   - Do **not** check **Require sign-in every** (leave sign-in frequency off for this group).
   - **Persistent browser session**: set to **Always persisted**.
5. **Enable policy**: **On**.
6. **Create**.

### Step 3: Validate
- Sign in on the admin device once.
- Close the browser tab/window entirely, reopen it days later (or open an old bookmarked/emailed link), and confirm the app loads without a login prompt.
- Open the dashboard in two tabs simultaneously and confirm neither tab triggers a duplicate interactive login.

## Frontend Complement

All three live Entra-auth apps (`dashboard-blueprint`, `survey`, `installation-survey`) are configured the same way in `src/auth.js`/`auth.ts`:

```js
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
});
```

- `cacheLocation: "localStorage"` — the MSAL token cache survives closing the tab/browser and is shared across tabs on the same device, instead of each tab having an isolated session that can independently trigger a login redirect.
- `navigateToLoginRequestUrl: true` — after any login (including a forced re-auth), MSAL returns the user to the page they originally requested (e.g. a deep link from an old email) instead of dropping them at the app root.
- Each app's `App.jsx`/`App.tsx` already calls `acquireTokenSilent` proactively before the access token expires and falls back to `acquireTokenRedirect` only on `InteractionRequiredAuthError` — so as long as the Entra-side refresh token / sign-in frequency window is open, users never see an interactive prompt.

## Notes

- With sign-in frequency unset and persistent browser sessions allowed, `acquireTokenSilent` should keep working indefinitely on a device that's used regularly — Entra rotates the underlying refresh token on each silent use.
- A user will still see an interactive login if: the account password is changed/reset, an admin revokes sessions, the device's browser profile/cache is wiped, or the account is genuinely inactive long enough for Entra's own absolute refresh-token lifetime to lapse. None of these are something this policy can avoid.
- If you ever need a stricter-security variant of this for a different group (e.g. external/contractor accounts), create a separate, narrowly-scoped Conditional Access policy rather than changing the settings above.
