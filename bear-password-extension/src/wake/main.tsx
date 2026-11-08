import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '../popup/ui/ErrorBoundary'
import ReactWakeApp from './ReactWakeApp'
import '../../../shared/ui/tokens.css'
import '../../../shared/ui/primitives.css'
import './wake.css'

document.documentElement.dataset.appearance = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.dataset.themeDesign = 'liquid'
document.documentElement.dataset.accent = 'blue'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  document.documentElement.dataset.appearance = event.matches ? 'dark' : 'light'
})
document.title = 'PPWD'

const root = document.getElementById('app')
if (!root) throw new Error('扩展唤起页面根节点不存在')

createRoot(root).render(<StrictMode><ErrorBoundary><ReactWakeApp /></ErrorBoundary></StrictMode>)
