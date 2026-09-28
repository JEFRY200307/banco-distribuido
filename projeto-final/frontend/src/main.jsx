import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { IdiomaProvider } from "./lib/idioma.jsx";
import "./estilo.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IdiomaProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </IdiomaProvider>
  </React.StrictMode>,
);
