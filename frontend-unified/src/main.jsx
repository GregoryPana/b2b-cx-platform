import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from "@azure/msal-react";
import App from './App.jsx'
import { msalInstance } from './auth'
import '../../frontend/shared-ui.css'
import '../../frontend/glass-theme.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>,
)
