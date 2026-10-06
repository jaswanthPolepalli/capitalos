import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";
import "./mobile.css";
import "./operations.css";

// ── Mock mode: intercept all /server/capitalos-api/* calls locally ────────────
// Enabled by running: VITE_USE_MOCK=true npm run client:dev
// In production builds __USE_MOCK__ is always false and this code is tree-shaken out.
declare const __USE_MOCK__: boolean;
if (__USE_MOCK__) {
  const { installMockFetch } = await import("./mocks/mockFetch");
  await installMockFetch();
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("CapitalOS root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
