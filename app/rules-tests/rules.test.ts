import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const ALICE = 'alice';
const BOB = 'bob';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'studyflow-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

type Db = ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore'] extends () => infer R ? R : never;
const asAlice = (): Db => env.authenticatedContext(ALICE).firestore();
const asBob = (): Db => env.authenticatedContext(BOB).firestore();
const anon = (): Db => env.unauthenticatedContext().firestore();

const asg = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'Essay',
  course: 'ENG 101',
  dueDate: '2026-11-20',
  dueTime: '17:00',
  priority: 'medium',
  status: 'pending',
  progress: 0,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: serverTimestamp(),
  ...over
});
const ses = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  title: 'Lecture',
  course: 'ENG 101',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:30',
  type: 'lecture',
  updatedAt: serverTimestamp(),
  ...over
});
const aDoc = (db: Db, id = 'a1') => doc(db, 'users', ALICE, 'assignments', id);
const sDoc = (db: Db, id = 's1') => doc(db, 'users', ALICE, 'sessions', id);
const timerDoc = (db: Db) => doc(db, 'users', ALICE, 'liveState', 'timer');
const fsDoc = (db: Db, id: string) => doc(db, 'users', ALICE, 'focusSessions', id);

async function seedRunningTimer(rev: number, elapsedMs = 1600 * 1000): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE, 'liveState', 'timer'), {
      rev,
      status: 'running',
      mode: 'focus',
      durationSeconds: 1500,
      startedAt: Timestamp.fromMillis(Date.now() - elapsedMs),
      updatedAt: Timestamp.now()
    });
  });
}

describe('tenancy', () => {
  it('denies unauthenticated reads and writes', async () => {
    await assertFails(setDoc(aDoc(anon()), asg()));
    await assertFails(getDoc(aDoc(anon())));
  });
  it("denies another user's reads and writes", async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg()));
    await assertFails(getDoc(aDoc(asBob())));
    await assertFails(setDoc(aDoc(asBob()), asg()));
    await assertFails(deleteDoc(aDoc(asBob())));
    await assertFails(getDocs(query(collection(asBob(), 'users', ALICE, 'assignments'), limit(10))));
  });
  it('denies unmapped paths', async () => {
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'surprise', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(asAlice(), 'other', 'x'), { a: 1 }));
  });
  it('denies listing /users', async () => {
    await assertFails(getDocs(query(collection(asAlice(), 'users'), limit(5))));
  });
});

