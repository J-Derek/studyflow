import { describe, expect, it } from 'vitest';
import { getSaveCopy, getSaveState } from './saveStatus';

const base = { isOnline: true, isSyncing: false, errorCount: 0, hasAccount: true, isSignedIn: true };

describe('save status', () => {
  it('says Saved when nothing is waiting', () => {
    expect(getSaveState(base)).toBe('saved');
  });
  it('says Saving while any collection has changes on the way', () => {
    expect(getSaveState({ ...base, isSyncing: true })).toBe('saving');
  });
  it('says Offline when there is no connection', () => {
    expect(getSaveState({ ...base, isOnline: false })).toBe('offline');
  });
  it('says the changes are on this device before the account has connected', () => {
    expect(getSaveState({ ...base, hasAccount: false })).toBe('device');
  });
  it('turns to Not saved when the cloud refused a save, even when offline or still saving', () => {
    expect(getSaveState({ ...base, errorCount: 1 })).toBe('error');
    expect(getSaveState({ ...base, errorCount: 2, isOnline: false, isSyncing: true })).toBe('error');
  });
  it('has plain words for every state, and tells a guest how to keep their data', () => {
    expect(getSaveCopy('saving', { isSignedIn: true, errorCount: 0 }).label).toBe('Saving…');
    expect(getSaveCopy('saved', { isSignedIn: false, errorCount: 0 }).detail).toMatch(/Sign in with Google/);
    expect(getSaveCopy('saved', { isSignedIn: true, errorCount: 0 }).detail).toMatch(/every device/);
    expect(getSaveCopy('error', { isSignedIn: true, errorCount: 1 }).detail).toMatch(/still on this device/);
    expect(getSaveCopy('error', { isSignedIn: true, errorCount: 3 }).detail).toMatch(/3 changes/);
  });
});
