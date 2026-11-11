import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, CreditCard, Database, Eye, EyeOff, FileText, FileUp, Fingerprint, KeyRound, ListChecks, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Server, ShieldAlert, ShieldCheck, Star, Trash2, X } from 'lucide-react'
import { addFavoriteApi, getFavoriteIdsApi, getFavoriteListApi, removeFavoriteApi } from './api/favorites'
import { fetchAllPasswordEntries, createPasswordApi, deletePasswordApi, updatePasswordApi } from './api/vault'
import { getRecentVisitListApi, recordRecentVisitApi } from './api/recent'
import { useSecurityStore } from './stores/security'
import { useStoreSnapshot } from './stores/reactiveStore'
import { useDesktopLocale } from './ui/useDesktopLocale'
import { Button, Dialog, DialogContent, SelectField, TextField, useToast } from './ui/primitives'
import type { AuthenticatorContent, PasswordContent, PasswordEntry, PasswordEntryParams, PasswordType, LoginExtraField } from './types'
import { PASSWORD_PICKER_ITEMS } from './types/vault'
import { resolveEntryTitle } from './utils/passwordTitle'
import { resolveEntryType, getEntryTypeColor } from './utils/vaultEntryDisplay'
import { getPasswordTypeFilterOptions } from './utils/passwordTypeI18n'
import { filterVaultEntries } from './utils/vaultEntrySearch'
import { getVaultSortOrderOptions, loadVaultSort, saveVaultSort, sortEntries, type VaultSortState, type VaultSortField } from './utils/vaultSort'
import { createEmptyLoginContent, createServerPresetContent } from './utils/loginContent'
import { createEmptyBankCardContent } from './utils/bankCardContent'
import { createEmptyIdentityContent } from './utils/identityContent'
import { createEmptySecureNoteContent } from './utils/secureNoteContent'
import { createEmptyAuthenticatorContent, normalizeAuthenticatorContent } from './utils/authenticatorContent'
import { createEmptyDatabaseContent } from './utils/databaseContent'
import { createEmptyCustomContent } from './utils/customContent'
import { isValidAuthenticatorSecret, generateTotpSnapshot } from './utils/totp'
import { parseOtpAuthUri, applyParsedOtpAuthImport } from './utils/totp'
import { copySensitiveText, appendClipboardClearHint } from './utils/sensitiveClipboard'
import { SecurityKeyRequiredError } from './utils/securityKeyRequired'
import { parsePasswordImportCsv, buildLoginImportParams } from './utils/passwordImport'
import { buildChromePasswordCsv } from './utils/passwordExport'
import { resolveEntryWebsites, formatWebsitesDisplay } from './utils/passwordWebsites'
import { getEditorWebsiteText, getEditorWebsites } from './utils/editorWebsiteValues'
import { EXTRA_FIELD_TYPE_OPTIONS } from './constants/extraFieldTypes'
import { applyParsedOtpAuthToExtraField, createAuthenticatorExtraField, extraFieldToAuthenticatorContent } from './utils/extraField'
import { auditVaultPasswords } from './utils/vaultSecurityAudit'
import './reactVault.css'

type WorkspaceMode = 'vault' | 'favorites' | 'recent'
type DetailField = { label: string; value: string; secret?: boolean; link?: boolean; authenticator?: AuthenticatorContent }

const TYPES = PASSWORD_PICKER_ITEMS.map((item) => item.value)

function emptyContent(type: PasswordType): PasswordContent {
  switch (type) {
    case '登录信息': return createEmptyLoginContent()
    case '服务器': return createServerPresetContent()
    case '银行卡': return createEmptyBankCardContent()
    case '身份信息': return createEmptyIdentityContent()
    case '安全备注': return createEmptySecureNoteContent()
    case '两步验证（2FA）': return createEmptyAuthenticatorContent()
    case '数据库': return createEmptyDatabaseContent()
    case '自定义': return createEmptyCustomContent()
  }
}

