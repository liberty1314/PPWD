import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import type { StoreGeneric } from './stores/reactiveStore'
import { useStoreSnapshot } from './stores/reactiveStore'
import { useNavigate, useParams } from 'react-router-dom'
import { Fingerprint, FolderOpen, KeyRound, RotateCcw, Trash2 } from 'lucide-react'
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
import { Button, Dialog, DialogClose, DialogContent, NativeSelect, TextField, useToast } from './ui/primitives'
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from './types/autoLock'
import { CLIPBOARD_CLEAR_OPTIONS, type ClipboardClearSeconds } from './types/clipboardClear'
import { SHORTCUT_ACTION_OPTIONS, type ShortcutActionId } from './types/shortcut'
import type { TrayClickAction } from './types/tray'
import { LOCALE_PREFERENCE_OPTIONS } from './utils/localePreference'
import { FONT_OPTIONS } from './utils/font'
import { formatAccelerator, keyboardEventToAccelerator } from './utils/shortcut'
import { normalizeAcceleratorString } from '../shared/acceleratorMatch'
import { persistVaultPassword } from './utils/vaultPasswordStorage'
import { APP_VERSION, AUTHOR_GITHUB_URL, AUTHOR_NAME, OFFICIAL_WEBSITE_URL } from './constants/app'
import { ReactAppearancePage } from './ReactAppearancePage'

