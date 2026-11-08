import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { createContext, useContext, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'neutral' | 'quiet' | 'danger'; icon?: ReactNode }

export function Button({ tone = 'neutral', icon, children, className = '', ...props }: ButtonProps) {
  return <button className={`bp-button bp-button--${tone} ${className}`} {...props}>{icon}{children && <span>{children}</span>}</button>
}

export function TextField({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = props.id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return <label className="bp-field" htmlFor={id}><span className="bp-field__label">{label}</span><input className="bp-input" id={id} {...props} />{description && <span className="bp-field__description">{description}</span>}</label>
}

export function NativeSelect({ label, children, ...props }: { label: string; id: string; value: string; disabled?: boolean; onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; children: ReactNode }) {
  return <label className="bp-field" htmlFor={props.id}><span className="bp-field__label">{label}</span><span className="bp-select-wrap"><select className="bp-input bp-select" {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
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
