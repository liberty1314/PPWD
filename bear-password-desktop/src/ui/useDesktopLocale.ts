import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app'
import { useStoreSnapshot } from '@/stores/reactiveStore'
import { t } from '@/locales'
import type { ResolvedLocale } from '@/locales/types'

export function useDesktopLocale(): {
  locale: ResolvedLocale
  translate: (key: string, params?: Record<string, string | number>) => string
} {
  const app = useStoreSnapshot(useAppStore)
  const [locale, setLocale] = useState<ResolvedLocale>(app.resolvedLocale)
  useEffect(() => app.subscribe(() => setLocale(app.resolvedLocale)), [app])
  return { locale, translate: (key, params) => t(key, locale, params) }
}
