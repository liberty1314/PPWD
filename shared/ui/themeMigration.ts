import type { AccentColor, AppearanceMode, ThemeDesign, ThemePreferences } from './themeTypes.ts'

export interface ThemePreferenceMigrationInput {
  theme?: unknown
  appearanceMode?: unknown
  themeDesign?: unknown
  accentColor?: unknown
}

const VALID_APPEARANCE_MODES = new Set<AppearanceMode>(['system', 'light', 'dark'])
const VALID_THEME_DESIGNS = new Set<ThemeDesign>(['classic', 'liquid', 'soft', 'contrast'])
const VALID_ACCENT_COLORS = new Set<AccentColor>(['blue', 'teal', 'green', 'purple', 'coral', 'amber'])
const DARK_THEMES = new Set(['dark', 'midnight', 'noir'])
const LEGACY_THEME_IDS = new Set([
  'system', 'light', 'ocean', 'warm', 'bloom', 'rose', 'mint', 'lagoon', 'forest', 'violet', 'earth',
  'dark', 'midnight', 'noir'
])

const LEGACY_ACCENTS: Record<string, AccentColor> = {
  ocean: 'teal', lagoon: 'teal', midnight: 'teal',
  warm: 'amber', earth: 'amber', noir: 'amber',
  bloom: 'coral', rose: 'coral', mint: 'green', forest: 'green', violet: 'purple'
}

function isMember<T extends string>(values: Set<T>, value: unknown): value is T {
  return typeof value === 'string' && values.has(value as T)
}

export function migrateThemePreferences(input: ThemePreferenceMigrationInput): ThemePreferences {
  const legacyTheme = typeof input.theme === 'string' ? input.theme : ''
  const migratedMode: AppearanceMode = legacyTheme === 'system'
    ? 'system'
    : legacyTheme === 'light'
      ? 'light'
      : DARK_THEMES.has(legacyTheme)
        ? 'dark'
        : LEGACY_THEME_IDS.has(legacyTheme)
          ? 'light'
          : 'system'

  return {
    appearanceMode: isMember(VALID_APPEARANCE_MODES, input.appearanceMode)
      ? input.appearanceMode
      : migratedMode,
    themeDesign: isMember(VALID_THEME_DESIGNS, input.themeDesign) ? input.themeDesign : 'classic',
    accentColor: isMember(VALID_ACCENT_COLORS, input.accentColor)
      ? input.accentColor
      : LEGACY_ACCENTS[legacyTheme] ?? 'blue'
  }
}
