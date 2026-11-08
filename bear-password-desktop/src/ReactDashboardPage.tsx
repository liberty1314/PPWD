import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, FileUp, KeyRound, LockKeyhole, Plus, ShieldCheck, Star } from 'lucide-react'
import { getDashboardStatsApi } from './api/dashboard'
import { getRecentVisitListApi } from './api/recent'
import { useAutoLockStore } from './stores/autoLock'
import { useStoreSnapshot } from './stores/reactiveStore'
import { useDesktopLocale } from './ui/useDesktopLocale'
import { Button } from './ui/primitives'
import type { DashboardStats, PasswordEntry } from './types'

const EMPTY_STATS: DashboardStats = { totalPasswords: 0, favoriteCount: 0, recentCount: 0 }

export function ReactDashboardPage() {
  const navigate = useNavigate()
  const { translate } = useDesktopLocale()
  const autoLock = useStoreSnapshot(useAutoLockStore)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [recent, setRecent] = useState<PasswordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([getDashboardStatsApi(), getRecentVisitListApi({ page: 1, pageSize: 5 })])
      .then(([nextStats, recentResult]) => {
        if (!active) return
        setStats(nextStats)
        setRecent(recentResult.list)
      })
      .catch(() => { if (active) setError(translate('dashboard.loadFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const statItems = [
    { label: translate('dashboard.totalPasswords'), value: stats.totalPasswords, icon: <KeyRound size={17} />, tone: 'accent' },
    { label: translate('dashboard.favorites'), value: stats.favoriteCount, icon: <Star size={17} />, tone: 'warning' },
    { label: translate('dashboard.recent'), value: stats.recentCount, icon: <Clock3 size={17} />, tone: 'success' }
  ]

  return <main className="react-page react-dashboard" aria-busy={loading}>
    <header className="react-page__header"><div><p className="react-eyebrow">{translate('nav.dashboard')}</p><h1>{translate('dashboard.welcome')}</h1><p className="react-page__description">{translate('dashboard.tagline')}</p></div><Button icon={<LockKeyhole size={15} />} onClick={() => autoLock.lock({ hideWindow: false })}>{translate('dashboard.actionLockApp')}</Button></header>
    {error && <p className="react-form__error" role="alert">{error}</p>}
    <section className="react-dashboard__stats" aria-label={translate('dashboard.summary')}>
      {statItems.map((item, index) => <button type="button" key={item.label} onClick={() => navigate(['/vault', '/favorites', '/recent'][index])} className={`react-dashboard__stat react-dashboard__stat--${item.tone}`}><div className="react-dashboard__stat-head"><span>{item.label}</span><span aria-hidden="true">{item.icon}</span></div><strong>{loading ? '—' : item.value}</strong></button>)}
    </section>
    <section className="react-dashboard__lower">
      <div className="react-dashboard__section"><header><div><h2>{translate('dashboard.recent')}</h2><p>{translate('dashboard.recentDescription')}</p></div><Button tone="quiet" onClick={() => navigate('/recent')}>{translate('nav.recent')}</Button></header>
        {loading ? <p className="react-dashboard__empty" role="status">{translate('common.loading')}</p> : recent.length ? <ul className="react-dashboard__recent">{recent.map((entry) => <li key={entry.id}><button type="button" onClick={() => navigate(`/vault?entry=${encodeURIComponent(entry.id)}`)}><span className="react-dashboard__entry-icon"><KeyRound size={15} /></span><span className="react-dashboard__entry-copy"><strong title={entry.passwordTitle || translate('dashboard.untitledEntry')}>{entry.passwordTitle || translate('dashboard.untitledEntry')}</strong><small>{translate(`vault.type.${entry.passwordType === '身份信息' ? 'identity' : entry.passwordType === '两步验证（2FA）' ? 'authenticator' : entry.passwordType === '安全备注' ? 'secureNote' : entry.passwordType === '银行卡' ? 'bankCard' : entry.passwordType === '服务器' ? 'server' : entry.passwordType === '数据库' ? 'database' : entry.passwordType === '自定义' ? 'custom' : 'login'}`)}</small></span><time>{formatRecentTime(entry.recentVisitTime)}</time></button></li>)}</ul> : <p className="react-dashboard__empty">{translate('dashboard.recentEmpty')}</p>}
      </div>
      <div className="react-dashboard__aside-stack">
        <section className="react-dashboard__section react-dashboard__security"><header><div><h2>{translate('dashboard.tipSecurityTitle')}</h2><p>{translate('dashboard.tipSecurityBody')}</p></div><ShieldCheck size={18} /></header><div className="react-dashboard__security-status"><span className="react-status-dot" /><strong>{translate('dashboard.vaultProtected')}</strong></div><p>{translate('settings.autoLockDesc')}</p><Button tone="quiet" onClick={() => navigate('/security')}>{translate('securityCenter.title')}</Button></section>
        <section className="react-dashboard__section react-dashboard__quick-section"><header><h2>{translate('dashboard.tipQuickTitle')}</h2></header><div className="react-dashboard__quick-actions"><Button tone="primary" icon={<Plus size={15} />} onClick={() => navigate('/vault?new=1')}>{translate('dashboard.actionAddPassword')}</Button><Button icon={<FileUp size={15} />} onClick={() => navigate('/vault?import=1')}>{translate('dashboard.actionImportPassword')}</Button></div></section>
      </div>
    </section>
  </main>
}

function formatRecentTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(document.documentElement.lang || 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
