import { computed, createStateStore, ref } from '@/stores/reactiveStore'
import { useSecurityStore } from '@/stores/security'
import { storage } from '@/utils/storage'

interface LocalVaultAuthStatus {
  available: boolean
  hasBinding: boolean
  hasLocalVault: boolean
  hasRecoveryKey: boolean
  fingerprint: string | null
  vaultSalt: string | null
  tokenVerifiedThisSession: boolean
  hasExistingData: boolean
}

/** 本地门禁状态；此 store 不持有账号、服务端 token 或凭据。 */
export const useAuthStore = createStateStore(() => {
  const status = ref<LocalVaultAuthStatus | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref('')

  const hasLocalVault = computed(() => status.value?.hasLocalVault === true)
  const hasPhoneTokenBinding = computed(() => status.value?.hasBinding === true)
  const hasRecoveryKey = computed(() => status.value?.hasRecoveryKey === true)
  const isUnlocked = computed(
    () => hasLocalVault.value && !useSecurityStore().isMigrating && useSecurityStore().hasVaultAccess
  )
  // 兼容部分已有的应用入口状态判断；不代表账号登录状态。
  const isLoggedIn = hasLocalVault

  async function refreshStatus(): Promise<LocalVaultAuthStatus> {
    if (!window.localVaultApi) throw new Error('本地保险库服务不可用')
    storage.remove('token')
    storage.remove('user')
    storage.remove('security_key')
    loading.value = true
    error.value = ''
    try {
      const nextStatus = await window.localVaultApi.getStatus()
      status.value = nextStatus
      initialized.value = true
      return nextStatus
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法读取本地保险库状态'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function createVault(masterPassword: string, recoveryKey: string): Promise<void> {
    const result = await window.localVaultApi!.create(masterPassword, recoveryKey)
    if (!result.ok) {
      const messages = {
        invalid: '主密码或恢复密钥格式无效',
        unavailable: '系统安全存储不可用，无法创建保险库',
        alreadyConfigured: '本地保险库已经创建',
        existingData: '当前数据目录包含已有数据，请先选择空目录'
      } as const
      throw new Error(messages[result.reason])
    }
    await refreshStatus()
  }

  async function applyUnlock(vukBase64: string): Promise<void> {
    const binary = atob(vukBase64)
    const vuk = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    useSecurityStore().applyVaultUnlock(vuk)
    await refreshStatus()
  }

  function clearUnlock(): void {
    useSecurityStore().unloadFromMemory()
  }

  return {
    status,
    initialized,
    loading,
    error,
    hasLocalVault,
    hasPhoneTokenBinding,
    hasRecoveryKey,
    isUnlocked,
    isLoggedIn,
    refreshStatus,
    createVault,
    applyUnlock,
    clearUnlock
  }
})
