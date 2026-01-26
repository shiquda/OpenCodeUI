import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DirectoryProvider, SessionProvider } from './contexts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectoryProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </DirectoryProvider>
  </StrictMode>,
)
