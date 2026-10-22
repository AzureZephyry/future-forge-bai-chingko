import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./workspace.css";

const root = createRoot(document.getElementById("root")!);
if (window.location.pathname === "/legacy") {
  void import("./legacy/LegacyAssessment").then(({ default: LegacyAssessment }) => {
    root.render(<StrictMode><LegacyAssessment /></StrictMode>);
  });
} else {
  root.render(<StrictMode><App /></StrictMode>);
}