describe('user profile', () => {
  const user = (over: Record<string, unknown> = {}) => ({
    uid: ALICE,
    name: 'Alice',
    university: 'Daystar',
    program: 'CS',
    semester: 'Fall',
    updatedAt: serverTimestamp(),
    ...over
  });
  const ref = () => doc(asAlice(), 'users', ALICE);
  it('accepts a valid profile with the onboarding map', async () => {
    await assertSucceeds(setDoc(ref(), user({ onboarding: { dismissed: true } })));
  });
  it('rejects uid mismatch, extra keys, missing keys', async () => {
    await assertFails(setDoc(ref(), user({ uid: BOB })));
    await assertFails(setDoc(ref(), user({ isAdmin: true })));
    const noName: Record<string, unknown> = user();
    delete noName.name;
    await assertFails(setDoc(ref(), noName));
  });
  describe('timerPrefs', () => {
    const prefs = (over: Record<string, unknown> = {}) => ({
      focusDuration: 3000,
      shortBreakDuration: 600,
      longBreakDuration: 1200,
      autoStartBreaks: false,
      autoStartFocus: true,
      soundscape: 'rain',
      breakSoundscape: 'off',
      soundscapeVolume: 0.5,
      ...over
    });
    it('accepts valid timer choices, including the extremes', async () => {
      await assertSucceeds(setDoc(ref(), user({ timerPrefs: prefs() })));
      await assertSucceeds(setDoc(ref(), user({ timerPrefs: prefs({ focusDuration: 10800, shortBreakDuration: 3600, longBreakDuration: 5400, soundscapeVolume: 0 }) })));
      await assertSucceeds(setDoc(ref(), user({ timerPrefs: prefs({ focusDuration: 1, soundscapeVolume: 1 }) })));
    });
    it('rejects out-of-range, non-integer and wrongly typed values', async () => {
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ focusDuration: 10801 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ focusDuration: 0 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ shortBreakDuration: 3601 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ longBreakDuration: 5401 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ focusDuration: 1500.5 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ autoStartBreaks: 'yes' }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ soundscapeVolume: 1.5 }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ soundscapeVolume: -0.1 }) })));
    });
    it('rejects unknown sounds, extra or missing keys, and a non-map value', async () => {
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ soundscape: 'thunder' }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ breakSoundscape: 'x' }) })));
      await assertFails(setDoc(ref(), user({ timerPrefs: prefs({ extra: 1 }) })));
      const missing: Record<string, unknown> = prefs();
      delete missing.soundscapeVolume;
      await assertFails(setDoc(ref(), user({ timerPrefs: missing })));
      await assertFails(setDoc(ref(), user({ timerPrefs: 'fast' })));
    });
    it('cannot be written into another student\'s profile', async () => {
      await assertFails(setDoc(doc(asBob(), 'users', ALICE), user({ timerPrefs: prefs() })));
    });
  });
  it('rejects a malformed onboarding map', async () => {
    await assertFails(setDoc(ref(), user({ onboarding: 'yes' })));
    await assertFails(setDoc(ref(), user({ onboarding: { dismissed: 'yes' } })));
    await assertFails(setDoc(ref(), user({ onboarding: { dismissed: true, extra: 1 } })));
  });
  describe('ageConfirmed', () => {
    const at = '2030-05-06T07:08:09.000Z';
    it('accepts an adult answer and a 13 to 17 answer with the guardian tick', async () => {
      await assertSucceeds(setDoc(ref(), user({ ageConfirmed: { band: '18+', guardian: false, at } })));
      await assertSucceeds(setDoc(ref(), user({ ageConfirmed: { band: '13-17', guardian: true, at } })));
    });
    it('never stores under 13, and refuses 13 to 17 without the guardian tick', async () => {
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: 'under13', guardian: true, at } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '12', guardian: true, at } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '13-17', guardian: false, at } })));
    });
    it('rejects a birth date, extra keys, missing keys, wrong types and an oversized time', async () => {
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '18+', guardian: false, at, birthDate: '2001-01-01' } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '18+', guardian: false } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '18+', guardian: 'no', at } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: { band: '18+', guardian: false, at: 'x'.repeat(41) } })));
      await assertFails(setDoc(ref(), user({ ageConfirmed: '18+' })));
    });
    it('can be added to an existing profile with a merge, and nobody else can add it', async () => {
      await assertSucceeds(setDoc(ref(), user()));
      await assertSucceeds(setDoc(ref(), { ageConfirmed: { band: '18+', guardian: false, at }, updatedAt: serverTimestamp() }, { merge: true }));
      await assertFails(setDoc(doc(asBob(), 'users', ALICE), { ageConfirmed: { band: '18+', guardian: false, at }, updatedAt: serverTimestamp() }, { merge: true }));
    });
  });
  it('rejects a client-sent updatedAt', async () => {
    await assertFails(setDoc(ref(), user({ updatedAt: Timestamp.fromMillis(1) })));
  });
  it('accepts semester dates, a time zone and a small JPEG picture', async () => {
    await assertSucceeds(setDoc(ref(), user({ semesterStart: '2026-09-07', semesterEnd: '2026-12-18', timeZone: 'Africa/Nairobi', photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' })));
  });
  it('rejects malformed dates, an oversized time zone, and unsafe or oversized pictures', async () => {
    await assertFails(setDoc(ref(), user({ semesterStart: 'tomorrow' })));
    await assertFails(setDoc(ref(), user({ semesterEnd: '2026-1-1' })));
    await assertFails(setDoc(ref(), user({ timeZone: 'x'.repeat(65) })));
    await assertFails(setDoc(ref(), user({ photo: 'https://example.com/me.jpg' })));
    await assertFails(setDoc(ref(), user({ photo: 'data:image/svg+xml;base64,PHN2Zz4=' })));
    await assertFails(setDoc(ref(), user({ photo: 'data:image/jpeg;base64,' + 'A'.repeat(60000) })));
    await assertFails(setDoc(ref(), user({ photo: 12345 })));
  });
  it('lets the student remove the picture and the dates again', async () => {
    await assertSucceeds(setDoc(ref(), user({ semesterStart: '2026-09-07', photo: 'data:image/jpeg;base64,/9j/4AAQ' })));
    await assertSucceeds(setDoc(ref(), { ...user(), semesterStart: deleteField(), photo: deleteField() }, { merge: true }));
  });
  it("does not let another student read or change someone else's picture", async () => {
    await assertSucceeds(setDoc(ref(), user({ photo: 'data:image/jpeg;base64,/9j/4AAQ' })));
    await assertFails(getDoc(doc(asBob(), 'users', ALICE)));
    await assertFails(setDoc(doc(asBob(), 'users', ALICE), user({ photo: 'data:image/jpeg;base64,/9j/EVIL' })));
  });
  it('makes uid immutable', async () => {
    await assertSucceeds(setDoc(ref(), user()));
    await assertFails(updateDoc(ref(), { uid: BOB, updatedAt: serverTimestamp() }));
  });
});

describe('assignments: shape', () => {
  it('accepts a valid assignment, with sample flag and map subtasks', async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg()));
    await assertSucceeds(
      setDoc(
        aDoc(asAlice(), 'a2'),
        asg({
          id: 'a2',
          sample: true,
          subtasks: { 'st-1': { id: 'st-1', title: 'Read', completed: false, order: 0 } }
        })
      )
    );
  });
  it('accepts every kind, and rejects an unknown one or a wrong type', async () => {
    for (const kind of ['assignment', 'exam', 'test', 'reading', 'project']) {
      await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ kind, updatedAt: serverTimestamp() })));
    }
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ kind: 'homework', updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ kind: 5, updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ kind: ['exam'], updatedAt: serverTimestamp() })));
  });
  it('still accepts an assignment with no kind (everything made before kinds existed)', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ updatedAt: serverTimestamp() })));
  });
  it('rejects unknown keys', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ role: 'admin' })));
  });
  it('rejects missing required keys', async () => {
    const rest: Record<string, unknown> = asg();
    delete rest.title;
    await assertFails(setDoc(aDoc(asAlice()), rest));
  });
  it('rejects wrong types', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ title: 5 })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ progress: '50' })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ sample: 'true' })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ priority: 'urgent' })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ subtasks: 'nope' })));
  });
  it('rejects NaN, Infinity and out-of-range progress', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ progress: NaN })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ progress: Infinity })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ progress: -1 })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ progress: 101 })));
  });
  it('rejects status completed with progress below 100', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ status: 'completed', progress: 50 })));
    await assertSucceeds(setDoc(aDoc(asAlice()), asg({ status: 'completed', progress: 100 })));
  });
  it('enforces string length edges (title max 250)', async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg({ title: 'x'.repeat(250) })));
    await assertFails(setDoc(aDoc(asAlice(), 'a2'), asg({ id: 'a2', title: 'x'.repeat(251) })));
    await assertFails(setDoc(aDoc(asAlice(), 'a3'), asg({ id: 'a3', title: '' })));
  });
  it('measured: rules count UTF-16 units, so an emoji uses 2 of the 250 allowed', async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg({ title: '😀'.repeat(125) })));
    await assertFails(setDoc(aDoc(asAlice(), 'a2'), asg({ id: 'a2', title: '😀'.repeat(126) })));
  });
  it('rejects bad time formats', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ dueTime: '25:99' })));
    await assertFails(setDoc(aDoc(asAlice()), asg({ dueTime: '5pm' })));
  });
  it('requires doc id to equal data.id', async () => {
    await assertFails(setDoc(aDoc(asAlice(), 'other'), asg()));
  });
  it('rejects more than 100 subtasks', async () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 101; i++) many[`s${i}`] = { id: `s${i}`, title: 't', completed: false, order: i };
    await assertFails(setDoc(aDoc(asAlice()), asg({ subtasks: many })));
  });
});

