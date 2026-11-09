import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

const RECOVERY_KEY_FILE = 'recovery-key.enc'

function getRecoveryKeyPath(): string {
  return join(app.getPath('userData'), RECOVERY_KEY_FILE)
}

export function isRecoveryKeyEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function hasStoredRecoveryKey(): boolean {
  return existsSync(getRecoveryKeyPath())
}

export function loadStoredRecoveryKey(): string | null {
  const filePath = getRecoveryKeyPath()
  if (!safeStorage.isEncryptionAvailable() || !existsSync(filePath)) return null
  try {
    return safeStorage.decryptString(readFileSync(filePath)) || null
  } catch {
    throw new Error('本地恢复密钥无法读取')
  }
}

export function saveStoredRecoveryKey(
  key: string
): { ok: true } | { ok: false; error: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: '当前系统无法使用安全存储' }
  }
  const normalized = key.trim()
  if (!/^[A-Za-z0-9_-]{128}$/.test(normalized)) {
    return { ok: false, error: '恢复密钥格式无效' }
  }

  const filePath = getRecoveryKeyPath()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    const encrypted = safeStorage.encryptString(normalized)
    writeFileSync(tempPath, encrypted, { mode: 0o600 })
    renameSync(tempPath, filePath)
    return { ok: true }
  } catch {
    try {
      unlinkSync(tempPath)
    } catch {
      // 文件不存在或已被清理。
    }
    return { ok: false, error: '恢复密钥保存失败' }
  }
}

export function removeStoredRecoveryKey(): void {
  const filePath = getRecoveryKeyPath()
  if (!existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch {
    // 仅用于回滚未完成的首次创建。
  }
}
