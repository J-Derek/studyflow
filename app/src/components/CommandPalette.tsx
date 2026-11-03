import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Timer,
  Award,
  Sun,
  Moon,
  Plus,
  Download,
  Database,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { downloadICalendarFile } from '../lib/icalExport';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
  onOpenBackupModal?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenAddModal,
  onOpenBackupModal
}) => {
  const {
    assignments,
    sessions,
    grades,
    setActiveTab,
    theme,
    toggleTheme,
    setTimerMode,
    startTimer
  } = useStudyFlowStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown handler for ESC and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build command items
  const navigationItems: CommandItem[] = [
    { id: 'nav-dash', label: 'Go to Academic Dashboard', category: 'Navigation', icon: LayoutDashboard, action: () => { setActiveTab('dashboard'); onClose(); } },
    { id: 'nav-asg', label: 'Go to Coursework Registry', category: 'Navigation', icon: CheckSquare, action: () => { setActiveTab('assignments'); onClose(); } },
    { id: 'nav-cal', label: 'Go to Academic Timetable', category: 'Navigation', icon: Calendar, action: () => { setActiveTab('calendar'); onClose(); } },
    { id: 'nav-timer', label: 'Go to Focus Timer Console', category: 'Navigation', icon: Timer, action: () => { setActiveTab('timer'); onClose(); } },
    { id: 'nav-grades', label: 'Go to GPA Predictor & Simulator', category: 'Navigation', icon: Award, action: () => { setActiveTab('grades'); onClose(); } }
  ];

  const actionItems: CommandItem[] = [
    { id: 'act-new', label: 'Create New Deliverable', category: 'Actions', icon: Plus, action: () => { onClose(); onOpenAddModal(); } },
    { id: 'act-focus', label: 'Launch 25m Focus Session', category: 'Actions', icon: Sparkles, action: () => { setActiveTab('timer'); setTimerMode('focus'); startTimer(); onClose(); } },
    { id: 'act-theme', label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`, category: 'Actions', icon: theme === 'light' ? Moon : Sun, action: () => { toggleTheme(); onClose(); } },
    { id: 'act-ics', label: 'Export Timetable to Apple/Google (.ICS)', category: 'Actions', icon: Download, action: () => { downloadICalendarFile(sessions); onClose(); } },
    {
      id: 'act-backup',
      label: 'Export Full Academic Ledger (.JSON Backup)',
      category: 'Actions',
      icon: Database,
      action: () => {
        if (onOpenBackupModal) {
          onClose();
          onOpenBackupModal();
        } else {
          // Direct JSON download
          const backupData = {
            version: 'StudyFlow-v1.2',
            exportedAt: new Date().toISOString(),
            assignments,
            sessions,
            grades
          };
          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `studyflow-ledger-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          onClose();
        }
      }
    }
  ];

  const assignmentItems: CommandItem[] = assignments.map((a) => ({
    id: `asg-${a.id}`,
    label: `${a.title} (${a.course.split('—')[0].trim()})`,
    category: 'Coursework',
    icon: CheckSquare,
    badge: a.priority.toUpperCase(),
    action: () => {
      setActiveTab('assignments');
      onClose();
    }
  }));

  const allItems: CommandItem[] = [...navigationItems, ...actionItems, ...assignmentItems];

  const filteredItems = allItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) current.action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bay */}
        <div className="flex items-center px-3.5 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 gap-3">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search coursework..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Command Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-mono">
              No matching commands or coursework found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300">
                        {item.badge}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight className="h-3 w-3 text-zinc-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-3.5 py-2 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-850/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Navigate with <kbd className="px-1 py-0.2 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500">↑</kbd> <kbd className="px-1 py-0.2 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500">↓</kbd></span>
          <span>Select with <kbd className="px-1 py-0.2 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500">↵</kbd></span>
        </div>
      </div>
    </div>
  );
};
