import { syncTrayAppearanceToMain } from '@/utils/trayAppearanceSync'
import { normalizeLocalePreference, resolveLocale } from '@/utils/localePreference'
import { normalizeFontPreference } from '@/utils/font'
import { storage } from '@/utils/storage'
import type { TrayRendererCommand } from '../../shared/trayMenu'

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

  async syncTrayAppearance(): Promise<void> {
    if (!window.trayApi) return
    const locale = normalizeLocalePreference(storage.get<unknown>('locale', 'zh-CN'))
    await syncTrayAppearanceToMain({
      locale,
      font: normalizeFontPreference(storage.get<unknown>('font', 'system')),
      resolvedLocale: resolveLocale(locale)
    })
  }
}
