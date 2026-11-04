import type { PageResult, PasswordRelationMetaItem } from '@/types'
import type { PasswordEntry } from '@/types'
import { toVaultEntryId, type VaultEntryId } from '../../shared/vaultEntryId'
import { decryptPasswordEntries } from '@/utils/vaultEntryTransform'
import { filterVaultEntries } from '@/utils/vaultEntrySearch'
import {
  addOfflineFavoriteApi,
  fetchOfflinePasswordEntriesRaw,
  getOfflineFavoriteIdsApi,
  getOfflineFavoriteMetaApi,
  removeOfflineFavoriteApi
} from '@/api/offlineVaultLocal'

/** 分页查询收藏条目 */
export async function getFavoriteListApi(params: {
  page?: number
  pageSize?: number
  keyword?: string
} = {}): Promise<PageResult<PasswordEntry>> {
  const [entries, ids, meta] = await Promise.all([
    fetchOfflinePasswordEntriesRaw(),
    getOfflineFavoriteIdsApi(),
    getOfflineFavoriteMetaApi()
  ])
  const favoriteTimeById = new Map(meta.map((item) => [toVaultEntryId(item.passwordId), item.time]))
  const favorites = await decryptPasswordEntries(entries
    .filter((entry) => ids.includes(toVaultEntryId(entry.id)))
    .map((entry) => ({
      ...entry,
      favorite: true,
      favoriteTime: favoriteTimeById.get(toVaultEntryId(entry.id))
    }))
  )
  const filtered = filterVaultEntries(favorites, { keyword: params.keyword })
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 50)
  const start = (page - 1) * pageSize
  return { list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
}

/** 获取收藏元数据（密码 ID + 收藏时间） */
export function getFavoriteMetaApi(): Promise<PasswordRelationMetaItem[]> {
  return getOfflineFavoriteMetaApi()
}

/** 获取已收藏的 password ID 列表 */
export function getFavoriteIdsApi(): Promise<VaultEntryId[]> {
  return getOfflineFavoriteIdsApi()
}

/** 添加收藏 */
export function addFavoriteApi(passwordId: VaultEntryId): Promise<void> {
  const id = toVaultEntryId(passwordId)
  return addOfflineFavoriteApi(id)
}

/** 取消收藏 */
export function removeFavoriteApi(passwordId: VaultEntryId): Promise<void> {
  const id = toVaultEntryId(passwordId)
  return removeOfflineFavoriteApi(id)
}
