import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { Children, createContext, isValidElement, useContext, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'neutral' | 'quiet' | 'danger'; icon?: ReactNode }

export function Button({ tone = 'neutral', icon, children, className = '', ...props }: ButtonProps) {
  return <button className={`bp-button bp-button--${tone} ${className}`} {...props}>{icon}{children && <span>{children}</span>}</button>
}

export function TextField({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = props.id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return <label className="bp-field" htmlFor={id}><span className="bp-field__label">{label}</span><input className="bp-input" id={id} {...props} />{description && <span className="bp-field__description">{description}</span>}</label>
}

type SelectOptionProps = { value?: string; disabled?: boolean; children?: ReactNode }
const EMPTY_SELECT_VALUE = '__bear_password_empty_select_value__'

export function SelectField({ label, children, id, value, disabled, onValueChange }: { label: string; id: string; value: string; disabled?: boolean; onValueChange: (value: string) => void; children: ReactNode }) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<SelectOptionProps>(child) || child.type !== 'option') return []
    return [child]
  })
  const selectedValue = value === '' ? EMPTY_SELECT_VALUE : value

  return <div className="bp-field">
    <span id={`${id}-label`} className="bp-field__label">{label}</span>
    <SelectPrimitive.Root value={selectedValue} disabled={disabled} onValueChange={(next) => onValueChange(next === EMPTY_SELECT_VALUE ? '' : next)}>
      <SelectPrimitive.Trigger id={id} className="bp-select-trigger" aria-labelledby={`${id}-label`}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild><ChevronDown size={15} aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="bp-select-content" position="popper" sideOffset={4}>
          <SelectPrimitive.Viewport>
            {options.map((option, index) => {
              const optionValue = String(option.props.value ?? option.props.children ?? '')
              const itemValue = optionValue === '' ? EMPTY_SELECT_VALUE : optionValue
              return <SelectPrimitive.Item key={option.key ?? `${itemValue}-${index}`} className="bp-select-item" value={itemValue} disabled={option.props.disabled}>
                <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="bp-select-item__indicator"><Check size={14} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  </div>
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
