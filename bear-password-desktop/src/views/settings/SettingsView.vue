<template>
  <div
    class="settings-view"
    :class="{
      'settings-view--embedded': embedded,
      'settings-view--dialog': dialog
    }"
  >
    <header v-if="!embedded" class="settings-view__header">
      <h1>{{ t('settings.title') }}</h1>
      <p>{{ t('settings.subtitle') }}</p>
    </header>

    <div class="settings-view__grid">
    <div v-if="showSection('general')" class="settings-view__section">
      <h3 v-if="!section">{{ t('settings.general') }}</h3>

      <div class="settings-view__row settings-view__row--launch">
        <div class="settings-view__row-label">
          <span>{{ t('settings.launchAtLogin') }}</span>
          <small>{{ t('settings.launchAtLoginDesc') }}</small>
        </div>
        <el-switch
          :model-value="launchAtLoginStore.enabled"
          :loading="launchAtLoginStore.loading"
          :disabled="!launchAtLoginStore.available"
          @change="handleLaunchAtLoginChange"
        />
      </div>

      <div class="settings-view__row settings-view__row--launch">
        <div class="settings-view__row-label">
          <span>{{ t('settings.tray') }}</span>
          <small>{{ t('settings.trayDesc') }}</small>
        </div>
        <el-switch
          :model-value="trayStore.enabled"
          :loading="trayStore.loading"
          :disabled="!trayStore.available"
          @change="handleTrayEnabledChange"
        />
      </div>

      <div class="settings-view__row settings-view__row--launch">
        <div class="settings-view__row-label">
          <span>{{ t('settings.dockHidden') }}</span>
          <small>{{ t('settings.dockHiddenDesc') }}</small>
        </div>
        <el-switch
          :model-value="dockStore.hidden"
          :loading="dockStore.loading"
          :disabled="!dockStore.available"
          @change="handleDockHiddenChange"
        />
      </div>

      <div class="settings-view__row settings-view__row--launch">
        <div class="settings-view__row-label">
          <span>{{ t('settings.trayClickAction') }}</span>
          <small>{{ t('settings.trayClickActionDesc') }}</small>
        </div>
        <el-select
          :model-value="trayStore.clickAction"
          class="settings-view__tray-select"
          size="large"
          :disabled="!trayStore.available || !trayStore.enabled || trayStore.loading"
          @update:model-value="handleTrayClickActionChange"
        >
          <el-option
            v-for="option in TRAY_CLICK_ACTION_OPTIONS"
            :key="option.value"
            :label="t(`tray.action.${option.value}`)"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>

    <div v-if="showSection('security')" class="settings-view__section">
      <h3 v-if="!section">{{ t('settings.security') }}</h3>
      <MfaSettingsPanel />
      <VaultBackupSettingsPanel />

      <div class="settings-view__row settings-view__row--auto-lock">
        <div class="settings-view__row-label">
          <span>{{ t('settings.autoLock') }}</span>
          <small>{{ t('settings.autoLockDesc') }}</small>
        </div>
        <el-select
          v-model="autoLockMinutes"
          size="large"
          class="settings-view__auto-lock-select"
          :disabled="securityStore.isMigrating"
        >
          <el-option
            v-for="item in autoLockOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="settings-view__row settings-view__row--auto-lock">
        <div class="settings-view__row-label">
          <span>{{ t('settings.clipboardClear') }}</span>
          <small>{{ t('settings.clipboardClearDesc') }}</small>
        </div>
        <el-select
          v-model="clipboardClearSeconds"
          size="large"
          class="settings-view__auto-lock-select"
          :disabled="securityStore.isMigrating"
        >
          <el-option
            v-for="item in clipboardClearOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div
        v-if="biometricUnlockSectionVisible"
        class="settings-view__row settings-view__row--launch settings-view__row--biometric"
      >
        <div class="settings-view__row-label">
          <span>{{ t('settings.preferBiometricUnlock') }}</span>
          <small>{{ preferBiometricUnlockDesc }}</small>
          <small v-if="biometricUnavailableHint" class="settings-view__biometric-unavailable">
            {{ biometricUnavailableHint }}
          </small>
        </div>
        <el-switch
          :model-value="biometricUnlockStore.preferBiometricUnlock"
          :disabled="!biometricUnlockSupported || securityStore.isMigrating"
          @change="handlePreferBiometricUnlockChange"
        />
      </div>

      <OfflineVaultSettingsPanel />
    </div>

    <div v-if="showSection('appearance')" class="settings-view__section">
      <h3 v-if="!section">{{ t('settings.appearance') }}</h3>

      <div class="settings-view__row settings-view__row--theme">
        <div class="settings-view__row-label">
          <span>{{ t('settings.theme') }}</span>
          <small>{{ themeDescription }}</small>
        </div>
        <el-select
          :model-value="appStore.themePreference"
          class="settings-view__theme-select"
          size="large"
          :placeholder="t('settings.selectTheme')"
          @update:model-value="appStore.setThemePreference"
        >
          <el-option
            v-for="option in THEME_OPTIONS"
            :key="option.value"
            :label="t(getThemeLabelKey(option.value))"
            :value="option.value"
          />
        </el-select>
      </div>

      <div class="settings-view__row settings-view__row--theme">
        <div class="settings-view__row-label">
          <span>{{ t('settings.font') }}</span>
          <small>{{ fontDescription }}</small>
        </div>
        <el-select
          :model-value="appStore.fontPreference"
          class="settings-view__theme-select"
          size="large"
          :placeholder="t('settings.selectFont')"
          @update:model-value="appStore.setFontPreference"
        >
          <el-option
            v-for="option in FONT_OPTIONS"
            :key="option.value"
            :label="t(`font.${option.value}`)"
            :value="option.value"
          />
        </el-select>
      </div>

      <div class="settings-view__row settings-view__row--theme">
        <div class="settings-view__row-label">
          <span>{{ t('settings.language') }}</span>
          <small>{{ localeDescription }}</small>
        </div>
        <el-select
          :model-value="appStore.localePreference"
          class="settings-view__theme-select"
          size="large"
          :placeholder="t('settings.selectLanguage')"
          @update:model-value="appStore.setLocalePreference"
        >
          <el-option
            v-for="option in LOCALE_PREFERENCE_OPTIONS"
            :key="option.value"
            :label="t(option.labelKey)"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>

    <div v-if="showSection('shortcuts')" class="settings-view__section">
      <h3 v-if="!section">{{ t('settings.shortcuts') }}</h3>

      <p v-if="!isDesktopApp" class="settings-view__shortcut-note settings-view__shortcut-note--warn">
        {{ t('settings.shortcuts.globalOnlyDesktop') }}
      </p>

      <div
        v-for="item in SHORTCUT_ACTION_OPTIONS"
        :key="item.id"
        class="settings-view__row settings-view__row--shortcut"
      >
        <div class="settings-view__row-label">
          <span>{{ t(`shortcut.${item.id}`) }}</span>
          <small>{{ t(`shortcut.${item.id}Desc`) }}</small>
        </div>
        <ShortcutInput
          :model-value="shortcutsStore.settings[item.id]"
          :disabled="shortcutSaving === item.id"
          @recorded="(value) => handleShortcutRecorded(item.id, value)"
        />
      </div>

      <div class="settings-view__shortcut-footer">
        <el-button size="large" :loading="resettingShortcuts" @click="handleResetShortcuts">
          {{ t('settings.shortcuts.reset') }}
        </el-button>
        <p v-if="shortcutRegisterWarning" class="settings-view__shortcut-note settings-view__shortcut-note--warn">
          {{ shortcutRegisterWarning }}
        </p>
      </div>
    </div>

    <div v-if="showSection('about')" class="settings-view__section">
      <h3 v-if="!section">{{ t('settings.about') }}</h3>

      <div class="settings-view__row">
        <span>{{ t('settings.version') }}</span>
        <span class="settings-view__badge">{{ APP_VERSION }}</span>
      </div>

      <div class="settings-view__row">
        <span>{{ t('settings.author') }}</span>
        <a
          :href="AUTHOR_GITHUB_URL"
          class="settings-view__about-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ AUTHOR_NAME }}
        </a>
      </div>

      <div class="settings-view__row">
        <span>{{ t('settings.officialWebsite') }}</span>
        <a
          :href="OFFICIAL_WEBSITE_URL"
          class="settings-view__about-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('settings.officialWebsiteLink') }}
        </a>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ShortcutInput from '@/components/settings/ShortcutInput.vue'
