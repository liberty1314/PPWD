/** 托盘右键菜单可切换的语言值 */
export var TRAY_LOCALE_VALUES = ['system', 'zh-CN', 'en', 'ja'];
/** 托盘右键菜单可切换的字体值 */
export var TRAY_FONT_VALUES = ['canger', 'system'];
/** 主进程菜单文案回退（未同步渲染进程标签时使用） */
export var DEFAULT_TRAY_MENU_LABELS = {
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
};
