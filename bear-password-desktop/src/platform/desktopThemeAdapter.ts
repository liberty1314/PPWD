import type { AccentColor } from '../../../shared/ui/themeTypes'
import { syncTrayAppearanceToMain } from '@/utils/trayAppearanceSync'
import { normalizeLocalePreference, resolveLocale } from '@/utils/localePreference'
import { normalizeFontPreference } from '@/utils/font'
import { storage } from '@/utils/storage'
import type { ThemePreference } from '@/utils/theme'
import type { TrayRendererCommand } from '../../shared/trayMenu'

const LEGACY_THEME_BY_ACCENT: Record<AccentColor, { light: ThemePreference; dark: ThemePreference }> = {
  blue: { light: 'light', dark: 'dark' },
  teal: { light: 'ocean', dark: 'midnight' },
  green: { light: 'mint', dark: 'forest' },
  purple: { light: 'violet', dark: 'noir' },
  coral: { light: 'rose', dark: 'noir' },
  amber: { light: 'earth', dark: 'noir' }
}

export const desktopThemeAdapter = {
  async isSystemDark(): Promise<boolean> {
    if (window.themeApi) return window.themeApi.getShouldUseDarkColors()
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  },

  async probeSystemAppearance(): Promise<boolean | null> {
    if (!window.themeApi) return null
    try {
      return await window.themeApi.getShouldUseDarkColors()
    } catch {
      return null
    }
  },

  async getPlatform(): Promise<NodeJS.Platform | 'unknown'> {
    return window.windowApi?.getPlatform() ?? 'unknown'
  },

  minimize(): void { window.windowApi?.minimize() },
  maximize(): void { window.windowApi?.maximize() },
  close(): void { window.windowApi?.close() },
  hide(): void { window.windowApi?.hide() },

  subscribeTrayCommand(listener: (command: TrayRendererCommand) => void): () => void {
    return window.trayApi?.onCommand((command) => listener(command as TrayRendererCommand)) ?? (() => undefined)
  },

  subscribeLockShortcut(listener: () => void): () => void {
    return window.shortcutApi?.onLock(listener) ?? (() => undefined)
  },

  subscribeSystemAppearance(listener: (dark: boolean) => void): () => void {
    const removeThemeListener = window.themeApi?.onUpdated(listener)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMediaChange = (): void => listener(media.matches)
    media.addEventListener('change', onMediaChange)
    return () => {
      removeThemeListener?.()
      media.removeEventListener('change', onMediaChange)
    }
  },

  async syncTrayAppearance(input: {
    appearanceMode: 'system' | 'light' | 'dark'
    accentColor: AccentColor
  }): Promise<void> {
    if (!window.trayApi) return
    const theme: ThemePreference = input.appearanceMode === 'system'
      ? 'system'
      : LEGACY_THEME_BY_ACCENT[input.accentColor][input.appearanceMode]
    const locale = normalizeLocalePreference(storage.get<unknown>('locale', 'zh-CN'))
    await syncTrayAppearanceToMain({
      theme,
      locale,
      font: normalizeFontPreference(storage.get<unknown>('font', 'system')),
      resolvedLocale: resolveLocale(locale)
    })
  }
}
