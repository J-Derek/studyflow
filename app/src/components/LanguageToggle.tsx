import { SWAHILI_ENABLED, setLanguage, useI18n, type Lang } from '../lib/i18n';

const OPTIONS: { lang: Lang; label: 'lang.english' | 'lang.swahili' }[] = [
  { lang: 'en', label: 'lang.english' },
  { lang: 'sw', label: 'lang.swahili' }
];

/** English | Kiswahili. A device setting, shown where a student first looks (the first screen) and in the menus. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, t } = useI18n();
  if (!SWAHILI_ENABLED) return null;
  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 ${className}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-pressed={lang === o.lang}
          onClick={() => setLanguage(o.lang)}
          className={`min-h-[44px] sm:min-h-[32px] px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            lang === o.lang
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200/60 dark:border-zinc-700/80'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
