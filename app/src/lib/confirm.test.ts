import { beforeEach, describe, expect, it } from 'vitest';
import { answerConfirm, confirmAction, currentConfirm, subscribeConfirm } from './confirm';

beforeEach(() => answerConfirm(false));

describe('confirmAction', () => {
  it('shows the request and resolves true when the student confirms', async () => {
    const seen: (string | null)[] = [];
    const stop = subscribeConfirm((r) => seen.push(r?.title ?? null));
    const answer = confirmAction({ title: 'Sign out?', body: 'b', confirmLabel: 'Sign out' });
    expect(currentConfirm()?.title).toBe('Sign out?');
    answerConfirm(true);
    await expect(answer).resolves.toBe(true);
    expect(currentConfirm()).toBeNull();
    stop();
    expect(seen).toEqual([null, 'Sign out?', null]);
  });

  it('resolves false on cancel', async () => {
    const answer = confirmAction({ title: 'Delete course?', body: 'b', confirmLabel: 'Delete' });
    answerConfirm(false);
    await expect(answer).resolves.toBe(false);
  });

  it('a second request cancels a forgotten first one, so nothing waits forever', async () => {
    const first = confirmAction({ title: 'One', body: 'b', confirmLabel: 'Yes' });
    const second = confirmAction({ title: 'Two', body: 'b', confirmLabel: 'Yes' });
    await expect(first).resolves.toBe(false);
    expect(currentConfirm()?.title).toBe('Two');
    answerConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it('answering with nothing open does nothing', () => {
    expect(() => answerConfirm(true)).not.toThrow();
    expect(currentConfirm()).toBeNull();
  });
});
