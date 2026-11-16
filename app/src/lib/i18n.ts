import { useCallback, useSyncExternalStore } from 'react';

/**
 * English and Kiswahili for the first screen and the navigation. The choice is a device setting (not account data), so it survives
 * signing out. With nothing chosen, a phone set to Kiswahili starts in Kiswahili. Anything not listed here stays in English.
 */
export type Lang = 'en' | 'sw';

export const STRINGS = {
  'lang.label': { en: 'Language', sw: 'Lugha' },
  'lang.english': { en: 'English', sw: 'English' },
  'lang.swahili': { en: 'Kiswahili', sw: 'Kiswahili' },

  'nav.today': { en: 'Today', sw: 'Leo' },
  'nav.assignments': { en: 'Assignments', sw: 'Kazi' },
  'nav.timetable': { en: 'Timetable', sw: 'Ratiba' },
  'nav.timer': { en: 'Focus Timer', sw: 'Kipima muda' },
  'nav.timerShort': { en: 'Timer', sw: 'Muda' },
  'nav.courses': { en: 'Courses', sw: 'Masomo' },
  'nav.notes': { en: 'Notes', sw: 'Maelezo' },

  'first.promise': { en: 'Never miss a deadline.', sw: 'Usikose tarehe ya mwisho.' },
  'first.intro': {
    en: 'Add what is due and StudyFlow shows how many days are left. Then plan your week and start a focus timer.',
    sw: 'Weka kinachotakiwa, StudyFlow ikuonyeshe siku zilizobaki. Kisha panga wiki yako na uanze kuzingatia.'
  },
  'first.step1': { en: 'Add a deadline: a title and a date is enough.', sw: 'Weka tarehe ya mwisho: kichwa na tarehe vinatosha.' },
  'first.step2': { en: 'Today shows how many days are left.', sw: 'Leo inaonyesha siku zilizobaki.' },
  'first.step3': { en: 'Start a focus block on it and tick it off.', sw: 'Anza kipindi cha kuzingatia, kisha tia alama ukimaliza.' },
  'first.heading': { en: 'What is your next deadline?', sw: 'Ni lini tarehe yako ijayo?' },
  'first.subtitle': { en: 'A title and a date is enough.', sw: 'Kichwa na tarehe vinatosha.' },
  'first.whatDue': { en: 'What is due?', sw: 'Nini kinatakiwa?' },
  'first.placeholder': { en: 'e.g. Problem Set 2 or Chapter 4 Summary', sw: 'mf. Zoezi la 2 au Muhtasari wa Sura ya 4' },
  'first.tryExample': { en: 'Try an example', sw: 'Jaribu mfano' },
  'first.exampleTitle': { en: 'Chemistry CAT 1', sw: 'CAT 1 ya Kemia' },
  'first.exampleTitle.same': { en: 'Chemistry CAT 1', sw: 'CAT 1 ya Kemia' },
  'first.exampleHint': {
    en: 'This is an example. Change it to your own deadline, then save.',
    sw: 'Huu ni mfano. Ubadilishe uwe tarehe yako ya mwisho, kisha uhifadhi.'
  },
  'first.whenDue': { en: 'When is it due?', sw: 'Inatakiwa lini?' },
  'first.today': { en: 'Today', sw: 'Leo' },
  'first.tomorrow': { en: 'Tomorrow', sw: 'Kesho' },
  'first.friday': { en: 'This Friday', sw: 'Ijumaa hii' },
  'first.nextWeek': { en: 'Next Week', sw: 'Wiki ijayo' },
  'first.moreOptions': { en: 'More options', sw: 'Chaguo zaidi' },
  'first.fewerOptions': { en: 'Fewer options', sw: 'Chaguo chache' },
  'first.save': { en: 'Save deadline', sw: 'Hifadhi tarehe ya mwisho' }
} as const satisfies Record<string, { en: string; sw: string }>;

export type StringKey = keyof typeof STRINGS;

const STORAGE_KEY = 'studyflow-lang';

export function pickLanguage(saved: string | null, deviceLanguage: string | undefined): Lang {
  if (saved === 'en' || saved === 'sw') return saved;
  return deviceLanguage?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

export function translate(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang] || STRINGS[key].en;
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: Lang = pickLanguage(readSaved(), typeof navigator === 'undefined' ? undefined : navigator.language);
const listeners = new Set<() => void>();

function applyToPage(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyToPage(current);

export function setLanguage(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* the choice still holds for this visit */
  }
  applyToPage(lang);
  listeners.forEach((l) => l());
}

export function currentLanguage(): Lang {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The language, and a `t(key)` for the text in it. */
export function useI18n(): { lang: Lang; t: (key: StringKey) => string } {
  const lang = useSyncExternalStore(subscribe, currentLanguage, () => 'en' as Lang);
  const t = useCallback((key: StringKey) => translate(lang, key), [lang]);
  return { lang, t };
}
