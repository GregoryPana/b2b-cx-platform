import React from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { ensureMsalInitialized, msalInstance } from "./auth";
import "../../shared-ui.css";
import "./index.css";
import "../../glass-theme.css";

const root = createRoot(document.getElementById("root"));

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
};

ensureMsalInitialized()
  .then(renderApp)
  .catch((error) => {
    console.error("MSAL initialization failed", error);
    renderApp();
  });
