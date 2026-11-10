export type AppearanceMode = 'system' | 'light' | 'dark'
export type ThemeDesign = 'classic' | 'liquid' | 'soft' | 'contrast'
export type AccentColor = 'blue' | 'teal' | 'green' | 'purple' | 'coral' | 'amber'

export interface ThemePreferences {
  appearanceMode: AppearanceMode
  themeDesign: ThemeDesign
  accentColor: AccentColor
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  appearanceMode: 'system',
  themeDesign: 'liquid',
  accentColor: 'blue'
}
