<template>
  <section class="vault-backup-settings" aria-labelledby="vault-backup-title">
    <h3 id="vault-backup-title">{{ t('backup.title') }}</h3>
    <p>{{ t('backup.description') }}</p>
    <el-input
      v-model="backupPassword"
      type="password"
      show-password
      autocomplete="new-password"
      :placeholder="t('backup.password')"
    />
    <div class="vault-backup-settings__actions">
      <el-button :loading="exporting" @click="exportBackup">{{ t('backup.export') }}</el-button>
      <el-button type="primary" :loading="importing" @click="importBackup">{{ t('backup.import') }}</el-button>
      <el-button type="danger" plain :loading="deleting" @click="deleteVaultData">{{ t('backup.deleteVault') }}</el-button>
    </div>
    <div v-if="deleteFormVisible" class="vault-backup-settings__delete-form">
      <el-input v-model="deleteMasterPassword" type="password" show-password autocomplete="current-password" :placeholder="t('phoneToken.masterPassword')" />
      <el-input v-model="deleteTokenCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :placeholder="t('phoneToken.code')" />
      <el-button text @click="cancelDelete">{{ t('common.cancel') }}</el-button>
    </div>
    <p class="vault-backup-settings__hint">{{ t('backup.hint') }}</p>
    <p v-if="error" class="vault-backup-settings__error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { encryptVaultBackup, decryptVaultBackup } from '@/utils/encryptedVaultBackup'
import type { OfflineVaultSnapshot } from '../../../shared/offlineVault.ts'

const { t } = useI18n()
const authStore = useAuthStore()
const backupPassword = ref('')
const exporting = ref(false)
const importing = ref(false)
const deleting = ref(false)
const deleteFormVisible = ref(false)
const deleteMasterPassword = ref('')
const deleteTokenCode = ref('')
const error = ref('')

async function saveBackup(snapshot: unknown): Promise<boolean> {
  const fingerprint = authStore.status?.fingerprint
  if (!fingerprint) throw new Error(t('backup.unavailable'))
  const content = await encryptVaultBackup(snapshot as OfflineVaultSnapshot, fingerprint, backupPassword.value)
  const result = await window.fileApi!.saveEncryptedVaultBackup({ content })
  return result.ok
}

async function exportBackup(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  try {
    const result = await saveBackup(await window.offlineVaultApi!.readSnapshot())
    if (result) ElMessage.success(t('backup.exported'))
  } catch (cause) {
    error.value = cause instanceof Error && cause.message.startsWith('backup.')
      ? t(cause.message)
      : cause instanceof Error ? cause.message : t('backup.failed')
  } finally {
    exporting.value = false
  }
}

async function importBackup(): Promise<void> {
  if (importing.value) return
  importing.value = true
  error.value = ''
  try {
    const selected = await window.fileApi!.pickEncryptedVaultBackup()
    if (!selected) return
    const fingerprint = authStore.status?.fingerprint
    if (!fingerprint) throw new Error(t('backup.unavailable'))
    const snapshot = await decryptVaultBackup(selected.content, fingerprint, backupPassword.value)
    await ElMessageBox.confirm(t('backup.replaceConfirm'), t('backup.replaceTitle'), {
      type: 'warning',
      confirmButtonText: t('backup.replace'),
      cancelButtonText: t('common.cancel')
    })
    const current = await window.offlineVaultApi!.readSnapshot()
    const saved = await saveBackup(current)
    if (!saved) return
    const result = await window.offlineVaultApi!.importSnapshot(snapshot)
    if (!result.ok) throw new Error(result.error)
    ElMessage.success(t('backup.imported'))
    window.location.reload()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    const message = cause instanceof Error ? cause.message : t('backup.failed')
    error.value = message.startsWith('backup.') ? t(message) : message
  } finally {
    importing.value = false
  }
}

async function deleteVaultData(): Promise<void> {
  if (!deleteFormVisible.value) {
    deleteFormVisible.value = true
    return
  }
  if (deleting.value) return
  deleting.value = true
  error.value = ''
  try {
    const current = await window.offlineVaultApi!.readSnapshot()
    const saved = await saveBackup(current)
    if (!saved) return
    await ElMessageBox.confirm(t('backup.deleteConfirm'), t('backup.deleteTitle'), {
      type: 'error',
      confirmButtonText: t('backup.deleteConfirmButton'),
      cancelButtonText: t('common.cancel')
    })
    const result = await window.phoneTokenApi!.destroy(deleteTokenCode.value, deleteMasterPassword.value)
    if (!result.ok) {
      error.value = result.reason === 'unavailable'
        ? t('phoneToken.storageUnavailable')
        : result.reason === 'locked'
          ? t('phoneToken.locked')
          : t('phoneToken.verificationFailed')
      return
    }
    deleteMasterPassword.value = ''
    deleteTokenCode.value = ''
    window.location.reload()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    error.value = cause instanceof Error ? cause.message : t('backup.failed')
  } finally {
    deleting.value = false
  }
}

function cancelDelete(): void {
  deleteFormVisible.value = false
  deleteMasterPassword.value = ''
  deleteTokenCode.value = ''
}
</script>

<style scoped lang="scss">
.vault-backup-settings {
  display: grid;
  gap: 10px;
  padding: 20px 0;
  border-top: 1px solid $color-border;
}

h3 { margin: 0; color: $color-text-primary; font-size: $font-size-md; }
p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.6; }
.vault-backup-settings__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.vault-backup-settings__delete-form { display: grid; gap: 10px; }
.vault-backup-settings__hint { color: $color-text-muted; }
.vault-backup-settings__error { color: $color-danger; }
</style>
