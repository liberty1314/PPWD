<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="bind-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">{{ isRebinding ? '更换验证器' : '首次设置' }}</p>
      <h1 id="bind-title">绑定手机令牌</h1>
      <p class="gate-copy">使用手机上的验证器扫描二维码，或手动输入密钥。绑定前请确认主密码和动态码。</p>
      <p v-if="!storageAvailable" class="gate-warning" role="alert">系统安全存储不可用，无法完成绑定。</p>
      <div class="bind-qr"><img v-if="qrDataUrl" :src="qrDataUrl" alt="手机令牌绑定二维码" /></div>
      <label class="gate-label" for="token-secret">手动密钥</label>
      <el-input id="token-secret" :model-value="secret" readonly />
      <el-form label-position="top" class="bind-form" @submit.prevent="submit">
        <el-form-item label="主密码">
          <el-input v-model="password" type="password" show-password autocomplete="current-password" :disabled="!storageAvailable || loading" />
        </el-form-item>
        <el-form-item label="6 位动态码">
          <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :disabled="!storageAvailable || loading" @keyup.enter="submit" />
        </el-form-item>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
        <el-button type="primary" size="large" class="gate-primary" :disabled="!storageAvailable" :loading="loading" @click="submit">验证并绑定</el-button>
      </el-form>
      <el-button v-if="!isRebinding" text :disabled="loading" @click="regenerate">重新生成密钥</el-button>
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

const router = useRouter()
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
    error.value = '验证失败'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await window.phoneTokenApi!.set(secret.value, code.value, password.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? '系统安全存储不可用，无法完成绑定'
        : result.reason === 'locked'
          ? '尝试次数过多，请稍后再试'
          : '验证失败'
      code.value = ''
      return
    }
    await authStore.applyUnlock(result.vuk)
    autoLockStore.unlock()
    password.value = ''
    secret.value = ''
    qrDataUrl.value = ''
    ElMessage.success('手机令牌绑定成功')
    void router.replace({ name: 'Dashboard' })
  } catch {
    error.value = '验证失败'
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
