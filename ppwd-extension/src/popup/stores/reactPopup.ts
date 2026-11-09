import { create } from 'zustand'
import type { FillCredential, DesktopConnectionState, MatchingCredentialsResult } from '@/shared/types'
import type { WakeDesktopResult } from '@/shared/utils/desktopProtocol'
import { sendMessage } from '@/shared/utils/messaging'
import { buildCredentialShareText } from '@/shared/utils/shareCredentialText'
import { OFFICIAL_WEBSITE_URL } from '@/shared/constants/app'
import { usePopupLocaleStore } from './reactLocale'
import { usePopupThemeStore } from './reactTheme'

type PopupPage = 'vault' | 'settings'
interface LoginEntryFormData { title: string; username: string; password: string; website: string }

interface ReactPopupState {
  initialized: boolean
  page: PopupPage
  desktopState: DesktopConnectionState | null
  sessionLoading: boolean
  sessionError: string
  wakeHint: string
  waking: boolean
  matching: FillCredential[]
  needsSecurityKey: boolean
  currentUrl: string
  keyword: string
  vaultLoading: boolean
  vaultError: string
  toast: string
  pendingDelete: FillCredential | null
  deleting: boolean
  editorOpen: boolean
  editingCredential: FillCredential | null
  entrySaving: boolean
  initialize: () => Promise<void>
  refreshDesktopState: (silent?: boolean) => Promise<void>
  wakeDesktop: () => Promise<void>
  refreshVault: (silent?: boolean) => Promise<void>
  setKeyword: (keyword: string) => void
  openSettings: () => void
  openVault: () => void
  openCreate: () => void
  openEdit: (credential: FillCredential) => void
  closeEditor: () => void
  saveEntry: (data: LoginEntryFormData) => Promise<void>
  autofill: (credentialId: string) => Promise<void>
  shareCredential: (credential: FillCredential) => Promise<void>
  toggleFavorite: (credential: FillCredential) => Promise<void>
  requestDelete: (credential: FillCredential) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<void>
  showToast: (text: string) => void
  generatePassword: () => Promise<string>
}

const LOCKED_STATE: DesktopConnectionState = {
  ready: false,
  loggedIn: false,
  locked: false,
  unlocked: false,
  username: null,
  themePreference: null,
  localePreference: null
}
let toastTimer: ReturnType<typeof setTimeout> | null = null
let desktopRequestSequence = 0
let vaultRequestSequence = 0

