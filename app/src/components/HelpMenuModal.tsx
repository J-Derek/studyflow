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
  const { loadSampleData, clearAllData, setActiveTab } = useStudyFlowStore();
  const [activeTab, setActiveTabLocal] = useState<'tour' | 'sandbox' | 'shortcuts'>('tour');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSandboxSuccess, setIsSandboxSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const slides = [
    {
      title: 'Coursework & Deadlines',
      tagline: 'Track every deliverable with milestone checklists',
      icon: CheckSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Break down complex assignments into subtasks. Watch your progress auto-calculate as you complete milestones, with live countdowns warning you before due dates.',
      bulletPoints: [
        'Hierarchical subtasks with progress math',
        'Urgent countdown alerts (Due tomorrow, Due in 3d)',
        'Filter by course, priority, or completion status'
      ],
      action: () => {
        setActiveTab('assignments');
        onClose();
      },
      actionLabel: 'Go to Assignments'
    },
    {
      title: '7-Day Class Timetable',
      tagline: 'Your weekly lectures & study blocks in one view',
      icon: Calendar,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Map out your lectures, labs, and review sessions for the week. Highlights current class periods in real time and exports directly to your phone calendar.',
      bulletPoints: [
        'Weekly grid with day-by-day navigation',
        '1-click RFC 5545 iCalendar (.ics) export for Google & Apple Calendar',
        'Lecture vs Lab vs Study session classification'
      ],
      action: () => {
        setActiveTab('calendar');
        onClose();
      },
      actionLabel: 'View Schedule'
    },
    {
      title: 'Deep Work Focus Timer',
      tagline: 'Zero-drift Pomodoros with ambient soundscapes',
      icon: Timer,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      description: 'Lock into deliberate study sprints with synthesized rain, waterfall, and binaural soundscapes generated natively with Web Audio. Zero external MP3 downloads.',
      bulletPoints: [
        'Native Web Audio pink & brown noise generation',
        'Screen Wake Lock keeps your display awake during focus',
        'OS Media Session integration with lock-screen playback'
      ],
      action: () => {
        setActiveTab('timer');
        onClose();
      },
      actionLabel: 'Launch Timer'
    },
    {
      title: 'GPA & Exam Score Predictor',
      tagline: 'Real-time 4.0 scale math with "What-If" sliders',
      icon: Award,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      description: 'Know exactly what score you need on your upcoming final exam to secure an A or protect your Dean\'s honors standing. No manual spreadsheet guesswork.',
      bulletPoints: [
        'Credit-weighted 4.0 cumulative GPA calculation',
        'Interactive final exam score simulator slider',
        'Real-time Dean\'s List & Honor Roll standing brackets'
      ],
      action: () => {
        setActiveTab('grades');
        onClose();
      },
      actionLabel: 'Open GPA Simulator'
    }
  ];

  const handleLoadDemo = () => {
    loadSampleData();
    setIsSandboxSuccess('Demo coursework loaded successfully!');
    setTimeout(() => setIsSandboxSuccess(null), 3000);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all coursework, schedule, and grade data for a fresh start?')) {
      clearAllData();
      setIsSandboxSuccess('All data cleared. You have a clean slate.');
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
                StudyFlow Playbook & Guide
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                Everything you need to know in 45 seconds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Playbook"
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
            Visual Tour
          </button>
          <button
            onClick={() => setActiveTabLocal('sandbox')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition min-h-[44px] cursor-pointer ${
              activeTab === 'sandbox'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Demo Sandbox
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
                      <span className="font-mono text-[10px] uppercase font-semibold text-zinc-400">
                        Module {currentSlide + 1} of {slides.length}
                      </span>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {slide.title}
                      </h3>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
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
                  Interactive Demo Sandbox
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Want to explore StudyFlow with realistic university coursework, a weekly lecture schedule, and sample GPA grades before adding your own?
                </p>

                <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
                  <button
                    onClick={handleLoadDemo}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Load Demo Coursework</span>
                  </button>

                  <button
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear All Data</span>
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
                  Data Privacy Guarantee
                </span>
                <p>
                  StudyFlow operates locally on your machine with offline persistence. No tracking cookies, no personal telemetry, and no mandatory accounts. You control your data.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-2">
              {[
                { key: '⌘ K / Ctrl K', desc: 'Open Command Palette & Coursework Search' },
                { key: '⌘ 1', desc: 'Jump to Today & Dashboard' },
                { key: '⌘ 2', desc: 'Jump to Deliverables & Deadlines' },
                { key: '⌘ 3', desc: 'Jump to Class Schedule' },
                { key: '⌘ 4', desc: 'Jump to Deep Work Focus Timer' },
                { key: '⌘ 5', desc: 'Jump to GPA & Grade Predictor' },
                { key: 'Space', desc: 'Start / Pause Active Focus Timer' }
              ].map((sc, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-200/60 dark:border-zinc-800 text-xs"
                >
                  <span className="text-zinc-600 dark:text-zinc-300">{sc.desc}</span>
                  <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-400">
            StudyFlow · Academic Operating System
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
