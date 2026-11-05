import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { useStudyFlowStore } from './store/studyFlowStore'
import { startTimerScheduler } from './lib/timerScheduler'

if (typeof window !== 'undefined') {
  startTimerScheduler();
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    // Test hooks, compiled in only for emulator builds.
    (window as unknown as Record<string, unknown>).__store = useStudyFlowStore;
    import('./lib/auth').then((m) => {
      (window as unknown as Record<string, unknown>).__auth = m;
    });
  }

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
