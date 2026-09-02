import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeKeycloak } from './auth/keycloak'

initializeKeycloak().finally(() => {
    createRoot(document.getElementById('root')!).render(<App />)
})
