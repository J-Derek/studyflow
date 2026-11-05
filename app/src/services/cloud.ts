/**
 * Thin lazy wrappers around the Firestore sync module. The Firebase SDK is large, so it is loaded
 * with a dynamic import after the first paint instead of sitting on the critical path. Every call
 * resolves to the real function; callers keep the same names and behaviour.
 */
type Mod = typeof import('./firestoreSync');

const load = () => import('./firestoreSync');

function lazy<K extends keyof Mod>(name: K) {
  return (...args: Parameters<Mod[K]>): Promise<unknown> =>
    load().then((m) => (m[name] as unknown as (...a: unknown[]) => unknown)(...args));
}

export const syncAssignmentToFirestore = lazy('syncAssignmentToFirestore');
export const deleteAssignmentFromFirestore = lazy('deleteAssignmentFromFirestore');
export const syncSessionToFirestore = lazy('syncSessionToFirestore');
export const deleteSessionFromFirestore = lazy('deleteSessionFromFirestore');
export const syncGradeToFirestore = lazy('syncGradeToFirestore');
export const deleteGradeFromFirestore = lazy('deleteGradeFromFirestore');
export const syncOnboardingDismissed = lazy('syncOnboardingDismissed');
export const pushTimerState = lazy('pushTimerState');
export const completeFocusSession = lazy('completeFocusSession');
