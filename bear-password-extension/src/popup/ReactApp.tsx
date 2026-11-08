import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowUpRight, CircleAlert, ExternalLink, Eye, EyeOff, Globe2, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, Settings2, Share2, ShieldCheck, Star, Trash2 } from 'lucide-react'
import type { FillCredential } from '@/shared/types'
import { t as translate } from '@/locales'
import { PASSWORD_TITLE_MAX_LENGTH } from '@/shared/constants/vaultFieldLimits'
import { getPageHostLabel, getPageWebsiteUrl } from '@/shared/utils/websiteMatch'
import { generateTotpSnapshot } from '@/shared/utils/totp'
import { APP_VERSION, AUTHOR_GITHUB_URL, AUTHOR_NAME, OFFICIAL_WEBSITE_URL } from '@/shared/constants/app'
import { usePopupLocaleStore } from './stores/reactLocale'
import { useReactPopupStore } from './stores/reactPopup'
import { usePopupThemeStore } from './stores/reactTheme'
import './reactPopup.css'

function usePopupT() {
  const locale = usePopupLocaleStore((value) => value.resolvedLocale)
  return useCallback((key: string, params?: Record<string, string | number>) => translate(key, locale, params), [locale])
}

function AppLogo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return <img className={`popup-logo popup-logo--${size}`} src={chrome.runtime.getURL('public/icons/logo.png')} alt="" />
}

function PopupContent() {
  const state = useReactPopupStore()
  const locale = usePopupLocaleStore()
  const theme = usePopupThemeStore()

  useEffect(() => {
    let active = true
    let timer: number | undefined
    void state.initialize().then(() => {
      if (!active) return
      timer = window.setInterval(() => { void useReactPopupStore.getState().refreshDesktopState(true) }, 3000)
    })
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (state.desktopState?.unlocked && state.page === 'vault') void state.refreshVault()
  }, [state.desktopState?.unlocked, state.page])

  const filtered = useMemo(() => {
    const query = state.keyword.trim().toLocaleLowerCase(locale.resolvedLocale)
    if (!query) return state.matching
    return state.matching.filter((credential) => credential.title.toLocaleLowerCase(locale.resolvedLocale).includes(query) || credential.username.toLocaleLowerCase(locale.resolvedLocale).includes(query))
  }, [state.keyword, state.matching, locale.resolvedLocale])

  if (!state.initialized || !theme.initialized) return <main className="popup-loading" role="status"><AppLogo size="lg" /><LoaderCircle size={18} className="is-spinning" /><span>{locale.t('app.loading')}</span></main>
  if (state.page === 'settings') return <SettingsPage />
  if (!state.desktopState?.unlocked) return <LoginPage />
  return <VaultPage credentials={filtered} />
}

function LoginPage() {
  const state = useReactPopupStore()
  const t = usePopupT()
  const current = state.desktopState
  const status = !current?.ready ? 'offline' : !current.loggedIn ? 'notLoggedIn' : current.locked || !current.unlocked ? 'locked' : 'ready'
  const statusKey = `login.status${status === 'notLoggedIn' ? 'NotLoggedIn' : status[0].toUpperCase() + status.slice(1)}`
  const hintKey = `login.hint${status === 'notLoggedIn' ? 'NotLoggedIn' : status[0].toUpperCase() + status.slice(1)}`

  return <main className="popup-login">
    <header className="popup-login__top"><span className="popup-login__brand"><AppLogo />BearPassword</span><button type="button" className="popup-icon-button" title={t('login.settings')} aria-label={t('login.settings')} onClick={state.openSettings}><Settings2 size={17} /></button></header>
    <section className="popup-login__panel">
      <AppLogo size="lg" />
      <p className="popup-login__subtitle">{t('login.subtitle')}</p>
      <div className="popup-status"><div><span>{t('login.connectionStatus')}</span><strong className={`popup-status__badge popup-status__badge--${status}`}>{t(statusKey)}</strong></div><p>{t(hintKey)}</p>{state.sessionError && <p className="popup-error" role="alert">{state.sessionError}</p>}</div>
      <button className="popup-button popup-button--primary popup-login__open" type="button" disabled={state.waking || state.sessionLoading} onClick={() => void state.wakeDesktop()}>{state.waking ? <LoaderCircle size={15} className="is-spinning" /> : <ArrowUpRight size={15} />}{state.waking ? t('login.openingDesktop') : t('login.openDesktop')}</button>
      {state.wakeHint && <p className="popup-login__hint" role="status">{state.wakeHint}</p>}
      <button className="popup-button popup-button--quiet popup-login__refresh" type="button" disabled={state.sessionLoading} onClick={() => void state.refreshDesktopState()}><RefreshCw size={14} />{state.sessionLoading ? t('login.refreshing') : t('login.refresh')}</button>
    </section>
    <a className="popup-external-link" href={OFFICIAL_WEBSITE_URL} target="_blank" rel="noopener noreferrer">{t('settings.officialWebsiteLink')}<ExternalLink size={12} /></a>
  </main>
}

