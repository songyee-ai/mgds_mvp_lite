import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, registerServiceWorker } from './app'
import './ui/tokens.css'

const container = document.getElementById('root')
if (container === null) throw new Error('#root 를 찾을 수 없습니다')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 첫 화면을 그린 뒤에 붙습니다. 자세한 것은 app/sw.ts.
registerServiceWorker()
