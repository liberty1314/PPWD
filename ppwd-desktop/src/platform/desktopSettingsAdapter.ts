import { useAuthStore } from '@/stores/auth'
import { decryptVaultBackup, encryptVaultBackup } from '@/utils/encryptedVaultBackup'
import type { OfflineVaultSnapshot } from '../../shared/offlineVault'

async function saveEncryptedSnapshot(snapshot: unknown, password: string): Promise<boolean> {
  const fingerprint = useAuthStore().status?.fingerprint
  if (!fingerprint) throw new Error('backup.unavailable')
  if (!window.fileApi?.saveEncryptedVaultBackup) throw new Error('backup.failed')
  const content = await encryptVaultBackup(snapshot as OfflineVaultSnapshot, fingerprint, password)
  const result = await window.fileApi.saveEncryptedVaultBackup({ content })
  return result.ok
}

export const desktopSettingsAdapter = {
  async exportEncryptedBackup(password: string): Promise<boolean> {
    if (!window.offlineVaultApi) throw new Error('backup.failed')
    return saveEncryptedSnapshot(await window.offlineVaultApi.readSnapshot(), password)
  },

  async importEncryptedBackup(password: string, confirmReplace: () => Promise<boolean>): Promise<'canceled' | 'saved' | 'imported'> {
    if (!window.fileApi?.pickEncryptedVaultBackup || !window.offlineVaultApi) throw new Error('backup.failed')
    const selected = await window.fileApi.pickEncryptedVaultBackup()
    if (!selected) return 'canceled'
    const fingerprint = useAuthStore().status?.fingerprint
    if (!fingerprint) throw new Error('backup.unavailable')
    const snapshot = await decryptVaultBackup(selected.content, fingerprint, password)
    if (!await confirmReplace()) return 'canceled'
    const saved = await saveEncryptedSnapshot(await window.offlineVaultApi.readSnapshot(), password)
    if (!saved) return 'saved'
    const result = await window.offlineVaultApi.importSnapshot(snapshot)
    if (!result.ok) throw new Error(result.error)
    return 'imported'
  },

  async deleteLocalVault(password: string, code: string): Promise<Awaited<ReturnType<NonNullable<Window['phoneTokenApi']>['destroy']>>> {
    if (!window.offlineVaultApi || !window.phoneTokenApi) throw new Error('backup.failed')
    const saved = await saveEncryptedSnapshot(await window.offlineVaultApi.readSnapshot(), password)
    if (!saved) return { ok: false, reason: 'unavailable' }
    const result = await window.phoneTokenApi.destroy(code, password)
    if (result.ok) await useAuthStore().refreshStatus()
    return result
  },

  async revealRecoveryKey(code: string, password: string): Promise<string | null> {
    if (!window.recoveryKeyApi) throw new Error('recoveryKey.readFailed')
    const authorized = await window.recoveryKeyApi.authorize(code, password)
    if (!authorized.ok) return null
    return window.recoveryKeyApi.get()
  }
}
