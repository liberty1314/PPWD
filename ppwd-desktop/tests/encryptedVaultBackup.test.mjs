import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptVaultBackup,
  encryptVaultBackup
} from '../src/utils/encryptedVaultBackup.ts'

const snapshot = {
  version: 1,
  nextId: 2,
  entries: [{ id: 'entry-1', passwordType: '登录信息', content: { cipher: 'sealed' } }],
  favorites: [{ passwordId: 'entry-1', time: '2026-11-06T00:00:00.000Z' }],
  recentVisits: []
}

test('加密备份可往返恢复快照且不在文件中暴露条目内容', async () => {
  const backup = await encryptVaultBackup(snapshot, 'vault-fingerprint', 'correct-horse-battery-staple')
  assert.equal(backup.includes('sealed'), false)
  assert.deepEqual(
    await decryptVaultBackup(backup, 'vault-fingerprint', 'correct-horse-battery-staple'),
    snapshot
  )
})

test('拒绝错误密码、其他保险库和不受支持的格式', async () => {
  const backup = await encryptVaultBackup(snapshot, 'vault-fingerprint', 'correct-horse-battery-staple')
  await assert.rejects(
    decryptVaultBackup(backup, 'vault-fingerprint', 'wrong-password-value'),
    /backup\.decryptFailed/
  )
  await assert.rejects(
    decryptVaultBackup(backup, 'another-vault', 'correct-horse-battery-staple'),
    /backup\.wrongVault/
  )
  await assert.rejects(decryptVaultBackup('{}', 'vault-fingerprint', 'long-enough-password'), /backup\.invalidFormat/)
})

test('加密备份要求足够长的独立密码', async () => {
  await assert.rejects(encryptVaultBackup(snapshot, 'vault-fingerprint', 'short'), /backup\.passwordTooShort/)
})
