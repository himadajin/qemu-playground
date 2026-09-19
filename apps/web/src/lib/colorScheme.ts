import { localStorageColorSchemeManager, type MantineColorSchemeManager } from "@mantine/core";
import { COLOR_SCHEME_STORAGE_KEY } from "./colorSchemeConfig";

export {
  COLOR_SCHEME_MEDIA_QUERY,
  DEFAULT_COLOR_SCHEME,
  THEME_CHOICES,
  isThemeChoice,
  themeChoiceLabel,
  type ThemeChoice,
} from "./colorSchemeConfig";
export { COLOR_SCHEME_STORAGE_KEY } from "./colorSchemeConfig";

export const colorSchemeManager: MantineColorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_STORAGE_KEY,
});
