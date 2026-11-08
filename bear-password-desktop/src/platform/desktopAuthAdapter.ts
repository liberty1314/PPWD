import { useAuthStore } from '@/stores/auth'
import { useAutoLockStore } from '@/stores/autoLock'
import { useSecurityStore } from '@/stores/security'
import { useReactSessionStore } from '@/stores/reactSession'
import { computeSecretKeyFingerprint } from '@/utils/vaultCrypto/vaultKeyDerivation'
import { buildEmergencyKitFileContent, buildEmergencyKitFileName } from '@/utils/vaultCrypto/emergencyKit'
function updateSession(): void {
  const auth = useAuthStore()
  const security = useSecurityStore()
  useReactSessionStore.getState().setSnapshot({
    initialized: auth.initialized && security.initialized,
    hasLocalVault: auth.hasLocalVault,
    hasBinding: auth.hasPhoneTokenBinding,
    hasVaultAccess: security.hasVaultAccess && !security.isMigrating,
    isMigrating: security.isMigrating
  })
}

export const desktopAuthAdapter = {
  updateSession,

  subscribeSession(listener: () => void): () => void {
    const auth = useAuthStore()
    const security = useSecurityStore()
    const unsubscribeAuth = auth.subscribe(listener)
    const unsubscribeSecurity = security.subscribe(listener)
    return () => {
      unsubscribeAuth()
      unsubscribeSecurity()
    }
  },

  async refreshStatus(): Promise<void> {
    await useAuthStore().refreshStatus()
    await useSecurityStore().init()
    updateSession()
  },

  async createVault(masterPassword: string, recoveryKey: string): Promise<void> {
    await useAuthStore().createVault(masterPassword, recoveryKey)
    updateSession()
  },

  async verifyTotp(code: string): Promise<Awaited<ReturnType<NonNullable<Window['phoneTokenApi']>['verify']>>> {
    if (!window.phoneTokenApi) throw new Error('本地验证服务不可用')
    const result = await window.phoneTokenApi.verify(code)
    if (result.ok) await this.applyUnlock(result.vuk)
    return result
  },

  async unlockBiometric(reason: string): Promise<{ ok: true; vuk: string } | { ok: false; reason: 'canceled' | 'unavailable' }> {
    if (!window.localVaultApi) throw new Error('本地保险库服务不可用')
    const result = await window.localVaultApi.biometricUnlock(reason)
    if (result.ok) await this.applyUnlock(result.vuk)
    return result
  },

  async applyUnlock(vuk: string): Promise<void> {
    await useAuthStore().applyUnlock(vuk)
    useAutoLockStore().unlock()
    updateSession()
  },

  async recover(masterPassword: string, recoveryKey: string): Promise<Awaited<ReturnType<NonNullable<Window['phoneTokenApi']>['recover']>>> {
    if (!window.phoneTokenApi) throw new Error('本地验证服务不可用')
    const result = await window.phoneTokenApi.recover(masterPassword, recoveryKey)
    await useAuthStore().refreshStatus()
    updateSession()
    return result
  },

  async bindPhoneToken(secret: string, code: string, masterPassword: string): Promise<Awaited<ReturnType<NonNullable<Window['phoneTokenApi']>['set']>>> {
    if (!window.phoneTokenApi) throw new Error('本地验证服务不可用')
    const result = await window.phoneTokenApi.set(secret, code, masterPassword)
    if (result.ok) await this.applyUnlock(result.vuk)
    else await useAuthStore().refreshStatus()
    updateSession()
    return result
  },

  async rebindPhoneToken(code: string, masterPassword: string): Promise<Awaited<ReturnType<NonNullable<Window['phoneTokenApi']>['rebind']>>> {
    if (!window.phoneTokenApi) throw new Error('本地验证服务不可用')
    const result = await window.phoneTokenApi.rebind(code, masterPassword)
    await useAuthStore().refreshStatus()
    updateSession()
    return result
  },

  async getRecoveryStatus(): Promise<{ hasRecoveryKey: boolean; fingerprint: string | null }> {
    const status = await window.localVaultApi?.getStatus()
    return { hasRecoveryKey: status?.hasRecoveryKey === true, fingerprint: status?.fingerprint ?? null }
  },

  async getLocalVaultAvailability(): Promise<boolean> {
    return (await window.localVaultApi?.getStatus())?.available === true
  },

  async fingerprintRecoveryKey(recoveryKey: string): Promise<string> {
    return computeSecretKeyFingerprint(recoveryKey)
  },

  async saveEmergencyKit(recoveryKey: string, fingerprint: string): Promise<boolean> {
    if (!window.fileApi?.saveSecurityKeyBackup) return false
    const result = await window.fileApi.saveSecurityKeyBackup({
      defaultFileName: buildEmergencyKitFileName(),
      content: buildEmergencyKitFileContent({
        version: 2,
        recoveryKey,
        secretKeyFingerprint: fingerprint,
        createdAt: new Date().toISOString()
      })
    })
    return result.ok
  },

  async chooseEmptyDataDirectory(): Promise<boolean> {
    if (!window.offlineVaultApi?.pickEmptyDataDir) return false
    const result = await window.offlineVaultApi.pickEmptyDataDir()
    return result?.ok === true
  },

  async getBiometricAvailability() {
    if (!window.biometricApi) return { available: false, kind: null, unavailableReason: 'notSupported' as const }
    return window.biometricApi.getAvailability()
  },

  async hasStoredBiometricPassword(): Promise<boolean> {
    return (await window.vaultPasswordApi?.has()) === true
  }
}
