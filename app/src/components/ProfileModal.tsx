import { useDialog } from '../lib/useDialog';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  ArrowLeft,
  User, 
  Building2, 
  BookOpen, 
  Calendar, 
  Check, 
  Camera, 
  Sun, 
  Moon, 
  Monitor, 
  HelpCircle,
  ChevronDown,
  GraduationCap
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { Avatar } from './Avatar';
import { resizeImageToDataUrl } from '../utils/imageResize';
import { LIMITS } from '../utils/limits';
import { PERIOD_LABELS, periodWord, periodWordCapital } from '../utils/periods';
import type { PeriodLabel, GradingScale } from '../types';
import { GRADING_SCALES, SCALE_LABEL } from '../utils/gradingScale';
import { SWAHILI_ENABLED, useI18n } from '../lib/i18n';
import { LanguageToggle } from './LanguageToggle';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onOpenHelp }) => {
  const { 
    user, 
    updateUser, 
    isAnonymous, 
    userPhotoUrl, 
    customPhotoUrl, 
    setCustomPhoto, 
    theme, 
    themeMode, 
    setTheme, 
    setThemeMode 
  } = useStudyFlowStore();
  const { t } = useI18n();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [name, setName] = useState(user.name);
  const [university, setUniversity] = useState(user.university);
  const [program, setProgram] = useState(user.program);
  const [semester, setSemester] = useState(user.semester);
  const [periodLabel, setPeriodLabel] = useState<PeriodLabel>(user.periodLabel ?? 'semester');
  const [gradingScale, setGradingScale] = useState<GradingScale>(user.gradingScale ?? 'us4');
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [semesterStart, setSemesterStart] = useState(user.semesterStart ?? '');
  const [semesterEnd, setSemesterEnd] = useState(user.semesterEnd ?? '');
  const [timeZone, setTimeZone] = useState(user.timeZone ?? deviceZone);
  const zones = (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [deviceZone]).concat(
    typeof Intl.supportedValuesOf === 'function' && Intl.supportedValuesOf('timeZone').includes(deviceZone) ? [] : [deviceZone]
  );
  const [saved, setSaved] = useState(false);

  // Fill the form from the saved profile when the dialog OPENS
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    if (justOpened) {
      setName(user.name);
      setUniversity(user.university);
      setProgram(user.program);
      setSemester(user.semester === 'Current Term' ? 'Current semester' : user.semester);
      setPeriodLabel(user.periodLabel ?? 'semester');
      setGradingScale(user.gradingScale ?? 'us4');
      setSemesterStart(user.semesterStart ?? '');
      setSemesterEnd(user.semesterEnd ?? '');
      setTimeZone(user.timeZone ?? deviceZone);
      setSaved(false);
    }
  }, [isOpen, user, deviceZone]);

  const dialogRef = useDialog(isOpen, onClose);

  // Profile completeness score
  const completeness = useMemo(() => {
    let score = 0;
    if (name.trim() && name.trim() !== 'Student') score += 20;
    if (university.trim() && university.trim() !== 'My university') score += 20;
    if (program.trim() && program.trim() !== 'My programme') score += 20;
    if (semesterStart) score += 20;
    if (semesterEnd) score += 20;
    return score;
  }, [name, university, program, semesterStart, semesterEnd]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name: name.trim() || 'Student',
      university: university.trim() || 'My university',
      program: program.trim() || 'My programme',
      semester: semester.trim() || `Current ${periodWord(periodLabel)}`,
      periodLabel,
      gradingScale,
      semesterStart: semesterStart || undefined,
      semesterEnd: semesterEnd && semesterEnd >= semesterStart ? semesterEnd : undefined,
      timeZone
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Sticky Top Navigation Bar: Back Button, Title, Close Button */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-3.5 py-2.5 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
            Student Profile
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Hero Banner */}
        <div className="bg-gradient-to-b from-brand-navy/5 via-brand-navy/3 to-transparent dark:from-brand-gold/10 dark:via-brand-gold/5 dark:to-transparent px-6 pt-7 pb-5 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col items-center text-center">
          <div className="relative">
            <Avatar 
              name={name || user.name} 
              photoUrl={customPhotoUrl || userPhotoUrl} 
              isGuest={isAnonymous && !customPhotoUrl} 
              className="h-20 w-20 ring-4 ring-brand-gold/30 shadow-md text-xl" 
            />
            <label 
              title="Change profile picture"
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-brand-gold hover:bg-brand-gold/90 text-brand-navy flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-90"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError(null);
                  try {
                    setCustomPhoto(await resizeImageToDataUrl(file));
                  } catch (err) {
                    setPhotoError(err instanceof Error ? err.message : 'That picture could not be used.');
                  }
                }}
              />
            </label>
          </div>

          <h2 id="profile-modal-title" className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {name.trim() || 'Student'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1 max-w-xs">
            {university.trim() || 'My university'} · {program.trim() || 'My programme'}
          </p>

          {customPhotoUrl && (
            <button
              type="button"
              onClick={() => setCustomPhoto(null)}
              className="mt-2 text-2xs font-medium text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 cursor-pointer underline transition-colors"
            >
              {userPhotoUrl ? 'Revert to Google photo' : 'Remove photo'}
            </button>
          )}

          {photoError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{photoError}</p>}

          {/* Profile Completeness Meter */}
          {completeness < 100 && (
            <div className="w-full max-w-xs mt-3.5">
              <div className="flex justify-between items-center text-2xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                <span>Profile setup</span>
                <span>{completeness}% complete</span>
              </div>
              <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-gold transition-all duration-300 rounded-full" 
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 flex-1">
          {/* Identity Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-brand-navy dark:text-brand-gold">
              <User className="h-3.5 w-3.5" />
              <span>Identity</span>
            </div>

            <div>
              <label htmlFor="profile-fullname" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Full name
              </label>
              <input
                id="profile-fullname"
                type="text"
                value={name}
                maxLength={LIMITS.profileName}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ken"
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-shadow"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-university" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-zinc-400" />
                  <span>University</span>
                </label>
                <input
                  id="profile-university"
                  type="text"
                  value={university}
                  maxLength={LIMITS.profileUniversity}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. University of Nairobi"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="profile-program" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <GraduationCap className="h-3 w-3 text-zinc-400" />
                  <span>Programme</span>
                </label>
                <input
                  id="profile-program"
                  type="text"
                  value={program}
                  maxLength={LIMITS.profileProgram}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. BSc Computer Science"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Academic Structure Section */}
          <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-brand-navy dark:text-brand-gold">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Academic Period & Grading</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-period-label" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Academic division
                </label>
                <select
                  id="profile-period-label"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value as PeriodLabel)}
                  className="w-full px-3 py-2 text-sm capitalize rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold cursor-pointer"
                >
                  {PERIOD_LABELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="profile-semester" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Current {periodWord(periodLabel)}
                </label>
                <input
                  id="profile-semester"
                  type="text"
                  value={semester}
                  maxLength={LIMITS.profileSemester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder={`e.g. ${periodWordCapital(periodLabel)} 1, 2026`}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-shadow"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-grading-scale" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Grading scale
              </label>
              <select
                id="profile-grading-scale"
                value={gradingScale}
                onChange={(e) => setGradingScale(e.target.value as GradingScale)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold cursor-pointer"
              >
                {GRADING_SCALES.map((s) => (
                  <option key={s} value={s}>{SCALE_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates & Timezone (Collapsible Details) */}
          <details className="group pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <summary className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-brand-navy dark:text-brand-gold cursor-pointer select-none py-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Dates & Timetable Sync</span>
              </div>
              <ChevronDown className="h-4 w-4 text-zinc-400 group-open:rotate-180 transition-transform" />
            </summary>

            <div className="mt-3 space-y-3 pl-0.5">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Setting your {periodWord(periodLabel)} start and end dates enables the semester progress tracker on your dashboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="profile-start-date" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {periodWordCapital(periodLabel)} starts
                  </label>
                  <input 
                    id="profile-start-date"
                    type="date" 
                    value={semesterStart} 
                    onChange={(e) => setSemesterStart(e.target.value)} 
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" 
                  />
                </div>
                <div>
                  <label htmlFor="profile-end-date" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {periodWordCapital(periodLabel)} ends
                  </label>
                  <input 
                    id="profile-end-date"
                    type="date" 
                    value={semesterEnd} 
                    min={semesterStart || undefined} 
                    onChange={(e) => setSemesterEnd(e.target.value)} 
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" 
                  />
                </div>
              </div>

              <div>
                <label htmlFor="profile-timezone" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Timezone
                </label>
                <select 
                  id="profile-timezone"
                  value={timeZone} 
                  onChange={(e) => setTimeZone(e.target.value)} 
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold cursor-pointer"
                >
                  {Array.from(new Set(zones)).map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* Mobile Theme & Help Controls (Hidden on md+) */}
          <div className="flex flex-wrap items-center gap-2 sm:hidden pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              aria-pressed={themeMode === 'system'}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer aria-pressed:border-brand-gold aria-pressed:text-brand-navy dark:aria-pressed:text-brand-gold"
            >
              <Monitor className="h-4 w-4" aria-hidden="true" />
              <span>{themeMode === 'system' ? 'System theme' : 'Match system'}</span>
            </button>
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                <span>Help</span>
              </button>
            )}
          </div>

          {SWAHILI_ENABLED && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t('lang.label')}</span>
              <LanguageToggle />
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400">
              {isAnonymous ? '🔒 Local on this device' : '✓ Cloud synced'}
            </span>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 min-h-[44px] text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-800" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
