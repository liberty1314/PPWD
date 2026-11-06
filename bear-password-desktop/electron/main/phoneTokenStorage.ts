import { app, safeStorage } from 'electron'
import { createHash, timingSafeEqual } from 'crypto'
import { appendFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as OTPAuth from 'otpauth'
import {
  advancePhoneTokenFailureState,
  checkPhoneTokenCode,
  checkPhoneTokenUnlock,
  matchPhoneTokenStep,
  resetPhoneTokenFailureState
} from '../../src/utils/phoneToken'
import {
  createLocalVaultCryptoMeta,
  deriveLocalVaultUnlockKey,
  hasStoredLocalVaultCrypto,
  isLocalVaultCryptoEncryptionAvailable,
  loadStoredLocalVaultCrypto,
  removeStoredLocalVaultCrypto,
  saveStoredLocalVaultCrypto,
  verifyLocalVaultUnlockKey,
  type LocalVaultCryptoMeta
} from './localVaultCryptoStorage'
import {
  hasStoredRecoveryKey,
  isRecoveryKeyEncryptionAvailable,
  loadStoredRecoveryKey,
  removeStoredRecoveryKey,
  saveStoredRecoveryKey
} from './recoveryKeyStorage'
import { loadStoredVaultUnlockKey, saveStoredVaultUnlockKey } from './vaultUnlockKeyStorage'

const PHONE_TOKEN_FILE = 'phone-token-state.enc'
const PHONE_TOKEN_AUDIT_FILE = 'phone-token-audit.log'

interface PhoneTokenState {
  version: 1
  secret: string | null
  failedAttempts: number
  lockedUntil: number
  lastAcceptedStep: number | null
}

export type PhoneTokenResult =
  | { ok: true; vuk: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'unavailable' | 'unbound' | 'alreadyBound' | 'alreadyConfigured' | 'existingData' }

export interface PhoneTokenStatus {
  available: boolean
  hasBinding: boolean
  hasLocalVault: boolean
  hasRecoveryKey: boolean
  fingerprint: string | null
  vaultSalt: string | null
  tokenVerifiedThisSession: boolean
}

const EMPTY_STATE: PhoneTokenState = {
  version: 1,
  secret: null,
  failedAttempts: 0,
  lockedUntil: 0,
  lastAcceptedStep: null
}

let actionQueue: Promise<unknown> = Promise.resolve()
let tokenVerifiedThisSession = false
let recoveryKeyReadAuthorized = false

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = actionQueue.then(operation, operation)
  actionQueue = result.then(() => undefined, () => undefined)
  return result
}

function getPhoneTokenPath(): string {
  return join(app.getPath('userData'), PHONE_TOKEN_FILE)
}

function parseState(value: unknown): PhoneTokenState {
  if (!value || typeof value !== 'object') throw new Error('手机令牌状态无效')
  const source = value as Partial<PhoneTokenState>
  if (
    source.version !== 1 ||
    !(source.secret === null || typeof source.secret === 'string') ||
    !Number.isInteger(source.failedAttempts) ||
    typeof source.lockedUntil !== 'number' ||
    !(source.lastAcceptedStep === null || typeof source.lastAcceptedStep === 'number')
  ) {
    throw new Error('手机令牌状态无效')
  }
  return {
    version: 1,
    secret: source.secret ?? null,
    failedAttempts: Math.max(0, Number(source.failedAttempts)),
    lockedUntil: Math.max(0, Number(source.lockedUntil)),
    lastAcceptedStep: source.lastAcceptedStep ?? null
  }
}

function readPhoneTokenState(): PhoneTokenState {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('安全存储不可用')
  const filePath = getPhoneTokenPath()
  if (!existsSync(filePath)) return { ...EMPTY_STATE }
  try {
    const serialized = safeStorage.decryptString(readFileSync(filePath))
    return parseState(JSON.parse(serialized))
  } catch {
    throw new Error('手机令牌安全状态无法读取')
  }
}

