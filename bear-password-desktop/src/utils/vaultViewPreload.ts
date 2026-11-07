import { shallowRef, type Component } from 'vue'

const vaultViewComponent = shallowRef<Component | null>(null)
let loadPromise: Promise<Component> | null = null

function cacheVaultViewComponent(component: Component): void {
  vaultViewComponent.value = component
}

export function getPreloadedVaultView(): Component | null {
  return vaultViewComponent.value
}

/** 后台预加载完整密码库页面（大 chunk），壳页面可立即进入 */
export function preloadVaultViewChunk(): Promise<Component> {
  if (vaultViewComponent.value) {
    return Promise.resolve(vaultViewComponent.value)
  }
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = import('@/views/vault/VaultView.vue').then((mod) => {
    cacheVaultViewComponent(mod.default)
    return mod.default
  })

  return loadPromise
}
