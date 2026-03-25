import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { ensureMsalInitialized, msalInstance } from "./auth";
import "./styles/globals.css";

const root = createRoot(document.getElementById("root") as HTMLElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
};

ensureMsalInitialized()
  .then(renderApp)
  .catch(() => {
    renderApp();
  });
