import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from './themeTypes.ts'

export interface ThemePreferenceMigrationInput {
  theme?: unknown
  appearanceMode?: unknown
  themeDesign?: unknown
  accentColor?: unknown
}

export function migrateThemePreferences(_input: ThemePreferenceMigrationInput): ThemePreferences {
  return { ...DEFAULT_THEME_PREFERENCES }
}
