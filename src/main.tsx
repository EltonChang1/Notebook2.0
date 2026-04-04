import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./i18n";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        if ("sync" in registration) {
          try {
            await (registration as ServiceWorkerRegistration & {
              sync: { register: (tag: string) => Promise<void> };
            }).sync.register("notebook-background-sync");
          } catch {
            // Background sync may fail when unsupported by browser policy.
          }
        }
      })
      .catch(() => {
        // Ignore registration errors; app still runs without SW.
      });
  });
}
