/** 托盘右键菜单可切换的语言值 */
export declare const TRAY_LOCALE_VALUES: readonly ["system", "zh-CN", "en", "ja"];
export type TrayLocaleValue = (typeof TRAY_LOCALE_VALUES)[number];
/** 托盘右键菜单可切换的字体值 */
export declare const TRAY_FONT_VALUES: readonly ["canger", "system"];
export type TrayFontValue = (typeof TRAY_FONT_VALUES)[number];
export interface TrayMenuLabels {
    open: string;
    lock: string;
    settings: string;
    language: string;
    font: string;
    quit: string;
    locales: Partial<Record<TrayLocaleValue, string>>;
    fonts: Partial<Record<TrayFontValue, string>>;
}
export interface TrayAppearanceSnapshot {
    locale: string;
    font: string;
    labels: TrayMenuLabels;
}
export type TrayRendererCommand = {
    action: 'open';
} | {
    action: 'lock';
} | {
    action: 'settings';
} | {
    action: 'quick-search';
} | {
    action: 'vault';
} | {
    action: 'favorites';
} | {
    action: 'recent';
} | {
    action: 'set-locale';
    value: TrayLocaleValue;
} | {
    action: 'set-font';
    value: TrayFontValue;
};
/** 主进程菜单文案回退（未同步渲染进程标签时使用） */
export declare const DEFAULT_TRAY_MENU_LABELS: TrayMenuLabels;
