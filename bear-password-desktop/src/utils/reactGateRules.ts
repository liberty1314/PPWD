export interface ReactGateSnapshot {
  initialized?: boolean
  hasLocalVault?: boolean
  hasBinding?: boolean
  hasVaultAccess?: boolean
}

export function resolveReactGateRoute(snapshot: ReactGateSnapshot): '/setup' | '/bind' | '/unlock' | null {
  if (!snapshot.initialized) return null
  if (!snapshot.hasLocalVault) return '/setup'
  if (!snapshot.hasBinding) return '/bind'
  if (!snapshot.hasVaultAccess) return '/unlock'
  return null
}

export function validateSetupPassword(password: string, confirmation: string): 'length' | 'mismatch' | null {
  const length = password.trim().length
  if (length < 6 || length > 64) return 'length'
  if (password !== confirmation) return 'mismatch'
  return null
}

export function isSixDigitTotp(value: string): boolean {
  return /^\d{6}$/.test(value.trim())
}
