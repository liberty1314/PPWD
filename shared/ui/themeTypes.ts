export type AppearanceMode = 'system' | 'light' | 'dark'
export type AccentColor = 'blue' | 'teal' | 'green' | 'purple' | 'coral' | 'amber'

export interface ThemePreferences {
  appearanceMode: AppearanceMode
  accentColor: AccentColor
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  appearanceMode: 'system',
  accentColor: 'blue'
}
