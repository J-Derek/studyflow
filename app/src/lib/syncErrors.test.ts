import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canRetry, clearSyncErrors, dismissSyncError, explainSyncError, getSyncErrors, reportSyncError, retrySyncError } from './syncErrors';

beforeEach(() => {
  clearSyncErrors();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('failed cloud saves', () => {
  it('explains the common refusals in plain words', () => {
    expect(explainSyncError({ code: 'permission-denied' })).toMatch(/too long|sign in/);
    expect(explainSyncError({ code: 'unavailable' })).toMatch(/connection/);
    expect(explainSyncError(new Error('boom'))).toMatch(/could not save/);
  });

  it('records a failure and lists the newest first', () => {
    reportSyncError('your assignment', { code: 'permission-denied' });
    reportSyncError('your note', { code: 'unavailable' });
    expect(getSyncErrors().map((e) => e.what)).toEqual(['your note', 'your assignment']);
  });

  it('keeps one entry per thing, however many times it fails', () => {
    reportSyncError('your assignment', {});
    reportSyncError('your assignment', {});
    expect(getSyncErrors()).toHaveLength(1);
  });

  it('only offers Try again when the save can simply be repeated', () => {
    reportSyncError('your note', {}, async () => undefined);
    reportSyncError('a class you deleted', {}); // that one was rolled back, nothing to repeat
    const [rolledBack, retryable] = getSyncErrors();
    expect(canRetry(retryable.id)).toBe(true);
    expect(canRetry(rolledBack.id)).toBe(false);
  });

  it('removes the message when the retry works, and keeps it (with the new reason) when it does not', async () => {
    reportSyncError('your note', {}, async () => undefined);
    expect(await retrySyncError(getSyncErrors()[0].id)).toBe(true);
    expect(getSyncErrors()).toHaveLength(0);

    reportSyncError('your note', {}, async () => {
      throw { code: 'permission-denied' };
    });
    expect(await retrySyncError(getSyncErrors()[0].id)).toBe(false);
    expect(getSyncErrors()).toHaveLength(1);
    expect(getSyncErrors()[0].reason).toMatch(/refused/);
  });

  it('a message dismissed while its retry is on the way does not come back when the retry fails', async () => {
    let fail: (e: unknown) => void = () => undefined;
    reportSyncError('your note', {}, () => new Promise((_, reject) => (fail = reject)));
    const id = getSyncErrors()[0].id;
    const pending = retrySyncError(id);
    dismissSyncError(id);
    fail({ code: 'permission-denied' });
    expect(await pending).toBe(false);
    expect(getSyncErrors()).toHaveLength(0);
  });

  it('can be dismissed, and is cleared for the next person on sign-out', () => {
    reportSyncError('your note', {});
    dismissSyncError(getSyncErrors()[0].id);
    expect(getSyncErrors()).toHaveLength(0);
    reportSyncError('your note', {});
    clearSyncErrors();
    expect(getSyncErrors()).toHaveLength(0);
  });

  it('never keeps more than five', () => {
    for (let i = 0; i < 9; i++) reportSyncError(`thing ${i}`, {});
    expect(getSyncErrors()).toHaveLength(5);
  });
});
