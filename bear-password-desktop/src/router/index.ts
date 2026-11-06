import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from './routes'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) return { name: 'Unlock', replace: true }
  if (!authStore.hasLocalVault) {
    return to.name === 'Setup' ? true : { name: 'Setup', replace: true }
  }
  if (!authStore.hasPhoneTokenBinding) {
    return to.name === 'Bind' ? true : { name: 'Bind', replace: true }
  }
  if (to.name === 'Setup' || to.name === 'Bind') {
    return authStore.isUnlocked ? { name: 'Dashboard', replace: true } : { name: 'Unlock', replace: true }
  }
  if (to.name === 'Recover') return true
  if (to.name === 'Unlock') {
    return authStore.isUnlocked ? { name: 'Dashboard', replace: true } : true
  }
  if (to.matched.some((record) => record.meta.requiresUnlock) && !authStore.isUnlocked) {
    return { name: 'Unlock', replace: true }
  }
  if (to.name === 'Recover') return true
  return true
})

export default router
