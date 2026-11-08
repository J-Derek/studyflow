/**
 * What the little "Saved" badge in the top bar should say. One place decides, so the words, the colour and the
 * tooltip always agree, and so it can be tested without drawing anything.
 */
export type SaveState = 'device' | 'saving' | 'saved' | 'error' | 'offline';

interface SaveInputs {
  isOnline: boolean;
  /** Some collection still has changes on their way to the cloud. */
  isSyncing: boolean;
  /** How many saves the cloud has refused and the student has not dismissed. */
  errorCount: number;
  /** The app has a cloud account for this person yet (it has not at the very first moment of a page load). */
  hasAccount: boolean;
  /** Signed in with Google, as opposed to a guest. */
  isSignedIn: boolean;
}

export function getSaveState({ isOnline, isSyncing, errorCount, hasAccount }: SaveInputs): SaveState {
  if (errorCount > 0) return 'error'; // a refused save matters more than being offline
  if (!isOnline) return 'offline';
  if (!hasAccount) return 'device';
  return isSyncing ? 'saving' : 'saved';
}

export interface SaveCopy {
  /** Short text for the badge. */
  label: string;
  /** The longer sentence for the tooltip and screen readers. */
  detail: string;
}

export function getSaveCopy(state: SaveState, inputs: Pick<SaveInputs, 'isSignedIn' | 'errorCount'>): SaveCopy {
  switch (state) {
    case 'error':
      return {
        label: 'Not saved',
        detail: `${inputs.errorCount === 1 ? 'A change' : `${inputs.errorCount} changes`} could not be saved to your account. It is still on this device. See the message at the bottom of the screen.`
      };
    case 'offline':
      return { label: 'Offline', detail: 'You are offline. Changes are kept on this device and sent when you reconnect.' };
    case 'device':
      return { label: 'On this device', detail: 'Your changes are saved on this device. Your account is still connecting.' };
    case 'saving':
      return { label: 'Saving…', detail: 'Saving your changes to your account.' };
    case 'saved':
      return inputs.isSignedIn
        ? { label: 'Saved', detail: 'All changes are saved to your Google account and available on every device you sign in on.' }
        : { label: 'Saved', detail: 'All changes are saved. Sign in with Google to keep them if you clear this browser or change phone.' };
  }
}