import MfaSettingsPanel from '@/components/settings/MfaSettingsPanel.vue'
import VaultBackupSettingsPanel from '@/components/settings/VaultBackupSettingsPanel.vue'
import OfflineVaultSettingsPanel from '@/components/settings/OfflineVaultSettingsPanel.vue'
import { APP_VERSION, AUTHOR_GITHUB_URL, AUTHOR_NAME, OFFICIAL_WEBSITE_URL } from '@/constants/app'
import { useAppStore } from '@/stores/app'
import { useAutoLockStore } from '@/stores/autoLock'
import { useClipboardClearStore } from '@/stores/clipboardClear'
import { useBiometricUnlockStore } from '@/stores/biometricUnlock'
import {
  BIOMETRIC_UNAVAILABLE_I18N_KEY,
  type BiometricUnavailableReason
} from '../../../shared/biometric'
import { useDockStore } from '@/stores/dock'
import { useLaunchAtLoginStore } from '@/stores/launchAtLogin'
import { useTrayStore } from '@/stores/tray'
import { useSecurityStore } from '@/stores/security'
import { useShortcutsStore } from '@/stores/shortcuts'
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from '@/types'
import {
  CLIPBOARD_CLEAR_OPTIONS,
  type ClipboardClearSeconds
} from '@/types/clipboardClear'
import {
  SHORTCUT_ACTION_OPTIONS,
  type ShortcutActionId
} from '@/types/shortcut'
import { useI18n } from '@/composables/useI18n'
import {
  getAutoLockLabelKey,
  getClipboardClearLabelKey,
  getFontDescKey,
  getThemeDescKey,
  getThemeLabelKey
} from '@/locales'
import { LOCALE_PREFERENCE_OPTIONS } from '@/utils/localePreference'
import { FONT_OPTIONS } from '@/utils/font'
import { THEME_OPTIONS } from '@/utils/theme'
import { persistVaultPassword } from '@/utils/vaultPasswordStorage'
import {
  TRAY_CLICK_ACTION_OPTIONS,
  type TrayClickAction
} from '@/types/tray'
import type { SettingsContentSection } from '@/types/settingsDialog'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    dialog?: boolean
    section?: SettingsContentSection
  }>(),
  {
    embedded: false,
    dialog: false
  }
)

