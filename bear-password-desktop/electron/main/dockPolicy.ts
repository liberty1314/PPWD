export interface DockVisibilitySettings {
  hidden: boolean
}

export function canHideDockIcon(trayReady: boolean): boolean {
  return trayReady
}

export function resolveDockSettingsAtStartup(
  settings: DockVisibilitySettings,
  trayReady: boolean
): DockVisibilitySettings {
  return settings.hidden && !trayReady ? { hidden: false } : settings
}
