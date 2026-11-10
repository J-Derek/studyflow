import { describe, expect, it } from 'vitest';
import { mergeById } from './mergeById';

type T = { id: string; v: number };
const r = (id: string, v: number, pendingWrite = false) => ({ item: { id, v }, pendingWrite });

describe('mergeById', () => {
  it('keeps the on-screen version of an item with a pending write from this device (the stale echo case)', () => {
    expect(mergeById<T>([r('a', 1, true)], [{ id: 'a', v: 2 }])).toEqual([{ id: 'a', v: 2 }]);
  });

  it('takes the snapshot version when nothing is pending (a change from another device)', () => {
    expect(mergeById<T>([r('a', 5)], [{ id: 'a', v: 2 }])).toEqual([{ id: 'a', v: 5 }]);
  });

  it('drops items that are no longer in the snapshot and adds new ones', () => {
    expect(mergeById<T>([r('b', 1), r('c', 3)], [{ id: 'a', v: 9 }, { id: 'b', v: 1 }])).toEqual([{ id: 'b', v: 1 }, { id: 'c', v: 3 }]);
  });

  it('uses the snapshot version when the pending item is not on screen yet', () => {
    expect(mergeById<T>([r('z', 7, true)], [])).toEqual([{ id: 'z', v: 7 }]);
  });

  it('two quick ticks: the second tick survives the echo of the first write', () => {
    expect(mergeById([r('a', 1, true)], [{ id: 'a', v: 2 }])[0]!.v).toBe(2);
  });
});
