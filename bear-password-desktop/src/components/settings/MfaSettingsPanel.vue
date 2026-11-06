<template>
  <section class="phone-token-settings" aria-labelledby="phone-token-title">
    <h3 id="phone-token-title">{{ t('phoneToken.title') }}</h3>
    <p class="phone-token-settings__status">
      {{ authStore.hasPhoneTokenBinding ? t('phoneToken.bound') : t('phoneToken.unbound') }}
      <span v-if="authStore.status?.fingerprint">· {{ t('phoneToken.fingerprint', { fingerprint: authStore.status.fingerprint }) }}</span>
    </p>

    <div v-if="authStore.hasPhoneTokenBinding" class="phone-token-settings__section">
      <h4>{{ t('phoneToken.rebind') }}</h4>
      <p>{{ t('phoneToken.rebindHint') }}</p>
      <el-input v-model="password" type="password" show-password autocomplete="current-password" :placeholder="t('phoneToken.masterPassword')" />
      <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :placeholder="t('phoneToken.oldCode')" />
      <el-button type="primary" :loading="loading" @click="startRebind">{{ t('phoneToken.verifyRebind') }}</el-button>
    </div>

    <div v-if="authStore.hasRecoveryKey" class="phone-token-settings__section">
      <h4>{{ t('recoveryKey.title') }}</h4>
      <p>{{ t('recoveryKey.viewHint') }}</p>
      <template v-if="!revealedKey">
        <el-input v-model="revealPassword" type="password" show-password autocomplete="current-password" :placeholder="t('phoneToken.masterPassword')" />
        <el-input v-model="revealCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :placeholder="t('phoneToken.code')" />
        <el-button :loading="revealing" @click="revealRecoveryKey">{{ t('recoveryKey.verifyView') }}</el-button>
      </template>
      <template v-else>
        <el-input :model-value="revealedKey" type="textarea" readonly :rows="3" resize="none" />
        <el-button @click="clearRevealedKey">{{ t('recoveryKey.hide') }}</el-button>
      </template>
    </div>

    <p v-if="error" class="phone-token-settings__error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSettingsDialogStore } from '@/stores/settingsDialog'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const authStore = useAuthStore()
const settingsDialog = useSettingsDialogStore()
const { t } = useI18n()
const password = ref('')
const code = ref('')
const revealPassword = ref('')
const revealCode = ref('')
const revealedKey = ref('')
const loading = ref(false)
const revealing = ref(false)
const error = ref('')

async function startRebind(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const authorized = await window.phoneTokenApi!.rebind(code.value, password.value)
    if (!authorized.ok) {
      error.value = authorized.reason === 'unavailable'
        ? t('phoneToken.storageUnavailable')
        : authorized.reason === 'locked'
          ? t('phoneToken.locked')
          : t('phoneToken.verificationFailed')
      code.value = ''
      return
    }
    password.value = ''
    code.value = ''
    await authStore.refreshStatus()
    settingsDialog.close()
    void router.replace({ name: 'Bind', query: { rebind: '1' } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('phoneToken.rebindFailed')
  } finally {
    loading.value = false
  }
}

async function revealRecoveryKey(): Promise<void> {
  if (revealing.value) return
  revealing.value = true
  error.value = ''
  try {
    const result = await window.recoveryKeyApi!.authorize(revealCode.value, revealPassword.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? t('phoneToken.storageUnavailable')
        : result.reason === 'locked'
          ? t('phoneToken.locked')
          : t('phoneToken.verificationFailed')
      revealCode.value = ''
      return
    }
    const key = await window.recoveryKeyApi!.get()
    if (!key) throw new Error(t('recoveryKey.readFailed'))
    revealedKey.value = key
    revealPassword.value = ''
    revealCode.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('recoveryKey.readFailed')
  } finally {
    revealing.value = false
  }
}

function clearRevealedKey(): void {
  revealedKey.value = ''
  ElMessage.success(t('recoveryKey.hidden'))
}

onUnmounted(() => {
  revealedKey.value = ''
  revealPassword.value = ''
  revealCode.value = ''
  password.value = ''
  code.value = ''
})
</script>

<style scoped lang="scss">
.phone-token-settings { margin: 22px 0; padding-top: 20px; border-top: 1px solid $color-border; }
h3, h4 { margin: 0 0 8px; color: $color-text-primary; }
h3 { font-size: $font-size-md; }
h4 { font-size: $font-size-sm; }
.phone-token-settings__status, .phone-token-settings__section p { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.6; }
.phone-token-settings__section { display: grid; gap: 10px; padding: 14px 0; border-top: 1px solid $color-border; }
.phone-token-settings__error { color: $color-danger; font-size: $font-size-sm; }
</style>
