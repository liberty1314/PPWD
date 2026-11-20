import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Star } from 'lucide-react'
import { Button } from '../../ui/primitives'
import type { AuthenticatorContent, LoginExtraField, PasswordEntry } from '../../types'
import { resolveEntryType } from '../../utils/vaultEntryDisplay'
import { resolveEntryWebsites } from '../../utils/passwordWebsites'
import { extraFieldToAuthenticatorContent } from '../../utils/extraField'
import { normalizeAuthenticatorContent } from '../../utils/authenticatorContent'
import { generateTotpSnapshot } from '../../utils/totp'
import { resolveEntryTitle } from '../../utils/passwordTitle'

export type DetailField = { label: string; value: string; secret?: boolean; link?: boolean; authenticator?: AuthenticatorContent }

export function detailsFor(entry: PasswordEntry): DetailField[] {
  const type = resolveEntryType(entry)
  const content = entry.content as Record<string, unknown>
  const asText = (key: string): string => String(content[key] ?? '')
  if (type === '登录信息') return [
    ...resolveEntryWebsites(entry).map((value) => ({ label: 'entry.form.login.website', value, link: true })),
    { label: 'entry.form.login.username', value: asText('username') },
    { label: 'entry.form.login.password', value: asText('password'), secret: true },
    ...extraDetails(content.extraFields)
  ]
  if (type === '服务器') return [
    { label: 'entry.form.login.host', value: asText('host') },
    { label: 'entry.form.login.username', value: asText('username') },
    { label: 'entry.form.login.password', value: asText('password'), secret: true },
    ...extraDetails(content.extraFields)
  ]
  if (type === '银行卡') return [
    { label: 'entry.form.bankCard.bankName', value: asText('bankName') },
    { label: 'entry.form.bankCard.cardHolder', value: asText('cardHolder') },
    { label: 'entry.form.bankCard.cardNumber', value: asText('cardNumber'), secret: true },
    { label: 'entry.form.bankCard.expiry', value: asText('expiry') },
    { label: 'entry.form.bankCard.cvv', value: asText('cvv'), secret: true },
    ...extraDetails(content.extraFields)
  ]
  if (type === '身份信息') return [
    { label: 'entry.form.identity.name', value: asText('name') },
    { label: 'entry.form.identity.idNumber', value: asText('idNumber'), secret: true },
    { label: 'entry.form.identity.birthDate', value: asText('birthDate') },
    { label: 'entry.form.identity.lunarBirthday', value: asText('lunarBirthday') },
    { label: 'entry.form.identity.phone', value: asText('phone') },
    { label: 'entry.form.identity.address', value: asText('address') },
    ...extraDetails(content.extraFields)
  ]
  if (type === '数据库') return [
    { label: 'entry.form.database.dbType', value: asText('dbType') },
    { label: 'entry.form.database.host', value: asText('host') },
    { label: 'entry.form.database.port', value: asText('port') },
    { label: 'entry.form.database.databaseName', value: asText('databaseName') },
    { label: 'entry.form.database.username', value: asText('username') },
    { label: 'entry.form.database.password', value: asText('password'), secret: true },
    ...extraDetails(content.extraFields)
  ]
  if (type === '安全备注') return [
    { label: 'entry.form.fieldContent', value: asText('body') },
    ...extraDetails(content.extraFields)
  ]
  if (type === '自定义') return extraDetails(content.fields)
  return []
}

function extraDetails(value: unknown): DetailField[] {
  if (!Array.isArray(value)) return []
  return value.map((field) => {
    const item = field as LoginExtraField
    if (item.type === 'authenticator') return { label: item.label || 'entry.form.authenticator.secret', value: '', authenticator: extraFieldToAuthenticatorContent(item) }
    return { label: item.label || 'entry.form.fieldContent', value: item.value || item.secret || '', secret: item.type === 'password' || /password|密码|secret|密钥|pin|cvv/i.test(item.label) }
  })
}

