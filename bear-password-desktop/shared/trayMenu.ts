/** 托盘右键菜单可切换的语言值 */
export const TRAY_LOCALE_VALUES = ['system', 'zh-CN', 'en', 'ja'] as const

export type TrayLocaleValue = (typeof TRAY_LOCALE_VALUES)[number]

/** 托盘右键菜单可切换的字体值 */
export const TRAY_FONT_VALUES = ['canger', 'system'] as const

export type TrayFontValue = (typeof TRAY_FONT_VALUES)[number]

export interface TrayMenuLabels {
  open: string
  lock: string
  settings: string
  language: string
  font: string
  quit: string
  locales: Partial<Record<TrayLocaleValue, string>>
  fonts: Partial<Record<TrayFontValue, string>>
}

export interface TrayAppearanceSnapshot {
  locale: string
  font: string
  labels: TrayMenuLabels
}

export type TrayRendererCommand =
  | { action: 'open' }
  | { action: 'lock' }
  | { action: 'settings' }
  | { action: 'quick-search' }
  | { action: 'vault' }
  | { action: 'favorites' }
  | { action: 'recent' }
  | { action: 'set-locale'; value: TrayLocaleValue }
  | { action: 'set-font'; value: TrayFontValue }

/** 主进程菜单文案回退（未同步渲染进程标签时使用） */
export const DEFAULT_TRAY_MENU_LABELS: TrayMenuLabels = {
  open: '打开 PPWD',
  lock: '锁定 PPWD',
  settings: '设置 PPWD',
  language: '语言',
  font: '字体',
  quit: '退出',
  locales: {
    system: '跟随系统',
    'zh-CN': '中文',
    en: 'English',
    ja: '日本語'
  },
  fonts: {
    canger: '仓耳今楷',
    system: '跟随系统'
  }
}
