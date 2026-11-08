import type { PasswordEntry, PasswordType } from '@/types'
import { isEncryptedContent } from '@/utils/contentCrypto'
import { resolveEntryTitle } from '@/utils/passwordTitle'
import { resolveEntryType } from '@/utils/vaultEntryDisplay'

const SENSITIVE_SEARCH_KEY = /password|secret|token|otp|authenticator|cvv|card.?number|id.?number|private.?key|recovery|pin|one.?time.?code|verification.?code/i
const SENSITIVE_FIELD_LABEL = /password|secret|token|otp|authenticator|cvv|card.?number|id.?number|private.?key|recovery|pin|one.?time.?code|verification.?code|密码|密钥|验证码|安全码|卡号|证件号/i

function collectExtraFieldStrings(value: unknown, out: string[]): void {
  if (!Array.isArray(value)) return
  for (const field of value) {
    if (!field || typeof field !== 'object') continue
    const item = field as Record<string, unknown>
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    if (label) out.push(label)
    if (item.type === 'password' || item.type === 'authenticator' || SENSITIVE_FIELD_LABEL.test(label)) continue
    collectStrings(item.value, out)
  }
}

function collectStrings(value: unknown, out: string[]): void {
  if (value == null) return
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) out.push(text)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_SEARCH_KEY.test(key)) continue
      if (key === 'extraFields' || key === 'fields') {
        collectExtraFieldStrings(nested, out)
        continue
      }
      collectStrings(nested, out)
    }
  }
}

/** 本地关键词匹配；仅搜索非敏感字段，不检索密码、验证码和密钥。 */
export function matchesVaultKeyword(entry: PasswordEntry, keyword: string): boolean {
  const query = keyword.trim().toLowerCase()
  if (!query) return true

  const parts: string[] = []
  parts.push(resolveEntryTitle(entry))

  if (entry.remark?.trim()) parts.push(entry.remark.trim())
  if (entry.passwordLabels?.length) parts.push(...entry.passwordLabels)
  if (entry.websites?.length) parts.push(...entry.websites)

  const entryType = resolveEntryType(entry)
  parts.push(entryType)
  if (entry.passwordType) parts.push(entry.passwordType)

  if (!isEncryptedContent(entry.content)) {
    collectStrings(entry.content, parts)
  }

  return parts.join('\n').toLowerCase().includes(query)
}

export function filterVaultEntries(
  entries: PasswordEntry[],
  options: { keyword?: string; passwordType?: PasswordType | '' } = {}
): PasswordEntry[] {
  const keyword = options.keyword?.trim() ?? ''
  const passwordType = options.passwordType ?? ''

  return entries.filter((entry) => {
    if (passwordType && resolveEntryType(entry) !== passwordType) return false
    return matchesVaultKeyword(entry, keyword)
  })
}
