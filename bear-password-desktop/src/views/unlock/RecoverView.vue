<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="recover-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">{{ t('unlock.recoveryTitle') }}</p>
      <h1 id="recover-title">{{ t('unlock.verifyRecovery') }}</h1>
      <p class="gate-copy">{{ t('unlock.recoveryHint') }}</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="t('unlock.masterPassword')">
          <el-input v-model="password" type="password" show-password autocomplete="current-password" :disabled="loading" />
        </el-form-item>
        <el-form-item :label="t('unlock.recoveryKey')">
          <el-input v-model="recoveryKey" type="textarea" :rows="3" resize="none" autocomplete="off" :disabled="loading" />
        </el-form-item>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
        <el-button type="primary" size="large" class="gate-primary" :loading="loading" @click="submit">{{ t('unlock.verifyRebind') }}</el-button>
      </el-form>
      <el-button text :disabled="loading" @click="router.replace({ name: 'Unlock' })">{{ t('unlock.backUnlock') }}</el-button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const password = ref('')
const recoveryKey = ref('')
const loading = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await window.phoneTokenApi!.recover(password.value, recoveryKey.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? t('unlock.storageUnavailable')
        : result.reason === 'locked'
          ? t('unlock.tooManyAttempts')
          : t('unlock.verificationFailed')
      return
    }
    password.value = ''
    recoveryKey.value = ''
    await authStore.refreshStatus()
    void router.replace({ name: 'Bind', query: { recovery: '1' } })
  } catch {
    error.value = t('unlock.verificationFailed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.gate-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: $color-bg-primary; }
.gate-panel { width: min(100%, 460px); padding: 30px; border: 1px solid $color-border; border-radius: $radius-lg; background: $color-bg-secondary; }
.gate-eyebrow { margin: 26px 0 6px; color: $color-accent; font-size: $font-size-xs; font-weight: 700; }
h1 { margin: 0 0 10px; color: $color-text-primary; font-size: $font-size-2xl; }
.gate-copy { margin: 0 0 22px; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.65; }
.gate-primary { width: 100%; }
.gate-error { color: $color-danger; font-size: $font-size-sm; }
@media (max-width: 520px) { .gate-page { padding: 14px; } .gate-panel { padding: 20px; } }
</style>
