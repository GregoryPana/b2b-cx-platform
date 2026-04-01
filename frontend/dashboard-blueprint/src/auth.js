import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || "97df7dc2-f178-4ce4-b55e-bcafc144485e";
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || "7e09a8c1-f113-4e3f-aeb7-21d1305cbd55";
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || `https://login.microsoftonline.com/${tenantId}`;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE || `api://${clientId}/access_as_user`;

export const loginRequest = {
  scopes: ["openid", "profile", "email", apiScope],
};

export const isMsalSupported =
  typeof window !== "undefined" &&
  window.isSecureContext &&
  typeof window.crypto !== "undefined" &&
  typeof window.crypto.subtle !== "undefined";

export const msalInstance = isMsalSupported
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
    })
  : null;

let msalInitPromise;

export const ensureMsalInitialized = async () => {
  if (!msalInstance) {
    throw new Error("MSAL is unavailable in this browser context. Use HTTPS or localhost.");
  }
  if (!msalInitPromise) {
    msalInitPromise = msalInstance.initialize();
  }
  await msalInitPromise;
};
