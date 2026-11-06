<template>
  <main class="gate-page">
    <section class="gate-panel" aria-labelledby="setup-title">
      <AppLogo size="md" />
      <p class="gate-eyebrow">{{ step === 'password' ? '本机保险库' : '恢复材料' }}</p>
      <h1 id="setup-title">{{ step === 'password' ? '创建保险库' : '保存恢复密钥' }}</h1>

      <template v-if="step === 'password'">
        <p class="gate-copy">设置只在本机使用的主密码。新保险库不会连接服务器，也不会导入旧数据。</p>
        <el-form label-position="top" @submit.prevent="prepareRecoveryKey">
          <el-form-item label="主密码">
            <el-input v-model="masterPassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <el-form-item label="确认主密码">
            <el-input v-model="confirmPassword" type="password" show-password autocomplete="new-password" @keyup.enter="prepareRecoveryKey" />
          </el-form-item>
          <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
          <el-button type="primary" size="large" class="gate-primary" @click="prepareRecoveryKey">
            继续
          </el-button>
        </el-form>
      </template>

      <template v-else>
        <p class="gate-copy">恢复密钥只展示这一次。请将它导出或保存到安全位置，再继续绑定手机令牌。</p>
        <label class="gate-label" for="recovery-key">恢复密钥</label>
        <el-input id="recovery-key" :model-value="recoveryKey" type="textarea" readonly :rows="4" resize="none" class="gate-secret" />
        <p class="gate-fingerprint">指纹：{{ fingerprint }}</p>
        <el-checkbox v-model="backupConfirmed" class="gate-confirm">我已妥善保存恢复密钥</el-checkbox>
        <div class="gate-actions">
          <el-button :disabled="creating" @click="downloadKit">导出 Emergency Kit</el-button>
          <el-button type="primary" :disabled="!backupConfirmed" :loading="creating" @click="createVault">
            创建并继续
          </el-button>
        </div>
        <el-button text :disabled="creating" @click="regenerateKey">重新生成密钥</el-button>
        <el-button v-if="error.includes('空目录')" text :disabled="creating" @click="chooseEmptyDirectory">
          选择空数据目录
        </el-button>
        <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
      </template>

      <p v-if="!safeStorageAvailable" class="gate-warning" role="status">
        当前系统安全存储不可用，创建保险库会被阻止。
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { computeSecretKeyFingerprint } from '@/utils/vaultCrypto/vaultKeyDerivation'
import { buildEmergencyKitFileContent, buildEmergencyKitFileName } from '@/utils/vaultCrypto/emergencyKit'
import { generatePhoneTokenRecoveryKey } from '@/utils/phoneToken'

const router = useRouter()
const authStore = useAuthStore()
const step = ref<'password' | 'recovery'>('password')
const masterPassword = ref('')
const confirmPassword = ref('')
const recoveryKey = ref('')
const fingerprint = ref('')
const backupConfirmed = ref(false)
const creating = ref(false)
const error = ref('')
const safeStorageAvailable = ref(true)

onMounted(async () => {
  try {
    const status = await window.localVaultApi?.getStatus()
    safeStorageAvailable.value = status?.available === true
  } catch {
    safeStorageAvailable.value = false
  }
})

async function makeRecoveryKey(): Promise<void> {
  recoveryKey.value = generatePhoneTokenRecoveryKey()
  fingerprint.value = await computeSecretKeyFingerprint(recoveryKey.value)
  backupConfirmed.value = false
}

async function prepareRecoveryKey(): Promise<void> {
  error.value = ''
  if (!masterPassword.value.trim()) {
    error.value = '请输入主密码'
    return
  }
  if (masterPassword.value.trim().length < 6 || masterPassword.value.trim().length > 64) {
    error.value = '主密码需为 6 至 64 位'
    return
  }
  if (masterPassword.value !== confirmPassword.value) {
    error.value = '两次输入的主密码不一致'
    return
  }
  await makeRecoveryKey()
  step.value = 'recovery'
}

async function regenerateKey(): Promise<void> {
  error.value = ''
  await makeRecoveryKey()
}

function downloadKit(): void {
  if (!window.fileApi?.saveSecurityKeyBackup) {
    error.value = '当前环境无法导出恢复材料'
    return
  }
  void window.fileApi.saveSecurityKeyBackup({
    defaultFileName: buildEmergencyKitFileName(),
    content: buildEmergencyKitFileContent({
      version: 2,
      recoveryKey: recoveryKey.value,
      secretKeyFingerprint: fingerprint.value,
      createdAt: new Date().toISOString()
    })
  }).then((result) => {
    if (result.ok) backupConfirmed.value = true
  }).catch(() => {
    error.value = '恢复材料导出失败，请重试'
  })
}

async function chooseEmptyDirectory(): Promise<void> {
  const picked = await window.offlineVaultApi?.pickEmptyDataDir()
  if (picked && !picked.ok) error.value = picked.error ?? '无法使用所选目录'
  else if (picked?.ok) error.value = ''
}

async function createVault(): Promise<void> {
  if (creating.value || !backupConfirmed.value) return
  creating.value = true
  error.value = ''
  try {
    await authStore.createVault(masterPassword.value, recoveryKey.value)
    masterPassword.value = ''
    confirmPassword.value = ''
    recoveryKey.value = ''
    void router.replace({ name: 'Bind' })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保险库创建失败'
  } finally {
    creating.value = false
  }
}
</script>

<style scoped lang="scss">
.gate-page { min-height: 100vh; display: grid; place-items: center; padding: 28px; background: $color-bg-primary; }
.gate-panel { width: min(100%, 460px); padding: 32px; border: 1px solid $color-border; border-radius: $radius-lg; background: $color-bg-secondary; box-shadow: $shadow-md; }
.gate-eyebrow { margin: 28px 0 6px; color: $color-accent; font-size: $font-size-xs; font-weight: 700; }
h1 { margin: 0 0 10px; color: $color-text-primary; font-size: $font-size-2xl; }
.gate-copy { margin: 0 0 22px; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.65; }
.gate-primary { width: 100%; margin-top: 8px; }
.gate-label { display: block; margin-bottom: 8px; color: $color-text-primary; font-size: $font-size-sm; font-weight: 600; }
.gate-secret :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.gate-fingerprint { color: $color-text-muted; font-size: $font-size-xs; overflow-wrap: anywhere; }
.gate-confirm { display: flex; margin: 18px 0; }
.gate-confirm :deep(.el-checkbox__label) { white-space: normal; }
.gate-actions { display: flex; gap: 10px; margin-bottom: 8px; }
.gate-actions :deep(.el-button) { flex: 1; margin-left: 0; }
.gate-error, .gate-warning { color: $color-danger; font-size: $font-size-sm; line-height: 1.5; }
.gate-warning { padding: 10px; border: 1px solid $color-warning; border-radius: $radius-sm; color: $color-warning; }
@media (max-width: 520px) { .gate-page { padding: 16px; } .gate-panel { padding: 22px; } .gate-actions { flex-direction: column; } }
</style>
