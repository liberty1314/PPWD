import { app, safeStorage } from 'electron'
import { randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { readFile, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

const VAULT_UNLOCK_KEY_FILE = 'vault-unlock-key.enc'

function getVaultUnlockKeyPath(): string {
  return join(app.getPath('userData'), VAULT_UNLOCK_KEY_FILE)
}

export async function loadStoredVaultUnlockKey(): Promise<Buffer | null> {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(getVaultUnlockKeyPath())) return null
  try {
    const serialized = safeStorage.decryptString(await readFile(getVaultUnlockKeyPath()))
    const key = Buffer.from(serialized, 'base64')
    return key.length === 32 ? key : null
  } catch (error) {
    console.error('[vault-unlock-key] decrypt failed', error)
    return null
  }
}

export async function hasStoredVaultUnlockKey(): Promise<boolean> {
  return (await loadStoredVaultUnlockKey()) !== null
}

export async function saveStoredVaultUnlockKey(vuk: Buffer): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: '当前系统无法使用安全存储' }
  if (vuk.length !== 32) return { ok: false, error: '保险库解锁密钥无效' }

  const filePath = getVaultUnlockKeyPath()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(tempPath, safeStorage.encryptString(vuk.toString('base64')), { mode: 0o600, flag: 'wx' })
    await rename(tempPath, filePath)
    return { ok: true }
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    console.error('[vault-unlock-key] save failed', error)
    return { ok: false, error: '保险库解锁密钥保存失败' }
  }
}

export async function removeStoredVaultUnlockKey(): Promise<void> {
  await unlink(getVaultUnlockKeyPath()).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
}
