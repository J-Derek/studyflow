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
import { SyncErrorToast } from './components/SyncErrorToast';
import { useStudyFlowStore, getTabFromPath } from './store/studyFlowStore';
import { startAuthSessionLazy } from './lib/authActions';

// Code-split pages for performance optimization
import { Dashboard } from './pages/Dashboard';
const AssignmentsPage = lazy(() => import('./pages/Assignments').then((m) => ({ default: m.AssignmentsPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const FocusTimerPage = lazy(() => import('./pages/FocusTimer').then((m) => ({ default: m.FocusTimerPage })));
const GradesPage = lazy(() => import('./pages/Grades').then((m) => ({ default: m.GradesPage })));
const NotesPage = lazy(() => import('./pages/Notes').then((m) => ({ default: m.NotesPage })));

export function App() {
  const { activeTab, theme, themeMode, setThemeMode } = useStudyFlowStore();
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

        {/* Page Content Viewport with Accessible Suspense Fallback */}
        <main id="main" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 focus:outline-none">
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
            {activeTab === 'grades' && <GradesPage />}
            {activeTab === 'notes' && <NotesPage />}
          </Suspense>
        </main>

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

        {/* Tells the student when a change reached the screen but not their account */}
        <SyncErrorToast />
      </div>
    </div>
  );
}

export default App;