function VaultPage({ credentials }: { credentials: FillCredential[] }) {
  const state = useReactPopupStore()
  const t = usePopupT()
  const pageHost = getPageHostLabel(state.currentUrl)

  return <main className="popup-vault">
    <header className="popup-topbar"><AppLogo /><span className="popup-topbar__username" title={state.desktopState?.username ?? ''}>{state.desktopState?.username}</span><button className="popup-icon-button" type="button" title={t('vault.settings')} aria-label={t('vault.settings')} onClick={state.openSettings}><Settings2 size={16} /></button></header>
    <label className="popup-search"><Search size={15} aria-hidden="true" /><input id="popup-vault-search" type="search" value={state.keyword} onChange={(event) => state.setKeyword(event.target.value)} placeholder={t('vault.searchPlaceholder')} aria-label={t('vault.searchPlaceholder')} /></label>
    <section className="popup-vault__heading"><div className="popup-vault__site"><Globe2 size={14} /><h1>{t('vault.thisSite')}</h1>{pageHost && <span title={state.currentUrl}>{pageHost}</span>}<small>{credentials.length}</small></div><button className="popup-button popup-button--primary popup-vault__add" type="button" title={t('vault.addTitle')} aria-label={t('vault.addTitle')} onClick={state.openCreate}><Plus size={15} />{t('vault.add')}</button></section>
    <section className={`popup-vault__list ${state.vaultLoading ? 'is-loading' : ''}`} aria-label={t('vault.thisSite')} aria-busy={state.vaultLoading}>
      {state.vaultError && <div className="popup-empty popup-empty--error" role="alert"><CircleAlert size={21} /><p>{state.vaultError}</p><button className="popup-button popup-button--quiet" type="button" onClick={() => void state.refreshVault()}><RefreshCw size={14} />{t('login.refresh')}</button></div>}
      {!state.vaultError && !state.vaultLoading && credentials.length === 0 && state.needsSecurityKey && !state.keyword && <div className="popup-empty"><KeyRound size={24} /><strong>{t('vault.emptyEncryptedTitle')}</strong><p>{t('vault.emptyEncryptedDesc')}</p><button className="popup-button popup-button--quiet" type="button" onClick={() => void state.refreshDesktopState()}>{t('vault.configureKey')}</button></div>}
      {!state.vaultError && !state.vaultLoading && credentials.length === 0 && !(state.needsSecurityKey && !state.keyword) && <div className="popup-empty"><KeyRound size={24} /><p>{state.keyword ? t('vault.emptyNoMatch') : t('vault.emptyNoEntries')}</p>{!state.keyword && <button className="popup-empty__add" type="button" onClick={state.openCreate}>{t('vault.addEntry')}</button>}</div>}
      {state.vaultLoading && credentials.length === 0 && <div className="popup-skeleton" aria-label={t('app.loading')}>{[0, 1, 2].map((item) => <i key={item} />)}</div>}
      {credentials.map((credential) => <CredentialRow key={credential.id} credential={credential} />)}
    </section>
    <EntryEditor />
    <DeleteDialog />
    {state.toast && <div className="popup-toast" role="status">{state.toast}</div>}
  </main>
}

