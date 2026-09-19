import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/noto-sans-jp";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { theme } from "./theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Root element is missing");
}

createRoot(container).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
);
