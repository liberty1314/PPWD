<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="bind-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">{{ isRebinding ? t('unlock.rebind') : t('unlock.firstSetup') }}</p>
      <h1 id="bind-title">{{ t('unlock.bind') }}</h1>
      <p class="gate-copy">{{ t('unlock.bindHint') }}</p>
      <p v-if="!storageAvailable" class="gate-warning" role="alert">{{ t('unlock.storageBindUnavailable') }}</p>
      <div class="bind-qr"><img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('unlock.bind')" /></div>
      <label class="gate-label" for="token-secret">{{ t('unlock.manualSecret') }}</label>
      <el-input id="token-secret" :model-value="secret" readonly />
      <el-form label-position="top" class="bind-form" @submit.prevent="submit">
        <el-form-item :label="t('unlock.masterPassword')">
          <el-input v-model="password" type="password" show-password autocomplete="current-password" :disabled="!storageAvailable || loading" />
        </el-form-item>
        <el-form-item :label="t('unlock.tokenCode')">
          <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :disabled="!storageAvailable || loading" @keyup.enter="submit" />
        </el-form-item>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
        <el-button type="primary" size="large" class="gate-primary" :disabled="!storageAvailable" :loading="loading" @click="submit">{{ t('unlock.verifyBind') }}</el-button>
      </el-form>
      <el-button v-if="!isRebinding" text :disabled="loading" @click="regenerate">{{ t('unlock.regenerateSecret') }}</el-button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLogo from '@/components/common/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { useAutoLockStore } from '@/stores/autoLock'
import { generatePhoneTokenSecret, createPhoneTokenQrDataUrl } from '@/utils/phoneToken'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const autoLockStore = useAutoLockStore()
const secret = ref('')
const qrDataUrl = ref('')
const password = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const storageAvailable = ref(false)
const isRebinding = computed(() => route.query.rebind === '1')

function generate(): void {
  secret.value = generatePhoneTokenSecret()
  qrDataUrl.value = createPhoneTokenQrDataUrl(secret.value)
  code.value = ''
}

function regenerate(): void {
  error.value = ''
  generate()
}

async function submit(): Promise<void> {
  if (loading.value) return
  if (!/^\d{6}$/.test(code.value.trim()) || !password.value) {
    error.value = t('unlock.verificationFailed')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await window.phoneTokenApi!.set(secret.value, code.value, password.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? t('unlock.storageBindUnavailable')
        : result.reason === 'locked'
          ? t('unlock.tooManyAttempts')
          : t('unlock.verificationFailed')
      code.value = ''
      return
    }
    await authStore.applyUnlock(result.vuk)
    autoLockStore.unlock()
    password.value = ''
    secret.value = ''
    qrDataUrl.value = ''
    ElMessage.success(t('unlock.bindSuccess'))
    void router.replace({ name: 'Dashboard' })
  } catch {
    error.value = t('unlock.verificationFailed')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    storageAvailable.value = (await window.localVaultApi!.getStatus()).available
  } catch {
    storageAvailable.value = false
  }
  generate()
})
onUnmounted(() => {
  secret.value = ''
  qrDataUrl.value = ''
  password.value = ''
  code.value = ''
})
</script>

<style scoped lang="scss">
.gate-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: $color-bg-primary; }
.gate-panel { width: min(100%, 460px); padding: 30px; border: 1px solid $color-border; border-radius: $radius-lg; background: $color-bg-secondary; text-align: left; }
.gate-eyebrow { margin: 26px 0 6px; color: $color-accent; font-size: $font-size-xs; font-weight: 700; }
h1 { margin: 0 0 10px; color: $color-text-primary; font-size: $font-size-2xl; }
.gate-copy { margin: 0 0 18px; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.65; }
.bind-qr { display: grid; place-items: center; width: 192px; height: 192px; margin: 0 auto 18px; background: white; border: 1px solid $color-border; border-radius: $radius-sm; }
.bind-qr img { display: block; width: 176px; height: 176px; }
.gate-label { display: block; margin: 0 0 8px; color: $color-text-primary; font-size: $font-size-sm; font-weight: 600; }
.bind-form { margin-top: 18px; }
.gate-primary { width: 100%; }
.gate-error { color: $color-danger; font-size: $font-size-sm; }
.gate-warning { padding: 10px; border: 1px solid $color-warning; border-radius: $radius-sm; color: $color-warning; font-size: $font-size-sm; }
@media (max-width: 520px) { .gate-page { padding: 14px; } .gate-panel { padding: 20px; } }
</style>