function detailsFor(entry: PasswordEntry): DetailField[] {
  const type = resolveEntryType(entry)
  const c = entry.content as Record<string, unknown>
  const asText = (key: string): string => String(c[key] ?? '')
  if (type === '登录信息') return [
    ...resolveEntryWebsites(entry).map((value) => ({ label: 'entry.form.login.website', value, link: true })),
    { label: 'entry.form.login.username', value: asText('username') },
    { label: 'entry.form.login.password', value: asText('password'), secret: true },
    ...extraDetails(c.extraFields)
  ]
  if (type === '服务器') return [
    { label: 'entry.form.login.host', value: asText('host') },
    { label: 'entry.form.login.username', value: asText('username') },
    { label: 'entry.form.login.password', value: asText('password'), secret: true },
    ...extraDetails(c.extraFields)
  ]
  if (type === '银行卡') return [
    { label: 'entry.form.bankCard.bankName', value: asText('bankName') },
    { label: 'entry.form.bankCard.cardHolder', value: asText('cardHolder') },
    { label: 'entry.form.bankCard.cardNumber', value: asText('cardNumber'), secret: true },
    { label: 'entry.form.bankCard.expiry', value: asText('expiry') },
    { label: 'entry.form.bankCard.cvv', value: asText('cvv'), secret: true },
    ...extraDetails(c.extraFields)
  ]
  if (type === '身份信息') return [
    { label: 'entry.form.identity.name', value: asText('name') },
    { label: 'entry.form.identity.idNumber', value: asText('idNumber'), secret: true },
    { label: 'entry.form.identity.birthDate', value: asText('birthDate') },
    { label: 'entry.form.identity.lunarBirthday', value: asText('lunarBirthday') },
    { label: 'entry.form.identity.phone', value: asText('phone') },
    { label: 'entry.form.identity.address', value: asText('address') },
    ...extraDetails(c.extraFields)
  ]
  if (type === '数据库') return [
    { label: 'entry.form.database.dbType', value: asText('dbType') },
    { label: 'entry.form.database.host', value: asText('host') },
    { label: 'entry.form.database.port', value: asText('port') },
    { label: 'entry.form.database.databaseName', value: asText('databaseName') },
    { label: 'entry.form.database.username', value: asText('username') },
    { label: 'entry.form.database.password', value: asText('password'), secret: true },
    ...extraDetails(c.extraFields)
  ]
  if (type === '安全备注') return [
    { label: 'entry.form.fieldContent', value: asText('body') },
    ...extraDetails(c.extraFields)
  ]
  if (type === '自定义') return extraDetails(c.fields)
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

export function ReactVaultWorkspace({ mode }: { mode: WorkspaceMode }) {
  const { translate, locale } = useDesktopLocale()
  const toast = useToast()
  const security = useStoreSnapshot(useSecurityStore)
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<PasswordEntry[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [keyword, setKeyword] = useState(new URLSearchParams(location.search).get('q') ?? '')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<VaultSortState>(loadVaultSort)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [visibleLimit, setVisibleLimit] = useState(100)
  const [batchBusy, setBatchBusy] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<PasswordEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PasswordEntry | null>(null)
  const [actionEntry, setActionEntry] = useState<PasswordEntry | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importParams, setImportParams] = useState<PasswordEntryParams[]>([])
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [operationBusy, setOperationBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const loadSequence = useRef(0)

  async function load(): Promise<void> {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const [vaultItems, ids] = await Promise.all([fetchAllPasswordEntries(), getFavoriteIdsApi()])
      if (sequence !== loadSequence.current) return
      setFavoriteIds(ids)
      let next = vaultItems
      if (mode === 'favorites') next = await getFavoriteListApi({ page: 1, pageSize: 10000 }) .then((result) => result.list)
      if (mode === 'recent') next = (await getRecentVisitListApi({ page: 1, pageSize: 10000 })).list
      if (sequence !== loadSequence.current) return
      setItems(next)
      setSelectedId((current) => next.some((entry) => entry.id === current) ? current : next[0]?.id ?? '')
    } catch (cause) {
      if (sequence !== loadSequence.current) return
      setError(cause instanceof Error ? cause.message : translate('vault.msg.operationFailed'))
      setItems([])
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    setSelectionMode(false)
    setSelection([])
    return () => { loadSequence.current++ }
  }, [mode])

  useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onSearchShortcut)
    return () => window.removeEventListener('keydown', onSearchShortcut)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const entryId = params.get('entry')
    if (entryId) setSelectedId(entryId)
    if (params.get('new') === '1') {
      openNew()
      navigate('/vault', { replace: true })
    } else if (params.get('import') === '1') {
      if (security.hasVaultAccess) setImportOpen(true)
      else toast(translate('msg.securityKeyRequiredWrite'))
      navigate('/vault', { replace: true })
    } else if (params.get('focus') === '1') {
      searchRef.current?.focus()
      navigate('/vault', { replace: true })
    }
  }, [location.search])

  const filtered = useMemo(() => {
    const result = filterVaultEntries(items, { keyword, passwordType: type as PasswordType | '' })
    return sortEntries(result, sort, resolveEntryTitle)
  }, [items, keyword, sort, type])
  useEffect(() => { setVisibleLimit(100) }, [keyword, type, mode])
  const selected = filtered.find((entry) => entry.id === selectedId) ?? null
  const title = translate(mode === 'favorites' ? 'nav.favorites' : mode === 'recent' ? 'nav.recent' : 'nav.vault')
  const typeOptions = getPasswordTypeFilterOptions(locale)
  const sortOrderOptions = getVaultSortOrderOptions(sort.field)
  const searchShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ F' : 'Ctrl F'
  const hasActiveFilters = Boolean(keyword.trim() || type)

  function openNew(): void {
    if (!security.hasVaultAccess) { toast(translate('msg.securityKeyRequiredWrite')); return }
    setEditing(null)
    setPickerOpen(true)
  }

  function beginEdit(entry: PasswordEntry): void {
    if (!security.hasVaultAccess) { toast(translate('msg.securityKeyRequiredWrite')); return }
    setEditing(entry)
    setEditorOpen(true)
  }

  async function toggleFavorite(entry: PasswordEntry): Promise<void> {
    try {
      if (favoriteIds.includes(entry.id)) await removeFavoriteApi(entry.id)
      else await addFavoriteApi(entry.id)
      await load()
      toast(translate(favoriteIds.includes(entry.id) ? 'vault.msg.favoriteRemoved' : 'vault.msg.favoriteAdded'))
    } catch (cause) { toast(cause instanceof Error ? cause.message : translate('vault.msg.operationFailed')) }
  }

  async function copyValue(field: DetailField): Promise<void> {
    if (!field.value) return
    const copied = await copySensitiveText(field.value)
    toast(copied ? appendClipboardClearHint(translate('vault.msg.fieldCopied', { label: translate(field.label) }), translate) : translate('entry.msg.copyFailed'))
    if (copied && selected) void recordRecentVisitApi(selected.id)
  }

  async function saveEntry(params: PasswordEntryParams): Promise<void> {
    if (operationBusy) return
    setOperationBusy(true)
    try {
      const saved = editing?.id ? await updatePasswordApi(editing.id, params) : await createPasswordApi(params)
      setEditorOpen(false)
      setPickerOpen(false)
      await load()
      setSelectedId(saved.id)
      toast(translate(editing?.id ? 'vault.msg.updated' : 'vault.msg.created'))
    } catch (cause) {
      toast(cause instanceof SecurityKeyRequiredError ? translate('msg.securityKeyRequiredWrite') : cause instanceof Error ? cause.message : translate('vault.msg.saveFailed'))
    } finally { setOperationBusy(false) }
  }

  async function removeEntry(entry: PasswordEntry): Promise<void> {
    setOperationBusy(true)
    try {
      await deletePasswordApi(entry.id)
      setConfirmDelete(null)
      await load()
      toast(translate('vault.msg.deleted'))
    } catch (cause) { toast(cause instanceof Error ? cause.message : translate('vault.msg.deleteFailed')) }
    finally { setOperationBusy(false) }
  }

  async function duplicateEntry(entry: PasswordEntry): Promise<void> {
    setOperationBusy(true)
    try {
      const duplicate = await createPasswordApi({
        passwordType: resolveEntryType(entry),
        passwordLabels: [...(entry.passwordLabels ?? [])],
        passwordTitle: `${resolveEntryTitle(entry)} (${translate('vault.detail.duplicate')})`,
        websites: [...resolveEntryWebsites(entry)],
        remark: entry.remark ?? '',
        content: structuredClone(entry.content)
      })
      setActionEntry(null)
      await load()
      setSelectedId(duplicate.id)
      toast(translate('vault.msg.duplicateCreated'))
    } catch (cause) { toast(cause instanceof Error ? cause.message : translate('vault.msg.duplicateFailed')) }
    finally { setOperationBusy(false) }
  }

  async function copyEntry(entry: PasswordEntry): Promise<void> {
    const fields = detailsFor(entry).filter((field) => field.value)
    const text = fields.map((field) => `${translate(field.label)}: ${field.value}`).join('\n')
    if (!text) { toast(translate('entry.msg.nothingToCopy')); return }
    const copied = await copySensitiveText(text)
    toast(copied ? appendClipboardClearHint(translate('vault.msg.shareCopied'), translate) : translate('entry.msg.copyFailed'))
    if (copied) void recordRecentVisitApi(entry.id)
  }

  async function runBatch(kind: 'favorite' | 'unfavorite' | 'delete'): Promise<void> {
    if (!selection.length || batchBusy) return
    setBatchBusy(true)
    let success = 0
    for (const id of selection) {
      try {
        if (kind === 'delete') await deletePasswordApi(id)
        else if (kind === 'favorite') await addFavoriteApi(id)
        else await removeFavoriteApi(id)
        success++
      } catch { /* keep processing remaining selected entries */ }
    }
    setSelection([])
    setSelectionMode(false)
    setConfirmBatchDelete(false)
    await load()
    setBatchBusy(false)
    const key = kind === 'delete' ? 'vault.batch.deleted' : kind === 'favorite' ? 'vault.batch.favoriteAdded' : 'vault.batch.favoriteRemoved'
    toast(success === selection.length ? translate(key, { count: success }) : translate(kind === 'delete' ? 'vault.batch.deletePartial' : kind === 'favorite' ? 'vault.batch.favoritePartial' : 'vault.batch.unfavoritePartial', { success, failed: selection.length - success }))
  }

  function setSortField(field: VaultSortField): void {
    const next = { field, order: field === 'title' ? 'asc' : 'desc' } satisfies VaultSortState
    setSort(next)
    saveVaultSort(next)
  }

  function clearFilters(): void {
    setKeyword('')
    setType('')
    searchRef.current?.focus()
  }

  async function importCsv(file: File | undefined): Promise<void> {
    if (!file) return
    setImportError('')
    try {
      const parsed = parsePasswordImportCsv(await file.text())
      if (!parsed.rows.length) { setImportError(translate('entry.import.noValidRows')); setImportParams([]); return }
      setImportParams(parsed.rows.map(buildLoginImportParams))
    } catch { setImportError(translate('entry.import.failed')); setImportParams([]) }
  }

  async function confirmImport(): Promise<void> {
    if (importBusy || !importParams.length) return
    setImportBusy(true)
    let imported = 0
    const total = importParams.length
    for (const params of importParams) {
      try { await createPasswordApi(params); imported++ } catch { /* continue and report the partial result */ }
    }
    setImportBusy(false)
    setImportOpen(false)
    setImportParams([])
    await load()
    toast(translate('entry.import.result', { success: imported, total }))
  }

  async function exportCsv(): Promise<void> {
    const confirmed = window.confirm(translate('dashboard.exportConfirmBody'))
    if (!confirmed) return
    try {
      const entries = await fetchAllPasswordEntries()
      const result = buildChromePasswordCsv(entries)
      if (!result.rowCount) { toast(translate('dashboard.exportEmpty')); return }
      const saved = await window.fileApi?.savePasswordCsv({ defaultFileName: `PPWD-passwords-${new Date().toISOString().slice(0, 10)}.csv`, content: result.content })
      if (saved?.ok) toast(translate('dashboard.exportSuccess', { count: result.rowCount }))
    } catch (cause) { toast(cause instanceof Error ? cause.message : translate('dashboard.exportFailed')) }
  }

  const hasMore = filtered.length > visibleLimit
  const shownEntries = filtered.slice(0, visibleLimit)

  const showFirstRun = mode === 'vault' && !loading && !error && items.length === 0 && !hasActiveFilters

  return <main className="react-page react-page--wide react-vault" aria-busy={loading}>
    <header className="react-page__header"><div><p className="react-eyebrow">{translate('nav.dashboard')}</p><h1>{title}</h1><p className="react-page__description">{translate(mode === 'favorites' ? 'vault.favoriteSubtitle' : mode === 'recent' ? 'vault.recentSubtitle' : 'vault.subtitle')}</p></div><div className="react-vault__header-actions">{mode === 'vault' && <Button disabled={loading || items.length === 0} onClick={exportCsv} icon={<FileUp size={15} />}>{translate('dashboard.actionExportPassword')}</Button>}<Button tone="primary" onClick={openNew} icon={<Plus size={16} />}>{translate('vault.newItem')}</Button></div></header>
    <div className="react-vault__toolbar">
      <div className="react-vault__search" role="search"><Search size={16} /><input ref={searchRef} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={translate('vault.searchPlaceholder')} aria-label={translate('vault.searchPlaceholder')} />{keyword && <button type="button" className="react-vault__search-clear" aria-label={translate('vault.clearSearch')} title={translate('vault.clearSearch')} onClick={() => setKeyword('')}><X size={15} /></button>}<kbd>{searchShortcut}</kbd></div>
      <SelectField label={translate('vault.allCategories')} id="vault-type-filter" value={type} onValueChange={setType}><option value="">{translate('vault.allCategories')}</option>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
      <SelectField label={translate('vault.sortAriaLabel')} id="vault-sort" value={sort.field} onValueChange={(value) => setSortField(value as VaultSortField)}>{(['title', 'createTime', 'updateTime', 'recent'] as VaultSortField[]).map((field) => <option key={field} value={field}>{translate(`vault.sort.field.${field}`)}</option>)}</SelectField>
      <SelectField label={translate('vault.sort.orderLabel')} id="vault-sort-order" value={sort.order} onValueChange={(value) => { const next = { ...sort, order: value as VaultSortState['order'] }; setSort(next); saveVaultSort(next) }}>{sortOrderOptions.map(({ value }) => <option key={value} value={value}>{translate(`vault.sort.order.${sort.field}.${value}`)}</option>)}</SelectField>
      <Button size="sm" aria-label={translate('vault.batch.select')} title={translate('vault.batch.select')} aria-pressed={selectionMode} className={selectionMode ? 'is-active' : ''} icon={<ListChecks size={16} />} onClick={() => { if (selectionMode) { setSelectionMode(false); setSelection([]) } else setSelectionMode(true) }} />
    </div>
    <div className="react-vault__filter-status" aria-live="polite"><span>{translate('vault.resultCount', { count: filtered.length })}</span>{hasActiveFilters && <Button tone="quiet" icon={<X size={14} />} onClick={clearFilters}>{translate('vault.clearFilters')}</Button>}</div>
    {selectionMode && <div className="react-vault__batch"><label><input type="checkbox" disabled={!filtered.length} checked={filtered.length > 0 && filtered.every((entry) => selection.includes(entry.id))} onChange={(event) => setSelection(event.target.checked ? Array.from(new Set([...selection, ...filtered.map((entry) => entry.id)])) : selection.filter((id) => !filtered.some((entry) => entry.id === id)))} />{translate('vault.batch.selectAll')}</label><span>{translate('vault.batch.selected', { count: selection.length })}</span>{mode === 'favorites' ? <Button disabled={batchBusy || !selection.length} onClick={() => void runBatch('unfavorite')}>{translate('vault.batch.removeFavorite')}</Button> : <Button disabled={batchBusy || !selection.length} onClick={() => void runBatch('favorite')}>{translate('vault.batch.addFavorite')}</Button>}<Button tone="danger" disabled={batchBusy || !selection.length} onClick={() => setConfirmBatchDelete(true)}>{translate('vault.batch.delete')}</Button><Button tone="quiet" onClick={() => { setSelection([]); setSelectionMode(false) }}>{translate('vault.batch.cancel')}</Button></div>}
    {error && <div className="react-vault__error" role="alert"><ShieldAlert size={16} />{error}<Button onClick={() => void load()}>{translate('common.retry')}</Button></div>}
    <section className={`react-vault__workspace${showFirstRun ? ' is-empty' : ''}`}>
      {showFirstRun ? <div className="react-vault__first-run"><KeyRound size={28} /><h2>{translate('vault.empty.default')}</h2><p>{translate('vault.empty.firstRunHint')}</p><div className="react-vault__first-run-actions"><Button tone="primary" icon={<Plus size={15} />} onClick={openNew}>{translate('vault.newItem')}</Button><Button icon={<FileUp size={15} />} onClick={() => setImportOpen(true)}>{translate('dashboard.actionImportPassword')}</Button></div></div> : <>
      <aside className={`react-vault__list ${selected ? 'has-selection' : ''}`} aria-label={title}>
        {loading ? <div className="react-vault__skeleton" aria-label={translate('common.loading')}>{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div> : shownEntries.length ? <div className="react-vault__list-scroll">{shownEntries.map((entry) => <article key={entry.id} className={`react-vault__item ${entry.id === selectedId ? 'is-active' : ''}`}>
          {selectionMode && <input type="checkbox" aria-label={resolveEntryTitle(entry)} checked={selection.includes(entry.id)} onChange={(event) => setSelection((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} />}
          <button type="button" className="react-vault__item-main" aria-pressed={selectionMode ? selection.includes(entry.id) : undefined} onClick={() => { if (selectionMode) setSelection((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id]); else { setSelectedId(entry.id); void recordRecentVisitApi(entry.id) } }}><span className="react-vault__icon" style={{ '--entry-color': getEntryTypeColor(entry) } as React.CSSProperties}>{entryTypeIcon(entry)}</span><span className="react-vault__item-copy"><strong title={resolveEntryTitle(entry)}>{resolveEntryTitle(entry)}</strong><small>{subtitle(entry, translate)}</small><small className="react-vault__item-type">{entryTypeLabel(entry, translate)}</small></span>{favoriteIds.includes(entry.id) && <Star size={14} className="is-favorite" aria-label={translate('vault.detail.favorite')} />}</button>
          <button type="button" className="react-vault__item-more" aria-label={translate('vault.detail.moreActions')} title={translate('vault.detail.moreActions')} onClick={() => { setSelectedId(entry.id); setActionEntry(entry) }}><MoreHorizontal size={17} /></button>
        </article>)}</div> : <div className="react-vault__empty"><KeyRound size={26} /><strong>{translate(keyword || type ? 'vault.empty.search' : mode === 'favorites' ? 'vault.empty.favorites' : mode === 'recent' ? 'vault.empty.recent' : 'vault.empty.default')}</strong></div>}
        {hasMore && <div className="react-vault__more-hint"><span>{translate('vault.listLimit', { count: shownEntries.length })}</span><Button onClick={() => setVisibleLimit((count) => count + 100)}>{translate('vault.loadMore')}</Button></div>}
      </aside>
      <div className={`react-vault__detail ${selected ? 'is-open' : ''}`}>
        {selected ? <EntryDetail entry={selected} favorite={favoriteIds.includes(selected.id)} onBack={() => setSelectedId('')} onFavorite={() => void toggleFavorite(selected)} onEdit={() => beginEdit(selected)} onMore={() => setActionEntry(selected)} onCopy={copyValue} translate={translate} /> : <div className="react-vault__empty"><KeyRound size={28} /><strong>{translate('vault.empty.selectItem')}</strong></div>}
      </div>
      </>}
    </section>
    <EntryTypePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onImport={() => { setPickerOpen(false); setImportOpen(true) }} onSelect={(type) => { setEditing({ id: '', passwordType: type, content: emptyContent(type) } as PasswordEntry); setEditorOpen(true); setPickerOpen(false) }} translate={translate} />
    {editorOpen && <EntryEditor key={editing?.id || editing?.passwordType || 'new'} open={editorOpen} entry={editing} busy={operationBusy} onClose={() => setEditorOpen(false)} onSave={(params) => void saveEntry(params)} translate={translate} />}
    <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}><DialogContent title={translate('vault.msg.deleteConfirmTitle')} description={translate('vault.msg.deleteConfirm', { title: confirmDelete ? resolveEntryTitle(confirmDelete) : '' })}><div className="react-dialog-actions"><Button onClick={() => setConfirmDelete(null)}>{translate('msg.cancel')}</Button><Button tone="danger" disabled={operationBusy} onClick={() => confirmDelete && void removeEntry(confirmDelete)} icon={<Trash2 size={15} />}>{translate('vault.detail.delete')}</Button></div></DialogContent></Dialog>
    <Dialog open={!!actionEntry} onOpenChange={(open) => { if (!open) setActionEntry(null) }}><DialogContent title={translate('vault.detail.moreActions')} description={actionEntry ? resolveEntryTitle(actionEntry) : undefined}><div className="react-entry-actions"><Button onClick={() => actionEntry && void copyEntry(actionEntry)} icon={<Copy size={15} />}>{translate('vault.detail.share')}</Button><Button onClick={() => actionEntry && void duplicateEntry(actionEntry)} disabled={operationBusy}>{translate('vault.detail.duplicate')}</Button><Button onClick={() => { if (actionEntry) beginEdit(actionEntry); setActionEntry(null) }} icon={<Pencil size={15} />}>{translate('vault.detail.edit')}</Button><Button tone="danger" onClick={() => { setConfirmDelete(actionEntry); setActionEntry(null) }} icon={<Trash2 size={15} />}>{translate('vault.detail.delete')}</Button></div></DialogContent></Dialog>
    <Dialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}><DialogContent title={translate('vault.batch.deleteConfirmTitle')} description={translate('vault.batch.deleteConfirm', { count: selection.length })}><div className="react-dialog-actions"><Button onClick={() => setConfirmBatchDelete(false)}>{translate('msg.cancel')}</Button><Button tone="danger" disabled={batchBusy} onClick={() => void runBatch('delete')}>{translate('vault.batch.delete')}</Button></div></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportParams([]); setImportError('') } }}><DialogContent title={translate('entry.import.title')} description={translate('entry.import.securityNote')}><div className="react-import"><input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event.target.files?.[0])} />{importError && <p role="alert" className="react-form__error">{importError}</p>}{importParams.length > 0 && <p>{translate('entry.import.result', { success: importParams.length, total: importParams.length })}</p>}<div className="react-dialog-actions"><Button onClick={() => setImportOpen(false)}>{translate('msg.cancel')}</Button><Button tone="primary" disabled={!importParams.length || importBusy} onClick={() => void confirmImport()}>{translate('entry.import.confirm')}</Button></div></div></DialogContent></Dialog>
  </main>
}