function showSection(id: SettingsContentSection): boolean {
  return !props.section || props.section === id
}

const { t } = useI18n()
const appStore = useAppStore()
const securityStore = useSecurityStore()
const autoLockStore = useAutoLockStore()
const clipboardClearStore = useClipboardClearStore()
const biometricUnlockStore = useBiometricUnlockStore()
const shortcutsStore = useShortcutsStore()
const launchAtLoginStore = useLaunchAtLoginStore()
const trayStore = useTrayStore()
const dockStore = useDockStore()
const shortcutSaving = ref<ShortcutActionId | null>(null)
const resettingShortcuts = ref(false)
const isDesktopApp = computed(() => !!window.shortcutApi)

const shortcutRegisterWarning = computed(() => {
  if (!isDesktopApp.value) return ''
  const status = shortcutsStore.registrationStatus
  const failed = shortcutsStore.lastSyncError
  if (failed.open) return `${t('shortcut.open')}: ${failed.open}`
  if (failed.lock) return `${t('shortcut.lock')}: ${failed.lock}`
  if (!status) return ''
  if (status.open.enabled && !status.open.registered) {
    return t('settings.shortcuts.openFailed')
  }
  if (status.lock.enabled && !status.lock.registered) {
    return t('settings.shortcuts.lockFailed')
  }
  return ''
})

const themeDescription = computed(() => t(getThemeDescKey(appStore.themePreference)))

const fontDescription = computed(() => t(getFontDescKey(appStore.fontPreference)))

