# StudyFlow: the big round (fixes, Courses, month calendar, writing, new semester, legal)

## Context
Derek tested the live app and sent a long list: sign-in feels slow and shows "Student" instead of his Google name/photo; timer settings follow you into another account; the timer lengths are hard to apply; the "Saved" badge is unclear; no 404 page; he wants item kinds (exams, readings), a month calendar, a per-course page, an in-app writing space with Word/PDF export, a happy "done" animation, keys/legends, term vs semester, a "start new semester" that archives instead of deleting, input limits everywhere, legal pages for an app used by students (some under 18, Kenya), and a refreshed "Your account" dialog.
Exploration also found real bugs: notes are dropped when restoring a backup; many inputs have no length limit so long entries silently fail to reach the cloud (only a `console.warn`); the stored profile name "Student" overwrites the Google name; timer lengths/sounds live per device (`utils/devicePrefs.ts`) so they leak to the next account; the Saved badge only watches assignments.
Decisions made: **Grades tab becomes Courses** (6 nav links kept); **writing space per assignment with .docx + PDF export**; **timer/sound settings per account, synced**; **new semester archives everything, with a review screen to carry chosen unfinished tasks/notes**.

## How the work ships
Ten small PRs, each on its own branch from `main`, pushed with a compare link. I never merge or deploy. Each PR says its deploy order: when rules only **add** allowed fields, Derek deploys **rules first, then the app**; when rules get stricter, app first. Rules deploy command (from `app/`): `npx firebase deploy --config ../firebase.json --only firestore:rules,firestore:indexes --project studyflow-app-8f038`.
Every synced field touches the same set: `src/types/index.ts`, repo-root `firestore.rules` (`hasOnly` + checks), `src/services/firestoreMappers.ts`, `src/utils/backupValidator.ts`, `app/rules-tests/rules.test.ts`, mapper/backup unit tests.