function subtitle(entry: PasswordEntry, translate: (key: string) => string): string {
  const content = entry.content as Record<string, unknown>
  const type = resolveEntryType(entry)
  if (type === '登录信息') return String(content.username || formatWebsitesDisplay(resolveEntryWebsites(entry)) || translate('vault.type.login'))
  if (type === '服务器' || type === '数据库') return String(content.host || content.dbType || translate(`vault.type.${type === '服务器' ? 'server' : 'database'}`))
  if (type === '银行卡') return String(content.cardHolder || translate('vault.type.bankCard'))
  if (type === '身份信息') return String(content.name || translate('vault.type.identity'))
  return translate(`vault.type.${type === '安全备注' ? 'secureNote' : type === '自定义' ? 'custom' : type === '两步验证（2FA）' ? 'authenticator' : 'login'}`)
}

function entryTypeLabel(entry: PasswordEntry, translate: (key: string) => string): string {
  const type = resolveEntryType(entry)
  const key = type === '身份信息' ? 'identity'
    : type === '两步验证（2FA）' ? 'authenticator'
      : type === '安全备注' ? 'secureNote'
        : type === '银行卡' ? 'bankCard'
          : type === '服务器' ? 'server'
            : type === '数据库' ? 'database'
              : type === '自定义' ? 'custom' : 'login'
  return translate(`vault.type.${key}`)
}

