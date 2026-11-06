import assert from 'node:assert/strict'
import test from 'node:test'
import * as OTPAuth from 'otpauth'
import {
  createPhoneTokenQrDataUrl,
  createPhoneTokenUri,
  generatePhoneTokenRecoveryKey,
  generatePhoneTokenSecret,
  matchPhoneTokenStep,
  checkPhoneTokenCode,
  checkPhoneTokenUnlock,
  PHONE_TOKEN_PERIOD_SECONDS,
  advancePhoneTokenFailureState
} from '../src/utils/phoneToken.ts'

const SECRET = 'JBSWY3DPEHPK3PXP'
const BASE_TIME = 1_700_000_000_000
const STEP_MS = PHONE_TOKEN_PERIOD_SECONDS * 1000

function codeAt(secret, timestamp) {
  return new OTPAuth.TOTP({
    issuer: 'BearPassword',
    label: 'BearPassword',
    algorithm: 'SHA1',
    digits: 6,
    period: PHONE_TOKEN_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret)
  }).generate({ timestamp })
}

test('生成的令牌密钥至少含 160 位熵且为 Base32', () => {
  const secret = generatePhoneTokenSecret()
  assert.equal(secret.length, 32)
  assert.match(secret, /^[A-Z2-7]+$/)
})

test('恢复密钥为 128 位 Base64URL 字符串', () => {
  const key = generatePhoneTokenRecoveryKey()
  assert.equal(key.length, 128)
  assert.match(key, /^[A-Za-z0-9_-]{128}$/)
})

test('生成通用验证器 URI 与二维码数据', () => {
  const uri = createPhoneTokenUri(SECRET)
  assert.match(uri, /^otpauth:\/\/totp\//)
  assert.match(uri, /issuer=BearPassword/)
  assert.match(createPhoneTokenQrDataUrl(SECRET), /^data:image\/gif;base64,/)
})

test('接受正确码及前后各一个时间步', () => {
  const now = BASE_TIME - (BASE_TIME % STEP_MS)
  for (const offset of [-1, 0, 1]) {
    const timestamp = now + offset * STEP_MS
    assert.equal(matchPhoneTokenStep(SECRET, codeAt(SECRET, timestamp), now), Math.floor(timestamp / STEP_MS))
  }
})

test('拒绝错误格式、错误码和超出容差的码', () => {
  const now = BASE_TIME - (BASE_TIME % STEP_MS)
  const currentCode = codeAt(SECRET, now)
  const wrongCode = currentCode === '000000' ? '000001' : '000000'
  assert.equal(matchPhoneTokenStep(SECRET, '12345', now), null)
  assert.equal(matchPhoneTokenStep(SECRET, wrongCode, now), null)
  assert.equal(matchPhoneTokenStep(SECRET, codeAt(SECRET, now + 2 * STEP_MS), now), null)
  assert.equal(matchPhoneTokenStep(SECRET, codeAt(SECRET, now - 2 * STEP_MS), now), null)
})

test('拒绝同一时间步的重放码', () => {
  const now = BASE_TIME - (BASE_TIME % STEP_MS)
  const step = Math.floor(now / STEP_MS)
  const code = codeAt(SECRET, now)
  assert.equal(matchPhoneTokenStep(SECRET, code, now), step)
  assert.equal(matchPhoneTokenStep(SECRET, code, now, step), null)
})

test('动态码验证只返回候选时间步，状态提交由调用方控制', () => {
  const now = BASE_TIME - (BASE_TIME % STEP_MS)
  const code = codeAt(SECRET, now)
  const state = { lastAcceptedStep: null }

  const checked = checkPhoneTokenCode(SECRET, code, now, state.lastAcceptedStep)
  assert.deepEqual(checked, { ok: true, acceptedStep: Math.floor(now / STEP_MS) })
  assert.equal(state.lastAcceptedStep, null)
  assert.deepEqual(checkPhoneTokenCode(SECRET, code, now, checked.acceptedStep), { ok: false })
})

test('安全存储凭据缺失不消耗正确动态码，恢复凭据后同一码仍可解锁', async () => {
  const now = BASE_TIME - (BASE_TIME % STEP_MS)
  const code = codeAt(SECRET, now)
  const lastAcceptedStep = null

  const invalidPassword = await checkPhoneTokenUnlock(
    SECRET,
    code,
    now,
    lastAcceptedStep,
    async () => null
  )
  assert.deepEqual(invalidPassword, { ok: false, reason: 'invalidCredential' })

  const validPassword = await checkPhoneTokenUnlock(
    SECRET,
    code,
    now,
    lastAcceptedStep,
    async () => 'verified-vuk'
  )
  assert.deepEqual(validPassword, {
    ok: true,
    acceptedStep: Math.floor(now / STEP_MS),
    value: 'verified-vuk'
  })
})

test('第 5 次失败锁定 1 分钟，第 10 次失败锁定 15 分钟', () => {
  let state = { failedAttempts: 0, lockedUntil: 0 }
  const now = BASE_TIME
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = advancePhoneTokenFailureState(state, now)
    state = result.state
    if (attempt < 5) assert.equal(result.lockEvent, null)
    else {
      assert.equal(result.lockEvent, 'short')
      assert.equal(state.lockedUntil, now + 60_000)
    }
  }

  state = { failedAttempts: 5, lockedUntil: now + 60_000 }
  let retryTime = state.lockedUntil
  for (let attempt = 6; attempt <= 10; attempt += 1) {
    const attemptTime = retryTime
    const result = advancePhoneTokenFailureState(state, attemptTime)
    state = result.state
    retryTime = state.lockedUntil
    if (attempt < 10) assert.equal(result.lockEvent, null)
    else {
      assert.equal(result.lockEvent, 'long')
      assert.equal(state.lockedUntil, attemptTime + 15 * 60_000)
    }
  }
})
