<template>
  <div class="offline-vault-settings">
    <div class="offline-vault-settings__panel">
      <div class="offline-vault-settings__row-label">
        <span>{{ t('settings.offlineDataDir') }}</span>
        <small>{{ t('settings.offlineDataDirDesc') }}</small>
      </div>

      <div class="offline-vault-settings__dir-row">
        <el-input
          :model-value="displayDataDir"
          readonly
          size="large"
          class="offline-vault-settings__dir-input"
          :title="displayDataDir"
        />
        <el-button
          size="large"
          class="offline-vault-settings__dir-btn"
          :disabled="!available || offlineVaultStore.saving"
          @click="handlePickDir"
        >
          {{ t('settings.offlineDataDirChoose') }}
        </el-button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '@/composables/useI18n'
import { useOfflineVaultStore } from '@/stores/offlineVault'
import { isLocalVaultApiAvailable } from '@/utils/localVault'
import { settingsMessageBoxConfirm } from '@/utils/settingsMessageBox'

const { t } = useI18n()
const offlineVaultStore = useOfflineVaultStore()
const available = computed(() => isLocalVaultApiAvailable())

const displayDataDir = computed(
  () => offlineVaultStore.dataDir || offlineVaultStore.defaultDataDir || t('settings.offlineDataDirUnset')
)

onMounted(async () => {
  if (!offlineVaultStore.initialized) {
    await offlineVaultStore.loadSettings()
  }
})

async function handlePickDir(): Promise<void> {
  const picked = await offlineVaultStore.pickDataDir()
  if (!picked) return

  if (picked === offlineVaultStore.dataDir) return

  try {
    await settingsMessageBoxConfirm(
      t('settings.offlineDataDirChangeConfirm'),
      t('settings.offlineDataDir'),
      {
        confirmButtonText: t('msg.confirm'),
        cancelButtonText: t('msg.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  const ok = await offlineVaultStore.setDataDir(picked)
  if (!ok) {
    ElMessage.error(t('settings.offlineDataDirSaveFailed'))
    return
  }

  ElMessage.success(t('settings.offlineDataDirSaved'))
}
</script>

<style scoped lang="scss">
.offline-vault-settings {
  padding-bottom: $spacing-md;
  margin-bottom: 0;
  border-bottom: none;

  &__row {
    @include flex-between;
    align-items: flex-start;
    gap: $spacing-lg;

    &--toggle {
      align-items: center;
      padding: 0;
    }
  }

  &__row-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    span {
      color: $color-text-primary;
      font-size: $font-size-md;
    }

    small {
      color: $color-text-muted;
      font-size: $font-size-sm;
      line-height: 1.5;
    }
  }

  &__panel {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding-top: $spacing-md;
  }

  &__dir-row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 100%;
  }

  &__dir-input {
    flex: 1;
    min-width: 0;

    :deep(.el-input__wrapper) {
      font-family: $font-family-mono;
      font-size: $font-size-xs;
    }

    :deep(.el-input__inner) {
      font-family: inherit;
      font-size: inherit;
      color: $color-text-secondary;
    }
  }

  &__dir-btn {
    flex-shrink: 0;
    min-width: 108px;
  }

  &__note {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.6;
  }
}
</style>
