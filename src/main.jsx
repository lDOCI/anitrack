import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/900.css'
import '@fontsource/dela-gothic-one/400.css'
import '@fontsource/onest/400.css'
import '@fontsource/onest/700.css'
import '@fontsource/onest/800.css'
import './index.css'
import './ui/theme.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
