/**
 * Minimal Document interface subset needed for theme color manipulation.
 * Enables zero-dependency unit testing in pure Node.js environments.
 */
export interface DocumentLike {
  querySelectorAll(selector: string): Array<{ remove(): void; getAttribute?(name: string): string | null; content?: string }>;
  createElement(tag: string): { name: string; content: string; remove?(): void };
  head: {
    appendChild(element: unknown): void;
  };
}

/**
 * Dynamic theme color synchronization for browser address bar & OS status bar.
 * Replaces any existing theme-color meta tags with a single tag reflecting current theme.
 */
export function syncThemeColor(
  dark: boolean,
  doc: DocumentLike | Document | null = typeof document !== 'undefined' ? document : null
): void {
  if (!doc) return;

  // Remove existing tags to avoid stale media-query conflicts
  const existingMetas = Array.from(doc.querySelectorAll('meta[name="theme-color"]'));
  existingMetas.forEach((meta) => meta.remove());

  // Create clean, unambiguous single meta tag
  const meta = doc.createElement('meta') as HTMLMetaElement;
  meta.name = 'theme-color';
  meta.content = dark ? '#090A0C' : '#F8F9FA';
  doc.head.appendChild(meta as unknown as Node);
}
