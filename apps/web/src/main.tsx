import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
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
    {/* Light mode is fixed; there is no theme switcher (ui.md). */}
    <Theme
      appearance="light"
      accentColor="blue"
      grayColor="slate"
      radius="small"
      scaling="95%"
      panelBackground="solid"
    >
      <App />
    </Theme>
  </StrictMode>,
);
