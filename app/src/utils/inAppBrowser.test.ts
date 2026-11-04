import { describe, it, expect } from 'vitest';
import { inAppBrowser } from './inAppBrowser';

describe('inAppBrowser', () => {
  it('detects WhatsApp in-app browser UA', () => {
    const waUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23.10.77';
    expect(inAppBrowser(waUA)).toBe(true);
  });

  it('detects Instagram in-app browser UA', () => {
    const igUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 225.0.0.16.113';
    expect(inAppBrowser(igUA)).toBe(true);
  });

  it('detects Facebook in-app browser UA (FBAN / FBAV)', () => {
    const fbUA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/98.0.4758.101 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/356.0.0.28.112;]';
    expect(inAppBrowser(fbUA)).toBe(true);
  });

  it('detects Android generic WebView with (; wv) token', () => {
    const androidWv = 'Mozilla/5.0 (Linux; U; Android 10; en-us; SM-G973F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.138 Mobile Safari/537.36';
    expect(inAppBrowser(androidWv)).toBe(true);
  });

  it('detects iOS in-app WebView lacking Safari/ token', () => {
    const iosWv = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(inAppBrowser(iosWv)).toBe(true);
  });

  it('returns false for standard mobile Safari on iOS', () => {
    const mobileSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
    expect(inAppBrowser(mobileSafari)).toBe(false);
  });

  it('returns false for standard mobile Chrome on Android', () => {
    const mobileChrome = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.41 Mobile Safari/537.36';
    expect(inAppBrowser(mobileChrome)).toBe(false);
  });

  it('returns false for standard desktop Chrome', () => {
    const desktopChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(inAppBrowser(desktopChrome)).toBe(false);
  });
});
