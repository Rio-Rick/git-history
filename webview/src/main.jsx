import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./app.jsx";
import { createProvider } from "./provider.js";

// What the extension tells the page (the file) comes in a data block
const { path } = JSON.parse(document.getElementById("gfh-data").textContent);

// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();
const provider = createProvider({ vscode, path });

createRoot(document.getElementById("root")).render(<App provider={provider} />);
