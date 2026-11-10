import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { Children, createContext, isValidElement, useContext, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { Button as EasyButton, type ButtonProps as EasyButtonProps } from '../components/ui/Button'
import { LockInput } from '../components/ui/LockInput'
import { SpringSelect } from '../components/ui/SpringSelect'
import { cn } from '../components/ui/utils'

type ButtonProps = Omit<EasyButtonProps, 'variant' | 'leftIcon' | 'children'> & { tone?: 'primary' | 'neutral' | 'quiet' | 'danger'; icon?: ReactNode; children?: ReactNode }

export function Button({ tone = 'neutral', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  const variant = tone === 'danger' ? 'destructive' : tone === 'quiet' ? 'ghost' : tone === 'neutral' ? 'secondary' : 'primary'
  return <EasyButton variant={variant} size={size} leftIcon={icon} className={cn('bp-button', className)} {...props}>{children}</EasyButton>
}

export function TextField({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = props.id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return <div className="bp-field"><LockInput id={id} label={label} description={description} className="bp-input" {...props} /></div>
}

type SelectOptionProps = { value?: string; disabled?: boolean; children?: ReactNode }
export function SelectField({ label, labelHidden = false, children, id, value, disabled, onValueChange }: { label: string; labelHidden?: boolean; id: string; value: string; disabled?: boolean; onValueChange: (value: string) => void; children: ReactNode }) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<SelectOptionProps>(child) || child.type !== 'option') return []
    return [child]
  })
  return <SpringSelect id={id} label={label} labelHidden={labelHidden} value={value} disabled={disabled} onChange={onValueChange} options={options.map((option) => ({ value: String(option.props.value ?? option.props.children ?? ''), label: String(option.props.children ?? ''), disabled: option.props.disabled }))} />
}

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="bp-dialog-overlay" /><DialogPrimitive.Content className="bp-dialog"><div className="bp-dialog__heading"><div><DialogPrimitive.Title className="bp-dialog__title">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="bp-dialog__description">{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close className="bp-icon-button" aria-label="关闭"><X size={17} /></DialogPrimitive.Close></div>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>
}

export const MenuRoot = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuItem = DropdownMenu.Item
export function MenuContent({ children }: { children: ReactNode }) { return <DropdownMenu.Portal><DropdownMenu.Content className="bp-menu" sideOffset={5}>{children}</DropdownMenu.Content></DropdownMenu.Portal> }

const ToastContext = createContext<((text: string) => void) | null>(null)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Array<{ id: number; text: string }>>([])
  const pushToast = (text: string): void => setMessages((current) => [...current, { id: Date.now() + Math.random(), text }])
  return <ToastContext.Provider value={pushToast}><ToastPrimitive.Provider swipeDirection="right">{children}{messages.map(({ id, text }) => <ToastPrimitive.Root key={id} className="bp-toast" duration={2600} onOpenChange={(open: boolean) => { if (!open) setMessages((current) => current.filter((message) => message.id !== id)) }}><ToastPrimitive.Title>{text}</ToastPrimitive.Title><ToastPrimitive.Close className="bp-toast__close" aria-label="关闭提示"><X size={15} /></ToastPrimitive.Close></ToastPrimitive.Root>)}<ToastPrimitive.Viewport className="bp-toast-viewport" /></ToastPrimitive.Provider></ToastContext.Provider>
}
export function useToast(): (text: string) => void { const value = useContext(ToastContext); if (!value) throw new Error('useToast must be used inside ToastProvider'); return value }
export function SelectMarker({ selected }: { selected: boolean }) { return selected ? <Check size={15} aria-hidden="true" /> : null }
