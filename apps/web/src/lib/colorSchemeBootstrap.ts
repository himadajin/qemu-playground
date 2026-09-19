import {
  COLOR_SCHEME_MEDIA_QUERY,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  THEME_CHOICES,
} from "./colorSchemeConfig";

const VALID_COLOR_SCHEMES = THEME_CHOICES.map(({ value }) => JSON.stringify(value)).join(", ");

/**
 * Generates the synchronous color-scheme initializer injected into index.html.
 * It must stay independent of the application bundle to run before first paint.
 */
export function getColorSchemeBootstrapScript() {
  const storageKey = JSON.stringify(COLOR_SCHEME_STORAGE_KEY);
  const mediaQuery = JSON.stringify(COLOR_SCHEME_MEDIA_QUERY);
  const defaultColorScheme = JSON.stringify(DEFAULT_COLOR_SCHEME);

  return `(() => {
  let colorScheme = ${defaultColorScheme};

  try {
    const storedColorScheme = window.localStorage.getItem(${storageKey});
    if ([${VALID_COLOR_SCHEMES}].includes(storedColorScheme)) {
      colorScheme = storedColorScheme;
    }
  } catch {
    // Keep the default choice and still evaluate the system preference below.
  }

  let prefersDark = false;
  if (colorScheme === "auto") {
    try {
      prefersDark = window.matchMedia(${mediaQuery}).matches;
    } catch {
      // Light is the safe fallback when the media query is unavailable.
    }
  }

  const computedColorScheme =
    colorScheme === "dark" || (colorScheme === "auto" && prefersDark) ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computedColorScheme);
})();`;
}
