export type AppearanceMode = 'system'
export type ThemeDesign = 'liquid'
export type AccentColor = 'blue'

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
