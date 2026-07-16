import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AgendaApp } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AgendaApp />
  </StrictMode>,
);
