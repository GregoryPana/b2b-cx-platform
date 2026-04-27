import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { ensureMsalInitialized, msalInstance } from "./auth";
import "./index.css";

const root = createRoot(document.getElementById("root"));
const routerBase = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter basename={routerBase}>
          <App />
        </BrowserRouter>
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
