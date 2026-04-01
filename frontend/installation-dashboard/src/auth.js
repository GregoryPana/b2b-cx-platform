import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || "97df7dc2-f178-4ce4-b55e-bcafc144485e";
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || "7e09a8c1-f113-4e3f-aeb7-21d1305cbd55";
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || `https://login.microsoftonline.com/${tenantId}`;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE || `api://${clientId}/access_as_user`;
const basePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const redirectUri = new URL(basePath === "/" ? "/" : `${basePath}/`, window.location.origin).toString();

export const loginRequest = {
  scopes: ["openid", "profile", "email", apiScope],
};

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
});

let msalInitPromise;

export const ensureMsalInitialized = async () => {
  if (!msalInitPromise) {
    msalInitPromise = msalInstance.initialize();
  }
  await msalInitPromise;
};