function CredentialRow({ credential }: { credential: FillCredential }) {
  const state = useReactPopupStore()
  const t = usePopupT()
  const [totp, setTotp] = useState(() => credential.authenticator ? generateTotpSnapshot(credential.authenticator) : null)
  useEffect(() => {
    if (!credential.authenticator) return
    const update = (): void => setTotp(generateTotpSnapshot(credential.authenticator!))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [credential.id, credential.authenticator?.secret])

  async function copyTotp(): Promise<void> {
    if (!totp?.code) return
    try { await navigator.clipboard.writeText(totp.code); state.showToast(t('credential.totpCopied')) }
    catch { state.showToast(t('content.picker.totpCopyFailed')) }
  }

  return <article className="popup-credential">
    <button className="popup-credential__main" type="button" title={t('credential.autofill')} onClick={() => void state.autofill(credential.id)}><strong>{credential.title}</strong><span>{credential.username || t('credential.noUsername')}</span></button>
    <div className="popup-credential__actions">
      {credential.authenticator && <div className="popup-totp"><button type="button" className="popup-icon-button popup-totp__trigger" title={t('credential.totpView')} aria-label={t('credential.totpView')} onClick={() => void copyTotp()}><ShieldCheck size={15} /></button><div className="popup-totp__popover" role="tooltip"><button type="button" onClick={() => void copyTotp()} title={t('credential.totpCopy')}><code>{totp?.code.match(/.{1,3}/g)?.join(' ') ?? '------'}</code><span>{totp?.remainingSeconds ?? '--'}s</span></button></div></div>}
      <button type="button" className="popup-icon-button" title={t('credential.edit')} aria-label={t('credential.edit')} onClick={() => state.openEdit(credential)}><Pencil size={14} /></button>
      <button type="button" className="popup-icon-button" title={t('credential.share')} aria-label={t('credential.share')} onClick={() => void state.shareCredential(credential)}><Share2 size={15} /></button>
      <button type="button" className={`popup-icon-button ${credential.favorite ? 'is-favorite' : ''}`} title={t(credential.favorite ? 'credential.unfavorite' : 'credential.favorite')} aria-label={t(credential.favorite ? 'credential.unfavorite' : 'credential.favorite')} onClick={() => void state.toggleFavorite(credential)}><Star size={15} fill={credential.favorite ? 'currentColor' : 'none'} /></button>
      <button type="button" className="popup-icon-button popup-icon-button--danger" title={t('credential.delete')} aria-label={t('credential.delete')} onClick={() => state.requestDelete(credential)}><Trash2 size={15} /></button>
    </div>
  </article>
}

function EntryEditor() {
  const state = useReactPopupStore()
  const t = usePopupT()
  const editing = state.editingCredential
  const website = editing?.websites[0] ?? getPageWebsiteUrl(state.currentUrl)
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [websiteValue, setWebsiteValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!state.editorOpen) return
    setTitle(editing?.title ?? '')
    setUsername(editing?.username ?? '')
    setPassword(editing?.password ?? '')
    setWebsiteValue(website)
    setShowPassword(false)
    setError('')
  }, [state.editorOpen, editing?.id, website])

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (!title.trim()) { setError(t('entry.error.titleRequired')); return }
    if (title.length > PASSWORD_TITLE_MAX_LENGTH) { setError(t('entry.error.titleTooLong', { max: PASSWORD_TITLE_MAX_LENGTH })); return }
    if (!username.trim() && !password) { setError(t('entry.error.usernameOrPassword')); return }
    setError('')
    void state.saveEntry({ title: title.trim(), username: username.trim(), password, website: websiteValue.trim() })
  }

  async function generate(): Promise<void> {
    try { setPassword(await state.generatePassword()); setShowPassword(true) }
    catch { setError(t('entry.generatePassword')) }
  }

  return <Dialog.Root open={state.editorOpen} onOpenChange={(open) => { if (!open) state.closeEditor() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="popup-dialog-overlay" />
      <Dialog.Content className="popup-editor" aria-describedby="popup-editor-description">
        <header className="popup-editor__header"><button type="button" className="popup-icon-button" title={t('common.back')} aria-label={t('common.back')} disabled={state.entrySaving} onClick={state.closeEditor}><ArrowLeft size={17} /></button><div><Dialog.Title>{t(editing ? 'entry.edit' : 'entry.create')}</Dialog.Title><Dialog.Description id="popup-editor-description">{t('entry.websiteHint')}</Dialog.Description></div><button className="popup-button popup-button--primary" type="submit" form="popup-entry-form" disabled={state.entrySaving}>{state.entrySaving ? t('entry.saving') : t('entry.save')}</button></header>
        <form id="popup-entry-form" className="popup-editor__body" onSubmit={submit}>
          <label className="popup-field"><span>{t('entry.titlePlaceholder')}</span><input autoFocus maxLength={PASSWORD_TITLE_MAX_LENGTH} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('entry.titlePlaceholder')} disabled={state.entrySaving} /></label>
          <label className="popup-field"><span>{t('entry.username')}</span><input autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t('entry.usernamePlaceholder')} disabled={state.entrySaving} /></label>
          <label className="popup-field"><span>{t('entry.password')}</span><span className="popup-password-field"><input autoComplete="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('entry.passwordPlaceholder')} disabled={state.entrySaving} /><button type="button" className="popup-icon-button" title={t(showPassword ? 'entry.hidePassword' : 'entry.showPassword')} aria-label={t(showPassword ? 'entry.hidePassword' : 'entry.showPassword')} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button><button type="button" className="popup-icon-button" title={t('entry.generatePassword')} aria-label={t('entry.generatePassword')} onClick={() => void generate()}><RefreshCw size={15} /></button></span></label>
          <label className="popup-field"><span>{t('entry.website')}</span><input autoComplete="url" value={websiteValue} onChange={(event) => setWebsiteValue(event.target.value)} placeholder={t('entry.websitePlaceholder')} disabled={state.entrySaving} /></label>
          {error && <p className="popup-error" role="alert">{error}</p>}
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function DeleteDialog() {
  const state = useReactPopupStore()
  const t = usePopupT()
  return <Dialog.Root open={!!state.pendingDelete} onOpenChange={(open) => { if (!open) state.cancelDelete() }}>
    <Dialog.Portal><Dialog.Overlay className="popup-dialog-overlay popup-dialog-overlay--confirm" /><Dialog.Content className="popup-confirm"><div className="popup-confirm__icon"><Trash2 size={19} /></div><Dialog.Title>{t('vault.deleteTitle')}</Dialog.Title><Dialog.Description>{t('vault.deleteMessage', { title: state.pendingDelete?.title ?? '' })}</Dialog.Description><div className="popup-confirm__actions"><button className="popup-button popup-button--quiet" type="button" disabled={state.deleting} onClick={state.cancelDelete}>{t('common.cancel')}</button><button className="popup-button popup-button--danger" type="button" disabled={state.deleting} onClick={() => void state.confirmDelete()}>{state.deleting ? t('common.deleting') : t('vault.deleteConfirm')}</button></div></Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}

