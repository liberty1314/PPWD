import { create } from 'zustand'
import { storage } from '@/utils/storage'
import { migrateThemePreferences } from '@/utils/themePreferenceMigration'
import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from '../../../shared/ui/themeTypes'
import { desktopThemeAdapter } from '@/platform/desktopThemeAdapter'

const MIGRATION_VERSION = 1
let initialization: Promise<void> | null = null

interface ReactThemeState extends ThemePreferences {
  systemDark: boolean
  initialized: boolean
  initialize: () => Promise<void>
  setPreference: <K extends keyof ThemePreferences>(key: K, value: ThemePreferences[K]) => void
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
    persistTheme(preferences)
    applyTheme(preferences, systemDark)
    set({ ...preferences, systemDark, initialized: true })
    void desktopThemeAdapter.syncTrayAppearance(preferences)
    desktopThemeAdapter.subscribeSystemAppearance((dark) => {
      const current = get()
      applyTheme(current, dark)
      set({ systemDark: dark })
    })
    })().finally(() => { initialization = null })
    return initialization
  },
  setPreference: (key, value) => {
    const current = get()
    const next = { ...current, [key]: value }
    persistTheme(next)
    applyTheme(next, current.systemDark)
    set({ [key]: value } as Pick<ReactThemeState, typeof key>)
    void desktopThemeAdapter.syncTrayAppearance(next)
  }
}))
