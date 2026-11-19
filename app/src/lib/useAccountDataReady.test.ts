import { describe, expect, it } from 'vitest';
import { accountDataReady } from './useAccountDataReady';

describe('accountDataReady', () => {
  it('is ready at once for a guest', () => {
    expect(accountDataReady(false, false, false)).toBe(true);
  });
  it('waits while a signed-in account has not loaded', () => {
    expect(accountDataReady(true, false, false)).toBe(false);
  });
  it('is ready once the account has loaded, or after the wait is capped', () => {
    expect(accountDataReady(true, true, false)).toBe(true);
    expect(accountDataReady(true, false, true)).toBe(true);
  });
});
