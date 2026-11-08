import * as ToastPrimitive from '@radix-ui/react-toast'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'

export function NativeSelect({ label, children, ...props }: { label: string; id: string; value: string; onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void; children: ReactNode }) {
  return <label className="bp-field" htmlFor={props.id}><span className="bp-field__label">{label}</span><span className="bp-select-wrap"><select className="bp-input bp-select" {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
}

const ToastContext = createContext<((text: string) => void) | null>(null)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Array<{ id: number; text: string }>>([])
  const pushToast = (text: string): void => setMessages((current) => [...current, { id: Date.now() + Math.random(), text }])
  return <ToastContext.Provider value={pushToast}><ToastPrimitive.Provider swipeDirection="right">{children}{messages.map(({ id, text }) => <ToastPrimitive.Root key={id} className="bp-toast" duration={2600} onOpenChange={(open: boolean) => { if (!open) setMessages((current) => current.filter((message) => message.id !== id)) }}><ToastPrimitive.Title>{text}</ToastPrimitive.Title><ToastPrimitive.Close className="bp-toast__close" aria-label="关闭提示"><X size={15} /></ToastPrimitive.Close></ToastPrimitive.Root>)}<ToastPrimitive.Viewport className="bp-toast-viewport" /></ToastPrimitive.Provider></ToastContext.Provider>
}
export function useToast(): (text: string) => void { const value = useContext(ToastContext); if (!value) throw new Error('useToast must be used inside ToastProvider'); return value }
