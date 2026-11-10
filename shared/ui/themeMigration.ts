import {
  DEFAULT_THEME_PREFERENCES,
  type AccentColor,
  type AppearanceMode,
  type ThemeDesign,
  type ThemePreferences
} from './themeTypes.ts'

export interface ThemePreferenceMigrationInput {
  theme?: unknown
  appearanceMode?: unknown
  themeDesign?: unknown
  accentColor?: unknown
}

const appearanceModes = new Set<AppearanceMode>(['system', 'light', 'dark'])
const themeDesigns = new Set<ThemeDesign>(['classic', 'liquid', 'soft', 'contrast'])
const accentColors = new Set<AccentColor>(['blue', 'teal', 'green', 'purple', 'coral', 'amber'])

export function migrateThemePreferences(input: ThemePreferenceMigrationInput): ThemePreferences {
  const legacyAppearance = input.theme === 'dark' || input.theme === 'midnight' || input.theme === 'noir'
    ? 'dark'
    : input.theme === 'light'
      ? 'light'
      : 'system'

  return {
    appearanceMode: appearanceModes.has(input.appearanceMode as AppearanceMode)
      ? input.appearanceMode as AppearanceMode
      : legacyAppearance,
    themeDesign: themeDesigns.has(input.themeDesign as ThemeDesign)
      ? input.themeDesign as ThemeDesign
      : DEFAULT_THEME_PREFERENCES.themeDesign,
    accentColor: accentColors.has(input.accentColor as AccentColor)
      ? input.accentColor as AccentColor
      : DEFAULT_THEME_PREFERENCES.accentColor
  }
}
