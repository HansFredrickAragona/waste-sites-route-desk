import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import { cleanupLegacyPwa } from "./cleanupLegacyPwa.js";
import "./styles/global.css";

cleanupLegacyPwa();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
