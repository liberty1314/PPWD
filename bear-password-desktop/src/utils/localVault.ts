/** 判断 Electron 本地保险库桥接是否可用。桌面端数据层始终使用本地库。 */
export function isLocalVaultApiAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.offlineVaultApi
}
