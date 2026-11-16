import React from "react";
import ReactDOM from "react-dom/client";
import { Account } from "./cloud/Account";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Account />
  </React.StrictMode>,
);