export function EntryDetail({ entry, favorite, onBack, onFavorite, onEdit, onMore, onCopy, translate }: { entry: PasswordEntry; favorite: boolean; onBack: () => void; onFavorite: () => void; onEdit: () => void; onMore: () => void; onCopy: (field: DetailField) => void; translate: (key: string, params?: Record<string, string | number>) => string }) {
  const [visible, setVisible] = useState<string[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const fields = detailsFor(entry).filter((field) => field.value || field.authenticator)
  const auth = resolveEntryType(entry) === '两步验证（2FA）' ? normalizeAuthenticatorContent(entry.content as Record<string, unknown>) : null
  useEffect(() => {
    setVisible([])
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [entry.id])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  function reveal(field: DetailField): void {
    setVisible((current) => current.includes(field.label) ? current.filter((label) => label !== field.label) : [...current, field.label])
    if (field.secret) {
      const timer = setTimeout(() => setVisible((current) => current.filter((label) => label !== field.label)), 15000)
      timers.current.push(timer)
    }
  }
  return <article className="react-vault__detail-content"><header className="react-vault__detail-head"><Button className="react-vault__back" aria-label={translate('entry.dialog.back')} title={translate('entry.dialog.back')} icon={<ArrowLeft size={16} />} onClick={onBack} /><div><p className="react-eyebrow">{translate(`vault.type.${entry.passwordType === '身份信息' ? 'identity' : entry.passwordType === '两步验证（2FA）' ? 'authenticator' : entry.passwordType === '安全备注' ? 'secureNote' : entry.passwordType === '银行卡' ? 'bankCard' : entry.passwordType === '服务器' ? 'server' : entry.passwordType === '数据库' ? 'database' : entry.passwordType === '自定义' ? 'custom' : 'login'}`)}</p><h2>{resolveEntryTitle(entry)}</h2></div><Button aria-label={translate(favorite ? 'vault.detail.unfavorite' : 'vault.detail.favorite')} title={translate(favorite ? 'vault.detail.unfavorite' : 'vault.detail.favorite')} icon={<Star size={16} fill={favorite ? 'currentColor' : 'none'} />} onClick={onFavorite} /></header>
    {auth && <OtpCode content={auth} onCopy={(code) => onCopy({ label: 'entry.form.authenticator.secret', value: code, secret: true })} translate={translate} />}
    <div className="react-vault__fields">{fields.map((field, index) => { if (field.authenticator) return <div key={`${field.label}-${index}`} className="react-vault__field"><span>{translate(field.label)}</span><OtpCode content={field.authenticator} onCopy={(code) => onCopy({ label: field.label, value: code, secret: true })} translate={translate} /></div>; const show = !field.secret || visible.includes(field.label); return <div key={`${field.label}-${index}`} className="react-vault__field"><span>{translate(field.label)}</span><div><button type="button" className={field.secret && !show ? 'is-masked' : ''} onClick={() => field.secret ? reveal(field) : field.link ? void onCopy(field) : undefined} onDoubleClick={() => void onCopy(field)}>{show ? field.value : '••••••••••••'}</button>{field.secret && <button type="button" aria-label={translate(show ? 'vault.detail.hide' : 'vault.detail.show')} title={translate(show ? 'vault.detail.hide' : 'vault.detail.show')} onClick={() => reveal(field)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>}<button type="button" aria-label={translate('vault.detail.share')} title={translate('vault.detail.share')} onClick={() => void onCopy(field)}><Copy size={14} /></button></div></div> })}</div>
    {entry.passwordLabels?.length ? <div className="react-vault__tags"><span>{translate('vault.detail.tags')}</span>{entry.passwordLabels.map((label) => <span key={label}>{label}</span>)}</div> : null}{entry.remark && <section className="react-vault__remark"><h3>{translate('vault.detail.remark')}</h3><p>{entry.remark}</p></section>}
    <footer className="react-vault__detail-actions"><Button onClick={onEdit} icon={<Pencil size={15} />}>{translate('vault.detail.edit')}</Button><Button tone="quiet" aria-label={translate('vault.detail.moreActions')} title={translate('vault.detail.moreActions')} onClick={onMore} icon={<MoreHorizontal size={16} />}>{translate('vault.detail.moreActions')}</Button></footer>
  </article>
}

function OtpCode({ content, onCopy, translate }: { content: AuthenticatorContent; onCopy: (code: string) => void; translate: (key: string) => string }) {
  const [snapshot, setSnapshot] = useState(() => generateTotpSnapshot(content))
  useEffect(() => {
    const update = (): void => setSnapshot(generateTotpSnapshot(content))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [content.secret, content.algorithm, content.digits, content.period])
  return <div className="react-vault__otp"><span>{snapshot?.code.match(/.{1,3}/g)?.join(' ') ?? '------'}</span><div><i style={{ '--otp-progress': `${snapshot ? (snapshot.remainingSeconds / snapshot.period) * 100 : 0}%` } as React.CSSProperties} /><small>{snapshot?.remainingSeconds ?? '--'}s</small></div><Button title={translate('entry.totp.copyCode')} aria-label={translate('entry.totp.copyCode')} icon={<Copy size={15} />} onClick={() => snapshot && onCopy(snapshot.code)} /></div>
}
