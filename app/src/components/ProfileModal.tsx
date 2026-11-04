import React, { useState, useEffect } from 'react';
import { X, User, Building2, BookOpen, Calendar, Check } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useStudyFlowStore();
  const [name, setName] = useState(user.name);
  const [university, setUniversity] = useState(user.university);
  const [program, setProgram] = useState(user.program);
  const [semester, setSemester] = useState(user.semester);
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
      setSemester(user.semester);
      setSemesterStart(user.semesterStart ?? '');
      setSemesterEnd(user.semesterEnd ?? '');
      setTimeZone(user.timeZone ?? deviceZone);
      setSaved(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name: name.trim() || 'Student',
      university: university.trim() || 'My university',
      program: program.trim() || 'My programme',
      semester: semester.trim() || 'Current Term',
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
        className="w-full max-w-md bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="profile-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 id="profile-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Profile
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                Your name and where you study.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-400" />
              <span>University</span>
            </label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. Stanford University"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
              <span>Programme</span>
            </label>
            <input
              type="text"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. Computer Science & Mathematics"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              <span>Current term</span>
            </label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. Fall 2026"
              required
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <fieldset className="space-y-2 pt-1">
            <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Calendar export</legend>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Your timetable repeats weekly between these dates when you export it to a calendar app.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
                Term starts
                <input type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
                Term ends
                <input type="date" value={semesterEnd} min={semesterStart || undefined} onChange={(e) => setSemesterEnd(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
            </div>
            <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
              Time zone
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
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