const localeDescription = computed(() =>
  appStore.localePreference === 'system' ? t('locale.systemDesc') : ''
)

const biometricUnlockSectionVisible = ref(false)
const biometricUnlockSupported = ref(false)
const biometricUnlockKind = ref<'touchId' | 'windowsHello' | null>(null)
const biometricUnavailableReason = ref<BiometricUnavailableReason | null>(null)

const preferBiometricUnlockDesc = computed(() => {
  if (biometricUnlockKind.value === 'touchId') {
    return t('settings.preferBiometricUnlockDescTouchId')
  }
  if (biometricUnlockKind.value === 'windowsHello') {
    return t('settings.preferBiometricUnlockDescWindowsHello')
  }
  return t('settings.preferBiometricUnlockDesc')
})

const biometricUnavailableHint = computed(() => {
  if (biometricUnlockSupported.value || !biometricUnavailableReason.value) return ''
  const key = BIOMETRIC_UNAVAILABLE_I18N_KEY[biometricUnavailableReason.value]
  return t(key)
})

async function handlePreferBiometricUnlockChange(enabled: boolean | string | number): Promise<void> {
  if (enabled !== true) {
    biometricUnlockStore.setPreferBiometricUnlock(false)
    return
  }

  let password: string
  try {
    const result = await ElMessageBox.prompt(
      t('settings.biometricEnablePasswordPrompt'),
      t('settings.biometricEnableTitle'),
      {
        inputType: 'password',
        inputPlaceholder: t('settings.biometricEnablePasswordPlaceholder'),
        inputValidator: (value) => value.trim().length > 0 || t('settings.biometricEnablePasswordRequired'),
        confirmButtonText: t('settings.biometricEnableConfirm'),
        cancelButtonText: t('msg.cancel'),
        distinguishCancelAndClose: true
      }
    )
    password = result.value
  } catch {
    return
  }

  try {
    const persisted = await persistVaultPassword(password)
    if (!persisted.ok) {
      ElMessage.error(persisted.error ?? t('settings.biometricEnableFailed'))
      return
    }
  } catch {
    ElMessage.error(t('settings.biometricEnableFailed'))
    return
  }

  biometricUnlockStore.setPreferBiometricUnlock(true)
}

async function refreshBiometricUnlockSupport(): Promise<void> {
  biometricUnlockSectionVisible.value = false
  biometricUnlockSupported.value = false
  biometricUnlockKind.value = null
  biometricUnavailableReason.value = null

  if (!window.biometricApi) {
    biometricUnlockStore.setPreferBiometricUnlock(false)
    return
  }

  biometricUnlockSectionVisible.value = true

  try {
    const [availability, hasStoredPassword] = await Promise.all([
      window.biometricApi.getAvailability(),
      window.vaultPasswordApi?.has() ?? Promise.resolve(false)
    ])
    biometricUnlockSupported.value = availability.available
    biometricUnlockKind.value = availability.kind
    biometricUnavailableReason.value = availability.unavailableReason
    if (!availability.available || !hasStoredPassword) biometricUnlockStore.setPreferBiometricUnlock(false)
  } catch {
    biometricUnlockSupported.value = false
    biometricUnlockKind.value = null
    biometricUnavailableReason.value = 'checkFailed'
    biometricUnlockStore.setPreferBiometricUnlock(false)
  }
}

const autoLockOptions = computed(() =>
  AUTO_LOCK_OPTIONS.map((item) => ({
    value: item.value,
    label: t(getAutoLockLabelKey(item.value))
  }))
)

const clipboardClearOptions = computed(() =>
  CLIPBOARD_CLEAR_OPTIONS.map((value) => ({
    value,
    label: t(getClipboardClearLabelKey(value))
  }))
)

onMounted(() => {
  void refreshBiometricUnlockSupport()
  void shortcutsStore.syncToMain()
  void launchAtLoginStore.refresh()
  void trayStore.refresh()
  void dockStore.refresh()
})

onUnmounted(() => {
})

const autoLockMinutes = computed({
  get: () => autoLockStore.lockMinutes,
  set: (value: AutoLockMinutes) => autoLockStore.setLockMinutes(value)
})

