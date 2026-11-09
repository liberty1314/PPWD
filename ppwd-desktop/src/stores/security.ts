import { computed, createStateStore, ref } from '@/stores/reactiveStore'
import type { VaultUnlockContext } from '@/utils/contentCrypto'
import type { SecurityKeyReencryptProgress } from '@/utils/securityKeyReencrypt'

const defaultMigrationProgress = (): SecurityKeyReencryptProgress => ({
  current: 0,
  total: 0,
  message: ''
})

/** 保留 VUK 仅在内存中的约束；恢复密钥始终由主进程持有。 */
export const useSecurityStore = createStateStore(() => {
  const vuk = ref<Uint8Array | null>(null)
  const vaultSalt = ref<string | null>(null)
  const secretKeyFingerprint = ref<string | null>(null)
  const initialized = ref(false)
  const isMigrating = ref(false)
  const migrationProgress = ref<SecurityKeyReencryptProgress>(defaultMigrationProgress())
  const hasPersistedSecurityKey = ref(false)
  const isVaultConfigured = computed(() => initialized.value && !!vaultSalt.value)
  const hasVaultAccess = computed(() => !!vuk.value)
  const hasSecurityKey = computed(() => hasPersistedSecurityKey.value)
  const needsVaultUnlock = computed(() => isVaultConfigured.value && !hasVaultAccess.value)
  const needsVaultSetup = computed(() => !isVaultConfigured.value)
  const canUseVaultLock = computed(() => isVaultConfigured.value && hasPersistedSecurityKey.value)

  async function init(): Promise<void> {
    if (!window.localVaultApi) {
      initialized.value = true
      return
    }
    const status = await window.localVaultApi.getStatus()
    hasPersistedSecurityKey.value = status.hasRecoveryKey
    vaultSalt.value = status.vaultSalt
    secretKeyFingerprint.value = status.fingerprint
    initialized.value = true
  }

  async function reloadFromStorage(): Promise<void> {
    await init()
    vuk.value = null
  }

  function getUnlockContext(): VaultUnlockContext | null {
    return vuk.value ? { vuk: vuk.value } : null
  }

  function applyVaultUnlock(nextVuk: Uint8Array): void {
    vuk.value = nextVuk
  }

  function unloadFromMemory(): void {
    vuk.value?.fill(0)
    vuk.value = null
  }

  function syncVaultCryptoMeta(meta: {
    vaultSalt?: string | null
    secretKeyFingerprint?: string | null
    vault_salt?: string | null
    secret_key_fingerprint?: string | null
  }): void {
    vaultSalt.value = meta.vaultSalt ?? meta.vault_salt ?? vaultSalt.value
    secretKeyFingerprint.value =
      meta.secretKeyFingerprint ?? meta.secret_key_fingerprint ?? secretKeyFingerprint.value
  }

  async function refreshVaultCryptoMeta(): Promise<void> {
    await init()
  }

  async function ensureVaultCryptoMeta(): Promise<void> {
    await init()
    if (!vaultSalt.value) throw new Error('本地保险库安全配置无法读取')
  }

  function beginMigration(message = '正在处理…'): void {
    isMigrating.value = true
    migrationProgress.value = { current: 0, total: 0, message }
  }

  function updateMigrationProgress(progress: SecurityKeyReencryptProgress): void {
    migrationProgress.value = progress
  }

  function endMigration(): void {
    isMigrating.value = false
    migrationProgress.value = defaultMigrationProgress()
  }

  return {
    // compatibility fields: no recovery key material is exposed to the renderer.
    securityKey: computed(() => null as string | null),
    vuk,
    vaultSalt,
    secretKeyFingerprint,
    initialized,
    hasSecurityKey,
    hasVaultAccess,
    hasPersistedSecurityKey,
    isVaultConfigured,
    needsVaultUnlock,
    needsVaultSetup,
    canUseVaultLock,
    isMigrating,
    migrationProgress,
    init,
    reloadFromStorage,
    unloadFromMemory,
    applyVaultUnlock,
    getUnlockContext,
    syncVaultCryptoMeta,
    refreshVaultCryptoMeta,
    ensureVaultCryptoMeta,
    beginMigration,
    updateMigrationProgress,
    endMigration
  }
})
