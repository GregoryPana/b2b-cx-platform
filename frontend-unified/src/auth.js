import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || "97df7dc2-f178-4ce4-b55e-bcafc144485e";
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || "7e09a8c1-f113-4e3f-aeb7-21d1305cbd55";
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || `https://login.microsoftonline.com/${tenantId}`;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE || `api://${clientId}/access_as_user`;

export const loginRequest = {
  scopes: ["openid", "profile", "email", apiScope],
  prompt: "select_account", // Force account selection to prevent loops
};

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri: "http://localhost:3000",
    postLogoutRedirectUri: "http://localhost:3000",
    navigateToLoginRequestUrl: false, // Prevent automatic navigation
  },
  cache: {
    cacheLocation: "sessionStorage", // Use sessionStorage for better control
    storeAuthStateInCookie: true, // Enable cookie fallback
  },
  system: {
    allowNativeBroker: false, // Disable BSSO to avoid browser compatibility issues
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        console.log(`MSAL [${level}]: ${message}`);
      },
    },
    tokenRenewalOffsetSeconds: 300, // 5 minutes buffer
    windowHashTimeout: 60000, // 1 minute timeout
    iframeHashTimeout: 6000, // 6 second timeout
  },
});

// Initialize MSAL with error handling
const initializeMsal = async () => {
  try {
    await msalInstance.initialize();
    console.log("✅ MSAL initialized successfully");
    
    // Note: handleRedirectPromise() is handled automatically by MsalProvider
    // Do not call it manually here to avoid conflicts
  } catch (error) {
    console.error("❌ MSAL initialization error:", error);
    // Clear cache on initialization error
    sessionStorage.clear();
    localStorage.clear();
  }
};

// Auto-initialize
initializeMsal();

// Export utilities
export const isAuthenticated = () => {
  return msalInstance.getAllAccounts().length > 0;
};

export const getCurrentAccount = () => {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
};

export const getAccessToken = async () => {
  const account = getCurrentAccount();
  if (!account) {
    throw new Error("No account found");
  }
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return response.accessToken;
  } catch (error) {
    console.error("Token acquisition error:", error);
    throw error;
  }
};

export const login = async () => {
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await msalInstance.logoutRedirect();
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};