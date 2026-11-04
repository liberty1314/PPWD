import type { PageResult } from '@/types'
import type { PasswordEntry, PasswordEntryParams, PasswordQueryParams } from '@/types'
import { toVaultEntryId, type VaultEntryId } from '../../shared/vaultEntryId'
import {
  createOfflinePasswordEntryRaw,
  deleteOfflinePasswordEntry,
  fetchOfflinePasswordEntriesRaw,
  updateOfflinePasswordEntryRaw
} from '@/api/offlineVaultLocal'
import {
  decryptPasswordEntries,
  decryptPasswordEntry,
  encryptPasswordEntryParams
} from '@/utils/vaultEntryTransform'
import { filterVaultEntries } from '@/utils/vaultEntrySearch'

/**
 * 密码库 API
 */

/** 分页查询密码条目 */
export async function getPasswordListApi(
  params: PasswordQueryParams = {}
): Promise<PageResult<PasswordEntry>> {
  const entries = await fetchAllPasswordEntries()
  const filtered = filterVaultEntries(entries, params)
  return paginate(filtered, params)
}

/** 拉取本地保险库全部密码条目并解密 */
export async function fetchAllPasswordEntries(): Promise<PasswordEntry[]> {
  const raw = await fetchOfflinePasswordEntriesRaw()
  return decryptPasswordEntries(raw)
}

/** 获取密码详情 */
export async function getPasswordDetailApi(id: VaultEntryId): Promise<PasswordEntry> {
  const entryId = toVaultEntryId(id)
  const raw = await fetchOfflinePasswordEntriesRaw()
  const entry = raw.find((item) => toVaultEntryId(item.id) === entryId)
  if (!entry) {
    throw new Error('密码条目不存在')
  }
  return decryptPasswordEntry(entry)
}

/** 新增密码条目 */
export async function createPasswordApi(data: PasswordEntryParams): Promise<PasswordEntry> {
  const payload = await encryptPasswordEntryParams(data)
  const entry = await createOfflinePasswordEntryRaw(payload)
  return decryptPasswordEntry(entry)
}

/** 更新密码条目 */
export async function updatePasswordApi(
  id: VaultEntryId,
  data: PasswordEntryParams
): Promise<PasswordEntry> {
  const entryId = toVaultEntryId(id)
  const payload = await encryptPasswordEntryParams(data)
  const entry = await updateOfflinePasswordEntryRaw(entryId, payload)
  return decryptPasswordEntry(entry)
}

/** 删除密码条目 */
export async function deletePasswordApi(id: VaultEntryId): Promise<void> {
  const entryId = toVaultEntryId(id)
  await deleteOfflinePasswordEntry(entryId)
}

/** 获取当前用户已使用过的标签 */
export async function getPasswordLabelsApi(): Promise<string[]> {
  const entries = await fetchAllPasswordEntries()
  const labels = new Set<string>()
  entries.forEach((entry) => {
    entry.passwordLabels?.forEach((label) => {
      if (label.trim()) labels.add(label.trim())
    })
  })
  return [...labels].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function paginate<T>(items: T[], params: PasswordQueryParams): PageResult<T> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 50)
  const start = (page - 1) * pageSize
  return { list: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}