function entryTypeIcon(entry: PasswordEntry): React.ReactNode {
  const type = resolveEntryType(entry)
  if (type === '银行卡') return <CreditCard size={16} />
  if (type === '身份信息') return <Fingerprint size={16} />
  if (type === '数据库') return <Database size={16} />
  if (type === '服务器') return <Server size={16} />
  if (type === '安全备注') return <FileText size={16} />
  if (type === '两步验证（2FA）') return <ShieldCheck size={16} />
  return <KeyRound size={16} />
}

function EntryDetail({ entry, favorite, onBack, onFavorite, onEdit, onMore, onCopy, translate }: { entry: PasswordEntry; favorite: boolean; onBack: () => void; onFavorite: () => void; onEdit: () => void; onMore: () => void; onCopy: (field: DetailField) => void; translate: (key: string, params?: Record<string, string | number>) => string }) {
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

function EntryTypePicker({ open, onClose, onImport, onSelect, translate }: { open: boolean; onClose: () => void; onImport: () => void; onSelect: (type: PasswordType) => void; translate: (key: string) => string }) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}><DialogContent title={translate('entry.picker.title')}><div className="react-type-picker">{TYPES.map((type) => <button key={type} type="button" onClick={() => onSelect(type)}><KeyRound size={17} /><span>{translate(`vault.type.${type === '身份信息' ? 'identity' : type === '两步验证（2FA）' ? 'authenticator' : type === '安全备注' ? 'secureNote' : type === '银行卡' ? 'bankCard' : type === '服务器' ? 'server' : type === '数据库' ? 'database' : type === '自定义' ? 'custom' : 'login'}`)}</span></button>)}<button type="button" onClick={onImport}><FileUp size={17} /><span>{translate('entry.picker.import')}</span></button></div></DialogContent></Dialog>
}

