import { create } from 'zustand'
import { t as translate } from '@/locales'
import { resolveAppearanceFromDesktop } from '@/shared/appearance/desktopAppearance'
import type { DesktopConnectionState } from '@/shared/types'
import { applyResolvedLocale, resolveLocale, subscribeSystemLocaleChange } from '@/shared/locale/locale'
import type { LocalePreference, ResolvedLocale } from '@/locales/types'

interface PopupLocaleState {
  preference: LocalePreference
  resolvedLocale: ResolvedLocale
  initialize: () => void
  syncFromDesktop: (state: DesktopConnectionState | null) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

let unsubscribeSystem: (() => void) | null = null

export const usePopupLocaleStore = create<PopupLocaleState>((set, get) => ({
  preference: 'system',
  resolvedLocale: resolveLocale('system'),
  initialize: () => {
    const resolvedLocale = resolveLocale(get().preference)
    applyResolvedLocale(resolvedLocale)
    set({ resolvedLocale })
    unsubscribeSystem?.()
    unsubscribeSystem = subscribeSystemLocaleChange(() => {
      if (get().preference !== 'system') return
      const nextLocale = resolveLocale('system')
      applyResolvedLocale(nextLocale)
      set({ resolvedLocale: nextLocale })
    })
  },
  syncFromDesktop: (state) => {
    const preference = resolveAppearanceFromDesktop(state).locale
    const resolvedLocale = resolveLocale(preference)
    applyResolvedLocale(resolvedLocale)
    set({ preference, resolvedLocale })
  },
  t: (key, params) => translate(key, get().resolvedLocale, params)
}))
