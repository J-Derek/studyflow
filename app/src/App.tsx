import { useEffect, useState, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Header } from './components/Header';
import { AssignmentModal } from './components/AssignmentModal';
import { CommandPalette } from './components/CommandPalette';
import { BackupModal } from './components/BackupModal';
import { ProfileModal } from './components/ProfileModal';
import { HelpMenuModal } from './components/HelpMenuModal';
import { AuthNotice } from './components/AuthNotice';
import { SignInProgress } from './components/SignInProgress';
import { AgeGateDialog } from './components/AgeGateDialog';
import { ConfirmHost } from './components/ConfirmHost';
import { CelebrateBurst } from './components/CelebrateBurst';
import { CourseSuggestions } from './components/CourseSuggestions';
import { SyncErrorToast } from './components/SyncErrorToast';
import { TooltipHost } from './components/TooltipHost';
import { OfflineBanner } from './components/OfflineBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './pages/NotFound';
import { LEGAL_TABS } from './store/studyFlowStore';
import { useStudyFlowStore, getTabFromPath } from './store/studyFlowStore';
import { startAuthSessionLazy } from './lib/authActions';
import { assignmentIdFromPath, usePath } from './lib/route';
import { pageTitle } from './lib/pageTitle';

// Code-split pages for performance optimization
import { Dashboard } from './pages/Dashboard';
const AssignmentsPage = lazy(() => import('./pages/Assignments').then((m) => ({ default: m.AssignmentsPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const FocusTimerPage = lazy(() => import('./pages/FocusTimer').then((m) => ({ default: m.FocusTimerPage })));
const CoursesPage = lazy(() => import('./pages/Courses').then((m) => ({ default: m.CoursesPage })));
const NotesPage = lazy(() => import('./pages/Notes').then((m) => ({ default: m.NotesPage })));
// After the first paint, fetch the two pages students open most so the grey "Loading" flash does not show on the first tap.
// Idle time only, and a failure is harmless: the normal lazy import will try again when the page is opened.
const preloadPages = () => {
  void import('./pages/FocusTimer').catch(() => undefined);
  void import('./pages/Assignments').catch(() => undefined);
};

const SharedNotePage = lazy(() => import('./pages/SharedNotePage').then((m) => ({ default: m.SharedNotePage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));

export function App() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(preloadPages, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(preloadPages, 1500);
    return () => window.clearTimeout(t);
  }, []);
  const { activeTab, theme, themeMode, setThemeMode } = useStudyFlowStore();
  // The visible height (with the on-screen keyboard taken off) as --vvh, so dialogs on a phone fit above the keyboard (see index.css).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    set();
    vv.addEventListener('resize', set);
    vv.addEventListener('scroll', set);
    return () => {
      vv.removeEventListener('resize', set);
      vv.removeEventListener('scroll', set);
    };
  }, []);
  // While a text box has focus (the keyboard is up on a phone), bars fixed to the bottom step aside so they never ride on top of it.
  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || (el instanceof HTMLTextAreaElement) || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type)));
    const on = (e: FocusEvent) => {
      if (typing(e.target)) document.documentElement.dataset.typing = 'true';
    };
    const off = () => {
      delete document.documentElement.dataset.typing;
    };
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
    };
  }, []);
  // The browser tab and history say which page this is; an assignment's own page uses its title.
  const path = usePath();
  const openAssignmentId = assignmentIdFromPath(path);
  const openAssignmentTitle = useStudyFlowStore((s) => (openAssignmentId ? s.assignments.find((a) => a.id === openAssignmentId)?.title : undefined));
  useEffect(() => {
    document.title = pageTitle(activeTab, openAssignmentTitle);
  }, [activeTab, openAssignmentTitle]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  // The sidebar can shrink to an icon rail; the choice is remembered on this device.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('studyflow_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () =>
    setSidebarCollapsed((v) => {
      try {
        localStorage.setItem('studyflow_sidebar_collapsed', v ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Guest-first anonymous auth and live Firestore sync, rebound whenever the signed-in user changes
  useEffect(() => startAuthSessionLazy(), []);

  // Synchronize dark mode class, colorScheme, and dynamic theme-color meta
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = isDark ? '#090A0C' : '#F8F9FA';
    document.head.appendChild(meta);
  }, [theme]);

  // In "match my device" mode, follow the device when it switches between light and dark.
  useEffect(() => {
    if (themeMode !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => setThemeMode('system');
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [themeMode, setThemeMode]);

  // Global keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // The old /grades address is now /courses: show the new one in the address bar too.
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, '').toLowerCase() === '/grades') window.history.replaceState({}, '', '/courses');
  }, []);

  // Synchronize HTML5 History popstate for Browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const targetTab = getTabFromPath(window.location.pathname);
      useStudyFlowStore.setState({ activeTab: targetTab });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row font-sans transition-colors duration-150">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:rounded-md focus:bg-zinc-900 focus:text-white dark:focus:bg-zinc-100 dark:focus:text-zinc-900 text-sm font-medium"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      {/* Desktop Navigation Sidebar */}
      <Sidebar
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header Bar (Desktop & Mobile) */}
        <Header
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenBackup={() => setIsBackupOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {/* Shown only while the device has no connection */}
        <OfflineBanner />

        {/* Page Content Viewport with Accessible Suspense Fallback. A page that crashes shows a calm screen here and
            the menus around it keep working; going to another page tries again (the key). */}
        <main id="main" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 focus:outline-none">
          <ErrorBoundary key={activeTab} scope="page">
          <Suspense
            fallback={
              <div
                role="status"
                aria-label="Loading workspace module"
                className="space-y-4 animate-pulse pt-2"
              >
                <div className="h-28 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="h-24 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                  <div className="h-24 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                  <div className="h-24 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                  <div className="h-24 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                </div>
                <div className="h-64 rounded-xl bg-zinc-200/40 dark:bg-zinc-800/40" />
              </div>
            }
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenBackup={() => setIsBackupOpen(true)}
              />
            )}
            {activeTab === 'assignments' && <AssignmentsPage />}
            {activeTab === 'calendar' && <CalendarPage />}
            {activeTab === 'timer' && <FocusTimerPage />}
            {activeTab === 'courses' && <CoursesPage />}
            {activeTab === 'notes' && <NotesPage />}
            {activeTab === 'shared' && <SharedNotePage />}
            {activeTab === 'notfound' && <NotFoundPage />}
            {(LEGAL_TABS as string[]).includes(activeTab) && <LegalPage doc={activeTab as (typeof LEGAL_TABS)[number]} />}
          </Suspense>
          </ErrorBoundary>
        </main>

        {/* Privacy, terms and the other rules pages */}

        {/* Mobile Navigation Bar */}
        <MobileNav />

        {/* Global Add Assignment Modal */}
        <AssignmentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

        {/* Raycast & shadcn-Grade Command Palette (⌘K) */}
        <CommandPalette
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenBackupModal={() => setIsBackupOpen(true)}
        />

        {/* Backup modal */}
        <BackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          onOpenProfile={() => {
            setIsBackupOpen(false);
            setIsProfileOpen(true);
          }}
        />

        {/* Profile modal */}
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onOpenHelp={() => {
            setIsProfileOpen(false);
            setIsHelpOpen(true);
          }}
        />

        {/* StudyFlow Playbook & 45-Second Tour Modal */}
        <HelpMenuModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />

        {/* Messages from sign-in, such as "Google sign-in did not finish" */}
        <AuthNotice />

        {/* "Signing you in…" while a sign-in into an existing account moves records and reloads */}
        <SignInProgress />

        {/* The one-time age question before signing in */}
        <AgeGateDialog />
        <ConfirmHost />

        {/* A happy burst when work is marked done */}
        <CelebrateBurst />

        {/* Course codes already in use, offered in every course field */}
        <CourseSuggestions />

        {/* Tells the student when a change reached the screen but not their account */}
        <SyncErrorToast />
        <TooltipHost />
      </div>
    </div>
  );
}

export default App;
