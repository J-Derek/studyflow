/** The StudyFlow mark: white layers on indigo, the same drawing as the browser-tab and install icons. */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="5.5" fill="#312E81" />
      <g transform="translate(4.4 4.4) scale(0.633)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2 2 7l10 5 10-5-10-5z" fill="#fff" />
        <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
      </g>
    </svg>
  );
}
