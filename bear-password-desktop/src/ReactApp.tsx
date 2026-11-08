import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Clock3, Home, KeyRound, Minimize2, Settings2, ShieldCheck, Square, Star, X } from 'lucide-react'
import type { TrayRendererCommand } from '../shared/trayMenu'
import { ToastProvider } from './ui/primitives'
import { useReactThemeStore } from './stores/reactTheme'
import { useReactSessionStore } from './stores/reactSession'
import { desktopThemeAdapter } from './platform/desktopThemeAdapter'
import { desktopAuthAdapter } from './platform/desktopAuthAdapter'
import { useAutoLockStore } from './stores/autoLock'
import { useAuthStore } from './stores/auth'
import { useSecurityStore } from './stores/security'
import { useStoreSnapshot } from './stores/reactiveStore'
import { ReactDashboardPage } from './ReactDashboardPage'
import { ReactSecurityCenterPage, ReactVaultWorkspace } from './ReactVaultWorkspace'
import { SetupPage, UnlockPage, RecoverPage, BindPage } from './ReactAuthPages'
import { SettingsPage } from './ReactSettingsPage'
import { useDesktopLocale } from './ui/useDesktopLocale'
import { resolveReactGateRoute } from './utils/reactGateRules'
import logoUrl from './assets/logo.svg'
import './reactApp.css'

function IslandPage() {
  return <main className="react-island"><Activity size={16} /><span>快捷浮窗</span></main>
}

function GateRouter() {
  const session = useReactSessionStore()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const sync = (): void => desktopAuthAdapter.updateSession()
    sync()
    return desktopAuthAdapter.subscribeSession(sync)
  }, [])

  useEffect(() => {
    if (!session.initialized) return
    const target = resolveReactGateRoute(session)
    const rebind = location.pathname === '/bind' && new URLSearchParams(location.search).get('rebind') === '1'
    const canRecover = location.pathname === '/recover' && session.hasLocalVault && session.hasBinding
    if (target) {
      if (location.pathname === target || rebind || canRecover) return
      navigate(target, { replace: true })
      return
    }
    if (location.pathname === '/setup' || location.pathname === '/unlock' || (location.pathname === '/bind' && !rebind)) {
      navigate('/', { replace: true })
    }
  }, [session.initialized, session.hasLocalVault, session.hasBinding, session.hasVaultAccess, location.pathname, location.search, navigate])

  if (!session.initialized) return <main className="react-gate-loading" role="status">BearPassword</main>

  return <Routes>
    <Route path="/setup" element={<SetupPage />} />
    <Route path="/bind" element={<BindPage />} />
    <Route path="/unlock" element={<UnlockPage />} />
    <Route path="/recover" element={<RecoverPage />} />
    <Route path="/*" element={<ReactShellRoutes />} />
  </Routes>
}

function ReactShellRoutes() {
  const [isMac, setIsMac] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()

  useEffect(() => {
    void useReactThemeStore.getState().initialize()
    void desktopThemeAdapter.getPlatform().then((platform) => setIsMac(platform === 'darwin'))
    const onNavigateVault = (event: Event): void => {
      const focus = (event as CustomEvent<{ focus?: boolean }>).detail?.focus
      navigate(focus ? '/vault?focus=1' : '/vault')
    }
    window.addEventListener('bear:navigate-vault', onNavigateVault)
    const unsubscribeTray = desktopThemeAdapter.subscribeTrayCommand((command: TrayRendererCommand) => {
      if (command.action === 'lock') {
        const auth = useAuthStore()
        if (auth.isLoggedIn && !useSecurityStore().isMigrating) useAutoLockStore().lock()
      } else if (command.action === 'set-theme') {
        useReactThemeStore.getState().setPreference('appearanceMode', command.value === 'system' ? 'system' : ['dark', 'midnight', 'noir'].includes(command.value) ? 'dark' : 'light')
      } else if (command.action === 'quick-search') {
        navigate('/vault?focus=1')
      }
    })
    const auth = useAuthStore()
    const security = useSecurityStore()
    const autoLock = useAutoLockStore()
    autoLock.start()
    const onActivity = (): void => { if (!security.isMigrating) autoLock.touchActivity() }
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    activityEvents.forEach((eventName) => document.addEventListener(eventName, onActivity, { capture: true, passive: true }))
    const unsubscribeLock = desktopThemeAdapter.subscribeLockShortcut(() => {
      if (auth.isLoggedIn && !security.isMigrating) autoLock.lock()
    })
    return () => {
      unsubscribeTray()
      unsubscribeLock()
      window.removeEventListener('bear:navigate-vault', onNavigateVault)
      activityEvents.forEach((eventName) => document.removeEventListener(eventName, onActivity, true))
      autoLock.pauseMonitoring()
    }
  }, [])

  if (location.pathname === '/island') return <IslandPage />
  return <div className="react-shell">
    <header className={`react-titlebar ${isMac ? 'react-titlebar--mac' : ''}`} aria-label={translate('window.controls')}>
      <span className="react-titlebar__drag">BearPassword</span>
      {!isMac && <div className="react-titlebar__controls"><button type="button" aria-label={translate('window.minimize')} title={translate('window.minimize')} onClick={() => desktopThemeAdapter.minimize()}><Minimize2 size={13} /></button><button type="button" aria-label={translate('window.maximize')} title={translate('window.maximize')} onClick={() => desktopThemeAdapter.maximize()}><Square size={12} /></button><button type="button" aria-label={translate('window.close')} title={translate('window.close')} onClick={() => desktopThemeAdapter.close()}><X size={14} /></button></div>}
    </header>
    <aside className="react-sidebar bp-glass">
      <div className="react-brand"><img src={logoUrl} alt="" /><span>BearPassword</span><small>{translate('unlock.localVault')}</small></div>
      <nav aria-label={translate('app.navigation')}>
        <NavLink to="/" end title={translate('nav.dashboard')}><Home size={16} />{translate('nav.dashboard')}</NavLink>
        <NavLink to="/vault" title={translate('nav.vault')}><KeyRound size={16} />{translate('nav.vault')}</NavLink>
        <NavLink to="/favorites" title={translate('nav.favorites')}><Star size={16} />{translate('nav.favorites')}</NavLink>
        <NavLink to="/recent" title={translate('nav.recent')}><Clock3 size={16} />{translate('nav.recent')}</NavLink>
        <NavLink to="/security" title={translate('securityCenter.title')}><ShieldCheck size={16} />{translate('securityCenter.title')}</NavLink>
        <NavLink to="/settings/general" title={translate('nav.settings')}><Settings2 size={16} />{translate('nav.settings')}</NavLink>
      </nav>
      <div className="react-sidebar__status"><span className="react-status-dot" />{translate('dashboard.vaultProtected')}</div>
    </aside>
    <div className="react-workspace"><Routes><Route path="/" element={<ReactDashboardPage />} /><Route path="/vault" element={<ReactVaultWorkspace mode="vault" />} /><Route path="/favorites" element={<ReactVaultWorkspace mode="favorites" />} /><Route path="/recent" element={<ReactVaultWorkspace mode="recent" />} /><Route path="/security" element={<ReactSecurityCenterPage />} /><Route path="/settings/:section" element={<SettingsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<ReactDashboardPage />} /></Routes></div>
  </div>
}

export default function ReactApp() {
  useStoreSnapshot(useAuthStore)
  useStoreSnapshot(useSecurityStore)
  useStoreSnapshot(useAutoLockStore)
  return <ToastProvider><HashRouter><GateRouter /></HashRouter></ToastProvider>
}