describe('assignments: timestamps and updates', () => {
  it('rejects a client-sent updatedAt and a missing updatedAt', async () => {
    await assertFails(setDoc(aDoc(asAlice()), asg({ updatedAt: Timestamp.fromMillis(Date.now() + 86400000) })));
    const none: Record<string, unknown> = asg();
    delete none.updatedAt;
    await assertFails(setDoc(aDoc(asAlice()), none));
  });
  it('keeps id and createdAt immutable', async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg()));
    await assertFails(updateDoc(aDoc(asAlice()), { createdAt: '2020-01-01T00:00:00.000Z', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(aDoc(asAlice()), { title: 'Renamed', updatedAt: serverTimestamp() }));
  });
  it('rejects an update that leaves the document invalid', async () => {
    await assertSucceeds(setDoc(aDoc(asAlice()), asg()));
    await assertFails(updateDoc(aDoc(asAlice()), { priority: 'nope', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(aDoc(asAlice()), { extra: 1, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(aDoc(asAlice()), { notes: deleteField(), updatedAt: serverTimestamp() }));
  });
});

describe('assignments: field-level updates (one tick, one step)', () => {
  const sub = (id: string, completed: boolean, order: number) => ({ id, title: `Step ${id}`, completed, order });
  const seedWithSteps = () =>
    setDoc(aDoc(asAlice()), asg({ subtasks: { s1: sub('s1', false, 0), s2: sub('s2', false, 1), s3: sub('s3', false, 2) } }));
  it('accepts a tick that touches one subtask and the derived fields, and nothing else changes', async () => {
    await assertSucceeds(seedWithSteps());
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'subtasks.s2.completed', true, 'progress', 33, 'status', 'in_progress', 'updatedAt', serverTimestamp()));
    const data = (await getDoc(aDoc(asAlice()))).data()!;
    expect(data.subtasks.s2.completed).toBe(true);
    expect(data.subtasks.s1.completed).toBe(false);
    expect(data.subtasks.s3.completed).toBe(false);
    expect(data.title).toBe('Essay');
  });
  it('accepts two ticks of different items written one after the other, as two devices would', async () => {
    await assertSucceeds(seedWithSteps());
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'subtasks.s1.completed', true, 'progress', 33, 'status', 'in_progress', 'updatedAt', serverTimestamp()));
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'subtasks.s3.completed', true, 'progress', 33, 'status', 'in_progress', 'updatedAt', serverTimestamp()));
    const s = (await getDoc(aDoc(asAlice()))).data()!.subtasks;
    expect([s.s1.completed, s.s2.completed, s.s3.completed]).toEqual([true, false, true]);
  });
  it('accepts finishing (status, progress, completedAt) and un-finishing (completedAt removed)', async () => {
    await assertSucceeds(seedWithSteps());
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'status', 'completed', 'progress', 100, 'completedAt', '2026-11-14T10:00:00.000Z', 'updatedAt', serverTimestamp()));
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'status', 'in_progress', 'progress', 66, 'completedAt', deleteField(), 'updatedAt', serverTimestamp()));
    expect((await getDoc(aDoc(asAlice()))).data()!.completedAt).toBeUndefined();
  });
  it('accepts adding and removing a single step', async () => {
    await assertSucceeds(seedWithSteps());
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'subtasks.s4', sub('s4', false, 3), 'updatedAt', serverTimestamp()));
    await assertSucceeds(updateDoc(aDoc(asAlice()), 'subtasks.s1', deleteField(), 'updatedAt', serverTimestamp()));
    expect(Object.keys((await getDoc(aDoc(asAlice()))).data()!.subtasks).sort()).toEqual(['s2', 's3', 's4']);
  });
  it('still refuses a partial update that is stale, leaves the document invalid, or belongs to someone else', async () => {
    await assertSucceeds(seedWithSteps());
    await assertFails(updateDoc(aDoc(asAlice()), 'subtasks.s1.completed', true)); // no fresh updatedAt
    await assertFails(updateDoc(aDoc(asAlice()), 'status', 'completed', 'progress', 50, 'updatedAt', serverTimestamp())); // completed needs 100
    await assertFails(updateDoc(aDoc(asAlice()), 'progress', 140, 'updatedAt', serverTimestamp()));
    await assertFails(updateDoc(aDoc(asAlice()), 'title', deleteField(), 'updatedAt', serverTimestamp()));
    await assertFails(updateDoc(aDoc(asBob()), 'subtasks.s1.completed', true, 'updatedAt', serverTimestamp()));
  });
});

