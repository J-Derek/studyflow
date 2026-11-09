/**
 * What the header and sidebar should show about who is signed in.
 *
 * Firebase takes a moment after a reload to say who is signed in. Until it does, `userId` is null and the
 * store says "guest", so a signed-in student saw the guest header (Sign in button, "Guest") flash on every
 * reload. The store keeps a small hint of the last signed-in account (`signedInHint`, saved with the rest of
 * the device's data and wiped with it on sign-out). While auth has not answered yet, and only if the hint
 * belongs to the same account as the data on this device, the header shows that account instead.
 *
 * This is display only: nothing that reads or writes data trusts the hint. `userId` and `isAnonymous` stay
 * exactly what Firebase said, so syncing and every check in the app are unchanged.
 */
export interface SignedInHint {
  uid: string;
  email: string | null;
  photoUrl: string | null;
}

export interface AccountViewInput {
  userId: string | null;
  dataOwnerUid: string | null;
  isAnonymous: boolean;
  userEmail: string | null;
  userPhotoUrl: string | null;
  signedInHint: SignedInHint | null;
}

export interface AccountView {
  /** Show the signed-in header (account menu, no Sign in button). */
  signedIn: boolean;
  email: string | null;
  photoUrl: string | null;
}

export function accountView(s: AccountViewInput): AccountView {
  if (s.userId !== null) {
    return { signedIn: !s.isAnonymous, email: s.userEmail, photoUrl: s.userPhotoUrl };
  }
  const hint = s.signedInHint;
  if (hint && hint.uid && hint.uid === s.dataOwnerUid) {
    return { signedIn: true, email: hint.email, photoUrl: hint.photoUrl };
  }
  return { signedIn: false, email: null, photoUrl: null };
}

/** Keeps only a well-formed hint (the saved copy could be damaged or from an older build). */
export function cleanSignedInHint(value: unknown): SignedInHint | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.uid !== 'string' || v.uid.length === 0 || v.uid.length > 128) return null;
  const str = (x: unknown, max: number) => (typeof x === 'string' && x.length <= max ? x : null);
  const photo = str(v.photoUrl, 2000);
  return {
    uid: v.uid,
    email: str(v.email, 320),
    photoUrl: photo && /^https:\/\//i.test(photo) ? photo : null
  };
}
