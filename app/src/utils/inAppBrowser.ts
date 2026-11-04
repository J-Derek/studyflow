/**
 * Detects in-app webviews (WhatsApp, Instagram, Facebook, TikTok, Line, etc.)
 * which fail Google OAuth linkWithPopup with `disallowed_useragent`.
 */
export function inAppBrowser(ua?: string): boolean {
  if (typeof window === 'undefined' && !ua) return false;

  const userAgent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // If running as an installed PWA or standalone display mode, it is NOT an embedded third-party webview
  const isStandalone =
    (typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean })?.standalone === true));
  if (isStandalone) return false;

  // Known app tokens inside webviews
  const namedApps = /FBAN|FBAV|Instagram|TikTok|musical_ly|Snapchat|Line\/|MicroMessenger|WhatsApp/i.test(userAgent);

  // Generic Android WebView token (; wv)
  const androidWebView = /Android/.test(userAgent) && /; wv\)/.test(userAgent);

  // iOS in-app WebView: Contains iPhone/iPad/iPod, but lacks 'Safari/' token
  const iosWebView = /iPhone|iPad|iPod/.test(userAgent) && !/Safari\//.test(userAgent);

  return namedApps || androidWebView || iosWebView;
}
