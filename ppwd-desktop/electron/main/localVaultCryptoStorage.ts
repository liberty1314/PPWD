import { app, safeStorage } from 'electron'
import { createHash, hkdfSync, pbkdf2, randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface LocalVaultCryptoMeta {
  version: 1
  vaultSalt: string
  secretKeyFingerprint: string
  passwordVerifier: string
}

const LOCAL_VAULT_CRYPTO_FILE = 'local-vault-crypto.enc'
const MASTER_PASSWORD_PEPPER = Buffer.from('bear-password-master-password-v2', 'utf8')
const MASTER_PASSWORD_ITERATIONS = 600_000
const VUK_HKDF_INFO = Buffer.from('bear-password-vuk-v2', 'utf8')
const PASSWORD_VERIFIER_CONTEXT = Buffer.from('bear-password-vuk-verifier-v1\0', 'utf8')

function getFilePath(): string {
  return join(app.getPath('userData'), LOCAL_VAULT_CRYPTO_FILE)
}

export function isLocalVaultCryptoEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function hasStoredLocalVaultCrypto(): boolean {
  return existsSync(getFilePath())
}

function normalizeMeta(value: unknown): LocalVaultCryptoMeta {
  if (!value || typeof value !== 'object') throw new Error('本地保险库配置无效')
  const source = value as Partial<LocalVaultCryptoMeta>
  if (
    source.version !== 1 ||
    typeof source.vaultSalt !== 'string' ||
    typeof source.secretKeyFingerprint !== 'string' ||
    typeof source.passwordVerifier !== 'string'
  ) {
    throw new Error('本地保险库配置无效')
  }
  return {
    version: 1,
    vaultSalt: source.vaultSalt,
    secretKeyFingerprint: source.secretKeyFingerprint,
    passwordVerifier: source.passwordVerifier
  }
}

export function loadStoredLocalVaultCrypto(): LocalVaultCryptoMeta | null {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(getFilePath())) return null
  try {
    const encrypted = readFileSync(getFilePath())
    const serialized = safeStorage.decryptString(encrypted)
    return normalizeMeta(JSON.parse(serialized))
  } catch {
    throw new Error('本地保险库安全配置无法读取')
  }
}

export function saveStoredLocalVaultCrypto(
  meta: LocalVaultCryptoMeta
): { ok: true } | { ok: false; error: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: '当前系统无法使用安全存储' }
  }

  const filePath = getFilePath()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    const normalized = normalizeMeta(meta)
    const encrypted = safeStorage.encryptString(JSON.stringify(normalized))
    writeFileSync(tempPath, encrypted, { mode: 0o600 })
    renameSync(tempPath, filePath)
    return { ok: true }
  } catch {
    try {
      unlinkSync(tempPath)
    } catch {
      // 文件不存在或已被清理。
    }
    return { ok: false, error: '本地保险库安全配置保存失败' }
  }
}

export function removeStoredLocalVaultCrypto(): void {
  const filePath = getFilePath()
  if (!existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch {
    // 仅用于回滚未完成的首次创建。
  }
}

function pbkdf2Async(password: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, MASTER_PASSWORD_PEPPER, MASTER_PASSWORD_ITERATIONS, 32, 'sha256', (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

export async function deriveLocalVaultUnlockKey(
  masterPassword: string,
  recoveryKey: string,
  vaultSaltBase64: string
): Promise<Buffer> {
  const normalizedPassword = masterPassword.trim()
  const normalizedRecoveryKey = recoveryKey.trim()
  if (!normalizedPassword || !normalizedRecoveryKey) throw new Error('验证失败')

  const passwordKey = await pbkdf2Async(Buffer.from(normalizedPassword, 'utf8'))
  const inputKeyMaterial = Buffer.concat([
    passwordKey,
    Buffer.from(normalizedRecoveryKey, 'utf8')
  ])
  return Buffer.from(
    hkdfSync(
      'sha256',
      inputKeyMaterial,
      Buffer.from(vaultSaltBase64, 'base64'),
      VUK_HKDF_INFO,
      32
    )
  )
}

function createPasswordVerifier(vuk: Buffer): string {
  return createHash('sha256')
    .update(PASSWORD_VERIFIER_CONTEXT)
    .update(vuk)
    .digest('base64')
}

export function verifyLocalVaultUnlockKey(vuk: Buffer, meta: LocalVaultCryptoMeta): boolean {
  const actual = Buffer.from(createPasswordVerifier(vuk), 'base64')
  const expected = Buffer.from(meta.passwordVerifier, 'base64')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function createLocalVaultCryptoMeta(
  masterPassword: string,
  recoveryKey: string
): Promise<{ meta: LocalVaultCryptoMeta; vuk: Buffer }> {
  const vaultSalt = randomBytes(32).toString('base64')
  const vuk = await deriveLocalVaultUnlockKey(masterPassword, recoveryKey, vaultSalt)
  const meta: LocalVaultCryptoMeta = {
    version: 1,
    vaultSalt,
    secretKeyFingerprint: createHash('sha256').update(recoveryKey.trim(), 'utf8').digest('base64'),
    passwordVerifier: createPasswordVerifier(vuk)
  }
  return { meta, vuk }
}

export function updateLocalVaultPasswordVerifier(vuk: Buffer, meta: LocalVaultCryptoMeta): LocalVaultCryptoMeta {
  return { ...meta, passwordVerifier: createPasswordVerifier(vuk) }
}