const SETTINGS_SECTIONS = ['general', 'security', 'appearance', 'shortcuts', 'backup', 'about'] as const
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

  return <button className={`react-shortcut-recorder ${recording ? 'is-recording' : ''}`} type="button" disabled={disabled} onClick={() => setRecording(true)} onKeyDown={handleKey} onBlur={() => setRecording(false)} aria-label={translate(`shortcut.${action}`)}>{recording ? translate('settings.shortcuts.recording') : value ? formatAccelerator(value, platform) : '—'}</button>
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

  const settingTabs: Array<{ id: SettingsSection; label: string }> = [
    { id: 'general', label: translate('settings.general') },
    { id: 'security', label: translate('settings.security') },
    { id: 'appearance', label: translate('settings.appearance') },
    { id: 'shortcuts', label: translate('settings.shortcuts') },
    { id: 'backup', label: translate('backup.title') },
    { id: 'about', label: translate('settings.about') }
  ]

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
    <nav className="react-settings-tabs" aria-label={translate('settings.title')} role="tablist">
      {settingTabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} onClick={() => navigate(`/settings/${item.id}`)}>{item.label}</button>)}
    </nav>

    {section === 'general' && <section className="react-settings" aria-label={translate('settings.general')}>
      <ToggleRow title={translate('settings.launchAtLogin')} description={translate('settings.launchAtLoginDesc')} checked={launchAtLogin.enabled} disabled={!launchAtLogin.available || launchAtLogin.loading} onChange={async (enabled) => { const result = await launchAtLogin.setEnabled(enabled); if (result.ok) toast(translate(enabled ? 'msg.launchAtLoginOn' : 'msg.launchAtLoginOff')); else toast(result.error ?? translate('common.settingsFailed')) }} />
      <ToggleRow title={translate('settings.tray')} description={translate('settings.trayDesc')} checked={tray.enabled} disabled={!tray.available || tray.loading} onChange={async (enabled) => { const result = await tray.updateSettings({ enabled }); if (result.ok) toast(translate(enabled ? 'msg.trayOn' : 'msg.trayOff')); else toast(result.error ?? translate('common.settingsFailed')) }} />
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.trayClickAction')}</h2><p>{translate('settings.trayClickActionDesc')}</p></div><NativeSelect label={translate('settings.trayClickAction')} id="tray-click-action" value={tray.clickAction} onChange={(event) => void tray.updateSettings({ clickAction: event.target.value as TrayClickAction })}><option value="vault">{translate('nav.vault')}</option><option value="favorites">{translate('nav.favorites')}</option><option value="recent">{translate('nav.recent')}</option><option value="settings">{translate('nav.settings')}</option></NativeSelect></div>
      <ToggleRow title={translate('settings.dockHidden')} description={translate('settings.dockHiddenDesc')} checked={dock.hidden} disabled={!dock.available || dock.loading} onChange={async (hidden) => { const result = await dock.setHidden(hidden); if (!result.ok) toast(result.error ?? translate('common.settingsFailed')) }} />
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.font')}</h2><p>{translate(app.fontPreference === 'system' ? 'font.systemDesc' : 'font.cangerDesc')}</p></div><NativeSelect label={translate('settings.font')} id="font-preference" value={app.fontPreference} onChange={(event) => app.setFontPreference(event.target.value)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(`font.${option.value}`)}</option>)}</NativeSelect></div>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.language')}</h2><p>{translate(app.localePreference === 'system' ? 'locale.systemDesc' : 'settings.subtitle')}</p></div><NativeSelect label={translate('settings.language')} id="locale-preference" value={app.localePreference} onChange={(event) => app.setLocalePreference(event.target.value)}>{LOCALE_PREFERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(option.labelKey)}</option>)}</NativeSelect></div>
      <div className="react-setting-row react-setting-row--directory"><div className="react-setting-row__copy"><h2>{translate('settings.offlineDataDir')}</h2><p>{offline.dataDir || offline.defaultDataDir || translate('settings.offlineDataDirUnset')}</p></div><Button icon={<FolderOpen size={15} />} onClick={requestDirectoryChange} disabled={offline.saving}>{translate('settings.offlineDataDirChoose')}</Button></div>
    </section>}

    {section === 'security' && <section className="react-settings" aria-label={translate('settings.security')}>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.autoLock')}</h2><p>{translate('settings.autoLockDesc')}</p></div><NativeSelect label={translate('settings.autoLock')} id="auto-lock-minutes" value={String(autoLock.lockMinutes)} disabled={security.isMigrating} onChange={(event) => autoLock.setLockMinutes(Number(event.target.value) as AutoLockMinutes)}>{AUTO_LOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translate(option.value === 0 ? 'autoLock.never' : `autoLock.${option.value}`)}</option>)}</NativeSelect></div>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.clipboardClear')}</h2><p>{translate('settings.clipboardClearDesc')}</p></div><NativeSelect label={translate('settings.clipboardClear')} id="clipboard-clear-seconds" value={String(clipboard.clearSeconds)} disabled={security.isMigrating} onChange={(event) => clipboard.setClearSeconds(Number(event.target.value) as ClipboardClearSeconds)}>{CLIPBOARD_CLEAR_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{translate(seconds === 0 ? 'clipboardClear.never' : `clipboardClear.${seconds}`)}</option>)}</NativeSelect></div>
      <ToggleRow title={translate('settings.preferBiometricUnlock')} description={translate(biometricSupported ? 'settings.preferBiometricUnlockDesc' : 'settings.preferBiometricUnlockDesc')} checked={biometric.preferBiometricUnlock} disabled={!biometricSupported || security.isMigrating} onChange={(enabled) => { if (!enabled) biometric.setPreferBiometricUnlock(false); else { setSecurityError(''); setBiometricPromptOpen(true) } }} />
      {security.isMigrating && <p className="react-form__warning" role="status">{security.migrationProgress.message}</p>}
      <section className="react-subsection"><h2>{translate('phoneToken.title')}</h2><p>{translate(auth.hasPhoneTokenBinding ? 'phoneToken.bound' : 'phoneToken.unbound')}{auth.status?.fingerprint ? ` · ${translate('phoneToken.fingerprint', { fingerprint: auth.status.fingerprint })}` : ''}</p>
        {auth.hasPhoneTokenBinding && <div className="react-inline-form"><TextField label={translate('phoneToken.masterPassword')} type="password" autoComplete="current-password" value={rebindPassword} onChange={(event) => setRebindPassword(event.target.value)} /><TextField label={translate('phoneToken.oldCode')} inputMode="numeric" maxLength={6} value={rebindCode} onChange={(event) => setRebindCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Button tone="primary" disabled={securityBusy} onClick={() => void rebindToken()}>{translate('phoneToken.verifyRebind')}</Button></div>}
        {auth.hasRecoveryKey && <div className="react-inline-form"><h3>{translate('recoveryKey.title')}</h3><p>{translate('recoveryKey.viewHint')}</p>{!recoveryKey ? <><TextField label={translate('phoneToken.masterPassword')} type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} /><TextField label={translate('phoneToken.code')} inputMode="numeric" maxLength={6} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Button disabled={securityBusy} onClick={() => void revealKey()}>{translate('recoveryKey.verifyView')}</Button></> : <><textarea className="bp-input react-secret" rows={3} value={recoveryKey} readOnly /><Button tone="quiet" onClick={() => setRecoveryKey('')}>{translate('recoveryKey.hide')}</Button></>}</div>}
        {securityError && <p className="react-form__error" role="alert">{securityError}</p>}
      </section>
    </section>}

    {section === 'appearance' && <ReactAppearancePage />}

    {section === 'shortcuts' && <section className="react-settings" aria-label={translate('settings.shortcuts')}>
      <p className="react-page__description">{translate('settings.shortcuts.globalOnlyDesktop')}</p>
      {SHORTCUT_ACTION_OPTIONS.map((item) => <div className="react-setting-row" key={item.id}><div className="react-setting-row__copy"><h2>{translate(`shortcut.${item.id}`)}</h2><p>{translate(`shortcut.${item.id}Desc`)}</p></div><ShortcutRecorder action={item.id} value={shortcuts.settings[item.id]} disabled={shortcutBusy === item.id} onSave={(value) => saveShortcut(item.id, value)} /></div>)}
      {shortcutWarning && <p className="react-form__error" role="alert">{shortcutWarning}</p>}
      <Button icon={<RotateCcw size={15} />} onClick={async () => { const result = await shortcuts.resetDefaults(); setShortcutWarning(result.ok ? '' : translate('settings.shortcuts.openFailed')); if (result.ok) toast(translate('msg.shortcutReset')) }}>{translate('settings.shortcuts.reset')}</Button>
    </section>}

    {section === 'backup' && <section className="react-settings react-settings--stack" aria-label={translate('backup.title')}>
      <div className="react-setting-row react-setting-row--stack"><div className="react-setting-row__copy"><h2>{translate('backup.title')}</h2><p>{translate('backup.description')}</p></div><TextField label={translate('backup.password')} type="password" autoComplete="new-password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} /></div>
      <p className="react-page__description">{translate('backup.hint')}</p>
      <div className="react-preview-actions"><Button icon={<DownloadIcon />} onClick={() => void exportBackup()} disabled={backupBusy}>{translate('backup.export')}</Button><Button tone="primary" icon={<FolderOpen size={15} />} onClick={() => void importBackup()} disabled={backupBusy}>{translate('backup.import')}</Button><Button tone="danger" icon={<Trash2 size={15} />} onClick={() => setDeleteDialogOpen(true)} disabled={backupBusy}>{translate('backup.deleteVault')}</Button></div>
      {backupError && <p className="react-form__error" role="alert">{localizedMessage(backupError, translate)}</p>}
    </section>}

    {section === 'about' && <section className="react-settings"><div className="react-setting-row"><h2>{translate('settings.version')}</h2><span>{APP_VERSION}</span></div><div className="react-setting-row"><h2>{translate('settings.author')}</h2><a href={AUTHOR_GITHUB_URL} target="_blank" rel="noreferrer">{AUTHOR_NAME}</a></div><div className="react-setting-row"><h2>{translate('settings.officialWebsite')}</h2><a href={OFFICIAL_WEBSITE_URL} target="_blank" rel="noreferrer">{translate('settings.officialWebsiteLink')}</a></div></section>}

    <Dialog open={biometricPromptOpen} onOpenChange={(open) => { setBiometricPromptOpen(open); if (!open) setBiometricPassword('') }}><DialogContent title={translate('settings.biometricEnableTitle')} description={translate('settings.biometricEnablePasswordPrompt')}><div className="react-dialog-body"><TextField label={translate('settings.biometricEnablePasswordPlaceholder')} type="password" autoComplete="current-password" value={biometricPassword} onChange={(event) => setBiometricPassword(event.target.value)} />{securityError && <p className="react-form__error" role="alert">{securityError}</p>}<div className="react-dialog-actions"><DialogClose asChild><Button tone="quiet">{translate('common.cancel')}</Button></DialogClose><Button tone="primary" icon={<FingerprintIcon />} onClick={() => void enableBiometric()} disabled={biometricBusy || !biometricPassword}>{translate('settings.biometricEnableConfirm')}</Button></div></div></DialogContent></Dialog>

    <Dialog open={restoreDialogOpen} onOpenChange={(open) => { if (!open) settleRestore(false); setRestoreDialogOpen(open) }}><DialogContent title={translate('backup.replaceTitle')} description={translate('backup.replaceConfirm')}><div className="react-dialog-actions"><Button tone="quiet" onClick={() => settleRestore(false)}>{translate('common.cancel')}</Button><Button tone="danger" onClick={() => settleRestore(true)}>{translate('backup.replace')}</Button></div></DialogContent></Dialog>

    <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) { setDeletePassword(''); setDeleteCode('') } }}><DialogContent title={translate('backup.deleteTitle')} description={translate('backup.deleteConfirm')}><div className="react-dialog-body"><TextField label={translate('phoneToken.masterPassword')} type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /><TextField label={translate('phoneToken.code')} inputMode="numeric" maxLength={6} value={deleteCode} onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />{backupError && <p className="react-form__error" role="alert">{localizedMessage(backupError, translate)}</p>}<div className="react-dialog-actions"><DialogClose asChild><Button tone="quiet">{translate('common.cancel')}</Button></DialogClose><Button tone="danger" icon={<Trash2 size={15} />} onClick={() => void deleteLocalVault()} disabled={backupBusy || !deletePassword || !deleteCode}>{translate('backup.deleteConfirmButton')}</Button></div></div></DialogContent></Dialog>

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
