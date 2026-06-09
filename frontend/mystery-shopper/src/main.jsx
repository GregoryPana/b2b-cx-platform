import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { ensureMsalInitialized, msalInstance } from "./auth";
import { AUTH_MODE, isMysteryPublicAuthMode } from "./authMode";
import { MysteryAuthProvider } from "./mysteryAuth/MysteryAuthContext";
import "./index.css";

const root = createRoot(document.getElementById("root"));
const routerBase = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";

const renderApp = () => {
  const tree = isMysteryPublicAuthMode ? (
    <MysteryAuthProvider>
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    </MysteryAuthProvider>
  ) : (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    </MsalProvider>
  );

  root.render(
    <React.StrictMode>
      {tree}
    </React.StrictMode>
  );
};

if (AUTH_MODE === "mystery_public") {
  renderApp();
} else {
  ensureMsalInitialized()
    .then(renderApp)
    .catch((error) => {
      console.error("MSAL initialization failed", error);
      renderApp();
    });
}