function EntryEditor({ open, entry, busy, onClose, onSave, translate }: { open: boolean; entry: PasswordEntry | null; busy: boolean; onClose: () => void; onSave: (params: PasswordEntryParams) => void; translate: (key: string, params?: Record<string, string | number>) => string }) {
  const type = entry?.passwordType ?? '登录信息'
  const [content, setContent] = useState<PasswordContent>(() => entry ? structuredClone(entry.content) : emptyContent(type))
  const [labels, setLabels] = useState((entry?.passwordLabels ?? []).join(', '))
  const [remark, setRemark] = useState(entry?.remark ?? '')
  const [otpUri, setOtpUri] = useState('')
  const [error, setError] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const toast = useToast()
  const record = content as Record<string, unknown>
  function set(key: string, value: unknown): void { setContent((current) => ({ ...current, [key]: value }) as PasswordContent) }
  function generatePassword(): void { set('password', createStrongPassword()) }
  async function copyEditorPassword(): Promise<void> {
    const copied = await copySensitiveText(String(record.password ?? ''))
    toast(copied ? appendClipboardClearHint(translate('entry.form.passwordCopied'), translate) : translate('entry.msg.copyFailed'))
  }
  function passwordField(labelKey: string): React.ReactNode {
    return <div className="react-password-input react-password-input--editor">
      {field('password', labelKey, passwordVisible ? 'text' : 'password')}
      <Button type="button" aria-label={translate(passwordVisible ? 'entry.form.hidePassword' : 'entry.form.showPassword')} title={translate(passwordVisible ? 'entry.form.hidePassword' : 'entry.form.showPassword')} icon={passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />} onClick={() => setPasswordVisible((visible) => !visible)} />
      <Button type="button" aria-label={translate('entry.form.copyPassword')} title={translate('entry.form.copyPassword')} icon={<Copy size={15} />} onClick={() => void copyEditorPassword()} disabled={!record.password} />
      <Button type="button" aria-label={translate('entry.form.generatePassword')} title={translate('entry.form.generatePassword')} icon={<RefreshCw size={15} />} onClick={generatePassword} />
    </div>
  }
  function field(key: string, labelKey: string, typeName = 'text'): React.ReactNode { return <TextField key={key} label={translate(labelKey)} type={typeName} value={String(record[key] ?? '')} onChange={(event) => set(key, event.target.value)} autoComplete="off" /> }
  function submit(event: FormEvent): void {
    event.preventDefault()
    const title = String(record.title ?? '').trim()
    if (!title) { setError(translate('entry.form.titleRequired')); return }
    if (type === '两步验证（2FA）' && !isValidAuthenticatorSecret(String(record.secret ?? ''))) { setError(translate('entry.form.authenticator.secretInvalid')); return }
    const websites = type === '登录信息' ? getEditorWebsites(record.websites).filter(Boolean) : []
    onSave({ passwordType: type, passwordLabels: labels.split(',').map((label) => label.trim()).filter(Boolean), passwordTitle: title, content, websites, remark })
  }
  let specific: React.ReactNode = null
  if (type === '登录信息') specific = <>{field('username', 'entry.form.login.username')}{passwordField('entry.form.login.password')}<TextField label={translate('entry.form.login.website')} value={getEditorWebsiteText(record.websites)} onChange={(event) => set('websites', event.target.value.split(',').map((value) => value.trim()))} description={translate('entry.form.websitesHint')} /><ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => set('extraFields', value)} translate={translate} /></>
  else if (type === '服务器') specific = <>{field('host', 'entry.form.login.host')}{field('username', 'entry.form.login.username')}{passwordField('entry.form.login.password')}<ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, extraFields: value }) as PasswordContent)} translate={translate} /></>
  else if (type === '银行卡') specific = <>{field('bankName', 'entry.form.bankCard.bankName')}{field('cardHolder', 'entry.form.bankCard.cardHolder')}{field('cardNumber', 'entry.form.bankCard.cardNumber', 'password')}{field('expiry', 'entry.form.bankCard.expiry')}{field('cvv', 'entry.form.bankCard.cvv', 'password')}<ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, extraFields: value }) as PasswordContent)} translate={translate} /></>
  else if (type === '身份信息') specific = <>{field('name', 'entry.form.identity.name')}{field('idNumber', 'entry.form.identity.idNumber', 'password')}{field('birthDate', 'entry.form.identity.birthDate')}{field('lunarBirthday', 'entry.form.identity.lunarBirthday')}{field('phone', 'entry.form.identity.phone')}{field('address', 'entry.form.identity.address')}<ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, extraFields: value }) as PasswordContent)} translate={translate} /></>
  else if (type === '数据库') specific = <>{field('dbType', 'entry.form.database.dbType')}{field('host', 'entry.form.database.host')}{field('port', 'entry.form.database.port')}{field('databaseName', 'entry.form.database.databaseName')}{field('username', 'entry.form.database.username')}{passwordField('entry.form.database.password')}<ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, extraFields: value }) as PasswordContent)} translate={translate} /></>
  else if (type === '安全备注') specific = <><label className="bp-field"><span className="bp-field__label">{translate('entry.form.fieldContent')}</span><textarea className="bp-input" rows={6} value={String(record.body ?? '')} onChange={(event) => set('body', event.target.value)} /></label><ExtraFields value={record.extraFields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, extraFields: value }) as PasswordContent)} translate={translate} /></>
  else if (type === '两步验证（2FA）') specific = <><TextField label={translate('entry.form.authenticator.importUri')} value={otpUri} onChange={(event) => setOtpUri(event.target.value)} placeholder={translate('entry.form.authenticator.importUriPlaceholder')} /><Button type="button" onClick={() => { const parsed = parseOtpAuthUri(otpUri); if (!parsed) setError(translate('entry.form.authenticator.importFailed')); else { const next = { ...(content as AuthenticatorContent) }; applyParsedOtpAuthImport(next, parsed); setContent(next); setError('') } }}>{translate('entry.form.authenticator.import')}</Button>{field('issuer', 'entry.form.authenticator.issuer')}{field('account', 'entry.form.authenticator.accountNamePlaceholder')}{field('secret', 'entry.form.authenticator.secret')}<SelectField label={translate('entry.form.authenticator.algorithm')} id="otp-algorithm" value={String(record.algorithm)} onValueChange={(value) => set('algorithm', value)}><option>SHA1</option><option>SHA256</option><option>SHA512</option></SelectField><SelectField label={translate('entry.form.authenticator.digits')} id="otp-digits" value={String(record.digits)} onValueChange={(value) => set('digits', value)}><option value="6">6</option><option value="8">8</option></SelectField><SelectField label={translate('entry.form.authenticator.period')} id="otp-period" value={String(record.period)} onValueChange={(value) => set('period', value)}>{[15, 30, 45, 60].map((value) => <option key={value} value={value}>{translate('entry.form.authenticator.periodOption', { n: value })}</option>)}</SelectField></>
  else specific = <CustomFields fields={record.fields as LoginExtraField[]} onChange={(value) => setContent((current) => ({ ...current, fields: value }) as PasswordContent)} translate={translate} />
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}><DialogContent title={translate(entry?.id ? 'vault.detail.edit' : 'entry.dialog.save')}><form className="react-entry-form" onSubmit={submit}>{field('title', 'entry.form.titlePlaceholder')}{specific}<label className="bp-field"><span className="bp-field__label">{translate('entry.form.tags')}</span><input className="bp-input" value={labels} onChange={(event) => setLabels(event.target.value)} placeholder={translate('entry.dialog.addTagsPlaceholder')} /></label><label className="bp-field"><span className="bp-field__label">{translate('entry.form.remark')}</span><textarea className="bp-input" rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>{error && <p role="alert" className="react-form__error">{error}</p>}<div className="react-dialog-actions"><Button type="button" onClick={onClose}>{translate('msg.cancel')}</Button><Button type="submit" tone="primary" disabled={busy}>{translate('entry.dialog.save')}</Button></div></form></DialogContent></Dialog>
}

