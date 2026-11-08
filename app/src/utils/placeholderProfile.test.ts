import { describe, expect, it } from 'vitest';
import { cleanUpProfile, googleProfileOf, isPlaceholderDetail, isPlaceholderName } from './placeholderProfile';

describe('placeholder profile text', () => {
  it('recognises names nobody typed', () => {
    expect(isPlaceholderName('Student')).toBe(true);
    expect(isPlaceholderName(' alex vance ')).toBe(true);
    expect(isPlaceholderName('')).toBe(true);
    expect(isPlaceholderName('Derrick Macharia')).toBe(false);
  });
  it('recognises details nobody typed', () => {
    expect(isPlaceholderDetail('Computer Science & Mathematics')).toBe(true);
    expect(isPlaceholderDetail('My programme')).toBe(true);
    expect(isPlaceholderDetail('BSc Nursing')).toBe(false);
  });
  it('reads the Google name and photo from the provider when the account itself has none (a linked guest)', () => {
    expect(
      googleProfileOf({ displayName: null, photoURL: null, providerData: [{ providerId: 'google.com', displayName: 'Amina W', photoURL: 'https://x/p.jpg' }] })
    ).toEqual({ name: 'Amina W', photo: 'https://x/p.jpg' });
    expect(googleProfileOf({ displayName: 'Own', photoURL: null, providerData: [] })).toEqual({ name: 'Own', photo: null });
    expect(googleProfileOf({ displayName: null, photoURL: null })).toEqual({ name: null, photo: null });
  });
  it('replaces the old sample profile and the guest name, and leaves real details alone', () => {
    expect(cleanUpProfile({ name: 'Alex Vance', university: 'Polytechnic Institute', program: 'Computer Science & Mathematics' }, 'Derrick')).toEqual({
      name: 'Derrick',
      university: 'My university',
      program: 'My programme'
    });
    expect(cleanUpProfile({ name: 'Student', university: 'Strathmore', program: 'BBIT' }, 'Amina')).toEqual({ name: 'Amina', university: 'Strathmore', program: 'BBIT' });
    expect(cleanUpProfile({ name: 'Amina', university: 'Strathmore', program: 'BBIT' }, 'Amina W')).toBeNull();
    expect(cleanUpProfile({ name: 'Student', university: 'Strathmore', program: 'BBIT' }, null)).toBeNull();
  });
});
