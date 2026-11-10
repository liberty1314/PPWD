import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, unlinkSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { OFFLINE_VAULT_DATA_FILE, OFFLINE_VAULT_SETTINGS_FILE } from '../../shared/offlineVault.ts'

const BACKUP_PREFIX = 'PPWD-reset-backup-'

interface ResetMarker {
  version: 1
  backupPath: string
  appData: { PPWD: string | null; BearPassword: string | null }
  externalDataFiles: Array<{ path: string; sha256: string }>
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
}

function statPath(path: string): ReturnType<typeof lstatSync> | null {
  try { return lstatSync(path) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export function assertManagedDataRoot(path: string, appDataPath: string, expectedName: 'PPWD' | 'BearPassword'): void {
  if (basename(resolve(path)) !== expectedName || resolve(dirname(path)) !== resolve(appDataPath)) {
    throw new Error('应用数据目录校验失败，未执行重置')
  }
  const stat = statPath(path)
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
    throw new Error('应用数据目录类型无效，未执行重置')
  }
}

function canonicalRoot(path: string): string {
  return existsSync(path) ? realpathSync(path) : resolve(path)
}

export function validateDataFilePath(path: string): string {
  if (!isAbsolute(path) || basename(path) !== OFFLINE_VAULT_DATA_FILE) {
    throw new Error('离线保险库路径无效，未执行重置')
  }
  const parent = dirname(resolve(path))
  const canonicalPath = join(existsSync(parent) ? realpathSync(parent) : parent, OFFLINE_VAULT_DATA_FILE)
  if (existsSync(canonicalPath)) {
    const stat = lstatSync(canonicalPath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('离线保险库文件类型无效，未执行重置')
  }
  return canonicalPath
}

export function getExternalDataFiles(userDataPaths: string[], currentPath: string, legacyPath: string): string[] {
  const paths = new Set<string>()
  for (const userDataPath of userDataPaths) {
    const settingsPath = join(userDataPath, OFFLINE_VAULT_SETTINGS_FILE)
    const settingsStat = statPath(settingsPath)
    if (!settingsStat) continue
    if (!settingsStat.isFile() || settingsStat.isSymbolicLink()) throw new Error('离线保险库配置文件类型无效，未执行重置')
    let settings: { dataDir?: unknown }
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { dataDir?: unknown } }
    catch { throw new Error('离线保险库路径配置损坏，未执行重置') }
    if (typeof settings.dataDir !== 'string' || !isAbsolute(settings.dataDir.trim())) {
      throw new Error('离线保险库路径无效，未执行重置')
    }
    const dataFile = validateDataFilePath(join(settings.dataDir.trim(), OFFLINE_VAULT_DATA_FILE))
    if (isInside(canonicalRoot(currentPath), dataFile) || isInside(canonicalRoot(legacyPath), dataFile)) continue
    if (existsSync(dataFile)) paths.add(dataFile)
  }
  return [...paths].sort()
}

export function hashLocalDataFile(path: string): string {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('待备份文件不是普通文件')
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function hashLocalDataTree(path: string): string {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return createHash('sha256').update('symlink\0' + readlinkForHash(path)).digest('hex')
  if (stat.isFile()) return hashLocalDataFile(path)
  if (!stat.isDirectory()) throw new Error('应用数据中包含不支持的文件类型')
  const hash = createHash('sha256')
  hash.update('directory\0')
  for (const name of readdirSync(path).sort()) {
    const child = join(path, name)
    hash.update(name + '\0' + hashLocalDataTree(child) + '\0')
  }
  return hash.digest('hex')
}

function readlinkForHash(path: string): string {
  return readlinkSync(path, { encoding: 'utf8' })
}

function requireRegularFile(path: string, expectedHash?: string): void {
  const stat = statPath(path)
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new Error('本机数据备份不完整，原数据已保留')
  if (expectedHash && hashLocalDataFile(path) !== expectedHash) throw new Error('本机数据备份校验失败，原数据已保留')
}

function requireBackupDirectory(path: string, expectedHash?: string): void {
  const stat = statPath(path)
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new Error('本机数据备份不完整，原数据已保留')
  if (expectedHash && hashLocalDataTree(path) !== expectedHash) throw new Error('本机数据备份校验失败，原数据已保留')
}

function parseMarker(value: unknown): ResetMarker {
  if (!value || typeof value !== 'object') throw new Error('本机数据重置标记无效，已停止清理以保留数据')
  const marker = value as Partial<ResetMarker>
  if (
    marker.version !== 1 ||
    typeof marker.backupPath !== 'string' || !isAbsolute(marker.backupPath) ||
    !marker.appData || ![marker.appData.PPWD, marker.appData.BearPassword].every(value => value === null || typeof value === 'string') ||
    !Array.isArray(marker.externalDataFiles) || !marker.externalDataFiles.every(item =>
      !!item && typeof item.path === 'string' && isAbsolute(item.path) && /^[a-f0-9]{64}$/.test(item.sha256)
    )
  ) throw new Error('本机数据重置标记无效，已停止清理以保留数据')
  return marker as ResetMarker
}

function verifyBackup(marker: ResetMarker, appDataPath: string, currentPath: string, legacyPath: string): void {
  const backupPath = resolve(marker.backupPath)
  if (
    !basename(backupPath).startsWith(BACKUP_PREFIX) ||
    isInside(canonicalRoot(appDataPath), backupPath) ||
    isInside(canonicalRoot(currentPath), backupPath) ||
    isInside(canonicalRoot(legacyPath), backupPath) ||
    (existsSync(backupPath) && realpathSync(backupPath) !== backupPath)
  ) {
    throw new Error('本机数据备份位置无效，已停止清理以保留数据')
  }
  requireBackupDirectory(backupPath)
  for (const name of ['PPWD', 'BearPassword'] as const) {
    const expectedHash = marker.appData[name]
    if (expectedHash) {
      requireBackupDirectory(join(backupPath, name), expectedHash)
    }
    else if (existsSync(join(backupPath, name))) throw new Error('本机数据备份内容与重置标记不符，原数据已保留')
  }
  if (marker.externalDataFiles.length) {
    const externalBackup = join(backupPath, 'external-vault')
    requireBackupDirectory(externalBackup)
    marker.externalDataFiles.forEach((entry, index) => {
      requireRegularFile(join(externalBackup, String(index + 1), OFFLINE_VAULT_DATA_FILE), entry.sha256)
    })
    const manifestPath = join(externalBackup, 'manifest.json')
    requireRegularFile(manifestPath)
    let manifest: unknown
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) }
    catch { throw new Error('本机数据备份清单无效，原数据已保留') }
    if (JSON.stringify(manifest) !== JSON.stringify(marker.externalDataFiles)) {
      throw new Error('本机数据备份清单与重置标记不符，原数据已保留')
    }
  }
}

