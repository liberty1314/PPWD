<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="recover-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">恢复手机令牌</p>
      <h1 id="recover-title">验证恢复材料</h1>
      <p class="gate-copy">需要同时提供主密码和完整恢复密钥。验证成功后，旧令牌会立即作废，并进入重新绑定流程。</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="主密码">
          <el-input v-model="password" type="password" show-password autocomplete="current-password" :disabled="loading" />
        </el-form-item>
        <el-form-item label="恢复密钥">
          <el-input v-model="recoveryKey" type="textarea" :rows="3" resize="none" autocomplete="off" :disabled="loading" />
        </el-form-item>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
        <el-button type="primary" size="large" class="gate-primary" :loading="loading" @click="submit">验证并重新绑定</el-button>
      </el-form>
      <el-button text :disabled="loading" @click="router.replace({ name: 'Unlock' })">返回解锁</el-button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
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
        ? '系统安全存储不可用，无法恢复'
        : result.reason === 'locked'
          ? '尝试次数过多，请稍后再试'
          : '验证失败'
      return
    }
    password.value = ''
    recoveryKey.value = ''
    await authStore.refreshStatus()
    void router.replace({ name: 'Bind', query: { recovery: '1' } })
  } catch {
    error.value = '验证失败'
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
