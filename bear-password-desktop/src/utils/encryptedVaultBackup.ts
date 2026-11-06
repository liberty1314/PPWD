import { normalizeOfflineVaultSnapshot, type OfflineVaultSnapshot } from '../../shared/offlineVault.ts'
import { fromBase64, toBase64 } from './vaultCrypto/encoding.ts'

const BACKUP_FORMAT = 'bearpassword-encrypted-backup'
const BACKUP_VERSION = 1
const ITERATIONS = 600_000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer
}

interface EncryptedBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  fingerprint: string
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asArrayBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptVaultBackup(
  snapshot: OfflineVaultSnapshot,
  fingerprint: string,
  password: string
): Promise<string> {
  if (password.length < 12) throw new Error('backup.passwordTooShort')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const normalized = normalizeOfflineVaultSnapshot(snapshot)
  const aad = encoder.encode(`${BACKUP_FORMAT}:${BACKUP_VERSION}:${fingerprint}`)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(iv), additionalData: aad },
    key,
    encoder.encode(JSON.stringify(normalized))
  )
  const backup: EncryptedBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    fingerprint,
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  }
  return JSON.stringify(backup, null, 2)
}

export async function decryptVaultBackup(
  source: string,
  fingerprint: string,
  password: string
): Promise<OfflineVaultSnapshot> {
  let backup: Partial<EncryptedBackup>
  try {
    backup = JSON.parse(source) as Partial<EncryptedBackup>
  } catch {
    throw new Error('backup.invalidFormat')
  }
  if (
    backup.format !== BACKUP_FORMAT ||
    backup.version !== BACKUP_VERSION ||
    backup.iterations !== ITERATIONS ||
    typeof backup.fingerprint !== 'string' ||
    typeof backup.salt !== 'string' ||
    typeof backup.iv !== 'string' ||
    typeof backup.ciphertext !== 'string'
  ) {
    throw new Error('backup.invalidFormat')
  }
  if (backup.fingerprint !== fingerprint) throw new Error('backup.wrongVault')
  try {
    const key = await deriveKey(password, fromBase64(backup.salt))
    const aad = encoder.encode(`${BACKUP_FORMAT}:${BACKUP_VERSION}:${fingerprint}`)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(backup.iv)), additionalData: aad },
      key,
      asArrayBuffer(fromBase64(backup.ciphertext))
    )
    return normalizeOfflineVaultSnapshot(JSON.parse(decoder.decode(plaintext)))
  } catch {
    throw new Error('backup.decryptFailed')
  }
}
