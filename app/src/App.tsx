import { useEffect, useState, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Header } from './components/Header';
import { AssignmentModal } from './components/AssignmentModal';
import { CommandPalette } from './components/CommandPalette';
import { BackupModal } from './components/BackupModal';
import { ProfileModal } from './components/ProfileModal';
import { HelpMenuModal } from './components/HelpMenuModal';
import { useStudyFlowStore, getTabFromPath } from './store/studyFlowStore';
import { ensureAuthenticatedUser } from './lib/auth';
import { initFirestoreSync } from './services/firestoreSync';

// Code-split pages for performance optimization
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AssignmentsPage = lazy(() => import('./pages/Assignments').then((m) => ({ default: m.AssignmentsPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const FocusTimerPage = lazy(() => import('./pages/FocusTimer').then((m) => ({ default: m.FocusTimerPage })));
const GradesPage = lazy(() => import('./pages/Grades').then((m) => ({ default: m.GradesPage })));

export function App() {
  const { activeTab, setAuthUser, theme } = useStudyFlowStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Initialize guest-first anonymous authentication & live Firestore sync
  useEffect(() => {
    let cleanupSync: (() => void) | null = null;

    ensureAuthenticatedUser()
      .then((firebaseUser) => {
        setAuthUser(
          firebaseUser.uid,
          firebaseUser.isAnonymous,
          firebaseUser.email,
          firebaseUser.displayName
        );

        cleanupSync = initFirestoreSync(firebaseUser.uid);
      })
      .catch((err) => {
        console.error('Firebase guest authentication error:', err);
      });

    return () => {
      if (cleanupSync) cleanupSync();
    };
  }, [setAuthUser]);

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
      {/* Desktop Navigation Sidebar */}
      <Sidebar
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
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
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
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
                onOpenProfile={() => setIsProfileOpen(true)}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenBackup={() => setIsBackupOpen(true)}
                onOpenHelp={() => setIsHelpOpen(true)}
              />
            )}
            {activeTab === 'assignments' && <AssignmentsPage />}
            {activeTab === 'calendar' && <CalendarPage />}
            {activeTab === 'timer' && <FocusTimerPage />}
            {activeTab === 'grades' && <GradesPage />}
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

        {/* Disaster Recovery & Backup Modal */}
        <BackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
        />

        {/* Scholar Profile & Academic Settings Modal */}
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        {/* StudyFlow Playbook & 45-Second Tour Modal */}
        <HelpMenuModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />
      </div>
    </div>
  );
}

export default App;
