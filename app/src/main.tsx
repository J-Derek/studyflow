import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStudyFlowStore } from './store/studyFlowStore'

if (typeof window !== 'undefined') {
  (window as any).__store = useStudyFlowStore;

  // Auto-recover from stale chunk 404s after new deployments
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
