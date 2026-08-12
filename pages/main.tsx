import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RobloxIDE from "../app/RobloxIDE";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RobloxIDE />
  </StrictMode>,
);
