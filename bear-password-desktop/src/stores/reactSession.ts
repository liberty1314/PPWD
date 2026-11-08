import { create } from 'zustand'

export interface ReactSessionState {
  initialized: boolean
  hasLocalVault: boolean
  hasBinding: boolean
  hasVaultAccess: boolean
  isMigrating: boolean
  setSnapshot: (snapshot: Omit<ReactSessionState, 'setSnapshot'>) => void
}

export const useReactSessionStore = create<ReactSessionState>((set) => ({
  initialized: false,
  hasLocalVault: false,
  hasBinding: false,
  hasVaultAccess: false,
  isMigrating: false,
  setSnapshot: (snapshot) => set(snapshot)
}))
