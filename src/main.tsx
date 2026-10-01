import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AccountProvider } from './sync/AccountProvider'
import './index.css'
import { applyTheme, watchDeviceTheme } from './lib/theme'
import { keepAppUpdated } from './lib/update'
import { listenForInstall } from './lib/install'

applyTheme()
watchDeviceTheme()
keepAppUpdated()
listenForInstall()

// Ask the browser not to clear our data when the device is low on space.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AccountProvider>
        <App />
      </AccountProvider>
    </BrowserRouter>
  </StrictMode>,
)
