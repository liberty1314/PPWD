import { useSecurityStore } from '@/stores/security'

/** UI state adapter: keep Pinia access outside framework-independent vault transforms. */
export function getVaultUnlockContext() {
  return useSecurityStore().getUnlockContext()
}
