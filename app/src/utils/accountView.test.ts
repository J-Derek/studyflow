import { describe, expect, it } from 'vitest';
import { accountView, cleanSignedInHint } from './accountView';

const base = { userId: null, dataOwnerUid: null, isAnonymous: true, userEmail: null, userPhotoUrl: null, signedInHint: null };
const hint = { uid: 'u1', email: 'a@example.com', photoUrl: 'https://img/a.png' };

describe('accountView', () => {
  it('uses what Firebase said once it has answered', () => {
    expect(accountView({ ...base, userId: 'u1', isAnonymous: false, userEmail: 'a@example.com', userPhotoUrl: 'p', signedInHint: hint }))
      .toEqual({ signedIn: true, email: 'a@example.com', photoUrl: 'p' });
    // A guest after auth answered: the hint never overrides a real answer
    expect(accountView({ ...base, userId: 'g1', isAnonymous: true, dataOwnerUid: 'u1', signedInHint: hint }).signedIn).toBe(false);
  });

  it('shows the last signed-in account while auth has not answered, if the data on the device is theirs', () => {
    expect(accountView({ ...base, dataOwnerUid: 'u1', signedInHint: hint })).toEqual({ signedIn: true, email: 'a@example.com', photoUrl: 'https://img/a.png' });
  });

  it('ignores a hint for a different account or with no owner', () => {
    expect(accountView({ ...base, dataOwnerUid: 'u2', signedInHint: hint }).signedIn).toBe(false);
    expect(accountView({ ...base, dataOwnerUid: null, signedInHint: hint }).signedIn).toBe(false);
    expect(accountView(base).signedIn).toBe(false);
  });
});

describe('cleanSignedInHint', () => {
  it('keeps a good hint and drops a damaged one', () => {
    expect(cleanSignedInHint(hint)).toEqual(hint);
    expect(cleanSignedInHint(null)).toBeNull();
    expect(cleanSignedInHint('x')).toBeNull();
    expect(cleanSignedInHint({ uid: '' })).toBeNull();
    expect(cleanSignedInHint({ uid: 7 })).toBeNull();
    expect(cleanSignedInHint({ uid: 'u', email: 5, photoUrl: 'javascript:alert(1)' })).toEqual({ uid: 'u', email: null, photoUrl: null });
  });
});
