import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useAuthStore } from './stores/auth'
import { useAutoLockStore } from './stores/autoLock'
import { useSecurityStore } from './stores/security'
import { registerExtensionBridgeClient } from './extensionBridge/register'
import { initFontOnBoot } from './utils/font'
import { initLocaleOnBoot } from './utils/localePreference'
import { initGlobalShortcutBridge } from './utils/globalShortcutBridge'
import ReactApp from './ReactApp'
import { ErrorBoundary } from './ui/ErrorBoundary'
import '../../shared/ui/tokens.css'
import '../../shared/ui/primitives.css'

const root = document.getElementById('app')
if (!root) throw new Error('应用根节点不存在')
const mountRoot = root as HTMLElement

async function bootstrap(): Promise<void> {
  initFontOnBoot()
  initLocaleOnBoot()
  const auth = useAuthStore()
  const security = useSecurityStore()
  const autoLock = useAutoLockStore()
  try {
    await auth.refreshStatus()
    await security.init()
    autoLock.ensureSecureLockState()
    autoLock.ensureVaultSessionLocked()
  } catch (error) {
    console.error('[desktop-react] 本地保险库状态读取失败', error)
  }
  registerExtensionBridgeClient()
  initGlobalShortcutBridge()
  createRoot(mountRoot).render(<StrictMode><ErrorBoundary><ReactApp /></ErrorBoundary></StrictMode>)
}

void bootstrap()
