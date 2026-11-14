import { beforeEach, describe, expect, it } from 'vitest';
import {
  endFinishingSignIn,
  getSignInProgress,
  isFinishingSignIn,
  markSigningInAcrossReload,
  resetFinishingSignInForTests,
  subscribeFinishingSignIn,
  setSignInProgress,
  subscribeSignInProgress,
  takeSigningInAcrossReload
} from './signInProgress';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage = new MemoryStorage();
  setSignInProgress(null);
  resetFinishingSignInForTests();
});

describe('finishing a sign-in after the reload (so no screen offers "Sign in" while it completes)', () => {
  it('is false on an ordinary page load', () => {
    expect(isFinishingSignIn()).toBe(false);
  });
  it('is true after the sign-in reload, stays true however often it is asked, and ends when told', () => {
    markSigningInAcrossReload(Date.now());
    const seen: boolean[] = [];
    const stop = subscribeFinishingSignIn(() => seen.push(isFinishingSignIn()));
    expect(isFinishingSignIn()).toBe(true);
    expect(isFinishingSignIn()).toBe(true);
    endFinishingSignIn();
    endFinishingSignIn();
    stop();
    expect(isFinishingSignIn()).toBe(false);
    expect(seen).toEqual([false]);
  });
});

describe('sign-in progress message', () => {
  it('tells listeners when it changes, and only then', () => {
    const seen: (string | null)[] = [];
    const stop = subscribeSignInProgress((m) => seen.push(m));
    setSignInProgress('a');
    setSignInProgress('a');
    setSignInProgress(null);
    stop();
    setSignInProgress('b');
    expect(seen).toEqual(['a', null]);
    expect(getSignInProgress()).toBe('b');
  });
});

describe('the flag that survives the reload', () => {
  it('is read once', () => {
    markSigningInAcrossReload(1000);
    expect(takeSigningInAcrossReload(2000)).toBe(true);
    expect(takeSigningInAcrossReload(2000)).toBe(false);
  });

  it('is ignored when stale, from the future, or damaged', () => {
    markSigningInAcrossReload(0);
    expect(takeSigningInAcrossReload(61_000)).toBe(false);
    markSigningInAcrossReload(5000);
    expect(takeSigningInAcrossReload(1000)).toBe(false);
    sessionStorage.setItem('studyflow_signing_in', 'nonsense');
    expect(takeSigningInAcrossReload(1000)).toBe(false);
  });

  it('does nothing when storage throws', () => {
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };
    expect(() => markSigningInAcrossReload()).not.toThrow();
    expect(takeSigningInAcrossReload()).toBe(false);
  });
});