export function completePendingLocalDataReset(
  markerPath: string,
  appDataPath: string,
  currentPath: string,
  legacyPath: string
): void {
  if (!existsSync(markerPath)) return
  const markerStat = lstatSync(markerPath)
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw new Error('本机数据重置标记无效，已停止启动以保留数据')
  let marker: ResetMarker
  try { marker = parseMarker(JSON.parse(readFileSync(markerPath, 'utf8'))) }
  catch (error) {
    if (error instanceof Error && error.message.includes('重置标记无效')) throw error
    throw new Error('本机数据重置标记无法读取，已停止启动以保留数据')
  }
  assertManagedDataRoot(currentPath, appDataPath, 'PPWD')
  assertManagedDataRoot(legacyPath, appDataPath, 'BearPassword')
  verifyBackup(marker, appDataPath, currentPath, legacyPath)

  for (const name of ['PPWD', 'BearPassword'] as const) {
    const sourcePath = name === 'PPWD' ? currentPath : legacyPath
    if (!marker.appData[name] && existsSync(sourcePath)) {
      throw new Error('应用数据在备份后发生变化，已停止清理以保留数据')
    }
  }

  const remainingExternalFiles: Array<{ path: string; sha256: string }> = []
  for (const entry of marker.externalDataFiles) {
    if (isInside(canonicalRoot(currentPath), entry.path) || isInside(canonicalRoot(legacyPath), entry.path)) {
      throw new Error('待清理保险库路径无效，已停止启动以保留数据')
    }
    if (!existsSync(entry.path)) continue
    const validatedPath = validateDataFilePath(entry.path)
    if (validatedPath !== resolve(entry.path)) throw new Error('待清理保险库位置已变化，已停止启动以保留数据')
    if (hashLocalDataFile(validatedPath) !== entry.sha256) throw new Error('外置保险库在备份后发生变化，已停止清理以保留数据')
    remainingExternalFiles.push(entry)
  }
  if (remainingExternalFiles.length) {
    const configured = new Set(getExternalDataFiles([currentPath, legacyPath], currentPath, legacyPath))
    if (remainingExternalFiles.some(entry => !configured.has(entry.path))) {
      throw new Error('待清理保险库与应用配置不符，已停止启动以保留数据')
    }
  }

  for (const entry of remainingExternalFiles) {
    try { unlinkSync(entry.path) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  rmSync(currentPath, { recursive: true, force: true })
  rmSync(legacyPath, { recursive: true, force: true })
  unlinkSync(markerPath)
}