export const useReactPopupStore = create<ReactPopupState>((set, get) => ({
  initialized: false,
  page: 'vault',
  desktopState: null,
  sessionLoading: false,
  sessionError: '',
  wakeHint: '',
  waking: false,
  matching: [],
  needsSecurityKey: false,
  currentUrl: '',
  keyword: '',
  vaultLoading: false,
  vaultError: '',
  toast: '',
  pendingDelete: null,
  deleting: false,
  editorOpen: false,
  editingCredential: null,
  entrySaving: false,

  initialize: async () => {
    await Promise.all([usePopupThemeStore.getState().initialize(), usePopupLocaleStore.getState().initialize()])
    await get().refreshDesktopState()
    set({ initialized: true })
  },

  refreshDesktopState: async (silent = false) => {
    const sequence = ++desktopRequestSequence
    set((state) => ({ sessionLoading: silent ? state.sessionLoading : true, sessionError: '' }))
    try {
      const desktopState = await sendMessage<DesktopConnectionState>({ type: 'GET_DESKTOP_STATE' })
      if (sequence !== desktopRequestSequence) return
      set({ desktopState })
      usePopupThemeStore.getState().syncFromDesktop(desktopState.themePreference, desktopState.themePreferences)
      usePopupLocaleStore.getState().syncFromDesktop(desktopState)
      if (!desktopState.unlocked) {
        vaultRequestSequence++
        set({ matching: [], needsSecurityKey: false, vaultLoading: false, pendingDelete: null, editorOpen: false, editingCredential: null })
      }
    } catch (cause) {
      if (sequence !== desktopRequestSequence) return
      vaultRequestSequence++
      const desktopState = { ...LOCKED_STATE }
      set({ desktopState, matching: [], needsSecurityKey: false, vaultLoading: false, pendingDelete: null, editorOpen: false, editingCredential: null })
      usePopupThemeStore.getState().syncFromDesktop(null)
      usePopupLocaleStore.getState().syncFromDesktop(null)
      if (!silent) set({ sessionError: cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('session.desktopFailed') })
    } finally {
      if (sequence === desktopRequestSequence) set({ sessionLoading: false })
    }
  },

  wakeDesktop: async () => {
    if (get().waking) return
    set({ waking: true, sessionError: '', wakeHint: '' })
    try {
      const result = await sendMessage<WakeDesktopResult>({ type: 'WAKE_DESKTOP' })
      if (result === 'protocol-on-tab' || result === 'fallback-page') {
        set({ wakeHint: usePopupLocaleStore.getState().t('login.protocolConfirm') })
      }
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await get().refreshDesktopState(true)
    } catch (cause) {
      set({ sessionError: cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('session.wakeDesktopFailed') })
    } finally {
      set({ waking: false })
    }
  },

  refreshVault: async (silent = false) => {
    if (!get().desktopState?.unlocked) return
    const sequence = ++vaultRequestSequence
    if (!silent) set({ vaultLoading: true, vaultError: '' })
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (sequence !== vaultRequestSequence || !get().desktopState?.unlocked) return
      const currentUrl = tab?.url ?? ''
      set({ currentUrl })
      if (!currentUrl) {
        set({ matching: [], needsSecurityKey: false })
        return
      }
      const result = await sendMessage<MatchingCredentialsResult>({
        type: 'GET_MATCHING_CREDENTIALS',
        payload: { url: currentUrl, matchBy: 'host' }
      })
      if (sequence !== vaultRequestSequence || !get().desktopState?.unlocked) return
      set({ matching: result.credentials, needsSecurityKey: result.needsSecurityKey, vaultError: '' })
    } catch (cause) {
      if (sequence !== vaultRequestSequence || !get().desktopState?.unlocked) return
      set({ vaultError: cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('vault.toast.fillFailed') })
    } finally {
      if (sequence === vaultRequestSequence && !silent) set({ vaultLoading: false })
    }
  },

  setKeyword: (keyword) => set({ keyword }),
  openSettings: () => set({ page: 'settings' }),
  openVault: () => set({ page: 'vault' }),
  openCreate: () => set({ editingCredential: null, editorOpen: true }),
  openEdit: (editingCredential) => set({ editingCredential, editorOpen: true }),
  closeEditor: () => { if (!get().entrySaving) set({ editorOpen: false, editingCredential: null }) },

  saveEntry: async (data) => {
    if (get().entrySaving) return
    const websites = data.website ? [data.website] : []
    const payload = { title: data.title, username: data.username, password: data.password, websites }
    set({ entrySaving: true })
    try {
      const editing = get().editingCredential
      if (editing) {
        await sendMessage({ type: 'UPDATE_CREDENTIAL', payload: { ...payload, credentialId: editing.id } })
        get().showToast(usePopupLocaleStore.getState().t('vault.toast.updated'))
      } else {
        await sendMessage({ type: 'CREATE_CREDENTIAL', payload })
        get().showToast(usePopupLocaleStore.getState().t('vault.toast.created'))
      }
      set({ editorOpen: false, editingCredential: null })
      await get().refreshVault()
    } catch (cause) {
      get().showToast(cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('vault.toast.saveFailed'))
    } finally {
      set({ entrySaving: false })
    }
  },

  autofill: async (credentialId) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      get().showToast(usePopupLocaleStore.getState().t('vault.toast.fillNoTab'))
      return
    }
    try {
      await sendMessage({ type: 'AUTOFILL', payload: { credentialId, tabId: tab.id } })
      window.close()
    } catch (cause) {
      get().showToast(cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('vault.toast.fillFailed'))
    }
  },

  shareCredential: async (credential) => {
    try {
      const t = usePopupLocaleStore.getState().t
      const text = buildCredentialShareText(credential, {
        website: t('entry.website'),
        username: t('vault.share.username'),
        password: t('vault.share.password'),
        footer: t('vault.share.footer', { url: OFFICIAL_WEBSITE_URL })
      })
      await navigator.clipboard.writeText(text)
      get().showToast(t('vault.toast.shareCopied'))
    } catch (cause) {
      get().showToast(cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('entry.msg.copyFailed'))
    }
  },

  toggleFavorite: async (credential) => {
    try {
      await sendMessage({ type: 'TOGGLE_FAVORITE', payload: { credentialId: credential.id, favorite: !!credential.favorite } })
      set((state) => ({ matching: state.matching.map((item) => item.id === credential.id ? { ...item, favorite: !credential.favorite } : item) }))
      get().showToast(usePopupLocaleStore.getState().t(credential.favorite ? 'vault.toast.unfavorited' : 'vault.toast.favorited'))
      await get().refreshVault(true)
    } catch (cause) {
      get().showToast(cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('vault.toast.favoriteFailed'))
      await get().refreshVault(true)
    }
  },

  requestDelete: (pendingDelete) => set({ pendingDelete }),
  cancelDelete: () => { if (!get().deleting) set({ pendingDelete: null }) },
  confirmDelete: async () => {
    const credential = get().pendingDelete
    if (!credential || get().deleting) return
    set({ deleting: true })
    try {
      await sendMessage({ type: 'DELETE_CREDENTIAL', payload: { credentialId: credential.id } })
      set({ pendingDelete: null })
      get().showToast(usePopupLocaleStore.getState().t('vault.toast.deleted'))
      await get().refreshVault()
    } catch (cause) {
      get().showToast(cause instanceof Error ? cause.message : usePopupLocaleStore.getState().t('vault.toast.deleteFailed'))
    } finally {
      set({ deleting: false })
    }
  },

  showToast: (toast) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: '' }), 2200)
  },

  generatePassword: async () => sendMessage<string>({ type: 'GENERATE_PASSWORD' })
}))
