import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  CheckSquare, 
  Calendar, 
  Timer, 
  Award, 
  Sparkles, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';

interface HelpMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpMenuModal: React.FC<HelpMenuModalProps> = ({ isOpen, onClose }) => {
  const { loadSampleData, clearSampleData, clearAllData, setActiveTab } = useStudyFlowStore();
  const [activeTab, setActiveTabLocal] = useState<'tour' | 'sandbox' | 'shortcuts'>('tour');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSandboxSuccess, setIsSandboxSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const slides = [
    {
      title: 'Assignments & Deadlines',
      tagline: 'Every deadline in one list',
      icon: CheckSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Add an assignment with a due date. Break it into subtasks if it is big, and progress is worked out from what you tick off.',
      bulletPoints: [
        'Subtasks that update progress',
        'Days left on every deadline (Due tomorrow, Due in 3d)',
        'Filter by course, priority, or completion status'
      ],
      action: () => {
        setActiveTab('assignments');
        onClose();
      },
      actionLabel: 'Go to Assignments'
    },
    {
      title: 'Timetable',
      tagline: 'Your week of classes and study blocks',
      icon: Calendar,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Add your lectures, labs and study blocks once. Export them to Google, Apple or Outlook calendar as repeating weekly events.',
      bulletPoints: [
        'Week view you can page through',
        'One-click .ics export for Google, Apple and Outlook calendars',
        'Lectures, labs, study blocks and exams in different colours'
      ],
      action: () => {
        setActiveTab('calendar');
        onClose();
      },
      actionLabel: 'Open timetable'
    },
    {
      title: 'Focus timer',
      tagline: 'Timed work blocks with optional background sound',
      icon: Timer,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      description: 'Work for 25 minutes, then rest. Pick rain, brown noise, white noise or binaural tones to play while you work. The sounds are generated in your browser, so nothing is downloaded.',
      bulletPoints: [
        'Sounds are made in your browser, no audio files',
        'Keeps the screen on while the timer runs, where your browser allows it',
        'Shows on your lock screen and media controls where your device supports it'
      ],
      action: () => {
        setActiveTab('timer');
        onClose();
      },
      actionLabel: 'Launch Timer'
    },
    {
      title: 'Grades',
      tagline: 'A projected GPA and a what-if calculator',
      icon: Award,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      description: 'Enter your scores as you get them. Slide a hypothetical final exam score to see how it would change your course grade. Results are projections on a 4.0 scale, so check your university\'s own scale.',
      bulletPoints: [
        'GPA weighted by credits',
        'What-if slider for an upcoming assessment',
        'Honors ranges shown as projections, not official standing'
      ],
      action: () => {
        setActiveTab('grades');
        onClose();
      },
      actionLabel: 'Open grades'
    }
  ];

  const handleLoadDemo = () => {
    loadSampleData();
    setIsSandboxSuccess('Sample data added.');
    setTimeout(() => setIsSandboxSuccess(null), 3000);
  };

  const handleClearAll = () => {
    if (window.confirm('Delete ALL your assignments, timetable and grades? This cannot be undone. Make a backup first if you might want them back.')) {
      clearAllData();
      setIsSandboxSuccess('All data deleted.');
      setTimeout(() => setIsSandboxSuccess(null), 3000);
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div 
        className="w-full max-w-xl bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 id="help-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Help
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                A quick tour of what is here
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close help"
            className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Navigation */}
        <div className="px-4 pt-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center gap-1">
          <button
            onClick={() => setActiveTabLocal('tour')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition min-h-[44px] cursor-pointer ${
              activeTab === 'tour'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Tour
          </button>
          <button
            onClick={() => setActiveTabLocal('sandbox')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition min-h-[44px] cursor-pointer ${
              activeTab === 'sandbox'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Sample data
          </button>
          <button
            onClick={() => setActiveTabLocal('shortcuts')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition min-h-[44px] cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Shortcuts
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'tour' && (
            <div className="space-y-5">
              {/* Slide Card */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-850/50 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${slide.bgColor} ${slide.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="tabular-nums text-[10px] uppercase font-semibold text-zinc-400">
                        {currentSlide + 1} of {slides.length}
                      </span>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {slide.title}
                      </h3>
                    </div>
                  </div>

                  <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {currentSlide + 1} / {slides.length}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {slide.description}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-750">
                  {slide.bulletPoints.map((pt, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={slide.action}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]"
                  >
                    <span>{slide.actionLabel}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1))}
                      aria-label="Previous Module"
                      className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0))}
                      aria-label="Next Module"
                      className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Slide Dots Indicator */}
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentSlide === idx 
                        ? 'w-6 bg-zinc-900 dark:bg-zinc-100' 
                        : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-zinc-50/60 dark:bg-zinc-850/30">
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Try it with sample data
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Load a few example assignments, classes and a course. They are labelled Sample and are left out of your GPA, backups and calendar export.
                </p>

                <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
                  <button
                    onClick={handleLoadDemo}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Add sample data</span>
                  </button>

                  <button
                    onClick={() => {
                      clearSampleData();
                      setIsSandboxSuccess('Sample data removed.');
                      setTimeout(() => setIsSandboxSuccess(null), 3000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition cursor-pointer"
                  >
                    <span>Remove sample data</span>
                  </button>

                  <button
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete all my data</span>
                  </button>
                </div>

                {isSandboxSuccess && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {isSandboxSuccess}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Where your data lives
                </span>
                <p>
                  You start as a guest with no sign-up. Your data is saved to a guest account on Google Firebase so it survives a refresh, and it is also kept on this device so the app works offline. Link a Google account to reach it from other devices. You can export everything from Backup.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-2">
              {[
                { key: '⌘ K / Ctrl K', desc: 'Search and jump anywhere' },
                { key: 'Esc', desc: 'Close a dialog or the search' },
                { key: '↑ ↓ Enter', desc: 'Move through and pick search results' }
              ].map((sc, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-200/60 dark:border-zinc-800 text-xs"
                >
                  <span className="text-zinc-600 dark:text-zinc-300">{sc.desc}</span>
                  <kbd className="tabular-nums text-[11px] px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
          <span className="text-[11px] tabular-nums text-zinc-400">
            StudyFlow · Study planner
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
