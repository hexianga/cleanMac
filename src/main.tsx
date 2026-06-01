import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globalScroll.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { cleanMacTheme } from "./lib/cleanMacTheme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={cleanMacTheme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);
