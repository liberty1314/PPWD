import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { StoreGeneric } from './stores/reactiveStore'
import { useStoreSnapshot } from './stores/reactiveStore'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Eye, EyeOff, Fingerprint, FolderOpen, HardDrive, KeyRound, Keyboard, Palette, RotateCcw, Shield, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useAppStore } from './stores/app'
import { useAutoLockStore } from './stores/autoLock'
import { useAuthStore } from './stores/auth'
import { useBiometricUnlockStore } from './stores/biometricUnlock'
import { useClipboardClearStore } from './stores/clipboardClear'
import { useDockStore } from './stores/dock'
import { useLaunchAtLoginStore } from './stores/launchAtLogin'
import { useOfflineVaultStore } from './stores/offlineVault'
import { useSecurityStore } from './stores/security'
import { useShortcutsStore } from './stores/shortcuts'
import { useTrayStore } from './stores/tray'
import { desktopAuthAdapter } from './platform/desktopAuthAdapter'
import { desktopSettingsAdapter } from './platform/desktopSettingsAdapter'
import { useDesktopLocale } from './ui/useDesktopLocale'
import { useReactThemeStore } from './stores/reactTheme'
import type { AccentColor, AppearanceMode } from '../../shared/ui/themeTypes'
import { Button, Dialog, DialogClose, DialogContent, SelectField, TextField, useToast } from './ui/primitives'
import { AnimatedTabs } from './components/ui/AnimatedTabs'
import { OtpInput } from './components/ui/OtpInput'
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from './types/autoLock'
import { CLIPBOARD_CLEAR_OPTIONS, type ClipboardClearSeconds } from './types/clipboardClear'
import { SHORTCUT_ACTION_OPTIONS, type ShortcutActionId } from './types/shortcut'
import type { TrayClickAction } from './types/tray'
import { LOCALE_PREFERENCE_OPTIONS } from './utils/localePreference'
import { FONT_OPTIONS } from './utils/font'
import { formatAccelerator, keyboardEventToAccelerator } from './utils/shortcut'
import { normalizeAcceleratorString } from '../shared/acceleratorMatch'
import { persistVaultPassword } from './utils/vaultPasswordStorage'
import { LocalDataReset } from './components/LocalDataReset'
const SETTINGS_SECTIONS = ['general', 'appearance', 'security', 'shortcuts', 'backup'] as const
type SettingsSection = typeof SETTINGS_SECTIONS[number]

function useStoreUpdates(stores: StoreGeneric[], onMount?: () => void): void {
  const [, update] = useReducer((revision: number) => revision + 1, 0)
  useEffect(() => {
    const unsubscribe = stores.map((store) => store.subscribe(() => update()))
    onMount?.()
    return () => unsubscribe.forEach((stop) => stop())
  }, [])
}

function ToggleRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <div className="react-setting-row react-setting-row--toggle"><div className="react-setting-row__copy"><h2>{title}</h2><p>{description}</p></div><input className="react-toggle" type="checkbox" role="switch" aria-label={title} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></div>
}

function ShortcutRecorder({ action, value, disabled, onSave }: { action: ShortcutActionId; value: string | null; disabled: boolean; onSave: (value: string | null) => Promise<void> }) {
  const { translate } = useDesktopLocale()
  const [recording, setRecording] = useState(false)
  const [platform, setPlatform] = useState<NodeJS.Platform>()
  useEffect(() => { void import('./platform/desktopThemeAdapter').then(({ desktopThemeAdapter }) => desktopThemeAdapter.getPlatform().then((value) => setPlatform(value === 'unknown' ? undefined : value))) }, [])

  function handleKey(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!recording) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') { setRecording(false); return }
    if (event.key === 'Backspace' || event.key === 'Delete') { setRecording(false); void onSave(null); return }
    const accelerator = keyboardEventToAccelerator(event.nativeEvent)
    if (!accelerator) return
    setRecording(false)
    void onSave(normalizeAcceleratorString(accelerator))
  }

  return <span className="react-shortcut-control"><button className={`react-shortcut-recorder ${recording ? 'is-recording' : ''}`} type="button" disabled={disabled} onClick={() => setRecording(true)} onKeyDown={handleKey} onBlur={() => setRecording(false)} aria-label={translate(`shortcut.${action}`)}>{recording ? translate('settings.shortcuts.recording') : value ? formatAccelerator(value, platform) : '—'}</button>{recording && <small role="status">{translate('settings.shortcuts.recordingHint')}</small>}</span>
}

