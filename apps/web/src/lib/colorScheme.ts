import {
  localStorageColorSchemeManager,
  type MantineColorScheme,
  type MantineColorSchemeManager,
} from "@mantine/core";

export const COLOR_SCHEME_STORAGE_KEY = "qemu-playground:color-scheme:v1";

export type ThemeChoice = MantineColorScheme;

export const colorSchemeManager: MantineColorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_STORAGE_KEY,
});

export const THEME_CHOICES = [
  { value: "auto", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

export function isThemeChoice(value: string): value is ThemeChoice {
  return value === "auto" || value === "light" || value === "dark";
}

export function themeChoiceLabel(value: ThemeChoice) {
  return THEME_CHOICES.find((choice) => choice.value === value)?.label ?? "System";
}