function ExtraFields({ value = [], onChange, translate }: { value?: LoginExtraField[]; onChange: (value: LoginExtraField[]) => void; translate: (key: string) => string }) {
  function update(index: number, next: LoginExtraField): void { onChange(value.map((item, i) => i === index ? next : item)) }
  return <section className="react-extra-fields"><header><h3>{translate('entry.form.additionalFields')}</h3><Button type="button" icon={<Plus size={14} />} onClick={() => onChange([...value, { label: '', value: '', type: 'custom' }])}>{translate('entry.form.addMore')}</Button></header>{value.map((field, index) => <div className="react-extra-fields__row" key={index}><SelectField label={translate('entry.form.extraFieldType.custom')} id={`extra-type-${index}`} value={field.type ?? 'custom'} onValueChange={(nextType) => { update(index, nextType === 'authenticator' ? createAuthenticatorExtraField() : { ...field, type: nextType as LoginExtraField['type'] }) }}>{EXTRA_FIELD_TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{translate(option.labelKey)}</option>)}</SelectField>{field.type === 'authenticator' ? <AuthenticatorExtraFieldEditor field={field} onChange={(next) => update(index, next)} translate={translate} /> : <><TextField label={translate('entry.form.fieldTitle')} value={field.label} onChange={(event) => update(index, { ...field, label: event.target.value })} /><TextField label={translate('entry.form.fieldContent')} type={field.type === 'password' ? 'password' : 'text'} value={field.value} onChange={(event) => update(index, { ...field, value: event.target.value })} /></>}<Button type="button" aria-label={translate('entry.form.removeField')} title={translate('entry.form.removeField')} icon={<Trash2 size={14} />} onClick={() => onChange(value.filter((_, i) => i !== index))} /></div>)}</section>
}

