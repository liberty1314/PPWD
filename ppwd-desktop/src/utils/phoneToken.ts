import * as OTPAuth from 'otpauth'
import qrcode from 'qrcode-generator'

export const PHONE_TOKEN_SECRET_BYTES = 20
export const PHONE_TOKEN_DIGITS = 6
export const PHONE_TOKEN_PERIOD_SECONDS = 30
export const PHONE_TOKEN_WINDOW = 1
export const PHONE_TOKEN_ISSUER = 'PPWD'
export const PHONE_TOKEN_SHORT_LOCK_MS = 60_000
export const PHONE_TOKEN_LONG_LOCK_MS = 15 * 60_000
export const PHONE_TOKEN_SHORT_LOCK_FAILURES = 5
export const PHONE_TOKEN_LONG_LOCK_FAILURES = 10

export interface PhoneTokenFailureState {
  failedAttempts: number
  lockedUntil: number
}

export function advancePhoneTokenFailureState(
  state: PhoneTokenFailureState,
  now: number
): { state: PhoneTokenFailureState; lockEvent: 'short' | 'long' | null } {
  if (state.lockedUntil > now) return { state: { ...state }, lockEvent: null }
  const failedAttempts = state.failedAttempts + 1
  if (failedAttempts >= PHONE_TOKEN_LONG_LOCK_FAILURES) {
    return {
      state: { failedAttempts, lockedUntil: now + PHONE_TOKEN_LONG_LOCK_MS },
      lockEvent: failedAttempts === PHONE_TOKEN_LONG_LOCK_FAILURES ? 'long' : null
    }
  }
  if (failedAttempts >= PHONE_TOKEN_SHORT_LOCK_FAILURES) {
    return {
      state: { failedAttempts, lockedUntil: now + PHONE_TOKEN_SHORT_LOCK_MS },
      lockEvent: failedAttempts === PHONE_TOKEN_SHORT_LOCK_FAILURES ? 'short' : null
    }
  }
  return { state: { failedAttempts, lockedUntil: 0 }, lockEvent: null }
}

export function resetPhoneTokenFailureState(): PhoneTokenFailureState {
  return { failedAttempts: 0, lockedUntil: 0 }
}

function buildPhoneToken(secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: PHONE_TOKEN_ISSUER,
    label: PHONE_TOKEN_ISSUER,
    algorithm: 'SHA1',
    digits: PHONE_TOKEN_DIGITS,
    period: PHONE_TOKEN_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret.trim().replace(/\s+/g, '').toUpperCase())
  })
}

/** 生成 160 位随机熵的 Base32 令牌密钥。 */
export function generatePhoneTokenSecret(): string {
  return new OTPAuth.Secret({ size: PHONE_TOKEN_SECRET_BYTES }).base32
}

/** 生成 96 字节熵、128 字符 Base64URL 格式的恢复密钥。 */
export function generatePhoneTokenRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(96))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}

/** 生成兼容通用验证器的 TOTP URI。 */
export function createPhoneTokenUri(secret: string): string {
  return buildPhoneToken(secret).toString()
}

/** 生成仅供当前绑定界面显示的二维码 Data URL。 */
export function createPhoneTokenQrDataUrl(secret: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(createPhoneTokenUri(secret))
  qr.make()
  return qr.createDataURL(5, 4)
}

/**
 * 校验当前 6 位动态码并返回其实际匹配的 30 秒时间步。
 * 返回 null 表示格式错误、超出 ±1 步或已经使用过。
 */
export function matchPhoneTokenStep(
  secret: string,
  code: string,
  nowMs = Date.now(),
  lastAcceptedStep: number | null = null
): number | null {
  const normalizedCode = code.trim()
  if (!/^\d{6}$/.test(normalizedCode) || !Number.isFinite(nowMs)) return null

  try {
    const delta = buildPhoneToken(secret).validate({
      token: normalizedCode,
      timestamp: nowMs,
      window: PHONE_TOKEN_WINDOW
    })
    if (delta === null) return null

    const currentStep = Math.floor(nowMs / (PHONE_TOKEN_PERIOD_SECONDS * 1000))
    const matchedStep = currentStep + delta
    if (lastAcceptedStep !== null && matchedStep <= lastAcceptedStep) return null
    return matchedStep
  } catch {
    return null
  }
}

export type PhoneTokenUnlockCheck<T> =
  | { ok: false; reason: 'invalidCode' | 'invalidCredential' }
  | { ok: true; acceptedStep: number; value: T }

export function checkPhoneTokenCode(
  secret: string,
  code: string,
  nowMs: number,
  lastAcceptedStep: number | null
): { ok: true; acceptedStep: number } | { ok: false } {
  const acceptedStep = matchPhoneTokenStep(secret, code, nowMs, lastAcceptedStep)
  return acceptedStep === null ? { ok: false } : { ok: true, acceptedStep }
}

export async function checkPhoneTokenUnlock<T>(
  secret: string,
  code: string,
  nowMs: number,
  lastAcceptedStep: number | null,
  verifyCredential: () => Promise<T | null>
): Promise<PhoneTokenUnlockCheck<T>> {
  const acceptedStep = matchPhoneTokenStep(secret, code, nowMs, lastAcceptedStep)
  if (acceptedStep === null) return { ok: false, reason: 'invalidCode' }

  const value = await verifyCredential()
  if (value === null) return { ok: false, reason: 'invalidCredential' }

  return { ok: true, acceptedStep, value }
}