function writePhoneTokenState(state: PhoneTokenState): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('安全存储不可用')
  const filePath = getPhoneTokenPath()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    const encrypted = safeStorage.encryptString(JSON.stringify(state))
    writeFileSync(tempPath, encrypted, { mode: 0o600 })
    renameSync(tempPath, filePath)
  } catch {
    try {
      unlinkSync(tempPath)
    } catch {
      // 文件不存在或已被清理。
    }
    throw new Error('手机令牌安全状态保存失败')
  }
}

function writeAuditEvent(event: string): void {
  const line = JSON.stringify({ event, at: new Date().toISOString() })
  try {
    appendFileSync(join(app.getPath('userData'), PHONE_TOKEN_AUDIT_FILE), `${line}\n`, { mode: 0o600 })
  } catch {
    // 审计记录失败不能泄露认证材料，也不能将失败伪装成验证成功。
  }
}

function currentAvailability(): boolean {
  return (
    safeStorage.isEncryptionAvailable() &&
    isLocalVaultCryptoEncryptionAvailable() &&
    isRecoveryKeyEncryptionAvailable()
  )
}

function failureResult(state: PhoneTokenState, now: number): PhoneTokenResult {
  if (state.lockedUntil > now) return { ok: false, reason: 'locked' }
  const failure = advancePhoneTokenFailureState(state, now)
  state.failedAttempts = failure.state.failedAttempts
  state.lockedUntil = failure.state.lockedUntil
  if (failure.lockEvent === 'long') writeAuditEvent('phone_token_lock_15m')
  if (failure.lockEvent === 'short') writeAuditEvent('phone_token_lock_1m')
  writePhoneTokenState(state)
  return state.lockedUntil > now
    ? { ok: false, reason: 'locked' }
    : { ok: false, reason: 'invalid' }
}

function isRecoveryKeyFormatValid(value: string): boolean {
  return /^[A-Za-z0-9_-]{128}$/.test(value.trim())
}

function isMasterPasswordValid(value: string): boolean {
  const password = value.trim()
  return password.length >= 6 && password.length <= 64
}

function isPhoneTokenSecretValid(value: string): string | null {
  const normalized = value.replace(/\s+/g, '').toUpperCase()
  try {
    const secret = OTPAuth.Secret.fromBase32(normalized)
    return secret.bytes.length >= 20 ? normalized : null
  } catch {
    return null
  }
}