describe('notes', () => {
  const note = (over: Record<string, unknown> = {}) => ({
    id: 'n1',
    title: 'Week 3',
    body: 'Offer, acceptance, consideration.',
    course: 'LAW 101',
    pinned: false,
    createdAt: '2026-11-01T08:00:00.000Z',
    editedAt: '2026-11-01T08:00:00.000Z',
    updatedAt: serverTimestamp(),
    ...over
  });
  const nDoc = (db: Db, id = 'n1') => doc(db, 'users', ALICE, 'notes', id);

  it('lets the owner create, read, edit and delete a note', async () => {
    await assertSucceeds(setDoc(nDoc(asAlice()), note()));
    await assertSucceeds(getDoc(nDoc(asAlice())));
    await assertSucceeds(setDoc(nDoc(asAlice()), note({ body: 'Updated', editedAt: '2026-11-02T08:00:00.000Z' })));
    await assertSucceeds(deleteDoc(nDoc(asAlice())));
  });
  it("keeps one student's notes from every other student", async () => {
    await assertSucceeds(setDoc(nDoc(asAlice()), note()));
    await assertFails(getDoc(nDoc(asBob())));
    await assertFails(setDoc(nDoc(asBob()), note({ body: 'overwritten' })));
    await assertFails(deleteDoc(nDoc(asBob())));
    await assertFails(getDocs(query(collection(asBob(), 'users', ALICE, 'notes'), limit(10))));
    await assertFails(getDoc(nDoc(anon())));
  });
  it('accepts an empty course and a long body, and rejects oversized ones', async () => {
    await assertSucceeds(setDoc(nDoc(asAlice()), note({ course: '' })));
    await assertSucceeds(setDoc(nDoc(asAlice(), 'n2'), note({ id: 'n2', body: 'x'.repeat(20000) })));
    await assertFails(setDoc(nDoc(asAlice(), 'n3'), note({ id: 'n3', body: 'x'.repeat(20001) })));
    await assertFails(setDoc(nDoc(asAlice(), 'n4'), note({ id: 'n4', title: 'x'.repeat(201) })));
    await assertFails(setDoc(nDoc(asAlice(), 'n5'), note({ id: 'n5', course: 'c'.repeat(51) })));
  });
  it('rejects a missing or empty title, wrong types, extra keys and a mismatched id', async () => {
    await assertFails(setDoc(nDoc(asAlice()), note({ title: '' })));
    await assertFails(setDoc(nDoc(asAlice()), note({ pinned: 'yes' })));
    await assertFails(setDoc(nDoc(asAlice()), note({ body: 5 })));
    await assertFails(setDoc(nDoc(asAlice()), note({ isPublic: true })));
    await assertFails(setDoc(nDoc(asAlice(), 'other'), note({ id: 'n1' })));
    const noBody: Record<string, unknown> = note();
    delete noBody.body;
    await assertFails(setDoc(nDoc(asAlice()), noBody));
  });
  it('requires a server-set updatedAt and keeps id and createdAt fixed', async () => {
    await assertFails(setDoc(nDoc(asAlice()), note({ updatedAt: Timestamp.fromMillis(1) })));
    await assertSucceeds(setDoc(nDoc(asAlice()), note()));
    await assertFails(setDoc(nDoc(asAlice()), note({ createdAt: '2020-01-01T00:00:00.000Z' })));
  });
  it('caps list queries', async () => {
    await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, 'notes'), limit(500))));
    await assertFails(getDocs(query(collection(asAlice(), 'users', ALICE, 'notes'), limit(501))));
  });
});

