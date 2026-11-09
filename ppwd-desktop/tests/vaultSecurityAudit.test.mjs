import assert from 'node:assert/strict'
import test from 'node:test'
import { auditVaultPasswords } from '../src/utils/vaultSecurityAudit.ts'

const entry = (id, passwordType, password) => ({ id, passwordType, content: { password } })

test('audit identifies short and reused login secrets without flagging long unique values', () => {
  const audit = auditVaultPasswords([
    entry('weak', '登录信息', 'short'),
    entry('reuse-a', '登录信息', 'a-unique-long-secret'),
    entry('reuse-b', '数据库', 'a-unique-long-secret'),
    entry('strong', '服务器', 'another-unique-secret'),
    entry('note', '安全备注', 'short')
  ])

  assert.equal(audit.checked, 4)
  assert.deepEqual([...audit.weakIds], ['weak'])
  assert.deepEqual([...audit.reusedIds], ['reuse-a', 'reuse-b'])
})

test('audit ignores empty secrets and non-credential entry types', () => {
  const audit = auditVaultPasswords([
    entry('empty', '登录信息', ''),
    entry('note', '安全备注', 'weak')
  ])

  assert.equal(audit.checked, 1)
  assert.equal(audit.weakIds.size, 0)
  assert.equal(audit.reusedIds.size, 0)
})
