import { ActionIcon, Menu, Tooltip, useMantineColorScheme } from "@mantine/core";
import { IconSunMoon } from "@tabler/icons-react";
import { isThemeChoice, THEME_CHOICES, themeChoiceLabel } from "../lib/colorSchemeConfig";

export function ThemeMenu() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const label = themeChoiceLabel(colorScheme);

  return (
    <Menu position="bottom-end" shadow="sm" width={160}>
      <Menu.Target>
        <Tooltip label="Theme" events={{ hover: true, focus: true, touch: false }} openDelay={400}>
          <ActionIcon size="input-xs" variant="default" aria-label={`Theme: ${label}`}>
            <IconSunMoon size={17} stroke={1.75} aria-hidden="true" />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Theme</Menu.Label>
        <Menu.RadioGroup
          value={colorScheme}
          onChange={(value) => {
            if (isThemeChoice(value)) setColorScheme(value);
          }}
        >
          {THEME_CHOICES.map((choice) => (
            <Menu.RadioItem key={choice.value} value={choice.value} closeMenuOnClick>
              {choice.label}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Dropdown>
    </Menu>
  );
}
