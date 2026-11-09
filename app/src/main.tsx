import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import App from './App.tsx'
import { useStudyFlowStore } from './store/studyFlowStore'
import { startTimerScheduler } from './lib/timerScheduler'
import { ErrorBoundary } from './components/ErrorBoundary'

if (typeof window !== 'undefined') {
  startTimerScheduler();
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    // Test hooks, compiled in only for emulator builds.
    (window as unknown as Record<string, unknown>).__store = useStudyFlowStore;
    import('./lib/auth').then((m) => {
      (window as unknown as Record<string, unknown>).__auth = m;
    });
  }

  // Auto-recover from stale chunk 404s after new deployments. Only for genuine "file did not load"
  // errors: anything else (a blocked sign-in pop-up, for example) must reach its caller, not reload.
  window.addEventListener('vite:preloadError', (event) => {
    const message = String((event as Event & { payload?: { message?: string } }).payload?.message ?? '');
    if (!/dynamically imported module|importing a module script failed|unable to preload|loading (css )?chunk/i.test(message)) return;
    try {
      const last = Number(sessionStorage.getItem('studyflow_chunk_reload_at') ?? 0);
      if (Date.now() - last < 10_000) return; // already reloaded just now: do not loop
      sessionStorage.setItem('studyflow_chunk_reload_at', String(Date.now()));
    } catch {
      /* storage unavailable: reload once anyway */
    }
    event.preventDefault();
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
