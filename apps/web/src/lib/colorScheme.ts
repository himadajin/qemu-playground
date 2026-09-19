import { localStorageColorSchemeManager, type MantineColorSchemeManager } from "@mantine/core";
import { COLOR_SCHEME_STORAGE_KEY } from "./colorSchemeConfig";

export const colorSchemeManager: MantineColorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_STORAGE_KEY,
});