## Progress (updated 2026-11-09)
- **PR1 done** (#16, live). **PR2 done** (#18, live; rules deployed). Left over from PR2: mode tab labels still change mid-block;
  focus counts still per device (not read from `focusSessions`).
- **PR3:** Google name and photo, and the "Alex Vance" sample-profile clean-up, are in **PR #19** (merged). Branch `claude/pr3-rest`:
  signed-in header right after a reload, "Signing you in…" note for the existing-account path, and the e2e pop-up close race that made #19's
  CI time out, and the refreshed "Your account" dialog. PR3 is complete.
- **PR4** (branch `claude/pr4-shell`) and **PR5** (`claude/pr5-legal`) are built. Derek was away, so from PR4 on each branch is **stacked** on the one before: merge them in order (PR4, PR5, PR6...), and GitHub will shrink each diff as the earlier ones land. See `docs/HANDOFF.md` section 0.

## PR1: Fixes, input limits, visible save errors (no rules change)
- New `src/utils/limits.ts` mirroring rule limits (title 250, course 200, note course 50, course code 50, course name 200, block title/course 200, subtask 200, due dates 2000–2100). Apply `maxLength` + trim in `AssignmentModal.tsx`, `FirstDeadlineCard.tsx`, `pages/Calendar.tsx`, `pages/Grades.tsx`, `pages/Assignments.tsx` (subtasks, cap 100), `GradingEditor.tsx`; use local dates (not `toISOString`) for defaults.
- Fix `validateBackupJson` so notes are restored; `clean*` trims over-long subtasks instead of rejecting the whole backup.
- Failed cloud writes go to a store `syncErrors` slice and show a toast with Retry (replace the `console.warn` catches in `studyFlowStore.ts`).
- Saved badge (`Header.tsx`) from new `utils/saveStatus.ts`: all listeners' pending writes + errors; states Saving / Saved / Not saved / Offline; "Saved on this device" for guests; `role="status"` + tooltip; icon on phones.
- Tests: unit (limits, notes round-trip, saveStatus); e2e (over-limit input, forced write failure shows toast).

## PR2: Timer settings per account (privacy fix)
- Rules (additive, deploy first): `timerPrefs` map on the user doc (focusMin, shortMin, longMin, autoStartBreaks, autoStartFocus, sound, breakSound, volume; ints/bools/allowed sound list).
- `utils/devicePrefs.ts` reduced to nothing timer-related (theme stays per device in `utils/themePreference.ts`); `resetStore` restores timer defaults; one-time upload of a device's values to the owner's account if it has none.
- Guard `src/lib/timerScheduler.ts` so a stale tab never writes another user's state; read focus counts from `focusSessions` so they follow the account.
- Timer lengths UX in `pages/FocusTimer.tsx`: controlled form with **Apply** (and Cancel); while running, offer "Apply to the next block" or "Restart with new length"; mode tab labels don't change mid-block.
- Tests: rules + mapper; e2e account isolation (A sets 50/10, signs out → guest and B see defaults; A on a fresh browser sees 50/10); timer-lengths spec updated.

## PR3: Sign-in speed, Google name/photo, "Your account" dialog
- Rules (additive): `nameSource` ('default'|'google'|'user') and `googlePhotoUrl` (https, ≤500) on the user doc.
- On link/sign-in read `providerData`; replace the name only if it's still the default; ProfileModal edits set `'user'`. Photo order: custom → Google → initials. Fix `profileToDoc` seeding that writes "Student".
- New `utils/authSnapshot.ts` (uid, isAnonymous, name, photo in localStorage, cleared on sign-out) so the signed-in header shows on first paint; start the auth import early; "Signing you in…" toast during merge/reload; `BackupModal.tsx` closes immediately.
- Refresh `BackupModal.tsx`: account card with real name/photo, sync status, data (download/restore), danger zone slot for PR5.
- Tests: rules, mapper, e2e (emulator Google user with a display name shows it; a typed name isn't overwritten; header shows signed-in state right after reload).

## PR4: App shell: 404, error page, offline (no rules change)
- `pages/NotFound.tsx` (`getTabFromPath` returns `notfound` for unknown paths), `components/ErrorBoundary.tsx` (friendly page, Reload, "Download my data"), `components/OfflineBanner.tsx`.
- `public/.well-known/security.txt` (skipped for now: needs a contact address from Derek), `/notes` in `sitemap.xml` (done), `docs/SECURITY.md` rewritten (done).
- Tests: e2e unknown route (+axe), `context.setOffline`, a forced render error.

## PR5: Legal pages, age notice, account deletion
- Research first (web): Kenya Data Protection Act 2019 (children = under 18, parental consent, ODPC registration rules for education), GDPR, COPPA (under 13), UK Age Appropriate Design Code. Write findings to `docs/COMPLIANCE.md`.
- Pages `/privacy`, `/terms`, `/children`, `/storage` (cookies/local storage: strictly necessary, so no banner), `/accessibility`, from lazy-loaded `src/legal/*.md`; links in a footer, Help, and the account dialog. Content: data kept and where, processors (Google Firebase, Vercel), no ads/analytics, retention, rights, contact.
- One-time age step at sign-in (`ageConfirmed` on the user doc, additive rule): under 13 can't create an account; 13–17 confirm a parent/guardian agrees.
- **Delete my account**: new `services/accountDeletion.ts` (re-authenticate, delete every subcollection in batches, user doc, `user.delete()`, wipe local). Help text updated.
- Clearly marked **drafts for legal review**; I'm not a lawyer. Derek should confirm ODPC registration and the parental-consent approach with a Kenyan lawyer.
- Tests: e2e deletion leaves no documents in the emulator; rules (only the owner can delete).

## PR6: Item kinds, progress, celebration, legends, nudges
- Rules (additive): `kind` in assignment|exam|test|reading|project (missing = assignment).
- Kind picker in the add/edit dialogs and FirstDeadlineCard; kind badges; hints that exams and readings can be added (empty states, add dialog, timetable).
- New `utils/progress.ts`: with a checklist, progress comes from ticks ("Based on your checklist", no slider); without one, the manual slider stays; un-completing recalculates.
- New `components/CelebrateBurst.tsx`: happy burst when marking work done (reuses canvas-confetti, off with reduced motion, announced to screen readers).
- New `components/Legend.tsx` for priority, kind and class-type colours; actually apply class-type colours in the timetable (Help already claims them).
- Tests: rules/mapper/backup for `kind`, progress units, e2e (burst; none with reduced motion).

## PR7: Month calendar and deadlines everywhere (no rules change)
- Week/Month toggle in `pages/Calendar.tsx`; new `components/MonthGrid.tsx` showing classes (worked out per date) and deadlines by kind; tap a day → sheet with that day's items and quick add.
- Week view shows that week's deadlines; shared `selectPendingDeadlines` selector used by Today, Timetable and Courses.
- Tests: `occurrencesInRange` units; e2e tap-a-day, 44px targets on phones, axe.

## PR8: Grades tab → Courses
- Rules (additive): optional `courseId` on assignments, sessions, notes; the existing grades doc is the course record.
- `pages/Courses.tsx` + `pages/CourseDetail.tsx` (pending/done work and exams, this week's classes, notes, grades/GPA); `components/CoursePicker.tsx` replaces free-text course fields (with "new course"); old items match by course code text. `/grades` redirects to `/courses`; nav stays at 6 links.
- Tests: bottom-nav count, redirect, rules/mapper/backup for `courseId`, e2e course page.

## PR9: Writing space with Word/PDF export
- Rules (additive): `users/{uid}/drafts/{assignmentId}` `{id, body ≤ 200000, format, updatedAt}`; included in backups and account deletion.
- Editor: textarea + toolbar with a small Markdown subset (headings, bold, italic, lists), preview from an in-house parser (`utils/miniMarkdown.ts`, nothing to sanitise), 1-second autosave. Opened from the assignment and the Today "Next up" card.
- Word: `docx` package, lazy-loaded on click. PDF: print stylesheet + `window.print()` (no dependency; selectable text).
- Tests: parser units, e2e .docx download is a valid zip, rules size limit.

## PR10: Term vs semester, and "Start a new semester"
- Rules (additive): `periodLabel` ('semester'|'term'|'trimester') and `currentPeriodId` on the user doc; `semesters/{id}` collection; `archived` + `periodId` on the four content collections.
- One batched backfill sets `archived:false`; listeners query only current items (keeps under the 500 cap).
- `pages/NewSemester.tsx` review screen: tick unfinished tasks/notes to carry; everything else archived in safe, repeatable 500-item batches. "Past semesters" view is read-only. All "semester" wording reads `periodLabel`; chosen in onboarding and the profile.
- Tests: rules, migration units, e2e archive + carry-over + past view.

## Verification (every PR)
- From `app/`: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`, `npm run test:rules` (when rules change), `npm run test:e2e`, `npm run test:e2e:prod`.
- Look at the changed screens in the browser pane against the emulators, phone and desktop, light and dark.
- Confirm the push reached GitHub (`git ls-remote`), give the compare link and the deploy order; Derek merges, deploys rules (if any) and `npx vercel --prod`, then hard-refreshes.
- Update `docs/HANDOFF.md` at the end of the round.
