import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { primeStaticAdvice } from "./data/segmentAdvice";
import { primeStaticDeep } from "./data/deepCache";
import "./styles.css";

// Load the answers that ship with the static build first, so every AI card can render from disk
// (with its 0.5 s loading bar) and no request ever leaves the page.
Promise.all([primeStaticAdvice(), primeStaticDeep()]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
