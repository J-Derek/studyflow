import { useDialog } from '../lib/useDialog';
import React, { useState, useEffect } from 'react';
import { X, User, Building2, BookOpen, Calendar, Check, Camera, Sun, Moon, Monitor, HelpCircle } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { Avatar } from './Avatar';
import { resizeImageToDataUrl } from '../utils/imageResize';
import { LIMITS } from '../utils/limits';
import { PERIOD_LABELS, periodWord, periodWordCapital } from '../utils/periods';
import type { PeriodLabel } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onOpenHelp }) => {
  const { user, updateUser, isAnonymous, userPhotoUrl, customPhotoUrl, setCustomPhoto, theme, themeMode, setTheme, setThemeMode } = useStudyFlowStore();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [name, setName] = useState(user.name);
  const [university, setUniversity] = useState(user.university);
  const [program, setProgram] = useState(user.program);
  const [semester, setSemester] = useState(user.semester);
  const [periodLabel, setPeriodLabel] = useState<PeriodLabel>(user.periodLabel ?? 'semester');
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [semesterStart, setSemesterStart] = useState(user.semesterStart ?? '');
  const [semesterEnd, setSemesterEnd] = useState(user.semesterEnd ?? '');
  const [timeZone, setTimeZone] = useState(user.timeZone ?? deviceZone);
  const zones = (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [deviceZone]).concat(
    typeof Intl.supportedValuesOf === 'function' && Intl.supportedValuesOf('timeZone').includes(deviceZone) ? [] : [deviceZone]
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setUniversity(user.university);
      setProgram(user.program);
      setSemester(user.semester === 'Current Term' ? 'Current semester' : user.semester);
      setPeriodLabel(user.periodLabel ?? 'semester');
      setSemesterStart(user.semesterStart ?? '');
      setSemesterEnd(user.semesterEnd ?? '');
      setTimeZone(user.timeZone ?? deviceZone);
      setSaved(false);
    }
  }, [isOpen, user]);

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name: name.trim() || 'Student',
      university: university.trim() || 'My university',
      program: program.trim() || 'My programme',
      semester: semester.trim() || `Current ${periodWord(periodLabel)}`,
      periodLabel,
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Profile
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                Your name and where you study.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile picture */}
        <div className="flex items-center gap-4">
          <Avatar name={name || user.name} photoUrl={customPhotoUrl || userPhotoUrl} isGuest={isAnonymous && !customPhotoUrl} className="h-16 w-16" />
          <div className="space-y-1.5 min-w-0">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Profile picture</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-blue-700">
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>{customPhotoUrl ? 'Change picture' : 'Choose a picture'}</span>
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
              {customPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setCustomPhoto(null)}
                  className="min-h-[44px] px-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
                >
                  {userPhotoUrl ? 'Use my Google photo' : 'Remove'}
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Saved on this device only. Signed in with Google? Your Google photo shows on other devices.</p>
            {photoError && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{photoError}</p>}
          </div>
        </div>

        {/* Phones have no sidebar, so theme and help live here */}
        <div className="flex flex-wrap items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            <span>{theme === 'dark' ? 'Use light theme' : 'Use dark theme'}</span>
          </button>
          <button
            type="button"
            onClick={() => setThemeMode('system')}
            aria-pressed={themeMode === 'system'}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer aria-pressed:bg-zinc-100 dark:aria-pressed:bg-zinc-800"
          >
            <Monitor className="h-4 w-4" aria-hidden="true" />
            <span>{themeMode === 'system' ? 'Matching my device' : 'Match my device'}</span>
          </button>
          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              <span>Help</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={LIMITS.profileName}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Wanjiru"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>University</span>
            </label>
            <input
              type="text"
              value={university}
              maxLength={LIMITS.profileUniversity}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. University of Nairobi"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Programme</span>
            </label>
            <input
              type="text"
              value={program}
              maxLength={LIMITS.profileProgram}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. BSc Computer Science"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Current {periodWord(periodLabel)}</span>
            </label>
            <input
              type="text"
              value={semester}
              maxLength={LIMITS.profileSemester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder={`e.g. ${periodWordCapital(periodLabel)} 1, 2026`}
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-400">
              Your school calls it a
              <select value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value as PeriodLabel)} className="mt-1 w-full px-3 py-1.5 text-xs capitalize rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {PERIOD_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="space-y-2 pt-1">
            <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Calendar export</legend>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Your timetable repeats weekly between these dates when you export it to a calendar app.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                {periodWordCapital(periodLabel)} starts
                <input type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                {periodWordCapital(periodLabel)} ends
                <input type="date" value={semesterEnd} min={semesterStart || undefined} onChange={(e) => setSemesterEnd(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
            </div>
            <label className="block text-xs text-zinc-600 dark:text-zinc-400">
              Time zone
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {Array.from(new Set(zones)).map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </label>
          </fieldset>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs active:scale-95"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