function AuthenticatorExtraFieldEditor({ field, onChange, translate }: { field: LoginExtraField; onChange: (field: LoginExtraField) => void; translate: (key: string, params?: Record<string, string | number>) => string }) {
  const [uri, setUri] = useState('')
  function set(key: string, value: unknown): void { onChange({ ...field, [key]: value }) }
  function importUri(): void {
    const parsed = parseOtpAuthUri(uri)
    if (!parsed) return
    const next = { ...field }
    applyParsedOtpAuthToExtraField(next, parsed)
    onChange(next)
  }
  return <div className="react-extra-fields__authenticator"><TextField label={translate('entry.form.authenticator.importUri')} value={uri} onChange={(event) => setUri(event.target.value)} placeholder={translate('entry.form.authenticator.importUriPlaceholder')} /><Button type="button" onClick={importUri}>{translate('entry.form.authenticator.import')}</Button><TextField label={translate('entry.form.authenticator.issuer')} value={field.issuer ?? ''} onChange={(event) => set('issuer', event.target.value)} /><TextField label={translate('entry.form.authenticator.accountNamePlaceholder')} value={field.account ?? ''} onChange={(event) => set('account', event.target.value)} /><TextField label={translate('entry.form.authenticator.secret')} type="password" value={field.secret ?? field.value} onChange={(event) => set('secret', event.target.value)} /><SelectField label={translate('entry.form.authenticator.algorithm')} id="extra-otp-algorithm" value={field.algorithm ?? 'SHA1'} onValueChange={(value) => set('algorithm', value)}><option>SHA1</option><option>SHA256</option><option>SHA512</option></SelectField><SelectField label={translate('entry.form.authenticator.digits')} id="extra-otp-digits" value={String(field.digits ?? 6)} onValueChange={(value) => set('digits', Number(value))}><option value="6">6</option><option value="8">8</option></SelectField><SelectField label={translate('entry.form.authenticator.period')} id="extra-otp-period" value={String(field.period ?? 30)} onValueChange={(value) => set('period', Number(value))}>{[15, 30, 45, 60].map((value) => <option key={value} value={value}>{translate('entry.form.authenticator.periodOption', { n: value })}</option>)}</SelectField></div>
}

