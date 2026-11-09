import { describe, expect, it } from 'vitest';
import { cleanAgeRecord, decideAge } from './ageGate';

const now = new Date('2030-05-06T07:08:09.000Z');

describe('decideAge', () => {
  it('lets adults through with no tick', () => {
    expect(decideAge('18+', false, now)).toEqual({ ok: true, record: { band: '18+', guardian: false, at: '2030-05-06T07:08:09.000Z' } });
  });
  it('needs the parent or guardian tick for 13 to 17', () => {
    expect(decideAge('13-17', false, now)).toEqual({ ok: false, record: null });
    expect(decideAge('13-17', true, now).record).toEqual({ band: '13-17', guardian: true, at: '2030-05-06T07:08:09.000Z' });
  });
  it('never allows an account under 13, ticked or not, and nothing without an answer', () => {
    expect(decideAge('under13', true, now)).toEqual({ ok: false, record: null });
    expect(decideAge('under13', false, now)).toEqual({ ok: false, record: null });
    expect(decideAge(null, true, now)).toEqual({ ok: false, record: null });
  });
});

describe('cleanAgeRecord', () => {
  const good = { band: '18+', guardian: false, at: '2030-05-06T07:08:09.000Z' };
  it('keeps a good record', () => expect(cleanAgeRecord(good)).toEqual(good));
  it('drops a damaged one', () => {
    for (const bad of [null, 'x', 5, {}, { ...good, band: 'under13' }, { ...good, band: '12' }, { ...good, guardian: 'yes' }, { ...good, at: 'now' }, { ...good, at: 'x'.repeat(41) }]) {
      expect(cleanAgeRecord(bad), JSON.stringify(bad)).toBeNull();
    }
  });
  it('refuses a 13 to 17 record that lacks the tick', () => {
    expect(cleanAgeRecord({ band: '13-17', guardian: false, at: good.at })).toBeNull();
    expect(cleanAgeRecord({ band: '13-17', guardian: true, at: good.at })).not.toBeNull();
  });
});
