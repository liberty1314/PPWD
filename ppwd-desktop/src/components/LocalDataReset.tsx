import { useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { Button, Dialog, DialogClose, DialogContent, TextField } from '../ui/primitives'
import { useDesktopLocale } from '../ui/useDesktopLocale'

export function LocalDataReset() {
  const { translate } = useDesktopLocale()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [location, setLocation] = useState<{ token: string; path: string } | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  async function chooseLocation(): Promise<void> {
    if (!window.localDataResetApi || busy) return
    setBusy(true)
    setError('')
    try {
      const selected = await window.localDataResetApi.chooseBackupLocation()
      if (selected) setLocation(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate('resetLocal.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function reset(): Promise<void> {
    if (!location || confirmation.trim() !== 'PPWD' || !window.localDataResetApi || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await window.localDataResetApi.reset(location.token, confirmation)
      if (!result.ok) {
        setError(translate(result.reason === 'location' ? 'resetLocal.chooseLocationFirst' : result.reason === 'canceled' ? 'resetLocal.canceled' : 'resetLocal.confirmationError'))
        return
      }
      setConfirmation('')
      setLocation(null)
      setError(translate('resetLocal.restarting', { path: result.backupPath }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate('resetLocal.failed'))
    } finally {
      setBusy(false)
    }
  }

  function close(openState: boolean): void {
    setOpen(openState)
    if (!openState) {
      setLocation(null)
      setConfirmation('')
      setError('')
    }
  }

  return <>
    <Button tone='danger' icon={<RotateCcw size={15} />} onClick={() => setOpen(true)}>{translate('resetLocal.open')}</Button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={translate('resetLocal.title')} description={translate('resetLocal.description')}>
        <div className='react-dialog-body react-local-reset'>
          <ul className='react-local-reset__scope'>
            <li>{translate('resetLocal.scopeAppData')}</li>
            <li>{translate('resetLocal.scopeExternalVault')}</li>
          </ul>
          <p className='react-local-reset__backup-hint'>{translate('resetLocal.backupHint')}</p>
          <div className='react-local-reset__location'>
            <p>{location ? location.path : translate('resetLocal.noLocation')}</p>
            <Button icon={<FolderOpen size={15} />} onClick={() => void chooseLocation()} disabled={busy}>{translate('resetLocal.chooseLocation')}</Button>
          </div>
          {location && <TextField label={translate('resetLocal.confirmationLabel')} value={confirmation} autoComplete='off' spellCheck={false} onChange={event => setConfirmation(event.target.value)} disabled={busy} />}
          {error && <p className='react-form__error' role='alert'>{error}</p>}
          <div className='react-dialog-actions'>
            <DialogClose asChild><Button tone='quiet' disabled={busy}>{translate('common.cancel')}</Button></DialogClose>
            <Button tone='danger' onClick={() => void reset()} disabled={busy || !location || confirmation.trim() !== 'PPWD'}>{translate('resetLocal.confirmButton')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
}