describe('past semesters (archiving)', () => {
  const period = (over: Record<string, unknown> = {}) => ({
    id: 'p-2026-11-09-ab3x', name: 'Semester 2, 2026', label: 'semester', archivedAt: '2026-11-09T10:00:00.000Z',
    counts: { assignments: 3, sessions: 2, grades: 1, notes: 4 }, updatedAt: serverTimestamp(), ...over
  });
  const pref = (db: Db = asAlice(), id = 'p-2026-11-09-ab3x') => doc(db, 'users', ALICE, 'semesters', id);
  it('lets the owner keep a past semester record, and nobody else see it', async () => {
    await assertSucceeds(setDoc(pref(), period()));
    await assertSucceeds(getDoc(pref()));
    await assertFails(getDoc(pref(asBob())));
    await assertFails(setDoc(pref(asBob()), period()));
    await assertFails(getDoc(pref(anon())));
    await assertSucceeds(deleteDoc(pref()));
  });
  it('rejects a bad label, extra keys, odd counts, a wrong id and a client-sent updatedAt', async () => {
    await assertFails(setDoc(pref(), period({ label: 'year' })));
    await assertFails(setDoc(pref(), period({ isAdmin: true })));
    await assertFails(setDoc(pref(), period({ counts: { assignments: -1, sessions: 0, grades: 0, notes: 0 } })));
    await assertFails(setDoc(pref(), period({ counts: { assignments: 1, sessions: 0, grades: 0 } })));
    await assertFails(setDoc(pref(), period({ counts: { assignments: 1.5, sessions: 0, grades: 0, notes: 0 } })));
    await assertFails(setDoc(pref(), period({ id: 'other' })));
    await assertFails(setDoc(pref(), period({ name: '' })));
    await assertFails(setDoc(pref(), period({ updatedAt: Timestamp.fromMillis(1) })));
  });
  it('lets assignments, classes, courses and notes carry the period they were archived into, and nothing odd', async () => {
    const id = 'p-2026-11-09-ab3x';
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archivedPeriod: id })));
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'sessions', 's1'), ses({ archivedPeriod: id })));
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'grades', 'g1'), { id: 'g1', courseCode: 'C', courseName: 'N', credits: 3, targetLetter: 'A', color: '#000', assessments: [], updatedAt: serverTimestamp(), archivedPeriod: id }));
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'notes', 'n1'), { id: 'n1', title: 'T', body: '', course: '', pinned: false, createdAt: 'z', editedAt: 'z', updatedAt: serverTimestamp(), archivedPeriod: id }));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archivedPeriod: 5 })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archivedPeriod: '' })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archivedPeriod: 'x'.repeat(61) })));
  });
  it('accepts the archived flag (true or false) on assignments, classes, courses and notes, and nothing but a boolean', async () => {
    const grade = (over: Record<string, unknown> = {}) => ({ id: 'g1', courseCode: 'C', courseName: 'N', credits: 3, targetLetter: 'A', color: '#000', assessments: [], updatedAt: serverTimestamp(), ...over });
    const note = (over: Record<string, unknown> = {}) => ({ id: 'n1', title: 'T', body: '', course: '', pinned: false, createdAt: 'z', editedAt: 'z', updatedAt: serverTimestamp(), ...over });
    for (const archived of [true, false]) {
      await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archived })));
      await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'sessions', 's1'), ses({ archived })));
      await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'grades', 'g1'), grade({ archived })));
      await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'notes', 'n1'), note({ archived })));
    }
    for (const bad of ['yes', 1, null]) {
      await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'a1'), asg({ archived: bad })));
      await assertFails(setDoc(doc(asAlice(), 'users', ALICE, 'notes', 'n1'), note({ archived: bad })));
    }
    // documents written by an older app version (no flag) are still accepted, and can be given the flag later by an update
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'old'), asg({ id: 'old' })));
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE, 'assignments', 'old'), { archived: false, updatedAt: serverTimestamp() }));
    // listing current items only is allowed (with a limit), as is listing the archived ones
    await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, 'assignments'), where('archived', '==', false), limit(500))));
    await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, 'assignments'), where('archived', '==', true), limit(500))));
  });
  it('accepts a semester, term or trimester label on the profile, and nothing else', async () => {
    const user = (over: Record<string, unknown> = {}) => ({ uid: ALICE, name: 'A', university: 'U', program: 'P', semester: 'S', updatedAt: serverTimestamp(), ...over });
    for (const periodLabel of ['semester', 'term', 'trimester']) await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE), user({ periodLabel })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE), user({ periodLabel: 'year' })));
    await assertFails(setDoc(doc(asAlice(), 'users', ALICE), user({ periodLabel: 5 })));
  });
});

