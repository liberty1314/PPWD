import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, linkSync, mkdirSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { OFFLINE_VAULT_DATA_FILE } from '../../shared/offlineVault'
import { assertManagedDataRoot, getExternalDataFiles, hashLocalDataFile, hashLocalDataTree, validateDataFilePath } from './localDataResetCore'

const RESET_MARKER = '.ppwd-reset-pending.json'
const CONFIRMATION_WORD = 'PPWD'
const backupSelections = new Map<string, string>()

function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
}

function makeBackupDirectory(parent: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  let target = join(parent, 'PPWD-reset-backup-' + stamp)
  if (existsSync(target)) target += '-' + randomUUID().slice(0, 8)
  mkdirSync(target, { recursive: false, mode: 0o700 })
  return target
}

function writeResetMarker(markerPath: string, marker: unknown): void {
  const tempPath = markerPath + '.' + process.pid + '.' + randomUUID() + '.tmp'
  try {
    writeFileSync(tempPath, JSON.stringify(marker), { flag: 'wx', mode: 0o600 })
    linkSync(tempPath, markerPath)
  } catch (error) {
    try { unlinkSync(tempPath) } catch { /* temporary marker may not exist */ }
    throw error
  }
  unlinkSync(tempPath)
}

export { completePendingLocalDataReset } from './localDataResetCore'

export function registerLocalDataResetIpc(currentPath: string, legacyPath: string, quit: () => void): void {
  const appDataPath = app.getPath('appData')
  const canonicalAppDataPath = existsSync(appDataPath) ? realpathSync(appDataPath) : resolve(appDataPath)
  assertManagedDataRoot(currentPath, appDataPath, 'PPWD')
  assertManagedDataRoot(legacyPath, appDataPath, 'BearPassword')

  ipcMain.handle('local-data-reset:choose-backup-location', async () => {
    const result = await dialog.showOpenDialog({ title: '选择本机数据备份位置', properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const parent = realpathSync(resolve(result.filePaths[0]))
    if (isInside(canonicalAppDataPath, parent)) throw new Error('备份位置不能在应用数据目录中')
    const token = randomUUID()
    backupSelections.set(token, parent)
    return { token, path: parent }
  })

  ipcMain.handle('local-data-reset:reset', async (_event, token: unknown, confirmation: unknown) => {
    if (typeof token !== 'string' || typeof confirmation !== 'string' || confirmation.trim() !== CONFIRMATION_WORD) {
      return { ok: false as const, reason: 'confirmation' as const }
    }
    const parent = backupSelections.get(token)
    backupSelections.delete(token)
    if (!parent) return { ok: false as const, reason: 'location' as const }

    const confirm = await dialog.showMessageBox({
      type: 'warning', title: '确认重置 PPWD 本机数据',
      message: '即将清除 PPWD 与旧版 BearPassword 的本机应用数据，并删除已配置的离线保险库文件。',
      detail: '数据会先复制到所选位置并校验。确认词仅用于防止误触，不会验证账户身份；备份可能含未加密密码数据，请妥善保管。',
      buttons: ['取消', '备份并重置'], defaultId: 0, cancelId: 0, noLink: true
    })
    if (confirm.response !== 1) return { ok: false as const, reason: 'canceled' as const }

    const markerPath = join(appDataPath, RESET_MARKER)
    if (existsSync(markerPath)) throw new Error('已有重置任务等待完成，请重新启动 PPWD')
    const backupPath = makeBackupDirectory(parent)
    try {
      const appData = {
        PPWD: existsSync(currentPath) ? hashLocalDataTree(currentPath) : null,
        BearPassword: existsSync(legacyPath) ? hashLocalDataTree(legacyPath) : null
      }
      if (appData.PPWD) {
        cpSync(currentPath, join(backupPath, 'PPWD'), { recursive: true, verbatimSymlinks: true, errorOnExist: true })
        if (hashLocalDataTree(join(backupPath, 'PPWD')) !== appData.PPWD) throw new Error('PPWD 应用数据备份校验失败')
      }
      if (appData.BearPassword) {
        cpSync(legacyPath, join(backupPath, 'BearPassword'), { recursive: true, verbatimSymlinks: true, errorOnExist: true })
        if (hashLocalDataTree(join(backupPath, 'BearPassword')) !== appData.BearPassword) throw new Error('BearPassword 应用数据备份校验失败')
      }

      const externalPaths = getExternalDataFiles([currentPath, legacyPath], currentPath, legacyPath)
      const externalDataFiles = externalPaths.map(path => ({
        path: validateDataFilePath(path),
        sha256: hashLocalDataFile(path)
      }))
      if (externalDataFiles.length) {
        const externalBackup = join(backupPath, 'external-vault')
        mkdirSync(externalBackup, { recursive: false, mode: 0o700 })
        externalDataFiles.forEach((entry, index) => {
          const target = join(externalBackup, String(index + 1))
          mkdirSync(target, { recursive: false, mode: 0o700 })
          cpSync(entry.path, join(target, OFFLINE_VAULT_DATA_FILE), { errorOnExist: true })
          if (hashLocalDataFile(join(target, OFFLINE_VAULT_DATA_FILE)) !== entry.sha256) throw new Error('外置保险库备份校验失败')
        })
        writeFileSync(join(externalBackup, 'manifest.json'), JSON.stringify(externalDataFiles), { flag: 'wx', mode: 0o600 })
      }

      const marker = { version: 1, backupPath, appData, externalDataFiles }
      writeResetMarker(markerPath, marker)
    } catch (error) {
      rmSync(backupPath, { recursive: true, force: true })
      throw error instanceof Error ? error : new Error('备份失败，原数据未修改')
    }
    setTimeout(quit, 150)
    return { ok: true as const, backupPath }
  })
}
