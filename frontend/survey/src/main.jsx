import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

// Force cache busting V2
console.log("🔥🔥 MAIN.JX V2 LOADED - FORCE CACHE CLEAR");
console.log(`🚀 Random V2: ${Math.random()}`);

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
