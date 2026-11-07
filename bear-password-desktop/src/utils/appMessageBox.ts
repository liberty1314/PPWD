import { ElMessageBox, type ElMessageBoxOptions, type MessageBoxData } from 'element-plus'
import { Z_INDEX_TOAST } from '@/constants/zIndex'

type MessageBoxContent = ElMessageBoxOptions['message']
type MessageBoxTitle = ElMessageBoxOptions['title']

export function appMessageBoxConfirm(
  message: MessageBoxContent,
  title: MessageBoxTitle,
  options?: ElMessageBoxOptions
): Promise<MessageBoxData> {
  const confirmOptions = {
    ...options,
    zIndex: Z_INDEX_TOAST,
    appendTo: document.body
  }
  return ElMessageBox.confirm(message, title, {
    ...confirmOptions
  } as ElMessageBoxOptions & { zIndex: number })
}
