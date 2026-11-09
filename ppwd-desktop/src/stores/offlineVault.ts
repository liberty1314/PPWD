import { createStateStore, ref } from '@/stores/reactiveStore'
import type { OfflineVaultSettings, OfflineVaultSnapshot } from '../../shared/offlineVault'
import { mergeOfflineVaultSnapshots } from '../../shared/offlineVault'
import { isLocalVaultApiAvailable } from '@/utils/localVault'
import { useVaultStore } from '@/stores/vault'

export const useOfflineVaultStore = createStateStore(() => {
  const dataDir = ref('')
  const defaultDataDir = ref('')
  const initialized = ref(false)
  const saving = ref(false)

  function applySettings(settings: OfflineVaultSettings): void {
    dataDir.value = settings.dataDir
  }

  async function loadSettings(): Promise<void> {
    if (!isLocalVaultApiAvailable()) {
      initialized.value = true
      return
    }

    const [settings, defaultDir] = await Promise.all([
      window.offlineVaultApi!.getSettings(),
      window.offlineVaultApi!.getDefaultDataDir()
    ])

    defaultDataDir.value = defaultDir
    applySettings(settings)
    initialized.value = true
  }

  async function persistSettings(partial: Partial<OfflineVaultSettings>): Promise<boolean> {
    if (!isLocalVaultApiAvailable()) return false

    saving.value = true
    try {
      const result = await window.offlineVaultApi!.setSettings(partial)
      if (!result.ok) return false
      applySettings(result.settings)
      return true
    } finally {
      saving.value = false
    }
  }

  async function pickDataDir(): Promise<string | null> {
    if (!isLocalVaultApiAvailable()) return null
    return window.offlineVaultApi!.pickDataDir(dataDir.value || defaultDataDir.value)
  }

  async function setDataDir(nextDir: string): Promise<boolean> {
    const trimmed = nextDir.trim()
    if (!trimmed) return false
    if (dataDir.value === trimmed) return true

    const previousDir = dataDir.value
    saving.value = true
    try {
      const currentSnapshot = (await window.offlineVaultApi!.readSnapshot()) as OfflineVaultSnapshot
      const switched = await window.offlineVaultApi!.setSettings({ dataDir: trimmed })
      if (!switched.ok) return false
      applySettings(switched.settings)

      const destinationSnapshot = (await window.offlineVaultApi!.readSnapshot()) as OfflineVaultSnapshot
      const mergedSnapshot = mergeOfflineVaultSnapshots(currentSnapshot, destinationSnapshot)
      const result = await window.offlineVaultApi!.importSnapshot(mergedSnapshot)
      if (!result.ok) {
        if (previousDir) await persistSettings({ dataDir: previousDir })
        return false
      }

      const vaultStore = useVaultStore()
      vaultStore.reset()
      await vaultStore.refresh()
      return true
    } catch {
      if (previousDir) await persistSettings({ dataDir: previousDir })
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    dataDir,
    defaultDataDir,
    initialized,
    saving,
    loadSettings,
    pickDataDir,
    setDataDir
  }
})