function SettingsPage() {
  const state = useReactPopupStore()
  const t = usePopupT()
  const status = !state.desktopState?.ready ? 'offline' : !state.desktopState.loggedIn ? 'notLoggedIn' : state.desktopState.locked || !state.desktopState.unlocked ? 'locked' : 'ready'
  const statusKey = `settings.desktop${status === 'notLoggedIn' ? 'NotLoggedIn' : status === 'offline' ? 'Offline' : status === 'locked' ? 'Locked' : 'Ready'}`
  return <main className="popup-settings"><header className="popup-topbar"><button className="popup-icon-button" type="button" title={t('common.back')} aria-label={t('common.back')} onClick={() => { state.openVault(); if (state.desktopState?.unlocked) void state.refreshVault() }}><ArrowLeft size={17} /></button><h1>{t('settings.title')}</h1></header><div className="popup-settings__content"><section className="popup-settings__section"><h2>{t('settings.desktop')}</h2><div className="popup-settings__status"><span>{t('settings.desktopStatus')}</span><strong className={`popup-status__badge popup-status__badge--${status}`}>{t(statusKey)}</strong></div><p>{t('settings.desktopNote')}</p><p>{t('settings.appearanceFromDesktop')}</p></section><section className="popup-settings__section"><h2>{t('settings.about')}</h2><div className="popup-settings__row"><span>{t('settings.version')}</span><strong>{APP_VERSION}</strong></div><div className="popup-settings__row"><span>{t('settings.author')}</span><a href={AUTHOR_GITHUB_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}<ExternalLink size={12} /></a></div><div className="popup-settings__row"><span>{t('settings.officialWebsite')}</span><a href={OFFICIAL_WEBSITE_URL} target="_blank" rel="noopener noreferrer">{t('settings.officialWebsiteLink')}<ExternalLink size={12} /></a></div></section></div><button className="popup-settings__refresh" type="button" disabled={state.sessionLoading} onClick={() => void state.refreshDesktopState()}><RefreshCw size={14} />{t('login.refresh')}</button></main>
}

export default function PopupReactApp() {
  return <PopupContent />
}
