import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Нет #root в index.html");

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// В собранной странице разметка App уже пререндерена (scripts/build.mjs) — гидрируем её;
// в dev-сервере в #root только комментарий-метка — рендерим с нуля.
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
