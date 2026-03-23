import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { msalInstance } from "./auth";
import "./styles/globals.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MsalProvider>
  </React.StrictMode>
);
