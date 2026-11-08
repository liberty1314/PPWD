import { useState } from 'react'
import { Check, Fingerprint, LockKeyhole, Settings2, ShieldCheck } from 'lucide-react'
import type { AccentColor, AppearanceMode, ThemeDesign } from '../../shared/ui/themeTypes'
import { Button, Dialog, DialogClose, DialogContent, DialogTrigger, MenuContent, MenuItem, MenuRoot, MenuTrigger, NativeSelect, useToast } from './ui/primitives'
import { useReactThemeStore } from './stores/reactTheme'
import { desktopThemeAdapter } from './platform/desktopThemeAdapter'
import { useDesktopLocale } from './ui/useDesktopLocale'

const accents: Array<{ id: AccentColor; label: string; color: string }> = [
  { id: 'blue', label: '蓝色', color: '#4f77d1' },
  { id: 'teal', label: '青绿', color: '#268c8a' },
  { id: 'green', label: '绿色', color: '#47845a' },
  { id: 'purple', label: '紫色', color: '#7865b1' },
  { id: 'coral', label: '珊瑚', color: '#d16c65' },
  { id: 'amber', label: '琥珀', color: '#b47a2b' }
]

export function ReactAppearancePage() {
  const preferences = useReactThemeStore()
  const toast = useToast()
  const { translate } = useDesktopLocale()
  const [busy, setBusy] = useState(false)

  const change = <K extends 'appearanceMode' | 'themeDesign'>(key: K, value: K extends 'appearanceMode' ? AppearanceMode : ThemeDesign): void => {
    preferences.setPreference(key, value as never)
  }

  async function verifyPreload(): Promise<void> {
    setBusy(true)
    const dark = await desktopThemeAdapter.probeSystemAppearance()
    setBusy(false)
    toast(dark === null || dark === undefined ? translate('settings.systemAppearanceUnavailable') : `${translate('settings.theme')}：${dark ? translate('theme.dark') : translate('theme.light')}`)
  }

  return <main className="react-page">
    <header className="react-page__header"><div><p className="react-eyebrow">{translate('settings.appearance')}</p><h1>{translate('settings.theme')}</h1><p className="react-page__description">{translate('settings.subtitle')}</p></div><MenuRoot><MenuTrigger asChild><Button aria-label={translate('settings.systemAppearanceCheck')} icon={<Settings2 size={16} />} /></MenuTrigger><MenuContent><MenuItem onSelect={() => void verifyPreload()}>{translate('settings.systemAppearanceCheck')}</MenuItem></MenuContent></MenuRoot></header>
    <section className="react-settings" aria-label={translate('settings.appearance')}>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.themeMode')}</h2><p>{translate('theme.systemDesc')}</p></div><div className="react-segmented" role="group" aria-label={translate('settings.themeMode')}>{(['system', 'light', 'dark'] as AppearanceMode[]).map((mode) => <button key={mode} type="button" aria-pressed={preferences.appearanceMode === mode} onClick={() => change('appearanceMode', mode)}>{translate(`theme.${mode}`)}</button>)}</div></div>
      <div className="react-setting-row"><div className="react-setting-row__copy"><h2>{translate('settings.themeDesign')}</h2><p>{translate('settings.themeDesignDesc')}</p></div><NativeSelect label={translate('settings.themeDesign')} id="theme-design" value={preferences.themeDesign} onChange={(event) => change('themeDesign', event.target.value as ThemeDesign)}><option value="classic">{translate('settings.themeDesign.classic')}</option><option value="liquid">{translate('settings.themeDesign.liquid')}</option><option value="soft">{translate('settings.themeDesign.soft')}</option><option value="contrast">{translate('settings.themeDesign.contrast')}</option></NativeSelect></div>
      <div className="react-setting-row react-setting-row--accent"><div className="react-setting-row__copy"><h2>{translate('settings.accentColor')}</h2><p>{translate('settings.accentColorDesc')}</p></div><div className="react-accent-grid" role="group" aria-label={translate('settings.accentColor')}>{accents.map(({ id, label, color }) => <button key={id} type="button" className="react-accent" aria-label={translate(`accent.${id}`)} aria-pressed={preferences.accentColor === id} onClick={() => preferences.setPreference('accentColor', id)}><span className="react-accent__swatch" style={{ backgroundColor: color }}>{preferences.accentColor === id && <Check size={13} aria-hidden="true" />}</span><span>{translate(`accent.${id}`) || label}</span></button>)}</div></div>
    </section>
    <section className="react-preview-row bp-glass" aria-label={translate('settings.preview')}><div className="react-preview-copy"><h2>{translate('settings.preview')}</h2><p>{translate('settings.sensitiveSurfaceHint')}</p></div><div className="react-preview-actions"><div className="bp-sensitive react-sensitive-sample"><LockKeyhole size={15} /><span>••••••••••••</span></div><Button tone="primary" icon={<ShieldCheck size={15} />} disabled={busy}>{translate('settings.primaryAction')}</Button><Dialog><DialogTrigger asChild><Button icon={<Fingerprint size={15} />}>{translate('settings.dialogPreview')}</Button></DialogTrigger><DialogContent title={translate('settings.securityConfirm')} description={translate('settings.securityConfirmDesc')}><div className="react-dialog-actions"><DialogClose asChild><Button tone="quiet">{translate('common.cancel')}</Button></DialogClose><DialogClose asChild><Button tone="primary" onClick={() => toast(translate('msg.settingsSaved'))}>{translate('common.confirm')}</Button></DialogClose></div></DialogContent></Dialog></div></section>
  </main>
}
