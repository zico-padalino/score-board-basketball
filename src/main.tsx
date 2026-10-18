import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { loadBranding } from './lib/branding'
import { startVersionCheck } from './lib/versionCheck'

startVersionCheck()
void loadBranding()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
