import { ElMessageBox, type ElMessageBoxOptions, type MessageBoxData } from 'element-plus'
import { Z_INDEX_SETTINGS_OVERLAY } from '@/constants/zIndex'

type MessageBoxContent = ElMessageBoxOptions['message']
type MessageBoxTitle = ElMessageBoxOptions['title']

export function settingsMessageBoxConfirm(
  message: MessageBoxContent,
  title: MessageBoxTitle,
  options?: ElMessageBoxOptions
): Promise<MessageBoxData> {
  const confirmOptions = {
    ...options,
    zIndex: Z_INDEX_SETTINGS_OVERLAY,
    appendTo: document.body
  }
  return ElMessageBox.confirm(message, title, {
    ...confirmOptions
  } as ElMessageBoxOptions & { zIndex: number })
}