const clipboardClearSeconds = computed({
  get: () => clipboardClearStore.clearSeconds,
  set: (value: ClipboardClearSeconds) => clipboardClearStore.setClearSeconds(value)
})

async function handleLaunchAtLoginChange(value: string | number | boolean): Promise<void> {
  const enabled = value === true
  const result = await launchAtLoginStore.setEnabled(enabled)
  if (!result.ok) {
    ElMessage.error(result.error ?? t('common.settingsFailed'))
    await launchAtLoginStore.refresh()
    return
  }
  ElMessage.success(enabled ? t('msg.launchAtLoginOn') : t('msg.launchAtLoginOff'))
}

async function handleTrayEnabledChange(value: string | number | boolean): Promise<void> {
  const enabled = value === true
  const result = await trayStore.updateSettings({ enabled })
  if (!result.ok) {
    ElMessage.error(result.error ?? t('common.settingsFailed'))
    await trayStore.refresh()
    return
  }
  ElMessage.success(enabled ? t('msg.trayOn') : t('msg.trayOff'))
}

async function handleTrayClickActionChange(value: TrayClickAction): Promise<void> {
  const result = await trayStore.updateSettings({ clickAction: value })
  if (!result.ok) {
    ElMessage.error(result.error ?? t('common.settingsFailed'))
    await trayStore.refresh()
    return
  }
  ElMessage.success(t('msg.trayActionUpdated'))
}

async function handleDockHiddenChange(value: string | number | boolean): Promise<void> {
  const hidden = value === true
  const result = await dockStore.setHidden(hidden)
  if (!result.ok) {
    ElMessage.error(result.error ?? t('common.settingsFailed'))
    await dockStore.refresh()
    return
  }
  ElMessage.success(hidden ? t('msg.dockHidden') : t('msg.dockShown'))
}

async function handleShortcutRecorded(action: ShortcutActionId, value: string): Promise<void> {
  shortcutSaving.value = action
  try {
    const result = await shortcutsStore.setAccelerator(action, value || null)
    if (!result.ok) {
      ElMessage.error(result.failed?.[action] ?? t('msg.shortcutSetFailed'))
      return
    }
    const warning = result.failed?.[action]
    if (warning) {
      ElMessage.warning(t('msg.shortcutUpdatedPartial', { detail: warning }))
      return
    }
    ElMessage.success(t('msg.shortcutUpdated'))
  } finally {
    shortcutSaving.value = null
  }
}

async function handleResetShortcuts(): Promise<void> {
  resettingShortcuts.value = true
  try {
    const result = await shortcutsStore.resetDefaults()
    if (result.ok) {
      ElMessage.success(t('msg.shortcutReset'))
      return
    }
    ElMessage.error(t('msg.shortcutResetPartial'))
  } finally {
    resettingShortcuts.value = false
  }
}

</script>

