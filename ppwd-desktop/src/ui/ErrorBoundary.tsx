import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './primitives'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('[desktop-react] renderer error', error, info) }
  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return <main className="bp-error-boundary" role="alert"><AlertTriangle size={20} aria-hidden="true" /><div><h1>界面暂时无法显示</h1><p>{this.state.error.message}</p></div><Button icon={<RotateCw size={15} />} onClick={() => window.location.reload()}>重新载入</Button></main>
  }
}
