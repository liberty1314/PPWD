import { dialog, ipcMain, type BrowserWindow } from 'electron'
import {
  getDefaultOfflineVaultDataDir,
  loadOfflineVaultSettings,
  saveOfflineVaultSettings
} from './offlineVaultConfig'
import {
  addOfflineVaultFavorite,
  createOfflineVaultEntry,
  deleteOfflineVaultEntry,
  getOfflineVaultFavoriteIds,
  getOfflineVaultFavorites,
  getOfflineVaultRecentVisits,
  importOfflineVaultSnapshot,
  listOfflineVaultEntries,
  readOfflineVaultSnapshot,
  recordOfflineVaultRecentVisit,
  removeOfflineVaultFavorite,
  updateOfflineVaultEntry,
  updateOfflineVaultEntryRaw
} from './offlineVaultStorage'
import type { OfflineVaultSnapshot } from '../../shared/offlineVault'
import type { VaultEntryId } from '../../shared/vaultEntryId'

function parseEntryId(id: unknown): VaultEntryId | null {
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  return null
}

function resolveDataDir(): string {
  return loadOfflineVaultSettings().dataDir
}

export function registerOfflineVaultIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('offline-vault:getDefaultDataDir', () => getDefaultOfflineVaultDataDir())

  ipcMain.handle('offline-vault:getSettings', () => loadOfflineVaultSettings())

  ipcMain.handle('offline-vault:setSettings', (_event, partial: unknown) => {
    if (!partial || typeof partial !== 'object') {
      return { ok: false as const, error: '配置格式无效' }
    }

    try {
      const settings = saveOfflineVaultSettings(partial as Partial<ReturnType<typeof loadOfflineVaultSettings>>)
      return { ok: true as const, settings }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存离线模式配置失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:pickDataDir', async (_event, currentDir: unknown) => {
    const parent = getMainWindow()
    const safeParent = parent && !parent.isDestroyed() ? parent : undefined
    const result = await dialog.showOpenDialog(safeParent, {
      title: '选择离线数据目录',
      defaultPath: typeof currentDir === 'string' && currentDir ? currentDir : getDefaultOfflineVaultDataDir(),
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('offline-vault:pickEmptyDataDir', async (_event, currentDir: unknown) => {
    const parent = getMainWindow()
    const safeParent = parent && !parent.isDestroyed() ? parent : undefined
    const result = await dialog.showOpenDialog(safeParent, {
      title: '选择新的本地保险库目录',
      defaultPath: typeof currentDir === 'string' && currentDir ? currentDir : getDefaultOfflineVaultDataDir(),
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || !result.filePaths.length) return { ok: false as const, canceled: true as const }

    try {
      const selectedDir = result.filePaths[0]
      const snapshot = readOfflineVaultSnapshot(selectedDir)
      if (snapshot.entries.length || snapshot.favorites.length || snapshot.recentVisits.length) {
        return { ok: false as const, canceled: false as const, error: '所选目录已有数据，请选择空目录' }
      }
      const settings = saveOfflineVaultSettings({ dataDir: selectedDir })
      return { ok: true as const, settings }
    } catch {
      return { ok: false as const, canceled: false as const, error: '所选目录无法安全读取，请选择空目录' }
    }
  })

  ipcMain.handle('offline-vault:readSnapshot', () => readOfflineVaultSnapshot(resolveDataDir()))

  ipcMain.handle('offline-vault:importSnapshot', (_event, snapshot: unknown) => {
    try {
      const saved = importOfflineVaultSnapshot(resolveDataDir(), snapshot as OfflineVaultSnapshot)
      return { ok: true as const, snapshot: saved }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入本地数据失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:listEntries', () => listOfflineVaultEntries(resolveDataDir()))

  ipcMain.handle('offline-vault:createEntry', (_event, entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return { ok: false as const, error: '条目格式无效' }
    }
    try {
      const created = createOfflineVaultEntry(resolveDataDir(), entry as Parameters<typeof createOfflineVaultEntry>[1])
      return { ok: true as const, entry: created }
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建本地条目失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:updateEntry', (_event, id: unknown, entry: unknown) => {
    const entryId = parseEntryId(id)
    if (!entryId || !entry || typeof entry !== 'object') {
      return { ok: false as const, error: '条目格式无效' }
    }
    try {
      const updated = updateOfflineVaultEntry(resolveDataDir(), entryId, entry as Parameters<typeof updateOfflineVaultEntry>[2])
      if (!updated) {
        return { ok: false as const, error: '条目不存在' }
      }
      return { ok: true as const, entry: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新本地条目失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:updateEntryRaw', (_event, id: unknown, entry: unknown) => {
    const entryId = parseEntryId(id)
    if (!entryId || !entry || typeof entry !== 'object') {
      return { ok: false as const, error: '条目格式无效' }
    }
    try {
      const updated = updateOfflineVaultEntryRaw(
        resolveDataDir(),
        entryId,
        entry as Parameters<typeof updateOfflineVaultEntryRaw>[2]
      )
      if (!updated) {
        return { ok: false as const, error: '条目不存在' }
      }
      return { ok: true as const, entry: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新本地条目失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:deleteEntry', (_event, id: unknown) => {
    const entryId = parseEntryId(id)
    if (!entryId) {
      return { ok: false as const, error: '条目 ID 无效' }
    }
    try {
      const deleted = deleteOfflineVaultEntry(resolveDataDir(), entryId)
      return { ok: true as const, deleted }
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除本地条目失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:getFavoritesMeta', () => getOfflineVaultFavorites(resolveDataDir()))

  ipcMain.handle('offline-vault:getFavoriteIds', () => getOfflineVaultFavoriteIds(resolveDataDir()))

  ipcMain.handle('offline-vault:addFavorite', (_event, passwordId: unknown) => {
    const id = parseEntryId(passwordId)
    if (!id) {
      return { ok: false as const, error: '密码 ID 无效' }
    }
    try {
      addOfflineVaultFavorite(resolveDataDir(), id)
      return { ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加收藏失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:removeFavorite', (_event, passwordId: unknown) => {
    const id = parseEntryId(passwordId)
    if (!id) {
      return { ok: false as const, error: '密码 ID 无效' }
    }
    try {
      removeOfflineVaultFavorite(resolveDataDir(), id)
      return { ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : '取消收藏失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('offline-vault:getRecentMeta', () => getOfflineVaultRecentVisits(resolveDataDir()))

  ipcMain.handle('offline-vault:recordRecent', (_event, passwordId: unknown) => {
    const id = parseEntryId(passwordId)
    if (!id) {
      return { ok: false as const, error: '密码 ID 无效' }
    }
    try {
      recordOfflineVaultRecentVisit(resolveDataDir(), id)
      return { ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : '记录最近访问失败'
      return { ok: false as const, error: message }
    }
  })
}
