import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Fingerprint, RefreshCw, ShieldCheck } from 'lucide-react'
import { desktopAuthAdapter } from './platform/desktopAuthAdapter'
import { useDesktopLocale } from './ui/useDesktopLocale'
import { useToast } from './ui/primitives'
import { useBiometricUnlockStore } from './stores/biometricUnlock'
import { useStoreSnapshot } from './stores/reactiveStore'
import { generatePhoneTokenRecoveryKey, generatePhoneTokenSecret, createPhoneTokenQrDataUrl } from './utils/phoneToken'
import { isSixDigitTotp, validateSetupPassword } from './utils/reactGateRules'
import { Button, TextField } from './ui/primitives'
import logoUrl from './assets/logo.png'

type ErrorReason = 'invalid' | 'locked' | 'unavailable' | 'unbound'

function verificationError(reason: ErrorReason | 'alreadyBound', translate: (key: string) => string): string {
  if (reason === 'unavailable') return translate('unlock.storageUnavailable')
  if (reason === 'locked') return translate('unlock.tooManyAttempts')
  if (reason === 'unbound') return translate('unlock.verificationFailed')
  if (reason === 'alreadyBound') return translate('unlock.verificationFailed')
  return translate('unlock.verificationFailed')
}

export function SetupPage() {
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()
  const toast = useToast()
  const [step, setStep] = useState<'password' | 'recovery'>('password')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [safeStorageAvailable, setSafeStorageAvailable] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void desktopAuthAdapter.getLocalVaultAvailability().then(setSafeStorageAvailable).catch(() => setSafeStorageAvailable(false))
    return () => {
      setPassword('')
      setConfirmation('')
      setRecoveryKey('')
    }
  }, [])

  async function prepareRecovery(event: FormEvent): Promise<void> {
    event.preventDefault()
    const invalid = validateSetupPassword(password, confirmation)
    if (invalid) {
      setError(translate(invalid === 'length' ? 'unlock.setup.passwordLength' : 'unlock.setup.passwordMismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const nextKey = generatePhoneTokenRecoveryKey()
      const nextFingerprint = await desktopAuthAdapter.fingerprintRecoveryKey(nextKey)
      setRecoveryKey(nextKey)
      setFingerprint(nextFingerprint)
      setSaved(false)
      setStep('recovery')
    } catch {
      setError(translate('unlock.setup.createFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function exportRecoveryKit(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      if (await desktopAuthAdapter.saveEmergencyKit(recoveryKey, fingerprint)) {
        setSaved(true)
        toast(translate('unlock.exportKit'))
      } else {
        setError(translate('unlock.setup.exportFailed'))
      }
    } catch {
      setError(translate('unlock.setup.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function chooseEmptyDirectory(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const selected = await desktopAuthAdapter.chooseEmptyDataDirectory()
      if (!selected) setError(translate('unlock.setup.directoryUnavailable'))
    } catch {
      setError(translate('unlock.setup.directoryUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  async function createVault(): Promise<void> {
    if (busy || !saved) return
    setBusy(true)
    setError('')
    try {
      await desktopAuthAdapter.createVault(password, recoveryKey)
      setPassword('')
      setConfirmation('')
      setRecoveryKey('')
      navigate('/bind', { replace: true })
    } catch (cause) {
      const message = cause instanceof Error && cause.message.includes('数据目录')
        ? translate('unlock.setup.emptyDirRequired')
        : translate('unlock.setup.createFailed')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateFrame eyebrow={translate(step === 'password' ? 'unlock.localVault' : 'unlock.recoveryMaterials')}>
      {step === 'password' ? <>
        <h1>{translate('unlock.setup')}</h1>
        <p className="react-gate__description">{translate('unlock.createHint')}</p>
        <form className="react-form" onSubmit={(event) => void prepareRecovery(event)}>
          <TextField label={translate('unlock.masterPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <TextField label={translate('unlock.confirmPassword')} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
          {error && <p className="react-form__error" role="alert">{error}</p>}
          <Button type="submit" tone="primary" disabled={busy}>{translate('unlock.continue')}</Button>
        </form>
      </> : <>
        <h1>{translate('unlock.saveRecovery')}</h1>
        <p className="react-gate__description">{translate('unlock.recoveryOnceHint')}</p>
        <label className="bp-field" htmlFor="setup-recovery-key"><span className="bp-field__label">{translate('unlock.recoveryKey')}</span><textarea id="setup-recovery-key" className="bp-input react-secret" value={recoveryKey} readOnly rows={4} /></label>
        <p className="react-gate__fingerprint">{translate('unlock.fingerprint', { fingerprint })}</p>
        <label className="react-check"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /><span>{translate('unlock.recoverySaved')}</span></label>
        <div className="react-gate__actions">
          <Button icon={<Download size={15} />} onClick={() => void exportRecoveryKit()} disabled={busy}>{translate('unlock.exportKit')}</Button>
          <Button tone="primary" icon={<Check size={15} />} onClick={() => void createVault()} disabled={busy || !saved}>{translate('unlock.createContinue')}</Button>
        </div>
        <Button tone="quiet" onClick={() => { setError(''); const nextKey = generatePhoneTokenRecoveryKey(); setRecoveryKey(nextKey); void desktopAuthAdapter.fingerprintRecoveryKey(nextKey).then(setFingerprint); setSaved(false) }} disabled={busy}>{translate('unlock.regenerate')}</Button>
        {error && <p className="react-form__error" role="alert">{error}</p>}
      </>}
      {!safeStorageAvailable && <p className="react-form__warning" role="status">{translate('unlock.safeStorageUnavailable')}</p>}
      {error.includes('空数据目录') && <Button tone="quiet" onClick={() => void chooseEmptyDirectory()} disabled={busy}>{translate('unlock.chooseEmptyDir')}</Button>}
    </GateFrame>
  )
}

export function UnlockPage() {
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()
  const biometricStore = useStoreSnapshot(useBiometricUnlockStore)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [biometricLoaded, setBiometricLoaded] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricKind, setBiometricKind] = useState<'touchId' | 'windowsHello' | null>(null)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([desktopAuthAdapter.getBiometricAvailability(), desktopAuthAdapter.hasStoredBiometricPassword()])
      .then(([availability, hasPassword]) => {
        if (!active) return
        setBiometricAvailable(availability.available && hasPassword)
        setBiometricKind(availability.kind)
        setBiometricEnabled(biometricStore.preferBiometricUnlock)
      })
      .catch(() => { if (active) setBiometricAvailable(false) })
      .finally(() => { if (active) setBiometricLoaded(true) })
    return () => { active = false; setCode('') }
  }, [])

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault()
    if (busy) return
    if (!isSixDigitTotp(code)) {
      setError(translate('unlock.verificationFailed'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await desktopAuthAdapter.verifyTotp(code)
      if (!result.ok) {
        setError(verificationError(result.reason, translate))
        setCode('')
        return
      }
      setCode('')
      navigate('/', { replace: true })
    } catch {
      setError(translate('unlock.verificationFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function unlockBiometric(): Promise<void> {
    if (biometricBusy) return
    setBiometricBusy(true)
    setError('')
    try {
      const result = await desktopAuthAdapter.unlockBiometric(translate('unlock.title'))
      if (!result.ok) {
        if (result.reason !== 'canceled') {
          setError(translate('unlock.biometricFailed'))
          setFallback(true)
        }
        return
      }
      navigate('/', { replace: true })
    } catch {
      setError(translate('unlock.biometricFailed'))
      setFallback(true)
    } finally {
      setBiometricBusy(false)
    }
  }

  return <GateFrame eyebrow={translate('unlock.localVault')} showSteps={false}>
    <h1>{translate('unlock.title')}</h1>
    <p className="react-gate__description">{biometricLoaded && biometricAvailable && biometricEnabled && !fallback ? translate('unlock.biometricHint') : translate('unlock.totpHint')}</p>
    <div className="react-gate__unlock-method" aria-busy={!biometricLoaded || biometricBusy || busy}>
      {!biometricLoaded ? <p className="react-gate__method-status" role="status">{translate('unlock.checkingBiometric')}</p> : <>
        {biometricEnabled && !biometricAvailable && <p className="react-form__warning" role="status">{translate('unlock.biometricUnavailable')}</p>}
        {biometricAvailable && biometricEnabled && !fallback
          ? <Button className="react-gate__wide" tone="primary" icon={<Fingerprint size={16} />} onClick={() => void unlockBiometric()} disabled={biometricBusy}>{biometricKind === 'touchId' ? translate('unlock.touchId') : translate('unlock.windowsHello')}</Button>
          : <form className="react-form" onSubmit={(event) => void submit(event)}>
            <TextField label={translate('unlock.tokenCode')} inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} />
            {error && <p className="react-form__error" role="alert">{error}</p>}
            <Button type="submit" tone="primary" disabled={busy}>{translate('unlock.totpUnlock')}</Button>
          </form>}
      </>}
    </div>
    {biometricLoaded && biometricAvailable && biometricEnabled && <Button tone="quiet" className="react-gate__center react-gate__method-switch" onClick={() => { setFallback(!fallback); setError('') }}>{fallback ? translate('unlock.useBiometric') : translate('unlock.useTotp')}</Button>}
    <Button tone="quiet" className="react-gate__center react-gate__recovery-link" onClick={() => navigate('/recover')}>{translate('unlock.recoverAccess')}</Button>
  </GateFrame>
}

export function RecoverPage() {
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()
  const [password, setPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { setPassword(''); setRecoveryKey('') }, [])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    if (!password || !recoveryKey.trim()) {
      setError(translate('unlock.verificationFailed'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await desktopAuthAdapter.recover(password, recoveryKey)
      if (!result.ok) {
        setError(verificationError(result.reason, translate))
        return
      }
      setPassword('')
      setRecoveryKey('')
      navigate('/bind?recovery=1', { replace: true })
    } catch {
      setError(translate('unlock.verificationFailed'))
    } finally {
      setBusy(false)
    }
  }

  return <GateFrame eyebrow={translate('unlock.recoveryTitle')}>
    <h1>{translate('unlock.verifyRecovery')}</h1>
    <p className="react-gate__description">{translate('unlock.recoveryHint')}</p>
    <form className="react-form" onSubmit={(event) => void submit(event)}>
      <TextField label={translate('unlock.masterPassword')} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
      <label className="bp-field" htmlFor="recovery-key"><span className="bp-field__label">{translate('unlock.recoveryKey')}</span><textarea id="recovery-key" className="bp-input react-secret" rows={3} autoComplete="off" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} disabled={busy} /></label>
      {error && <p className="react-form__error" role="alert">{error}</p>}
      <Button type="submit" tone="primary" disabled={busy}>{translate('unlock.verifyRebind')}</Button>
    </form>
    <Button tone="quiet" className="react-gate__center" icon={<ArrowLeft size={15} />} onClick={() => navigate('/unlock')}>{translate('unlock.backUnlock')}</Button>
  </GateFrame>
}

export function BindPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { translate } = useDesktopLocale()
  const [secret, setSecret] = useState('')
  const [qrData, setQrData] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(false)
  const [error, setError] = useState('')
  const isRebinding = new URLSearchParams(location.search).get('rebind') === '1'

  function generate(): void {
    const nextSecret = generatePhoneTokenSecret()
    setSecret(nextSecret)
    setQrData(createPhoneTokenQrDataUrl(nextSecret))
    setCode('')
  }

  useEffect(() => {
    let active = true
    void desktopAuthAdapter.getLocalVaultAvailability().then((available) => { if (active) setStorageAvailable(available) }).catch(() => { if (active) setStorageAvailable(false) })
    generate()
    return () => { active = false; setSecret(''); setQrData(''); setPassword(''); setCode('') }
  }, [])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    if (!isSixDigitTotp(code) || !password) {
      setError(translate('unlock.verificationFailed'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await desktopAuthAdapter.bindPhoneToken(secret, code, password)
      if (!result.ok) {
        setError(verificationError(result.reason, translate))
        setCode('')
        return
      }
      setPassword('')
      setSecret('')
      setQrData('')
      navigate('/', { replace: true })
    } catch {
      setError(translate('unlock.verificationFailed'))
    } finally {
      setBusy(false)
    }
  }

  return <GateFrame eyebrow={translate(isRebinding ? 'unlock.rebind' : 'unlock.firstSetup')}>
    <h1>{translate('unlock.bind')}</h1>
    <p className="react-gate__description">{translate('unlock.bindHint')}</p>
    {!storageAvailable && <p className="react-form__warning" role="alert">{translate('unlock.storageBindUnavailable')}</p>}
    {qrData && <img className="react-gate__qr" src={qrData} alt={translate('unlock.bind')} />}
    <label className="bp-field" htmlFor="manual-token-secret"><span className="bp-field__label">{translate('unlock.manualSecret')}</span><input id="manual-token-secret" className="bp-input react-secret" value={secret} readOnly /></label>
    <form className="react-form" onSubmit={(event) => void submit(event)}>
      <TextField label={translate('unlock.masterPassword')} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={!storageAvailable || busy} />
      <TextField label={translate('unlock.tokenCode')} inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={!storageAvailable || busy} />
      {error && <p className="react-form__error" role="alert">{error}</p>}
      <Button type="submit" tone="primary" disabled={!storageAvailable || busy}>{translate('unlock.verifyBind')}</Button>
    </form>
    {!isRebinding && <Button tone="quiet" className="react-gate__center" icon={<RefreshCw size={15} />} onClick={() => { setError(''); generate() }} disabled={busy}>{translate('unlock.regenerateSecret')}</Button>}
  </GateFrame>
}

function GateFrame({ eyebrow, children, showSteps = true }: { eyebrow: string; children: ReactNode; showSteps?: boolean }) {
  const { translate } = useDesktopLocale()
  return <main className="react-gate-layout">
    <aside className="react-gate-aside">
      <div className="react-gate__brand"><img src={logoUrl} alt="" /><span>PPWD</span></div>
      <div className="react-gate__message">
        <h2>{translate('unlock.assuranceTitle')}</h2>
        <p>{translate('unlock.assuranceBody')}</p>
      </div>
      <p className="react-gate-layout__note"><ShieldCheck size={14} />{translate('unlock.assuranceFoot')}</p>
    </aside>
    <section className="react-gate-main">
      <div className="react-gate">
        {showSteps && <div className="react-gate__steps" aria-hidden="true"><i /><i className="is-complete" /><i /></div>}
        <p className="react-eyebrow">{eyebrow}</p>
        {children}
      </div>
    </section>
  </main>
}
