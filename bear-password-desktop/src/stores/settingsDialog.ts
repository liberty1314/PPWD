import { createStateStore, ref } from '@/stores/reactiveStore'

export const useSettingsDialogStore = createStateStore(() => {
  const visible = ref(false)

  function open(): void {
    visible.value = true
  }

  function close(): void {
    visible.value = false
  }

  return {
    visible,
    open,
    close
  }
})
