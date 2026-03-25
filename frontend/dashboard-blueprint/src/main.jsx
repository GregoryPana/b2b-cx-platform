import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { isMsalSupported, msalInstance } from "./auth";
import "./styles/globals.css";

const devAuthBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";
const routerBase = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";

function InsecureContextNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Secure context required for authentication</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This dashboard uses MSAL and browser crypto APIs, which are available only on `https://` origins or `localhost`.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          For testing from another device, run the dev server over HTTPS and use your machine IP.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {devAuthBypass ? (
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    ) : isMsalSupported && msalInstance ? (
      <MsalProvider instance={msalInstance}>
        <BrowserRouter basename={routerBase}>
          <App />
        </BrowserRouter>
      </MsalProvider>
    ) : (
      <InsecureContextNotice />
    )}
  </React.StrictMode>
);
