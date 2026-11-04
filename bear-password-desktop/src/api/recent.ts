import type { PageResult, PasswordRelationMetaItem } from '@/types'
import type { PasswordEntry } from '@/types'
import { decryptPasswordEntries } from '@/utils/vaultEntryTransform'
import { filterVaultEntries } from '@/utils/vaultEntrySearch'
import {
  getOfflineRecentVisitMetaApi,
  recordOfflineRecentVisitApi,
  fetchOfflinePasswordEntriesRaw
} from '@/api/offlineVaultLocal'

/** 分页查询最近访问条目 */
export async function getRecentVisitListApi(params: {
  page?: number
  pageSize?: number
  keyword?: string
} = {}): Promise<PageResult<PasswordEntry>> {
  const [entries, meta] = await Promise.all([fetchOfflinePasswordEntriesRaw(), getOfflineRecentVisitMetaApi()])
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]))
  const recentTimeById = new Map(meta.map((item) => [item.passwordId, item.time]))
  const recent = await decryptPasswordEntries(meta
    .map((item) => entryMap.get(item.passwordId))
    .filter((entry): entry is PasswordEntry => !!entry)
    .map((entry) => ({ ...entry, recentVisitTime: recentTimeById.get(entry.id) }))
  )
  const filtered = filterVaultEntries(recent, { keyword: params.keyword })
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 50)
  const start = (page - 1) * pageSize
  return { list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
}

/** 获取最近访问元数据（密码 ID + 访问时间） */
export function getRecentVisitMetaApi(): Promise<PasswordRelationMetaItem[]> {
  return getOfflineRecentVisitMetaApi()
}

/** 记录一次最近访问（点击明细字段复制时调用） */
export function recordRecentVisitApi(passwordId: string): Promise<void> {
  return recordOfflineRecentVisitApi(passwordId)
}
