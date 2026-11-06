import { app, safeStorage } from 'electron'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { readFile, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

const VAULT_PASSWORD_FILE = 'vault-password.enc'

function getVaultPasswordPath(): string {
  return join(app.getPath('userData'), VAULT_PASSWORD_FILE)
}

export function isVaultPasswordEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

async function decryptPasswordFile(filePath: string): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(filePath)) {
    return null
  }

  try {
    const encrypted = await readFile(filePath)
    const decrypted = safeStorage.decryptString(encrypted)
    return decrypted || null
  } catch (error) {
    console.error('[vault-password] decrypt failed', error)
    return null
  }
}

export async function loadStoredVaultPassword(): Promise<string | null> {
  return decryptPasswordFile(getVaultPasswordPath())
}

export async function hasStoredVaultPassword(): Promise<boolean> {
  return (await loadStoredVaultPassword()) !== null
}

export async function saveStoredVaultPassword(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error: '当前系统无法使用安全存储，请检查钥匙串/凭据管理器是否可用'
    }
  }

  if (!password) {
    return { ok: false, error: '密码不能为空' }
  }

  const filePath = getVaultPasswordPath()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  try {
    const encrypted = safeStorage.encryptString(password)
    await writeFile(tempPath, encrypted, { mode: 0o600, flag: 'wx' })
    await rename(tempPath, filePath)
    return { ok: true }
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    console.error('[vault-password] encrypt failed', error)
    return { ok: false, error: '密码保存失败，请稍后重试' }
  }
}

export async function removeStoredVaultPassword(): Promise<{ ok: true } | { ok: false; error: string }> {
  const filePath = getVaultPasswordPath()
  if (existsSync(filePath)) {
    try {
      await unlink(filePath)
    } catch (error) {
      console.error('[vault-password] remove failed', error)
      return { ok: false, error: '快捷解锁凭据删除失败' }
    }
  }
  return { ok: true }
}
