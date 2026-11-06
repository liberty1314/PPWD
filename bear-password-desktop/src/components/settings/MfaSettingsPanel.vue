<template>
  <section class="phone-token-settings" aria-labelledby="phone-token-title">
    <h3 id="phone-token-title">手机令牌</h3>
    <p class="phone-token-settings__status">
      {{ authStore.hasPhoneTokenBinding ? '已绑定' : '未绑定' }}
      <span v-if="authStore.status?.fingerprint">· 恢复密钥指纹 {{ authStore.status.fingerprint }}</span>
    </p>

    <div v-if="authStore.hasPhoneTokenBinding" class="phone-token-settings__section">
      <h4>换绑验证器</h4>
      <p>先使用旧验证器动态码和主密码验证。旧绑定作废后需完成新的二维码绑定。</p>
      <el-input v-model="password" type="password" show-password autocomplete="current-password" placeholder="主密码" />
      <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="旧验证器 6 位动态码" />
      <el-button type="primary" :loading="loading" @click="startRebind">验证并换绑</el-button>
    </div>

    <div v-if="authStore.hasRecoveryKey" class="phone-token-settings__section">
      <h4>恢复密钥</h4>
      <p>已配置。查看完整密钥前需再次验证主密码和手机令牌。</p>
      <template v-if="!revealedKey">
        <el-input v-model="revealPassword" type="password" show-password autocomplete="current-password" placeholder="主密码" />
        <el-input v-model="revealCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位动态码" />
        <el-button :loading="revealing" @click="revealRecoveryKey">验证并查看</el-button>
      </template>
      <template v-else>
        <el-input :model-value="revealedKey" type="textarea" readonly :rows="3" resize="none" />
        <el-button @click="clearRevealedKey">隐藏恢复密钥</el-button>
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

const router = useRouter()
const authStore = useAuthStore()
const settingsDialog = useSettingsDialogStore()
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
        ? '系统安全存储不可用'
        : authorized.reason === 'locked'
          ? '尝试次数过多，请稍后重试'
          : '验证失败'
      code.value = ''
      return
    }
    password.value = ''
    code.value = ''
    await authStore.refreshStatus()
    settingsDialog.close()
    void router.replace({ name: 'Bind', query: { rebind: '1' } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '换绑失败'
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
        ? '系统安全存储不可用'
        : result.reason === 'locked'
          ? '尝试次数过多，请稍后重试'
          : '验证失败'
      revealCode.value = ''
      return
    }
    const key = await window.recoveryKeyApi!.get()
    if (!key) throw new Error('恢复密钥读取失败')
    revealedKey.value = key
    revealPassword.value = ''
    revealCode.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '恢复密钥读取失败'
  } finally {
    revealing.value = false
  }
}

function clearRevealedKey(): void {
  revealedKey.value = ''
  ElMessage.success('恢复密钥已隐藏')
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
