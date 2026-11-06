<template>
  <el-config-provider :locale="elementLocale" :z-index="Z_INDEX_ELEMENT_PLUS">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useSecurityStore } from '@/stores/security'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useI18n } from '@/composables/useI18n'
import { getElementPlusLocale } from '@/locales'
import { Z_INDEX_ELEMENT_PLUS } from '@/constants/zIndex'
import { initGlobalShortcutBridge } from '@/utils/globalShortcutBridge'
import { initTrayBridge } from '@/utils/trayBridge'
import { useOfflineVaultStore } from '@/stores/offlineVault'

const appStore = useAppStore()
const authStore = useAuthStore()
const securityStore = useSecurityStore()
const router = useRouter()
const { t } = useI18n()

const elementLocale = computed(() => getElementPlusLocale(appStore.resolvedLocale))

initGlobalShortcutBridge()
initTrayBridge()

watch(
  () => [authStore.hasLocalVault, authStore.hasPhoneTokenBinding, securityStore.hasVaultAccess] as const,
  ([hasVault, hasBinding, hasAccess]) => {
    const currentName = router.currentRoute.value.name
    if (!hasVault && currentName !== 'Setup') {
      void router.replace({ name: 'Setup' })
    } else if (hasVault && !hasBinding && currentName !== 'Bind') {
      void router.replace({ name: 'Bind' })
    } else if (
      hasVault && hasBinding && !hasAccess &&
      currentName !== 'Unlock' && currentName !== 'Recover'
    ) {
      void router.replace({ name: 'Unlock' })
    }
  },
  { immediate: true, flush: 'sync' }
)

onMounted(async () => {
  void useOfflineVaultStore().loadSettings()

  const shortcutsStore = useShortcutsStore()
  await shortcutsStore.init()
  const result = await shortcutsStore.syncToMain()

  if (!window.shortcutApi) return

  if (!result.ok) {
    const messages = Object.values(result.failed ?? {}).filter(Boolean)
    ElMessage.warning(messages[0] ?? t('msg.shortcutRegisterPartial'))
    return
  }

  const status = result.status
  if (!status) return

  const globalFailed =
    (status.open.enabled && !status.open.registered) ||
    (status.lock.enabled && !status.lock.registered)

  if (globalFailed) {
    ElMessage.warning(t('msg.shortcutRegisterGlobalFailed'))
  }
})
</script>
