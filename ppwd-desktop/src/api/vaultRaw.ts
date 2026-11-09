import type { PageResult } from '@/types'
import type { PasswordEntry, PasswordQueryParams } from '@/types'
import type { PasswordEntryApiParams } from '@/utils/contentMetadata'
import { toVaultEntryId, type VaultEntryId } from '../../shared/vaultEntryId'
import {
  fetchOfflinePasswordEntriesRaw,
  updateOfflinePasswordEntryRaw
} from '@/api/offlineVaultLocal'

/**
 * 密码库原始 API（不做客户端加解密，供密钥更换时重新加密使用）
 */

export async function getPasswordListRawApi(
  params: PasswordQueryParams = {}
): Promise<PageResult<PasswordEntry>> {
  const entries = await fetchAllPasswordEntriesRaw()
  const keyword = params.keyword?.trim().toLocaleLowerCase()
  const filtered = entries.filter((entry) => {
    if (params.passwordType && entry.passwordType !== params.passwordType) return false
    if (!keyword) return true
    return JSON.stringify(entry.content).toLocaleLowerCase().includes(keyword)
  })
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 50)
  const start = (page - 1) * pageSize
  return { list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
}

export function updatePasswordRawApi(
  id: VaultEntryId,
  data: PasswordEntryApiParams
): Promise<PasswordEntry> {
  const entryId = toVaultEntryId(id)
  return updateOfflinePasswordEntryRaw(entryId, data)
}

/** 拉取本地保险库全部密码条目（原始 content） */
export async function fetchAllPasswordEntriesRaw(): Promise<PasswordEntry[]> {
  return fetchOfflinePasswordEntriesRaw()
}
