import { create } from 'zustand'
import { storage } from '@/utils/storage'
import { migrateThemePreferences } from '@/utils/themePreferenceMigration'
import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from '../../../shared/ui/themeTypes'
import { desktopThemeAdapter } from '@/platform/desktopThemeAdapter'

const MIGRATION_VERSION = 2
let initialization: Promise<void> | null = null

interface ReactThemeState extends ThemePreferences {
  systemDark: boolean
  initialized: boolean
  initialize: () => Promise<void>
}

function applyTheme(preferences: ThemePreferences, systemDark: boolean): void {
  const root = document.documentElement
  root.dataset.appearance = preferences.appearanceMode === 'system'
    ? systemDark ? 'dark' : 'light'
    : preferences.appearanceMode
  root.dataset.themeDesign = preferences.themeDesign
  root.dataset.accent = preferences.accentColor
}

function persistTheme(preferences: ThemePreferences): void {
  storage.set('appearanceMode', preferences.appearanceMode)
  storage.set('themeDesign', preferences.themeDesign)
  storage.set('accentColor', preferences.accentColor)
  storage.set('theme_migration_version', MIGRATION_VERSION)
}

export const useReactThemeStore = create<ReactThemeState>((set, get) => ({
  ...DEFAULT_THEME_PREFERENCES,
  systemDark: false,
  initialized: false,
  initialize: () => {
    if (get().initialized) return Promise.resolve()
    if (initialization) return initialization
    initialization = (async () => {
    const preferences = migrateThemePreferences({
      theme: storage.get<unknown>('theme'),
      appearanceMode: storage.get<unknown>('appearanceMode'),
      themeDesign: storage.get<unknown>('themeDesign'),
      accentColor: storage.get<unknown>('accentColor')
    })
    const systemDark = await desktopThemeAdapter.isSystemDark().catch(() => false)
    storage.remove('theme')
    persistTheme(preferences)
    applyTheme(preferences, systemDark)
    set({ ...preferences, systemDark, initialized: true })
    void desktopThemeAdapter.syncTrayAppearance()
    desktopThemeAdapter.subscribeSystemAppearance((dark) => {
      const current = get()
      applyTheme(current, dark)
      set({ systemDark: dark })
    })
    })().finally(() => { initialization = null })
    return initialization
  },
}))
