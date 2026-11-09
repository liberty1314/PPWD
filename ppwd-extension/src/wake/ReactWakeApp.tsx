import { useEffect, useState } from 'react'
import { ArrowUpRight, RotateCw } from 'lucide-react'
import { t } from '@/locales'
import { getSystemLocale } from '@/shared/locale/locale'
import { triggerDesktopProtocolUrl } from '@/shared/utils/desktopProtocol'

const locale = getSystemLocale()

export default function ReactWakeApp() {
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => { void triggerDesktopProtocolUrl() }, 300)
    return () => window.clearTimeout(timer)
  }, [])

  const steps = [t('wake.step1', locale), t('wake.step2', locale), t('wake.step3', locale)]

  function retry(): void {
    if (retrying) return
    setRetrying(true)
    void triggerDesktopProtocolUrl()
    window.setTimeout(() => setRetrying(false), 1000)
  }

  return (
    <main className="wake-page">
      <img className="wake-page__logo" src={chrome.runtime.getURL('public/icons/logo.png')} alt="" />
      <h1 className="wake-page__title">{t('wake.title', locale)}</h1>
      <p className="wake-page__lead">{t('wake.lead', locale)}</p>
      <ol className="wake-page__steps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <button className="wake-page__btn" type="button" disabled={retrying} onClick={retry}>
        <RotateCw size={15} className={retrying ? 'is-spinning' : ''} />{t('wake.retry', locale)}<ArrowUpRight size={14} />
      </button>
      <p className="wake-page__note">{t('wake.note', locale)}</p>
    </main>
  )
}
