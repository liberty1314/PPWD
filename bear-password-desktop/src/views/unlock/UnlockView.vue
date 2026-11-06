<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="unlock-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">本机保险库</p>
      <h1 id="unlock-title">解锁</h1>
      <p v-if="biometricSettingsLoaded" class="gate-copy">
        {{ biometricOnlyMode ? '使用系统生物识别解锁，或切换为手机验证器动态码。' : '输入手机验证器当前显示的 6 位动态码。' }}
      </p>
      <p v-else class="gate-copy" role="status">正在检查生物识别状态…</p>
      <p v-if="biometricSettingsLoaded && biometricEnabled && !biometricAvailable" class="gate-notice" role="status">
        生物识别当前不可用，请使用手机动态码解锁。
      </p>
      <el-button
        v-if="biometricOnlyMode"
        type="primary"
        size="large"
        class="gate-primary gate-biometric"
        :loading="biometricLoading"
        @click="unlockBiometric"
      >
        {{ biometricLabel }}
      </el-button>
      <div v-if="biometricOnlyMode" class="gate-divider"><span>或</span></div>
      <el-form v-if="biometricSettingsLoaded && !biometricOnlyMode" label-position="top" @submit.prevent="submit">
        <el-form-item label="6 位动态码">
          <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :disabled="loading" @keyup.enter="submit" />
        </el-form-item>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
        <el-button type="primary" size="large" class="gate-primary" :loading="loading" @click="submit">
          使用动态码解锁
        </el-button>
      </el-form>
      <el-button v-if="biometricOnlyMode" text class="gate-switch" @click="showTotpFallback = true">改用动态码</el-button>
      <el-button v-else-if="biometricAvailable && biometricEnabled" text class="gate-switch" @click="switchToBiometric">改用生物识别</el-button>
      <div class="gate-links">
        <el-button text @click="router.push({ name: 'Recover' })">恢复访问</el-button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { useAutoLockStore } from '@/stores/autoLock'
import { useBiometricUnlockStore } from '@/stores/biometricUnlock'

const router = useRouter()
const authStore = useAuthStore()
const autoLockStore = useAutoLockStore()
const biometricStore = useBiometricUnlockStore()
const code = ref('')
const loading = ref(false)
const biometricLoading = ref(false)
const error = ref('')
const biometricSettingsLoaded = ref(false)
const showTotpFallback = ref(false)
const biometricAvailable = ref(false)
const biometricKind = ref<'touchId' | 'windowsHello' | null>(null)
const biometricEnabled = computed(() => biometricStore.preferBiometricUnlock)
const biometricOnlyMode = computed(() => biometricAvailable.value && biometricEnabled.value && !showTotpFallback.value)
const biometricLabel = computed(() => biometricKind.value === 'touchId' ? '使用 Touch ID' : '使用 Windows Hello')

onMounted(async () => {
  try {
    const [availability, hasKey] = await Promise.all([
      window.biometricApi?.getAvailability(),
      window.vaultPasswordApi?.has()
    ])
    biometricAvailable.value = availability?.available === true && hasKey === true
    biometricKind.value = availability?.kind ?? null
  } catch {
    biometricAvailable.value = false
  } finally {
    biometricSettingsLoaded.value = true
  }
})

async function completeUnlock(vuk: string): Promise<void> {
  await authStore.applyUnlock(vuk)
  autoLockStore.unlock()
  code.value = ''
  void router.replace({ name: 'Dashboard' })
}

function switchToBiometric(): void {
  error.value = ''
  showTotpFallback.value = false
}

async function submit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await window.phoneTokenApi!.verify(code.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? '系统安全存储不可用，无法解锁'
        : result.reason === 'locked'
          ? '尝试次数过多，请稍后再试'
          : '验证失败'
      code.value = ''
      return
    }
    await completeUnlock(result.vuk)
  } catch {
    error.value = '验证失败'
  } finally {
    loading.value = false
  }
}

async function unlockBiometric(): Promise<void> {
  if (biometricLoading.value) return
  biometricLoading.value = true
  error.value = ''
  try {
    const result = await window.localVaultApi!.biometricUnlock('解锁 BearPassword 保险库')
    if (!result.ok) {
      error.value = result.reason === 'canceled'
          ? ''
          : '生物识别解锁失败'
      if (result.reason !== 'canceled') showTotpFallback.value = true
      return
    }
    await authStore.applyUnlock(result.vuk)
    autoLockStore.unlock()
    void router.replace({ name: 'Dashboard' })
  } catch {
    error.value = '生物识别解锁失败'
    showTotpFallback.value = true
  } finally {
    biometricLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.gate-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: $color-bg-primary; }
.gate-panel { width: min(100%, 420px); padding: 30px; border: 1px solid $color-border; border-radius: $radius-lg; background: $color-bg-secondary; }
.gate-eyebrow { margin: 26px 0 6px; color: $color-accent; font-size: $font-size-xs; font-weight: 700; }
h1 { margin: 0 0 10px; color: $color-text-primary; font-size: $font-size-2xl; }
.gate-copy { margin: 0 0 22px; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.65; }
.gate-primary { width: 100%; }
.gate-biometric { margin-bottom: 18px; }
.gate-switch { display: flex; margin: 0 auto; }
.gate-divider { display: flex; align-items: center; gap: 12px; margin: 0 0 6px; color: $color-text-secondary; font-size: $font-size-xs; }
.gate-divider::before, .gate-divider::after { content: ''; flex: 1; height: 1px; background: $color-border; }
.gate-error { color: $color-danger; font-size: $font-size-sm; }
.gate-notice { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.5; }
.gate-links { display: flex; justify-content: space-between; margin-top: 12px; }
@media (max-width: 520px) { .gate-page { padding: 14px; } .gate-panel { padding: 20px; } }
</style>