function CustomFields({ fields = [], onChange, translate }: { fields?: LoginExtraField[]; onChange: (fields: LoginExtraField[]) => void; translate: (key: string) => string }) {
  function update(index: number, next: LoginExtraField): void { onChange(fields.map((item, i) => i === index ? next : item)) }
  return <section className="react-extra-fields"><header><h3>{translate('entry.form.additionalFields')}</h3><Button type="button" icon={<Plus size={14} />} onClick={() => onChange([...fields, { label: '', value: '', type: 'custom' }])}>{translate('entry.form.addMore')}</Button></header>{fields.map((field, index) => <div className="react-extra-fields__row" key={index}><SelectField label={translate('entry.form.extraFieldType.custom')} id={`custom-type-${index}`} value={field.type ?? 'custom'} onValueChange={(nextType) => { update(index, nextType === 'authenticator' ? createAuthenticatorExtraField() : { ...field, type: nextType as LoginExtraField['type'] }) }}>{EXTRA_FIELD_TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{translate(option.labelKey)}</option>)}</SelectField>{field.type === 'authenticator' ? <AuthenticatorExtraFieldEditor field={field} onChange={(next) => update(index, next)} translate={translate} /> : <><TextField label={translate('entry.form.fieldTitle')} value={field.label} onChange={(event) => update(index, { ...field, label: event.target.value })} /><TextField label={translate('entry.form.fieldContent')} type={field.type === 'password' ? 'password' : 'text'} value={field.value} onChange={(event) => update(index, { ...field, value: event.target.value })} /></>}<Button type="button" aria-label={translate('entry.form.removeField')} icon={<Trash2 size={14} />} onClick={() => onChange(fields.filter((_, i) => i !== index))} /></div>)}</section>
}

function createStrongPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=?'
  const ceiling = Math.floor(256 / alphabet.length) * alphabet.length
  let output = ''
  const bytes = new Uint8Array(32)
  while (output.length < 24) {
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= ceiling) continue
      output += alphabet[byte % alphabet.length]
      if (output.length === 24) break
    }
  }
  return output
}

export function ReactSecurityCenterPage() {
  const { translate } = useDesktopLocale()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [riskFilter, setRiskFilter] = useState<'all' | 'weak' | 'reused'>('all')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetchAllPasswordEntries()
      .then((result) => { if (active) setEntries(result) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate('vault.msg.operationFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  const audit = auditVaultPasswords(entries)
  const risks = entries.filter((entry) => audit.weakIds.has(entry.id) || audit.reusedIds.has(entry.id))
  const visibleRisks = risks.filter((entry) => riskFilter === 'all' || (riskFilter === 'weak' ? audit.weakIds.has(entry.id) : audit.reusedIds.has(entry.id)))
  const riskCount = riskFilter === 'weak' ? audit.weakIds.size : riskFilter === 'reused' ? audit.reusedIds.size : risks.length
  const reasonText = (entry: PasswordEntry): string => [
    ...(audit.weakIds.has(entry.id) ? [translate('securityCenter.weakRisk')] : []),
    ...(audit.reusedIds.has(entry.id) ? [translate('securityCenter.reusedRisk')] : [])
  ].join(' · ')
  return <main className="react-page react-security-center"><header className="react-page__header"><div><p className="react-eyebrow">{translate('nav.vault')}</p><h1>{translate('securityCenter.title')}</h1><p className="react-page__description">{translate('securityCenter.description')}</p></div><Button onClick={() => navigate('/vault')} icon={<KeyRound size={15} />}>{translate('nav.vault')}</Button></header>{error && <div className="react-vault__error" role="alert"><ShieldAlert size={16} />{error}<Button onClick={() => setAttempt((value) => value + 1)}>{translate('common.retry')}</Button></div>}<section className="react-security-center__summary" aria-label={translate('securityCenter.summary')}><button type="button" aria-pressed={riskFilter === 'all'} onClick={() => setRiskFilter('all')}><span>{translate('securityCenter.checked')}</span><strong>{loading ? '—' : audit.checked}</strong><small>{translate('securityCenter.filterAll')}</small></button><button type="button" aria-pressed={riskFilter === 'weak'} onClick={() => setRiskFilter('weak')}><span>{translate('securityCenter.weak')}</span><strong>{loading ? '—' : audit.weakIds.size}</strong><small>{translate('securityCenter.filterWeak')}</small></button><button type="button" aria-pressed={riskFilter === 'reused'} onClick={() => setRiskFilter('reused')}><span>{translate('securityCenter.reused')}</span><strong>{loading ? '—' : audit.reusedIds.size}</strong><small>{translate('securityCenter.filterReused')}</small></button></section><p className="react-security-center__note">{translate('securityCenter.overlapHint')}</p><section className="react-security-center__risks"><header><h2>{translate('securityCenter.risks')}</h2>{!loading && !error && <span>{translate('securityCenter.showing', { count: riskCount })}</span>}</header>{loading ? <p>{translate('common.loading')}</p> : error ? <p>{translate('vault.msg.operationFailed')}</p> : visibleRisks.length ? visibleRisks.map((entry) => <button key={entry.id} type="button" onClick={() => navigate(`/vault?entry=${encodeURIComponent(entry.id)}`)}><ShieldAlert size={16} /><span><strong>{resolveEntryTitle(entry)}</strong><small>{reasonText(entry)}</small></span></button>) : risks.length ? <p>{translate('securityCenter.noFilteredRisks')}</p> : <p>{translate('securityCenter.allClear')}</p>}</section></main>
}