function recoveryKeyMatchesMeta(recoveryKey: string, meta: LocalVaultCryptoMeta): boolean {
  const actual = createHash('sha256').update(recoveryKey.trim(), 'utf8').digest()
  const expected = Buffer.from(meta.secretKeyFingerprint, 'base64')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function verifyPasswordAndRecoverKey(
  masterPassword: string,
  recoveryKey: string,
  meta: LocalVaultCryptoMeta
): Promise<Buffer | null> {
  if (!isMasterPasswordValid(masterPassword) || !isRecoveryKeyFormatValid(recoveryKey)) return null
  if (!recoveryKeyMatchesMeta(recoveryKey, meta)) return null
  const vuk = await deriveLocalVaultUnlockKey(masterPassword, recoveryKey, meta.vaultSalt)
  return verifyLocalVaultUnlockKey(vuk, meta) ? vuk : null
}

function readStatus(): PhoneTokenStatus {
  const available = currentAvailability()
  let hasBinding = false
  let fingerprint: string | null = null
  let vaultSalt: string | null = null
  if (available) {
    try {
      hasBinding = !!readPhoneTokenState().secret
      const meta = loadStoredLocalVaultCrypto()
      fingerprint = meta?.secretKeyFingerprint ?? null
      vaultSalt = meta?.vaultSalt ?? null
    } catch {
      hasBinding = existsSync(getPhoneTokenPath())
    }
  } else {
    hasBinding = existsSync(getPhoneTokenPath())
  }

  return {
    available,
    hasBinding,
    hasLocalVault: hasStoredLocalVaultCrypto(),
    hasRecoveryKey: hasStoredRecoveryKey(),
    fingerprint,
    vaultSalt,
    tokenVerifiedThisSession
  }
}

export async function getPhoneTokenStatus(): Promise<PhoneTokenStatus> {
  return enqueue(async () => readStatus())
}

export async function initializeLocalVault(
  masterPassword: string,
  recoveryKey: string,
  hasExistingData: boolean
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'unavailable' | 'alreadyConfigured' | 'existingData' }> {
  return enqueue(async () => {
    if (!currentAvailability()) return { ok: false, reason: 'unavailable' }
    if (hasExistingData) return { ok: false, reason: 'existingData' }
    if (hasStoredLocalVaultCrypto() || hasStoredRecoveryKey() || existsSync(getPhoneTokenPath())) {
      return { ok: false, reason: 'alreadyConfigured' }
    }
    if (!isMasterPasswordValid(masterPassword) || !isRecoveryKeyFormatValid(recoveryKey)) {
      return { ok: false, reason: 'invalid' }
    }

    try {
      const { meta } = await createLocalVaultCryptoMeta(masterPassword, recoveryKey)
      const keyResult = saveStoredRecoveryKey(recoveryKey)
      if (!keyResult.ok) return { ok: false, reason: 'unavailable' }
      const metaResult = saveStoredLocalVaultCrypto(meta)
      if (!metaResult.ok) {
        removeStoredRecoveryKey()
        removeStoredLocalVaultCrypto()
        return { ok: false, reason: 'unavailable' }
      }
      writeAuditEvent('local_vault_created')
      return { ok: true }
    } catch {
      removeStoredRecoveryKey()
      removeStoredLocalVaultCrypto()
      return { ok: false, reason: 'unavailable' }
    }
  })
}

export async function unlockWithPhoneToken(
  code: string,
  verifyCredential: () => Promise<Buffer | null> = () => loadStoredVaultUnlockKey()
): Promise<PhoneTokenResult> {
  return enqueue(async () => {
    const now = Date.now()
    if (!currentAvailability()) return { ok: false, reason: 'unavailable' }
    let state: PhoneTokenState
    try {
      state = readPhoneTokenState()
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (!state.secret) return { ok: false, reason: 'unbound' }
    if (state.lockedUntil > now) return { ok: false, reason: 'locked' }

    try {
      const checked = checkPhoneTokenCode(
        state.secret,
        code,
        now,
        state.lastAcceptedStep
      )
      if (!checked.ok) return failureResult(state, now)

      const value = await verifyCredential()
      if (!value) return { ok: false, reason: 'unavailable' }

      state.lastAcceptedStep = checked.acceptedStep
      Object.assign(state, resetPhoneTokenFailureState())
      writePhoneTokenState(state)
      tokenVerifiedThisSession = true
      return { ok: true, vuk: value.toString('base64') }
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  })
}

export async function authorizeRecoveryKeyRead(
  code: string,
  masterPassword: string
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'unavailable' | 'unbound' }> {
  const result = await unlockWithPhoneToken(code, async () => {
    const meta = loadStoredLocalVaultCrypto()
    const key = loadStoredRecoveryKey()
    if (!meta || !key) return null
    return verifyPasswordAndRecoverKey(masterPassword, key, meta)
  })
  recoveryKeyReadAuthorized = result.ok
  if (result.ok) return { ok: true }
  const reason = result.reason
  return {
    ok: false,
    reason: reason === 'invalid' || reason === 'locked' || reason === 'unavailable' || reason === 'unbound'
      ? reason
      : 'invalid'
  }
}

export function consumeRecoveryKeyReadAuthorization(): boolean {
  const authorized = recoveryKeyReadAuthorized && tokenVerifiedThisSession
  recoveryKeyReadAuthorized = false
  return authorized
}

export async function bindPhoneToken(
  secretInput: string,
  code: string,
  masterPassword: string
): Promise<PhoneTokenResult> {
  return enqueue(async () => {
    const now = Date.now()
    if (!currentAvailability()) return { ok: false, reason: 'unavailable' }
    let state: PhoneTokenState
    try {
      state = readPhoneTokenState()
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (state.secret) return { ok: false, reason: 'alreadyBound' }
    if (state.lockedUntil > now) return { ok: false, reason: 'locked' }
    const secret = isPhoneTokenSecretValid(secretInput)
    if (!secret) return failureResult(state, now)
    const acceptedStep = matchPhoneTokenStep(secret, code, now)
    if (acceptedStep === null) return failureResult(state, now)

    try {
      const meta = loadStoredLocalVaultCrypto()
      const key = loadStoredRecoveryKey()
      if (!meta || !key) return failureResult(state, now)
      const vuk = await verifyPasswordAndRecoverKey(masterPassword, key, meta)
      if (!vuk) return failureResult(state, now)
      const savedKey = await saveStoredVaultUnlockKey(vuk)
      if (!savedKey.ok) return { ok: false, reason: 'unavailable' }
      state.secret = secret
      state.lastAcceptedStep = acceptedStep
      Object.assign(state, resetPhoneTokenFailureState())
      writePhoneTokenState(state)
      tokenVerifiedThisSession = true
      writeAuditEvent('phone_token_bound')
      return { ok: true, vuk: vuk.toString('base64') }
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  })
}

export async function rebindPhoneToken(
  code: string,
  masterPassword: string
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'unavailable' | 'unbound' }> {
  return enqueue(async () => {
    const now = Date.now()
    if (!currentAvailability()) return { ok: false, reason: 'unavailable' }
    let state: PhoneTokenState
    try {
      state = readPhoneTokenState()
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (!state.secret) return { ok: false, reason: 'unbound' }
    if (state.lockedUntil > now) return { ok: false, reason: 'locked' }

    const acceptedStep = matchPhoneTokenStep(state.secret, code, now, state.lastAcceptedStep)
    if (acceptedStep === null) {
      const failure = failureResult(state, now)
      return { ok: false, reason: failure.reason === 'locked' ? 'locked' : 'invalid' }
    }
    state.lastAcceptedStep = acceptedStep
    writePhoneTokenState(state)

    try {
      const meta = loadStoredLocalVaultCrypto()
      const key = loadStoredRecoveryKey()
      if (!meta || !key || !(await verifyPasswordAndRecoverKey(masterPassword, key, meta))) {
        const failure = failureResult(state, now)
        return { ok: false, reason: failure.reason === 'locked' ? 'locked' : 'invalid' }
      }
      Object.assign(state, resetPhoneTokenFailureState())
      state.secret = null
      writePhoneTokenState(state)
      tokenVerifiedThisSession = false
      recoveryKeyReadAuthorized = false
      writeAuditEvent('phone_token_rebind_started')
      return { ok: true }
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  })
}

export async function recoverPhoneToken(
  masterPassword: string,
  recoveryKey: string
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'unavailable' }> {
  return enqueue(async () => {
    const now = Date.now()
    if (!currentAvailability()) return { ok: false, reason: 'unavailable' }
    let state: PhoneTokenState
    try {
      state = readPhoneTokenState()
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (state.lockedUntil > now) return { ok: false, reason: 'locked' }

    try {
      const meta = loadStoredLocalVaultCrypto()
      if (!meta) return { ok: false, reason: 'unavailable' }
      const vuk = await verifyPasswordAndRecoverKey(masterPassword, recoveryKey, meta)
      if (!vuk) {
        const failure = failureResult(state, now)
        return { ok: false, reason: failure.reason === 'locked' ? 'locked' : 'invalid' }
      }
      state.failedAttempts = 0
      state.lockedUntil = 0
      state.secret = null
      writePhoneTokenState(state)
      tokenVerifiedThisSession = false
      recoveryKeyReadAuthorized = false
      writeAuditEvent('phone_token_recovery_started')
      return { ok: true }
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  })
}

export function isPhoneTokenSessionVerified(): boolean {
  return tokenVerifiedThisSession
}

export async function deriveVerifiedVaultUnlockKey(masterPassword: string): Promise<Buffer | null> {
  try {
    const meta = loadStoredLocalVaultCrypto()
    const recoveryKey = loadStoredRecoveryKey()
    if (!meta || !recoveryKey) return null
    return verifyPasswordAndRecoverKey(masterPassword, recoveryKey, meta)
  } catch {
    return null
  }
}

export async function validateBiometricPasswordForSession(password: string): Promise<boolean> {
  return (await deriveVerifiedVaultUnlockKey(password)) !== null
}