<style scoped lang="scss">
.settings-view {
  width: 100%;
  max-width: 720px;
  box-sizing: border-box;

  &--embedded {
    max-width: none;
  }

  &--dialog {
    .settings-view__grid {
      gap: $spacing-md;
    }

    .settings-view__section {
      border-radius: $radius-md;
      box-shadow: none;
      padding: 0;
      overflow: hidden;
    }

    .settings-view__row--security,
    .settings-view__row--launch,
    .settings-view__row--auto-lock {
      align-items: center;
    }
  }

  &__header {
    margin-bottom: $spacing-xl;

    h1 {
      font-size: $font-size-2xl;
      font-weight: 700;
      color: $color-text-primary;
      margin-bottom: $spacing-xs;
    }

    p {
      color: $color-text-secondary;
    }
  }

  &__grid {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  &__section {
    width: 100%;
    background: $color-bg-elevated;
    border: 1px solid $color-border;
    border-radius: $radius-lg;
    box-shadow: $shadow-sm;
    padding: $spacing-lg;
    min-width: 0;
    box-sizing: border-box;
    isolation: isolate;

    h3 {
      font-size: $font-size-sm;
      font-weight: 600;
      color: $color-text-muted;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: $spacing-md;
    }
  }

  &__row {
    @include flex-between;
    align-items: flex-start;
    gap: $spacing-lg;
    padding: $spacing-md 0;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
    }

    &--theme {
      align-items: center;
    }

    &--health {
      align-items: center;
    }

    > span:first-child {
      color: $color-text-primary;
      font-size: $font-size-md;
    }
  }

  &__row-label {
    display: flex;
    flex-direction: column;
    gap: 4px;

    span {
      color: $color-text-primary;
      font-size: $font-size-md;
    }

    small {
      color: $color-text-muted;
      font-size: $font-size-sm;
    }
  }

  &__row--shortcut {
    align-items: center;
  }

  &__shortcut-footer {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    padding-top: $spacing-md;
  }

  &__shortcut-note {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.6;

    &--warn {
      color: $color-warning;
      margin-bottom: $spacing-sm;
    }
  }

  &__theme-select {
    width: min(220px, 100%);
    flex-shrink: 1;
  }

  &__badge {
    font-size: $font-size-sm;
    color: $color-text-secondary;
    background: $color-badge-bg;
    padding: 4px 12px;
    border-radius: $radius-sm;

    &--active {
      color: $color-success;
      background: rgba(82, 196, 26, 0.12);
    }

    &--shortcut {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.02em;
    }
  }

  &__about-link {
    font-size: $font-size-sm;
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__row--update {
    color: $color-accent;
  }

  &__update-btn {
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-md;
    border: 1px solid rgba(108, 92, 231, 0.25);
    background: rgba(108, 92, 231, 0.08);
    color: $color-accent;
    font-size: $font-size-sm;
    font-weight: 500;
    cursor: pointer;
    transition: background $transition-fast, border-color $transition-fast;

    &:hover {
      background: rgba(108, 92, 231, 0.14);
      border-color: rgba(108, 92, 231, 0.35);
    }
  }

  &__row--security {
    border-bottom: none;
    padding-bottom: $spacing-sm;
  }

  &__row--server {
    border-bottom: none;
    padding-bottom: $spacing-sm;
  }

  &__server-panel {
    padding: 0 0 $spacing-md;
    margin-bottom: $spacing-sm;
    border-bottom: 1px solid $color-border;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  &__server-input {
    width: 100%;
  }

  &__server-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  &__server-note {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.6;
    word-break: break-all;

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: $font-size-xs;
      color: $color-text-secondary;
      background: $color-badge-bg;
      padding: 1px 6px;
      border-radius: 4px;
    }
  }

  &__vault-crypto-intro {
    margin: 0 0 $spacing-md;
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.5;
  }

  &__security-panel {
    padding: 0 0 $spacing-md;
    margin-bottom: $spacing-sm;
    border-bottom: 1px solid $color-border;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  &__security-input {
    width: 100%;
  }

  &__security-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  &__security-note {
    margin: 0;
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.6;
  }

  &__key-dialog-tip {
    margin: 0 0 $spacing-md;
    font-size: $font-size-sm;
    color: $color-text-secondary;
    line-height: 1.6;
  }

  &__key-dialog-text :deep(textarea) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: $font-size-sm;
    line-height: 1.5;
    word-break: break-all;
  }

  &__key-dialog-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: $spacing-sm;
  }

  &__verify-code-row {
    display: flex;
    gap: $spacing-sm;
    width: 100%;
  }

  &__verify-code-btn {
    flex-shrink: 0;
    min-width: 108px;
  }

  &__row--auto-lock {
    align-items: center;
  }

  &__row--launch {
    align-items: center;
  }

  &__row--biometric {
    align-items: flex-start;

    :deep(.el-switch) {
      margin-top: 2px;
    }
  }

  &__biometric-unavailable {
    color: $color-text-secondary;
    line-height: 1.55;
  }

  &__auto-lock-select {
    width: min(140px, 100%);
    flex-shrink: 1;
  }

  &__tray-select {
    width: min(220px, 100%);
    flex-shrink: 1;
  }

  &__health-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background $transition-fast, box-shadow $transition-fast;

    &.is-ready {
      background: $color-success;
      box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.18);
    }

    &.is-down {
      background: $color-danger;
      box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.18);
    }
  }
}
</style>
