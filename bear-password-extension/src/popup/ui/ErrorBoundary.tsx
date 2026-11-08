import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('[extension-react] renderer error', error, info) }
  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return <main className="bp-error-boundary" role="alert"><AlertTriangle size={20} /><p>扩展页面无法显示，请重新打开。</p></main>
  }
}
