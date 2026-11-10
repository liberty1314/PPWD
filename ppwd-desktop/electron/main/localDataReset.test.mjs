import assert from 'node:assert/strict'
import test from 'node:test'
import { cpSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { completePendingLocalDataReset, getExternalDataFiles, hashLocalDataFile, hashLocalDataTree } from './localDataResetCore.ts'

function makeTempDir() {
  return realpathSync(mkdtempSync(join(tmpdir(), 'ppwd-local-reset-')))
}

test('内置保险库由应用数据目录覆盖，不作为外置文件单独删除', () => {
  const root = makeTempDir()
  try {
    const appData = join(root, 'app-data')
    const current = join(appData, 'PPWD')
    const dataDir = join(current, 'offline-vault')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(current, 'offline-vault-settings.json'), JSON.stringify({ dataDir }))
    writeFileSync(join(dataDir, 'vault-data.json'), '{}')

    assert.deepEqual(getExternalDataFiles([current], current, join(appData, 'BearPassword')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('外置保险库路径从当前和旧版设置读取且去重', () => {
  const root = makeTempDir()
  try {
    const appData = join(root, 'app-data')
    const current = join(appData, 'PPWD')
    const legacy = join(appData, 'BearPassword')
    const dataDir = join(root, 'external-vault')
    mkdirSync(current, { recursive: true })
    mkdirSync(legacy, { recursive: true })
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(current, 'offline-vault-settings.json'), JSON.stringify({ dataDir }))
    writeFileSync(join(legacy, 'offline-vault-settings.json'), JSON.stringify({ dataDir }))
    const dataFile = join(dataDir, 'vault-data.json')
    writeFileSync(dataFile, '{}')

    assert.deepEqual(getExternalDataFiles([current, legacy], current, legacy), [join(realpathSync(dataDir), 'vault-data.json')])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('备份校验失败时保留原应用数据和重置标记', () => {
  const root = makeTempDir()
  try {
    const appData = join(root, 'app-data')
    const current = join(appData, 'PPWD')
    const legacy = join(appData, 'BearPassword')
    const backup = join(root, 'PPWD-reset-backup-test')
    const markerPath = join(appData, '.ppwd-reset-pending.json')
    mkdirSync(join(current, 'offline-vault'), { recursive: true })
    mkdirSync(backup, { recursive: true })
    mkdirSync(join(backup, 'PPWD'), { recursive: true })
    writeFileSync(join(current, 'sentinel.txt'), 'keep')
    writeFileSync(join(backup, 'PPWD', 'sentinel.txt'), 'incomplete')
    writeFileSync(markerPath, JSON.stringify({
      version: 1,
      backupPath: backup,
      appData: { PPWD: '0'.repeat(64), BearPassword: null },
      externalDataFiles: []
    }))

    assert.throws(() => completePendingLocalDataReset(markerPath, appData, current, legacy), /备份校验失败/)
    assert.equal(readFileSync(join(current, 'sentinel.txt'), 'utf8'), 'keep')
    assert.equal(existsSync(markerPath), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('有效备份通过校验后清理本机数据和外置保险库并保留备份', () => {
  const root = makeTempDir()
  try {
    const appData = join(root, 'app-data')
    const current = join(appData, 'PPWD')
    const legacy = join(appData, 'BearPassword')
    const externalDir = join(root, 'external-vault')
    const externalFile = join(externalDir, 'vault-data.json')
    const backup = join(root, 'PPWD-reset-backup-test')
    const markerPath = join(appData, '.ppwd-reset-pending.json')
    mkdirSync(current, { recursive: true })
    mkdirSync(externalDir, { recursive: true })
    mkdirSync(join(backup, 'external-vault', '1'), { recursive: true })
    writeFileSync(join(current, 'offline-vault-settings.json'), JSON.stringify({ dataDir: externalDir }))
    writeFileSync(join(current, 'profile.json'), '{"account":"test"}')
    writeFileSync(externalFile, '{"entries":[{"id":"1"}]}')
    cpSync(current, join(backup, 'PPWD'), { recursive: true })
    cpSync(externalFile, join(backup, 'external-vault', '1', 'vault-data.json'))
    const externalDataFiles = [{ path: join(realpathSync(externalDir), 'vault-data.json'), sha256: hashLocalDataFile(externalFile) }]
    writeFileSync(join(backup, 'external-vault', 'manifest.json'), JSON.stringify(externalDataFiles))
    writeFileSync(markerPath, JSON.stringify({
      version: 1,
      backupPath: backup,
      appData: { PPWD: hashLocalDataTree(current), BearPassword: null },
      externalDataFiles
    }))

    completePendingLocalDataReset(markerPath, appData, current, legacy)
    assert.equal(existsSync(markerPath), false)
    assert.equal(existsSync(current), false)
    assert.equal(existsSync(legacy), false)
    assert.equal(existsSync(externalFile), false)
    assert.equal(readFileSync(join(backup, 'PPWD', 'profile.json'), 'utf8'), '{"account":"test"}')
    assert.equal(existsSync(join(backup, 'external-vault', '1', 'vault-data.json')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
