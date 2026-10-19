import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Theme before the first React render avoids a light-mode flash on startup.
const storedTheme = localStorage.getItem("studydeck-theme");
const startupTheme =
  storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
document.documentElement.dataset.theme = startupTheme;
document.documentElement.style.colorScheme = startupTheme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
