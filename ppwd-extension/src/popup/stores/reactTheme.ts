import { create } from 'zustand'
import { migrateThemePreferences } from '../../../../shared/ui/themeMigration'
import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from '../../../../shared/ui/themeTypes'

interface PopupThemeState extends ThemePreferences {
  systemDark: boolean
  initialized: boolean
  initialize: () => Promise<void>
  syncFromDesktop: (themePreference: string | null, preferences?: ThemePreferences) => void
}

const STORAGE_KEYS = {
  appearanceMode: 'bear_extension_appearance_mode',
  accentColor: 'bear_extension_accent_color'
} as const
let initialization: Promise<void> | null = null

function applyTheme(preferences: ThemePreferences, systemDark: boolean): void {
  const root = document.documentElement
  root.dataset.appearance = preferences.appearanceMode === 'system'
    ? systemDark ? 'dark' : 'light'
    : preferences.appearanceMode
  root.dataset.themeDesign = 'liquid'
  root.dataset.accent = preferences.accentColor
}

export const usePopupThemeStore = create<PopupThemeState>((set, get) => ({
  ...DEFAULT_THEME_PREFERENCES,
  systemDark: false,
  initialized: false,
  initialize: () => {
    if (get().initialized) return Promise.resolve()
    if (initialization) return initialization
    initialization = (async () => {
    const keys = [...Object.values(STORAGE_KEYS), 'bear_extension_theme', 'bear_extension_theme_design']
    const stored = await chrome.storage.local.get(keys)
    const preferences = migrateThemePreferences({
      theme: stored['bear_extension_theme'],
      appearanceMode: stored[STORAGE_KEYS.appearanceMode],
      themeDesign: stored['bear_extension_theme_design'],
      accentColor: stored[STORAGE_KEYS.accentColor]
    })
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    await chrome.storage.local.set({
      [STORAGE_KEYS.appearanceMode]: preferences.appearanceMode,
      [STORAGE_KEYS.accentColor]: preferences.accentColor
    })
    await chrome.storage.local.remove(['bear_extension_theme', 'bear_extension_theme_design'])
    applyTheme(preferences, systemDark)
    set({ ...preferences, systemDark, initialized: true })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      const current = get()
      applyTheme(current, event.matches)
      set({ systemDark: event.matches })
    })
    })().finally(() => { initialization = null })
    return initialization
  },
  syncFromDesktop: (theme, desktopPreferences) => {
    const preferences = migrateThemePreferences({
      theme,
      appearanceMode: desktopPreferences?.appearanceMode,
      accentColor: desktopPreferences?.accentColor
    })
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(preferences, systemDark)
    set({ ...preferences, systemDark, initialized: true })
    void chrome.storage.local.set({
      [STORAGE_KEYS.appearanceMode]: preferences.appearanceMode,
      [STORAGE_KEYS.accentColor]: preferences.accentColor
    })
    void chrome.storage.local.remove(['bear_extension_theme', 'bear_extension_theme_design'])
  },
}))
