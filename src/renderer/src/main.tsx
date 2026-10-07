import './assets/index.css'

import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'

// Avoid React StrictMode double-mount in Electron: it starts/stops js-dos WASM
// twice and commonly triggers "memory access out of bounds" panics.
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
