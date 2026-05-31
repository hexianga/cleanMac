import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { diskCleanerTheme } from "./lib/diskCleanerTheme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={diskCleanerTheme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);
