import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import { registerServiceWorker } from "./pwa/registerServiceWorker.js";
import "./styles/global.css";

registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