export function SettingsPage() {
  const { section: rawSection = 'general' } = useParams<{ section?: string }>()
  const section: SettingsSection = SETTINGS_SECTIONS.includes(rawSection as SettingsSection) ? rawSection as SettingsSection : 'general'
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()
  const toast = useToast()
  const app = useAppStore()
  const auth = useAuthStore()
  const autoLock = useAutoLockStore()
  const security = useSecurityStore()
  const clipboard = useClipboardClearStore()
  const biometric = useBiometricUnlockStore()
  const shortcuts = useShortcutsStore()
  const launchAtLogin = useLaunchAtLoginStore()
  const tray = useTrayStore()
  const dock = useDockStore()
  const offline = useOfflineVaultStore()
  const theme = useReactThemeStore()
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricPromptOpen, setBiometricPromptOpen] = useState(false)
  const [biometricPassword, setBiometricPassword] = useState('')
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [shortcutBusy, setShortcutBusy] = useState<ShortcutActionId | null>(null)
  const [shortcutWarning, setShortcutWarning] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState('')
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const restoreConfirm = useRef<((confirmed: boolean) => void) | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteCode, setDeleteCode] = useState('')
  const [rebindPassword, setRebindPassword] = useState('')
  const [rebindCode, setRebindCode] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [showFingerprint, setShowFingerprint] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securityBusy, setSecurityBusy] = useState(false)
  const [selectedDataDir, setSelectedDataDir] = useState('')
  const [directoryDialogOpen, setDirectoryDialogOpen] = useState(false)

  useStoreSnapshot(useAppStore)
  useStoreSnapshot(useAuthStore)
  useStoreSnapshot(useAutoLockStore)
  useStoreSnapshot(useSecurityStore)
  useStoreSnapshot(useClipboardClearStore)
  useStoreSnapshot(useBiometricUnlockStore)
  useStoreSnapshot(useShortcutsStore)
  useStoreSnapshot(useLaunchAtLoginStore)
  useStoreSnapshot(useTrayStore)
  useStoreSnapshot(useDockStore)
  useStoreSnapshot(useOfflineVaultStore)
  useStoreUpdates([app, auth, autoLock, security, clipboard, biometric, shortcuts, launchAtLogin, tray, dock, offline], () => {
    void launchAtLogin.refresh()
    void tray.refresh()
    void dock.refresh()
    void shortcuts.syncToMain()
    if (!offline.initialized) void offline.loadSettings()
    void desktopAuthAdapter.getBiometricAvailability().then((availability) => setBiometricSupported(availability.available)).catch(() => setBiometricSupported(false))
  })

  useEffect(() => () => {
    setBiometricPassword('')
    setBackupPassword('')
    setDeletePassword('')
    setDeleteCode('')
    setRebindPassword('')
    setRebindCode('')
    setRecoveryPassword('')
    setRecoveryCode('')
    setRecoveryKey('')
  }, [])

  useEffect(() => {
    if (section !== 'security') {
      setRebindPassword('')
      setRebindCode('')
      setRecoveryPassword('')
      setRecoveryCode('')
      setRecoveryKey('')
      setShowFingerprint(false)
      setSecurityError('')
    }
  }, [section])

  const settingTabs: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
    { id: 'general', label: translate('settings.general'), icon: <SlidersHorizontal size={16} /> },
    { id: 'appearance', label: translate('settings.appearance'), icon: <Palette size={16} /> },
    { id: 'security', label: translate('settings.security'), icon: <Shield size={16} /> },
    { id: 'shortcuts', label: translate('settings.shortcuts'), icon: <Keyboard size={16} /> },
    { id: 'backup', label: translate('backup.title'), icon: <HardDrive size={16} /> }
  ]

  async function updateTrayEnabled(enabled: boolean): Promise<void> {
    if (!enabled && dock.hidden) {
      toast(translate('settings.trayRequiredForDock'))
      return
    }
    const result = await tray.updateSettings({ enabled })
    if (result.ok) toast(translate(enabled ? 'msg.trayOn' : 'msg.trayOff'))
    else toast(result.error === 'settings.trayRequiredForDock' ? translate(result.error) : result.error ?? translate('common.settingsFailed'))
  }

  async function updateDockHidden(hidden: boolean): Promise<void> {
    let enabledTrayForReopen = false
    if (hidden && !tray.enabled) {
      const trayResult = await tray.updateSettings({ enabled: true })
      if (!trayResult.ok) {
        toast(trayResult.error === 'settings.trayRequiredForDock' ? translate(trayResult.error) : trayResult.error ?? translate('common.settingsFailed'))
        return
      }
      enabledTrayForReopen = true
    }

    const result = await dock.setHidden(hidden)
    if (result.ok) return
    if (enabledTrayForReopen) await tray.updateSettings({ enabled: false })
    toast(result.error === 'settings.trayRequiredForDock' ? translate(result.error) : result.error ?? translate('common.settingsFailed'))
  }

  async function enableBiometric(): Promise<void> {
    if (biometricBusy) return
    setBiometricBusy(true)
    setSecurityError('')
    try {
      const persisted = await persistVaultPassword(biometricPassword)
      if (!persisted.ok) throw new Error(persisted.error || translate('settings.biometricEnableFailed'))
      biometric.setPreferBiometricUnlock(true)
      setBiometricPassword('')
      setBiometricPromptOpen(false)
      toast(translate('settings.preferBiometricUnlock'))
    } catch (cause) {
      setSecurityError(cause instanceof Error ? cause.message : translate('settings.biometricEnableFailed'))
    } finally {
      setBiometricBusy(false)
    }
  }

  async function rebindToken(): Promise<void> {
    if (securityBusy) return
    setSecurityBusy(true)
    setSecurityError('')
    try {
      const result = await desktopAuthAdapter.rebindPhoneToken(rebindCode, rebindPassword)
      if (!result.ok) {
        setSecurityError(result.reason === 'unavailable' ? translate('phoneToken.storageUnavailable') : result.reason === 'locked' ? translate('phoneToken.locked') : translate('phoneToken.verificationFailed'))
        setRebindCode('')
        return
      }
      setRebindPassword('')
      setRebindCode('')
      navigate('/bind?rebind=1')
    } catch {
      setSecurityError(translate('phoneToken.rebindFailed'))
    } finally {
      setSecurityBusy(false)
    }
  }

  async function revealKey(): Promise<void> {
    if (securityBusy) return
    setSecurityBusy(true)
    setSecurityError('')
    try {
      const key = await desktopSettingsAdapter.revealRecoveryKey(recoveryCode, recoveryPassword)
      if (!key) {
        setSecurityError(translate('phoneToken.verificationFailed'))
        setRecoveryCode('')
        return
      }
      setRecoveryKey(key)
      setRecoveryCode('')
      setRecoveryPassword('')
    } catch {
      setSecurityError(translate('recoveryKey.readFailed'))
    } finally {
      setSecurityBusy(false)
    }
  }

  async function copyRecoveryKey(): Promise<void> {
    if (!recoveryKey) return
    try {
      await navigator.clipboard.writeText(recoveryKey)
      toast(translate('recoveryKey.copied'))
    } catch {
      setSecurityError(translate('recoveryKey.copyFailed'))
    }
  }

  async function exportBackup(): Promise<void> {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupError('')
    try {
      if (await desktopSettingsAdapter.exportEncryptedBackup(backupPassword)) toast(translate('backup.exported'))
    } catch (cause) {
      setBackupError(localizedError(cause, translate, 'backup.failed'))
    } finally {
      setBackupBusy(false)
    }
  }

  async function importBackup(): Promise<void> {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupError('')
    try {
      const result = await desktopSettingsAdapter.importEncryptedBackup(backupPassword, () => new Promise<boolean>((resolve) => {
        restoreConfirm.current = resolve
        setRestoreDialogOpen(true)
      }))
      if (result === 'imported') {
        toast(translate('backup.imported'))
        window.location.reload()
      }
    } catch (cause) {
      setBackupError(localizedError(cause, translate, 'backup.failed'))
    } finally {
      setBackupBusy(false)
    }
  }

  async function deleteLocalVault(): Promise<void> {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupError('')
    try {
      const result = await desktopSettingsAdapter.deleteLocalVault(deletePassword, deleteCode)
      if (!result.ok) {
        setBackupError(result.reason === 'unavailable' ? translate('phoneToken.storageUnavailable') : result.reason === 'locked' ? translate('phoneToken.locked') : translate('phoneToken.verificationFailed'))
        return
      }
      setDeletePassword('')
      setDeleteCode('')
      window.location.reload()
    } catch (cause) {
      setBackupError(localizedError(cause, translate, 'backup.failed'))
    } finally {
      setBackupBusy(false)
    }
  }

  function requestDirectoryChange(): void {
    void offline.pickDataDir().then((directory) => {
      if (!directory || directory === offline.dataDir) return
      setSelectedDataDir(directory)
      setDirectoryDialogOpen(true)
    }).catch(() => setSecurityError(translate('settings.offlineDataDirSaveFailed')))
  }

  async function confirmDirectoryChange(): Promise<void> {
    const success = await offline.setDataDir(selectedDataDir)
    setDirectoryDialogOpen(false)
    if (success) toast(translate('settings.offlineDataDirSaved'))
    else setSecurityError(translate('settings.offlineDataDirSaveFailed'))
  }

  async function saveShortcut(action: ShortcutActionId, value: string | null): Promise<void> {
    setShortcutBusy(action)
    setShortcutWarning('')
    try {
      const result = await shortcuts.setAccelerator(action, value)
      if (!result.ok) setShortcutWarning(result.failed?.[action] ?? translate('msg.shortcutSetFailed'))
      else if (result.failed?.[action]) setShortcutWarning(result.failed[action] ?? '')
      else toast(translate('msg.shortcutUpdated'))
    } catch {
      setShortcutWarning(translate('settings.shortcuts.openFailed'))
    } finally {
      setShortcutBusy(null)
    }
  }

  const currentSection = settingTabs.find((item) => item.id === section)

  return <main className="react-page react-settings-page">
    <header className="react-page__header"><div><p className="react-eyebrow">{translate('settings.title')}</p><h1>{currentSection?.label}</h1><p className="react-page__description">{translate('settings.subtitle')}</p></div></header>
    <AnimatedTabs
      className="react-settings-tabs-root"
      tabs={settingTabs}
      activeTab={section}
      onChange={(id) => navigate(`/settings/${id}`)}
      renderContent={false}
      tabsContainerClassName="react-settings-tabs"
    />
    <div className="react-settings-content">

    {section === 'general' && <section className="react-settings" aria-label={translate('settings.general')}>
      <section className="react-setting-group" aria-label={translate('settings.groupStartup')}><h2>{translate('settings.groupStartup')}</h2>
      <ToggleRow title={translate('settings.launchAtLogin')} description={translate('settings.launchAtLoginDesc')} checked={launchAtLogin.enabled} disabled={!launchAtLogin.available || launchAtLogin.loading} onChange={async (enabled) => { const result = await launchAtLogin.setEnabled(enabled); if (result.ok) toast(translate(enabled ? 'msg.launchAtLoginOn' : 'msg.launchAtLoginOff')); else toast(result.error ?? translate('common.settingsFailed')) }} />
      <ToggleRow title={translate('settings.tray')} description={translate('settings.trayDesc')} checked={tray.enabled} disabled={!tray.available || tray.loading} onChange={updateTrayEnabled} />
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.trayClickAction')}</h2><p>{translate('settings.trayClickActionDesc')}</p></div><SelectField label={translate('settings.trayClickAction')} labelHidden id="tray-click-action" value={tray.clickAction} onValueChange={(value) => void tray.updateSettings({ clickAction: value as TrayClickAction })}><option value="vault">{translate('nav.vault')}</option><option value="favorites">{translate('nav.favorites')}</option><option value="recent">{translate('nav.recent')}</option><option value="settings">{translate('nav.settings')}</option></SelectField></div>
      <ToggleRow title={translate('settings.dockHidden')} description={translate('settings.dockHiddenDesc')} checked={dock.hidden} disabled={!dock.available || dock.loading} onChange={updateDockHidden} />
      </section>
      <section className="react-setting-group" aria-label={translate('settings.groupInterface')}><h2>{translate('settings.groupInterface')}</h2>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.font')}</h2><p>{translate(app.fontPreference === 'system' ? 'font.systemDesc' : 'font.cangerDesc')}</p></div><SelectField label={translate('settings.font')} labelHidden id="font-preference" value={app.fontPreference} onValueChange={(value) => app.setFontPreference(value)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(`font.${option.value}`)}</option>)}</SelectField></div>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.language')}</h2><p>{translate(app.localePreference === 'system' ? 'locale.systemDesc' : 'settings.languageDesc')}</p></div><SelectField label={translate('settings.language')} labelHidden id="locale-preference" value={app.localePreference} onValueChange={(value) => app.setLocalePreference(value)}>{LOCALE_PREFERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(option.labelKey)}</option>)}</SelectField></div>
      </section>
      <section className="react-setting-group" aria-label={translate('settings.groupStorage')}><h2>{translate('settings.groupStorage')}</h2>
      <div className="react-setting-row react-setting-row--directory"><div className="react-setting-row__copy"><h2>{translate('settings.offlineDataDir')}</h2><p>{offline.dataDir || offline.defaultDataDir || translate('settings.offlineDataDirUnset')}</p></div><Button icon={<FolderOpen size={15} />} onClick={requestDirectoryChange} disabled={offline.saving}>{translate('settings.offlineDataDirChoose')}</Button></div>
      </section>
    </section>}

    {section === 'appearance' && <section className="react-settings react-settings--stack" aria-label={translate('settings.appearance')}>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.themeMode')}</h2><p>{translate('theme.systemDesc')}</p></div><SelectField label={translate('settings.themeMode')} labelHidden id="appearance-mode" value={theme.appearanceMode} onValueChange={(value) => theme.updatePreferences({ appearanceMode: value as AppearanceMode })}><option value="system">{translate('theme.system')}</option><option value="light">{translate('theme.light')}</option><option value="dark">{translate('theme.dark')}</option></SelectField></div>
      <div className="react-setting-row react-setting-row--accent"><div className="react-setting-row__copy"><h2>{translate('settings.accentColor')}</h2><p>{translate('settings.accentColorDesc')}</p></div><div className="react-accent-grid" role="group" aria-label={translate('settings.accentColor')}>
        {(['blue', 'teal', 'green', 'purple', 'coral', 'amber'] as const).map((accent) => <button key={accent} type="button" className={`react-accent ${theme.accentColor === accent ? 'is-active' : ''}`} aria-label={translate(`accent.${accent}`)} aria-pressed={theme.accentColor === accent} title={translate(`accent.${accent}`)} onClick={() => theme.updatePreferences({ accentColor: accent as AccentColor })}><span className={`react-accent__swatch react-accent__swatch--${accent}`}>{theme.accentColor === accent && <Check size={13} aria-hidden="true" />}</span></button>)}
      </div></div>
    </section>}

    {section === 'security' && <section className="react-settings react-security-settings" aria-label={translate('settings.security')}>
      <section className="react-subsection react-security-options"><h2>{translate('settings.vaultProtectionGroup')}</h2>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.autoLock')}</h2><p>{translate('settings.autoLockDesc')}</p></div><SelectField label={translate('settings.autoLock')} labelHidden id="auto-lock-minutes" value={String(autoLock.lockMinutes)} disabled={security.isMigrating} onValueChange={(value) => autoLock.setLockMinutes(Number(value) as AutoLockMinutes)}>{AUTO_LOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(option.value === 0 ? 'autoLock.never' : `autoLock.${option.value}`)}</option>)}</SelectField></div>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.clipboardClear')}</h2><p>{translate('settings.clipboardClearDesc')}</p></div><SelectField label={translate('settings.clipboardClear')} labelHidden id="clipboard-clear-seconds" value={String(clipboard.clearSeconds)} disabled={security.isMigrating} onValueChange={(value) => clipboard.setClearSeconds(Number(value) as ClipboardClearSeconds)}>{CLIPBOARD_CLEAR_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{translate(seconds === 0 ? 'clipboardClear.never' : `clipboardClear.${seconds}`)}</option>)}</SelectField></div>
      <ToggleRow title={translate('settings.preferBiometricUnlock')} description={translate(biometricSupported ? 'settings.preferBiometricUnlockDesc' : 'settings.preferBiometricUnlockDesc')} checked={biometric.preferBiometricUnlock} disabled={!biometricSupported || security.isMigrating} onChange={(enabled) => { if (!enabled) biometric.setPreferBiometricUnlock(false); else { setSecurityError(''); setBiometricPromptOpen(true) } }} />
      {security.isMigrating && <p className="react-form__warning" role="status">{security.migrationProgress.message}</p>}
      </section>
      <section className="react-subsection react-token-section"><h2>{translate('phoneToken.title')}</h2>
        <div className="react-token-status-row"><div><span className={`react-token-status${auth.hasPhoneTokenBinding ? ' is-bound' : ''}`}><span aria-hidden="true" />{translate(auth.hasPhoneTokenBinding ? 'phoneToken.bound' : 'phoneToken.unbound')}</span><p>{translate('phoneToken.statusHint')}</p></div>
          {auth.status?.fingerprint && <div className="react-token-fingerprint"><span>{translate('phoneToken.fingerprint', { fingerprint: showFingerprint ? auth.status.fingerprint : `${auth.status.fingerprint.slice(0, 6)}…${auth.status.fingerprint.slice(-4)}` })}</span><Button tone="quiet" icon={showFingerprint ? <EyeOff size={15} /> : <Eye size={15} />} aria-label={translate(showFingerprint ? 'phoneToken.hideFingerprint' : 'phoneToken.showFingerprint')} title={translate(showFingerprint ? 'phoneToken.hideFingerprint' : 'phoneToken.showFingerprint')} onClick={() => setShowFingerprint((visible) => !visible)} />
          </div>}
        </div>
        {auth.hasPhoneTokenBinding && <div className="react-security-form"><div className="react-security-form__heading"><h3>{translate('phoneToken.rebind')}</h3><p>{translate('phoneToken.rebindHint')}</p></div><div className="react-inline-form"><TextField label={translate('phoneToken.masterPassword')} type="password" autoComplete="current-password" value={rebindPassword} onChange={(event) => setRebindPassword(event.target.value)} /><OtpInput label={translate('phoneToken.oldCode')} value={rebindCode} onChange={setRebindCode} /><Button tone="primary" disabled={securityBusy || !rebindPassword || rebindCode.length !== 6} onClick={() => void rebindToken()}>{translate('phoneToken.verifyRebind')}</Button></div></div>}
        {auth.hasRecoveryKey && <div className="react-security-form react-recovery-key"><div className="react-security-form__heading"><h3>{translate('recoveryKey.title')}</h3><p>{translate('recoveryKey.viewHint')}</p></div>{!recoveryKey ? <div className="react-inline-form"><TextField label={translate('phoneToken.masterPassword')} type="password" autoComplete="current-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} /><OtpInput label={translate('phoneToken.code')} value={recoveryCode} onChange={setRecoveryCode} /><Button disabled={securityBusy || !recoveryPassword || recoveryCode.length !== 6} onClick={() => void revealKey()}>{translate('recoveryKey.verifyView')}</Button></div> : <div className="react-recovery-key__revealed"><textarea className="bp-input react-secret" rows={3} value={recoveryKey} readOnly aria-label={translate('recoveryKey.title')} /><div><Button icon={<Copy size={15} />} onClick={() => void copyRecoveryKey()}>{translate('recoveryKey.copy')}</Button><Button tone="quiet" icon={<EyeOff size={15} />} onClick={() => setRecoveryKey('')}>{translate('recoveryKey.hide')}</Button></div></div>}</div>}
        {securityError && <p className="react-form__error" role="alert">{securityError}</p>}
      </section>
    </section>}

    {section === 'shortcuts' && <section className="react-settings react-shortcuts" aria-label={translate('settings.shortcuts')}>
      <p className="react-page__description react-shortcuts__intro">{translate('settings.shortcuts.globalOnlyDesktop')}</p>
      {SHORTCUT_ACTION_OPTIONS.map((item) => <div className="react-setting-row" key={item.id}><div className="react-setting-row__copy"><h2>{translate(`shortcut.${item.id}`)}</h2><p>{translate(`shortcut.${item.id}Desc`)}</p></div><ShortcutRecorder action={item.id} value={shortcuts.settings[item.id]} disabled={shortcutBusy === item.id} onSave={(value) => saveShortcut(item.id, value)} /></div>)}
      {shortcutWarning && <p className="react-form__error" role="alert">{shortcutWarning}</p>}
      <div className="react-settings-action-row"><Button icon={<RotateCcw size={15} />} onClick={async () => { const result = await shortcuts.resetDefaults(); setShortcutWarning(result.ok ? '' : translate('settings.shortcuts.openFailed')); if (result.ok) toast(translate('msg.shortcutReset')) }}>{translate('settings.shortcuts.reset')}</Button></div>
    </section>}

    {section === 'backup' && <section className="react-settings react-settings--stack react-backup-settings" aria-label={translate('backup.title')}>
      <div className="react-setting-row react-setting-row--stack"><div className="react-setting-row__copy"><h2>{translate('backup.title')}</h2><p>{translate('backup.description')}</p></div><TextField label={translate('backup.password')} type="password" autoComplete="new-password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} /></div>
      <div className="react-backup-actions-row"><div className="react-preview-actions react-backup-settings__actions"><Button icon={<DownloadIcon />} onClick={() => void exportBackup()} disabled={backupBusy}>{translate('backup.export')}</Button><Button tone="primary" icon={<FolderOpen size={15} />} onClick={() => void importBackup()} disabled={backupBusy}>{translate('backup.import')}</Button></div></div>
      <section className="react-subsection react-backup-danger"><h2>{translate('backup.dangerZone')}</h2>
        <div className="react-backup-danger__row"><div className="react-setting-row__copy"><h3>{translate('backup.deleteTitle')}</h3><p>{translate('backup.dangerZoneDescription')}</p></div><Button tone="danger" icon={<Trash2 size={15} />} onClick={() => setDeleteDialogOpen(true)} disabled={backupBusy}>{translate('backup.deleteVault')}</Button></div>
        <div className="react-backup-danger__row"><div className="react-setting-row__copy"><h3>{translate('resetLocal.sectionTitle')}</h3><p>{translate('resetLocal.sectionDescription')}</p></div><LocalDataReset /></div>
      </section>
      {backupError && <p className="react-form__error" role="alert">{localizedMessage(backupError, translate)}</p>}
    </section>}
      </div>

    <Dialog open={biometricPromptOpen} onOpenChange={(open) => { setBiometricPromptOpen(open); if (!open) setBiometricPassword('') }}><DialogContent title={translate('settings.biometricEnableTitle')} description={translate('settings.biometricEnablePasswordPrompt')}><div className="react-dialog-body"><TextField label={translate('settings.biometricEnablePasswordPlaceholder')} type="password" autoComplete="current-password" value={biometricPassword} onChange={(event) => setBiometricPassword(event.target.value)} />{securityError && <p className="react-form__error" role="alert">{securityError}</p>}<div className="react-dialog-actions"><DialogClose asChild><Button tone="quiet">{translate('common.cancel')}</Button></DialogClose><Button tone="primary" icon={<FingerprintIcon />} onClick={() => void enableBiometric()} disabled={biometricBusy || !biometricPassword}>{translate('settings.biometricEnableConfirm')}</Button></div></div></DialogContent></Dialog>

    <Dialog open={restoreDialogOpen} onOpenChange={(open) => { if (!open) settleRestore(false); setRestoreDialogOpen(open) }}><DialogContent title={translate('backup.replaceTitle')} description={translate('backup.replaceConfirm')}><div className="react-dialog-actions"><Button tone="quiet" onClick={() => settleRestore(false)}>{translate('common.cancel')}</Button><Button tone="danger" onClick={() => settleRestore(true)}>{translate('backup.replace')}</Button></div></DialogContent></Dialog>

    <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) { setDeletePassword(''); setDeleteCode('') } }}><DialogContent title={translate('backup.deleteTitle')} description={translate('backup.deleteConfirm')}><div className="react-dialog-body"><TextField label={translate('phoneToken.masterPassword')} type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /><OtpInput label={translate('phoneToken.code')} value={deleteCode} onChange={setDeleteCode} />{backupError && <p className="react-form__error" role="alert">{localizedMessage(backupError, translate)}</p>}<div className="react-dialog-actions"><DialogClose asChild><Button tone="quiet">{translate('common.cancel')}</Button></DialogClose><Button tone="danger" icon={<Trash2 size={15} />} onClick={() => void deleteLocalVault()} disabled={backupBusy || !deletePassword || !deleteCode}>{translate('backup.deleteConfirmButton')}</Button></div></div></DialogContent></Dialog>

    <Dialog open={directoryDialogOpen} onOpenChange={setDirectoryDialogOpen}><DialogContent title={translate('settings.offlineDataDir')} description={translate('settings.offlineDataDirChangeConfirm')}><p className="react-directory-path">{selectedDataDir}</p><div className="react-dialog-actions"><Button tone="quiet" onClick={() => setDirectoryDialogOpen(false)}>{translate('common.cancel')}</Button><Button tone="primary" onClick={() => void confirmDirectoryChange()} disabled={offline.saving}>{translate('common.confirm')}</Button></div></DialogContent></Dialog>
  </main>

  function settleRestore(confirmed: boolean): void {
    restoreConfirm.current?.(confirmed)
    restoreConfirm.current = null
    setRestoreDialogOpen(false)
  }
}

function localizedError(cause: unknown, translate: (key: string) => string, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback
  return message.startsWith('backup.') ? translate(message) : message
}

function localizedMessage(message: string, translate: (key: string) => string): string {
  return message.startsWith('backup.') ? translate(message) : message
}

function DownloadIcon() { return <KeyRound size={15} /> }
function FingerprintIcon() { return <Fingerprint size={15} /> }
