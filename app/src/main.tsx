import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStudyFlowStore } from './store/studyFlowStore'

if (typeof window !== 'undefined') {
  (window as any).__store = useStudyFlowStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
