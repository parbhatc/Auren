import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import './services/tradesea/practiceChartSymbolDebug'
import { registerCandleDebugGlobals } from './services/debug/candleDebugCapture'
import { registerConsoleCaptureGlobals } from './services/debug/consoleLogCapture'
import { installBwcTouchScrollLockIntercept } from './utils/bwcTouchScrollLock'
import { registerAppServiceWorker } from './pwa/register'

registerCandleDebugGlobals()
registerConsoleCaptureGlobals()
installBwcTouchScrollLockIntercept()
registerAppServiceWorker()

/** Suppress noisy unhandled rejections from browser extensions (not from app code). */
if (import.meta.env.DEV) {
  const EXTENSION_RE =
    /message channel closed before a response was received|Extension context invalidated|Receiving end does not exist/
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : String(reason ?? '')
    if (EXTENSION_RE.test(msg)) {
      event.preventDefault()
      return
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

