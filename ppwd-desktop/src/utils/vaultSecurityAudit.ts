import type { PasswordEntry } from '@/types'

export interface VaultSecurityAudit {
  checked: number
  weakIds: Set<string>
  reusedIds: Set<string>
}

const CREDENTIAL_TYPES = new Set(['登录信息', '服务器', '数据库'])

export function auditVaultPasswords(entries: PasswordEntry[]): VaultSecurityAudit {
  const credentials = entries.filter((entry) => CREDENTIAL_TYPES.has(entry.passwordType))
  const weakIds = new Set<string>()
  const idsByPassword = new Map<string, string[]>()

  for (const entry of credentials) {
    const password = String((entry.content as Record<string, unknown>).password ?? '')
    if (!password) continue
    if (password.length < 8) weakIds.add(entry.id)
    const ids = idsByPassword.get(password) ?? []
    ids.push(entry.id)
    idsByPassword.set(password, ids)
  }

  const reusedIds = new Set<string>()
  for (const ids of idsByPassword.values()) {
    if (ids.length > 1) ids.forEach((id) => reusedIds.add(id))
  }

  return { checked: credentials.length, weakIds, reusedIds }
}