describe('drafts (writing space)', () => {
  const draft = (over: Record<string, unknown> = {}) => ({ id: 'a1', body: 'Hello', format: 'markdown', editedAt: '2030-01-01T00:00:00.000Z', updatedAt: serverTimestamp(), ...over });
  const ref = (db: Db = asAlice(), id = 'a1') => doc(db, 'users', ALICE, 'drafts', id);
  it('lets the owner write, read, edit and delete a draft, up to 200000 characters', async () => {
    await assertSucceeds(setDoc(ref(), draft()));
    await assertSucceeds(getDoc(ref()));
    await assertSucceeds(setDoc(ref(), draft({ body: 'x'.repeat(200000) })));
    await assertSucceeds(deleteDoc(ref()));
  });
  it('rejects a body over 200000 characters, a bad format, extra keys, a wrong id and a client-sent updatedAt', async () => {
    await assertFails(setDoc(ref(), draft({ body: 'x'.repeat(200001) })));
    await assertFails(setDoc(ref(), draft({ format: 'html' })));
    await assertFails(setDoc(ref(), draft({ isAdmin: true })));
    await assertFails(setDoc(ref(), draft({ id: 'other' })));
    await assertFails(setDoc(ref(), draft({ body: 5 })));
    await assertFails(setDoc(ref(), draft({ updatedAt: Timestamp.fromMillis(1) })));
  });
  it('keeps one student drafts from every other student and from signed-out visitors', async () => {
    await assertSucceeds(setDoc(ref(), draft()));
    await assertFails(getDoc(ref(asBob())));
    await assertFails(setDoc(ref(asBob()), draft()));
    await assertFails(getDoc(ref(anon())));
  });
  it('caps list queries', async () => {
    await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, 'drafts'), limit(500))));
    await assertFails(getDocs(query(collection(asAlice(), 'users', ALICE, 'drafts'), limit(501))));
  });
});

describe('sessions (timetable)', () => {
  it('accepts valid, rejects bad day, bad time, unknown type, extra key', async () => {
    await assertSucceeds(setDoc(sDoc(asAlice()), ses({ sample: true })));
    await assertFails(setDoc(sDoc(asAlice(), 's2'), ses({ id: 's2', dayOfWeek: 7 })));
    await assertFails(setDoc(sDoc(asAlice(), 's3'), ses({ id: 's3', dayOfWeek: 1.5 })));
    await assertFails(setDoc(sDoc(asAlice(), 's4'), ses({ id: 's4', startTime: '9am' })));
    await assertFails(setDoc(sDoc(asAlice(), 's5'), ses({ id: 's5', type: 'party' })));
    await assertFails(setDoc(sDoc(asAlice(), 's6'), ses({ id: 's6', hacked: 1 })));
  });
});

