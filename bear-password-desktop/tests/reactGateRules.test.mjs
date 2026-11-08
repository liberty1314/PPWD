import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveReactGateRoute, validateSetupPassword, isSixDigitTotp } from '../src/utils/reactGateRules.ts'

test('gate requires setup, local token binding, then unlock in that order', () => {
  assert.equal(resolveReactGateRoute({ initialized: false }), null)
  assert.equal(resolveReactGateRoute({ initialized: true, hasLocalVault: false }), '/setup')
  assert.equal(resolveReactGateRoute({ initialized: true, hasLocalVault: true, hasBinding: false }), '/bind')
  assert.equal(resolveReactGateRoute({ initialized: true, hasLocalVault: true, hasBinding: true, hasVaultAccess: false }), '/unlock')
  assert.equal(resolveReactGateRoute({ initialized: true, hasLocalVault: true, hasBinding: true, hasVaultAccess: true }), null)
})

test('setup password validation rejects short, long, or mismatched values', () => {
  assert.equal(validateSetupPassword('short', 'short'), 'length')
  assert.equal(validateSetupPassword('long'.repeat(17), 'long'.repeat(17)), 'length')
  assert.equal(validateSetupPassword('correct horse', 'correct Horse'), 'mismatch')
  assert.equal(validateSetupPassword('correct horse', 'correct horse'), null)
})

test('TOTP input accepts exactly six digits', () => {
  assert.equal(isSixDigitTotp('123456'), true)
  assert.equal(isSixDigitTotp('12345'), false)
  assert.equal(isSixDigitTotp('12 456'), false)
})
