import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ui/ErrorBoundary'
import PopupReactApp from './ReactApp'
import '../../../shared/ui/tokens.css'
import '../../../shared/ui/primitives.css'

const root = document.getElementById('app')
if (!root) throw new Error('扩展弹窗根节点不存在')

createRoot(root).render(<StrictMode><ErrorBoundary><PopupReactApp /></ErrorBoundary></StrictMode>)