describe('grades', () => {
  const grade = (over: Record<string, unknown> = {}) => ({
    id: 'g1', courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#6366F1',
    assessments: [{ id: 'x1', name: 'Midterm', weight: 40, score: 82 }, { id: 'x2', name: 'Final exam', weight: 60 }],
    updatedAt: serverTimestamp(), ...over
  });
  const gDoc = (db: Db, id = 'g1') => doc(db, 'users', ALICE, 'grades', id);
  it('accepts a valid course and its owner can read it back', async () => {
    await assertSucceeds(setDoc(gDoc(asAlice()), grade()));
    await assertSucceeds(getDoc(gDoc(asAlice())));
    await assertSucceeds(setDoc(gDoc(asAlice(), 'g2'), grade({ id: 'g2', sample: true })));
  });
  it('denies other users and unauthenticated access', async () => {
    await assertSucceeds(setDoc(gDoc(asAlice()), grade()));
    await assertFails(getDoc(gDoc(asBob())));
    await assertFails(setDoc(gDoc(asBob(), 'g9'), grade({ id: 'g9' })));
    await assertFails(getDoc(gDoc(anon())));
  });
  it('rejects bad credits, unknown keys, too many assessments, client timestamps, id mismatch', async () => {
    await assertFails(setDoc(gDoc(asAlice()), grade({ credits: -1 })));
    await assertFails(setDoc(gDoc(asAlice()), grade({ credits: 31 })));
    await assertFails(setDoc(gDoc(asAlice()), grade({ credits: NaN })));
    await assertFails(setDoc(gDoc(asAlice()), grade({ gpa: 4 })));
    await assertFails(setDoc(gDoc(asAlice()), grade({ assessments: Array.from({ length: 51 }, (_, i) => ({ id: `a${i}`, name: 'x', weight: 1 })) })));
    await assertFails(setDoc(gDoc(asAlice()), grade({ updatedAt: Timestamp.fromMillis(1) })));
    await assertFails(setDoc(gDoc(asAlice(), 'other'), grade()));
  });
  it('keeps id immutable and lists capped', async () => {
    await assertSucceeds(setDoc(gDoc(asAlice()), grade()));
    await assertFails(updateDoc(gDoc(asAlice()), { id: 'zzz', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, 'grades'), limit(500))));
    await assertFails(getDocs(query(collection(asAlice(), 'users', ALICE, 'grades'), limit(501))));
  });
});

describe('list queries are capped', () => {
  it('allows limit <= 500, denies larger or missing limit', async () => {
    for (const c of ['assignments', 'sessions', 'focusSessions']) {
      await assertSucceeds(getDocs(query(collection(asAlice(), 'users', ALICE, c), limit(500))));
      await assertFails(getDocs(query(collection(asAlice(), 'users', ALICE, c), limit(501))));
      await assertFails(getDocs(collection(asAlice(), 'users', ALICE, c)));
    }
  });
});

