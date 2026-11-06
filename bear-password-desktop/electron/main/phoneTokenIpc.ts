import { ipcMain } from 'electron'
import { loadOfflineVaultSettings } from './offlineVaultConfig'
import { readOfflineVaultSnapshot } from './offlineVaultStorage'
import { hasStoredRecoveryKey, loadStoredRecoveryKey } from './recoveryKeyStorage'
import { promptBiometricUnlock } from './biometricAuth'
import { loadStoredVaultUnlockKey } from './vaultUnlockKeyStorage'
import {
  bindPhoneToken,
  authorizeRecoveryKeyRead,
  consumeRecoveryKeyReadAuthorization,
  getPhoneTokenStatus,
  initializeLocalVault,
  recoverPhoneToken,
  rebindPhoneToken,
  unlockWithPhoneToken
} from './phoneTokenStorage'

function hasExistingVaultData(): boolean {
  try {
    const settings = loadOfflineVaultSettings()
    const snapshot = readOfflineVaultSnapshot(settings.dataDir)
    return snapshot.entries.length > 0 || snapshot.favorites.length > 0 || snapshot.recentVisits.length > 0
  } catch {
    return true
  }
}

export function registerPhoneTokenIpc(): void {
  ipcMain.handle('local-vault:getStatus', async () => ({
    ...await getPhoneTokenStatus(),
    hasExistingData: hasExistingVaultData()
  }))
  ipcMain.handle('local-vault:biometricUnlock', async (_event, reason: unknown) => {
    const prompted = await promptBiometricUnlock(typeof reason === 'string' ? reason : '')
    if (!prompted.ok) return { ok: false as const, reason: prompted.canceled ? 'canceled' as const : 'unavailable' as const }
    try {
      const vuk = await loadStoredVaultUnlockKey()
      if (!vuk) return { ok: false as const, reason: 'unavailable' as const }
      return { ok: true as const, vuk: vuk.toString('base64') }
    } catch {
      return { ok: false as const, reason: 'unavailable' as const }
    }
  })

  ipcMain.handle('local-vault:create', async (_event, masterPassword: unknown, recoveryKey: unknown) => {
    if (typeof masterPassword !== 'string' || typeof recoveryKey !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    try {
      return await initializeLocalVault(masterPassword, recoveryKey, hasExistingVaultData())
    } catch {
      return { ok: false as const, reason: 'existingData' as const }
    }
  })

  ipcMain.handle('phone-token:isAvailable', async () => (await getPhoneTokenStatus()).available)
  ipcMain.handle('phone-token:has', async () => (await getPhoneTokenStatus()).hasBinding)
  ipcMain.handle('phone-token:set', async (_event, secret: unknown, code: unknown, password: unknown) => {
    if (typeof secret !== 'string' || typeof code !== 'string' || typeof password !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    return bindPhoneToken(secret, code, password)
  })
  ipcMain.handle('phone-token:verify', async (_event, code: unknown) => {
    if (typeof code !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    return unlockWithPhoneToken(code)
  })
  ipcMain.handle('recovery-key:authorize', async (_event, code: unknown, password: unknown) => {
    if (typeof code !== 'string' || typeof password !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    return authorizeRecoveryKeyRead(code, password)
  })
  ipcMain.handle('phone-token:rebind', async (_event, code: unknown, password: unknown) => {
    if (typeof code !== 'string' || typeof password !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    return rebindPhoneToken(code, password)
  })
  ipcMain.handle('phone-token:recover', async (_event, password: unknown, recoveryKey: unknown) => {
    if (typeof password !== 'string' || typeof recoveryKey !== 'string') {
      return { ok: false as const, reason: 'invalid' as const }
    }
    return recoverPhoneToken(password, recoveryKey)
  })
  ipcMain.handle('recovery-key:has', () => hasStoredRecoveryKey())
  ipcMain.handle('recovery-key:get', () => {
    if (!consumeRecoveryKeyReadAuthorization()) return null
    return loadStoredRecoveryKey()
  })
}
