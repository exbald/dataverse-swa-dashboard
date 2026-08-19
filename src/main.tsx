import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installPreviewMock } from "./lib/previewMock";
import "./styles/tokens.css";
import "./styles/app.css";

installPreviewMock();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
