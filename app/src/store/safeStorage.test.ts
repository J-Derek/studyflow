import { describe, expect, it, vi } from 'vitest';
import { createSafeStorage, isQuotaError } from './safeStorage';

const quotaError = () => Object.assign(new Error('full'), { name: 'QuotaExceededError', code: 22 });

function fakeStorage(opts: { full?: boolean } = {}) {
  const data = new Map<string, string>();
  const setItem = vi.fn((k: string, v: string) => {
    if (opts.full) throw quotaError();
    data.set(k, v);
  });
  return { data, setItem, storage: { getItem: (k: string) => data.get(k) ?? null, setItem, removeItem: (k: string) => data.delete(k) } as unknown as Storage };
}

describe('createSafeStorage', () => {
  it('writes and reads like localStorage', () => {
    const f = fakeStorage();
    const s = createSafeStorage(() => f.storage, vi.fn());
    s.setItem('k', 'v1');
    expect(s.getItem('k')).toBe('v1');
  });

  it('never throws when the storage is full, and reports it once', () => {
    const f = fakeStorage({ full: true });
    const report = vi.fn();
    const s = createSafeStorage(() => f.storage, report);
    expect(() => s.setItem('k', 'a')).not.toThrow();
    expect(() => s.setItem('k', 'b')).not.toThrow();
    expect(report).toHaveBeenCalledTimes(1);
    expect(isQuotaError(report.mock.calls[0]![0])).toBe(true);
  });

  it('skips a write that would not change anything (the timer clock ticks every second)', () => {
    const f = fakeStorage();
    const s = createSafeStorage(() => f.storage, vi.fn());
    s.setItem('k', 'same');
    s.setItem('k', 'same');
    s.setItem('k', 'same');
    expect(f.setItem).toHaveBeenCalledTimes(1);
    s.setItem('k', 'changed');
    expect(f.setItem).toHaveBeenCalledTimes(2);
  });

  it('works with no storage at all (private mode, tests)', () => {
    const s = createSafeStorage(() => undefined, vi.fn());
    expect(() => s.setItem('k', 'v')).not.toThrow();
    expect(s.getItem('k')).toBeNull();
  });
});
