import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import App from './App.vue'
import router from './router'
import pinia from './stores'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAutoLockStore } from '@/stores/autoLock'
import { useSecurityStore } from '@/stores/security'
import { initFontOnBoot } from '@/utils/font'
import { initLocaleOnBoot } from '@/utils/localePreference'
import { initThemeOnBoot } from '@/utils/theme'
import { registerExtensionBridgeClient } from '@/extensionBridge/register'
import '@/styles/index.scss'

initThemeOnBoot()
initFontOnBoot()
initLocaleOnBoot()

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  app.use(pinia)

  const authStore = useAuthStore()
  const securityStore = useSecurityStore()
  const autoLockStore = useAutoLockStore()
  try {
    await authStore.refreshStatus()
    await securityStore.init()
    autoLockStore.ensureSecureLockState()
    autoLockStore.ensureVaultSessionLocked()
  } catch (error) {
    console.error('[bootstrap] 本地保险库状态读取失败', error)
  }

  app.use(router)
  app.use(ElementPlus, { size: 'default' })
  void useAppStore().initTheme()
  registerExtensionBridgeClient()
  app.mount('#app')
}

void bootstrap()