describe('timer state (liveState/timer) compare-and-swap', () => {
  const idle = (over: Record<string, unknown> = {}) => ({
    rev: 1,
    status: 'idle',
    mode: 'focus',
    durationSeconds: 1500,
    updatedAt: serverTimestamp(),
    ...over
  });
  const running = (rev: number, over: Record<string, unknown> = {}) => ({
    rev,
    status: 'running',
    mode: 'focus',
    durationSeconds: 1500,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over
  });

  it('creates at rev 1 only', async () => {
    await assertFails(setDoc(timerDoc(asAlice()), idle({ rev: 5 })));
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle()));
  });
  it('requires rev to increase by exactly one', async () => {
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle()));
    await assertFails(setDoc(timerDoc(asAlice()), running(1)));
    await assertFails(setDoc(timerDoc(asAlice()), running(3)));
    await assertSucceeds(setDoc(timerDoc(asAlice()), running(2)));
  });
  it('two clients, same rev: exactly one succeeds', async () => {
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle()));
    const a = env.authenticatedContext(ALICE).firestore();
    const b = env.authenticatedContext(ALICE).firestore();
    const results = await Promise.allSettled([
      setDoc(timerDoc(a), running(2)),
      setDoc(timerDoc(b), running(2, { durationSeconds: 900 }))
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('rejects a client-sent startedAt when running', async () => {
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle()));
    await assertFails(setDoc(timerDoc(asAlice()), running(2, { startedAt: Timestamp.fromMillis(1) })));
  });
  it('accepts a paused timer only with remainingSeconds, and never with startedAt', async () => {
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle()));
    await assertFails(setDoc(timerDoc(asAlice()), { rev: 2, status: 'paused', mode: 'focus', durationSeconds: 1500, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(timerDoc(asAlice()), { rev: 2, status: 'paused', mode: 'focus', durationSeconds: 1500, remainingSeconds: 1501, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(timerDoc(asAlice()), { rev: 2, status: 'paused', mode: 'focus', durationSeconds: 1500, remainingSeconds: 600, startedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(timerDoc(asAlice()), { rev: 2, status: 'paused', mode: 'focus', durationSeconds: 1500, remainingSeconds: 600, updatedAt: serverTimestamp() }));
  });
  it('rejects remainingSeconds on an idle timer', async () => {
    await assertFails(setDoc(timerDoc(asAlice()), idle({ remainingSeconds: 5 })));
  });
  it('rejects bad mode, bad duration, extra keys', async () => {
    await assertFails(setDoc(timerDoc(asAlice()), idle({ mode: 'nap' })));
    await assertFails(setDoc(timerDoc(asAlice()), idle({ durationSeconds: 0 })));
    await assertFails(setDoc(timerDoc(asAlice()), idle({ durationSeconds: 86401 })));
    await assertFails(setDoc(timerDoc(asAlice()), idle({ secondsLeft: 3 })));
  });
});

describe('focusSessions: forged creation is blocked', () => {
  const idle = (rev: number) => ({
    rev,
    status: 'idle',
    mode: 'focus',
    durationSeconds: 1500,
    updatedAt: serverTimestamp()
  });
  const session = (over: Record<string, unknown> = {}) => ({
    durationSeconds: 1500,
    mode: 'focus',
    completedAt: serverTimestamp(),
    localDate: '2026-11-05',
    ...over
  });

  it('denies creation when no timer exists', async () => {
    await assertFails(setDoc(fsDoc(asAlice(), 'run-1'), session()));
  });
  it('denies creation while the timer is idle', async () => {
    await assertSucceeds(setDoc(timerDoc(asAlice()), idle(1)));
    await assertFails(setDoc(fsDoc(asAlice(), 'run-1'), session()));
  });
  it('denies a session that claims more time than has elapsed', async () => {
    await seedRunningTimer(2, 5 * 1000);
    const db = asAlice();
    const b = writeBatch(db);
    b.set(fsDoc(db, 'run-2'), session({ durationSeconds: 1500 }));
    b.set(timerDoc(db), idle(3));
    await assertFails(b.commit());
  });
  it('allows a session once the elapsed time has passed', async () => {
    await seedRunningTimer(2);
    const db = asAlice();
    const b = writeBatch(db);
    b.set(fsDoc(db, 'run-2'), session({ durationSeconds: 1500 }));
    b.set(timerDoc(db), idle(3));
    await assertSucceeds(b.commit());
  });
  it('binds the session id to the timer rev (one session per run)', async () => {
    await seedRunningTimer(2);
    const db = asAlice();
    const wrong = writeBatch(db);
    wrong.set(fsDoc(db, 'anything-i-like'), session());
    wrong.set(timerDoc(db), idle(3));
    await assertFails(wrong.commit());
  });
  it('denies updates to existing sessions', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'focusSessions', 'run-2'), {
        durationSeconds: 60,
        mode: 'focus',
        completedAt: Timestamp.now(),
        localDate: '2026-11-05'
      });
    });
    await assertFails(updateDoc(fsDoc(asAlice(), 'run-2'), { durationSeconds: 86400 }));
  });
});

describe('get/exists call budget on the largest batch', () => {
  it('a 500-document assignment batch commits (no get() calls in those rules)', async () => {
    const db = asAlice();
    const b = writeBatch(db);
    for (let i = 0; i < 500; i++) b.set(aDoc(db, `a${i}`), asg({ id: `a${i}` }));
    await assertSucceeds(b.commit());
  });
  it('the timer-stop batch (session + timer) stays within the call limit', async () => {
    await seedRunningTimer(4);
    const db = asAlice();
    const b = writeBatch(db);
    b.set(fsDoc(db, 'run-4'), {
      durationSeconds: 1500,
      mode: 'focus',
      completedAt: serverTimestamp(),
      localDate: '2026-11-05'
    });
    b.set(timerDoc(db), { rev: 5, status: 'idle', mode: 'focus', durationSeconds: 1500, updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});
