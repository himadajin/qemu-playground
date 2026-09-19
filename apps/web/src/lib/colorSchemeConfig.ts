export const COLOR_SCHEME_STORAGE_KEY = "qemu-playground:color-scheme:v1";
export const COLOR_SCHEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const DEFAULT_COLOR_SCHEME = "auto" as const;

export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_CHOICES = [
  { value: "auto", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

export function isThemeChoice(value: string): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice.value === value);
}

export function themeChoiceLabel(value: ThemeChoice) {
  return THEME_CHOICES.find((choice) => choice.value === value)?.label ?? "System";
}
