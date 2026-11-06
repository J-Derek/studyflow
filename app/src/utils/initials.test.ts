import { describe, expect, it } from 'vitest';
import { initialsOf } from '../components/Avatar';

describe('initialsOf', () => {
  it('uses the first letters of up to two words', () => {
    expect(initialsOf('Derrick Macharia')).toBe('DM');
    expect(initialsOf('amina')).toBe('A');
    expect(initialsOf('Mary Jane Wanjiru')).toBe('MJ');
  });
  it('copes with extra spaces and empty names', () => {
    expect(initialsOf('  Brian   Otieno ')).toBe('BO');
    expect(initialsOf('')).toBe('?');
  });
});
