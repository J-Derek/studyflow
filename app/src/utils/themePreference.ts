export const THEME_KEY = 'studyflow_theme';

export type Theme = 'light' | 'dark';
/** "system" follows the device's own light or dark setting and changes with it. */
export type ThemeMode = Theme | 'system';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (private window, site data blocked)
  }
}

/**
 * Light, dark or "match my device" is a choice about this device, not about an account, so it is kept in
 * its own entry. Signing out wipes the student's data from the browser; this entry is deliberately left
 * alone, so the app does not flip back to light every time someone signs out or switches account.
 * Returns null when nothing has been chosen yet.
 */
export function readSavedMode(storage: StorageLike | null = browserStorage()): ThemeMode | null {
  try {
    const v = storage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

export function saveMode(mode: ThemeMode, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(THEME_KEY, mode);
  } catch {
    /* storage unavailable: the choice still applies until the page is closed */
  }
}

/** Whether the device is currently set to dark. False where the browser cannot tell. */
export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The theme to actually show for a mode. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): Theme {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
}
