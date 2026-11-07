# StudyFlow: handoff for a new chat

Read this first. It is the current state of the project and how to work on it. Last updated 2026-11-07.
The older docs in this folder (PRD, ARCHITECTURE, DESIGN and so on) describe intent; this file describes what is true now.

## 1. What it is, who it is for

StudyFlow is a study planner for university students (the product owner and first users are in Nairobi).
Guest-first: no sign-up to start. Signing in with Google keeps the plan on every device.

**Product owner: Derek.** The only human on the project. Casual, direct, wants honest answers in plain language.
Spell out acronyms the first time. Say what you checked, how, and what the output was. Never claim something works
without having run it. He is often away or asleep: finish work, test it, push the branch, and leave a clear summary.

## 2. Where everything is

| Thing | Where |
|---|---|
| Code | `C:\Users\Jiva\Documents\Freelance\studyflow` (GitHub: `J-Derek/studyflow`). The app is in `app/` |
| Live site | https://app-beta-lilac-23.vercel.app (Vercel project `app`, **not** connected to Git) |
| Firebase project | `studyflow-app-8f038` (Auth + Firestore; no paid plan, so no Storage and no Cloud Functions) |
| Rules and indexes | `firestore.rules`, `firestore.indexes.json` at the repo root |
| Local emulators | Auth 9099, Firestore 8080 (`firebase.json`) |

Stack: React 19, Vite 8, TypeScript, Tailwind 3.4, Zustand 5 (persisted under `studyflow_storage_v1`), Firebase 13,
Vitest, Playwright with axe-core, ical.js. Fonts are self-hosted (Inter and Bricolage Grotesque).

## 3. Rules of engagement (these matter)

- **Never** push to `main`, merge, force-push, or deploy to production. Derek does the merge click and the deploys.
  (The tool permission system also blocks production deploys; do not try to work around it.)
- Never type passwords, create accounts or do a real Google sign-in for Derek. Ask him for that step.
- Work on a feature branch, push it, and give Derek the compare link: `https://github.com/J-Derek/studyflow/compare/main...<branch>`.
- **Standing order from Derek: fix bugs you can fix yourself without asking him.** (Saved in the project memory.)
- Stage only your own files. `scripts/` holds Derek's own scratch files (modified and untracked); never stage or edit them.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Report format: what you checked, the command, the actual output, the verdict (confirmed, fixed, still open).
- No invented data shown as the student's. No compliance or security claims without a passing test.

## 4. How Derek ships a change

1. Merge the PR on GitHub (after CI is green).
2. In PowerShell: `git checkout main`, `git pull`, `cd app`, `npx vercel --prod` (**must be run from `app/`**, not the repo root).
3. If `firestore.rules` changed, then from `app/`:
   `npx firebase deploy --config ../firebase.json --only firestore:rules,firestore:indexes --project studyflow-app-8f038`
   Ship the app first, rules second. The app is written to tolerate old rules (it logs a warning and keeps working locally).
   **Careful:** that command deploys the rules file from the shared working folder, whatever branch is checked out.
4. Hard-refresh the live site (Ctrl+Shift+R) and check by hand.

## 5. Commands (run from `app/`)

| Command | What it does | Needs |
|---|---|---|
| `npm test` | Vitest unit tests | Node |
| `npm run test:rules` | Firestore rules against the emulator | Java |
| `npm run test:e2e` | Playwright against Auth and Firestore emulators (about 6 minutes) | Java, Chromium |
| `npm run test:e2e:prod` | A few checks on the **production build** (Vite behaves differently there) | Java |
| `npm run lint`, `npx tsc -b`, `npm run build` | Lint, types, build | Node |

CI (`.github/workflows/ci.yml`) runs all of these on every push. The "Deploy Firestore rules" job on `main` is red by design
until a `FIREBASE_SERVICE_ACCOUNT` GitHub secret exists; it refuses to deploy without it.

**Test environment gotchas**
- Only one emulator set can run at a time (fixed ports). A leftover emulator or `firebase` process makes the next run fail
  with "port taken". Do not run two test runs at once.
- Long runs time out the shell: start them in the background, write a flag file at the end, and wait for it with a monitor.
- Tests that sign in use the emulator's fake Google pop-up. Real Google pop-ups are blocked in any automated browser; only
  Derek clicking by hand tests real sign-in.
- Known flake pattern: the app reloads itself once after signing in to an existing account, so a test that reads
  `window.__store` at that moment throws. Retry through it (see `e2e/profile-sync.spec.ts`).
- Windows shell: a bash heredoc containing quotes often breaks. Write Python or TypeScript helper scripts with the file tool
  instead. Many files use CRLF line endings; match them when editing programmatically.
- Test hooks `window.__store` and `window.__auth` exist only when `VITE_USE_EMULATORS=true`.

## 6. What is built (all merged and live unless noted)

Today (Next up card, edit and add from there), Assignments (subtasks, notes, undo delete), Timetable (weekly blocks, `.ics`
export with real time zones), Focus Timer (editable lengths, calm generated sounds with separate focus and break choices,
state kept as timestamps so refresh and tab switches stay exact), Grades (GPA, what-if calculator, editable assessments),
profile (picture, semester dates, time zone), sign in with Google (guest data is merged and never lost), sidebar that
collapses, profile photos, privacy note in Help, backups (export and restore), keyboard and screen-reader basics (axe-clean).

Notes tab (typed notes by course, pinned, searchable, clickable links, undo, syncs, in backups): PR #8.

Added on 2026-11-06 and 2026-11-07 (PRs #9 to #12, all merged and live; no Firestore rules change):
- Deadline reminders: the `.ics` export also contains open assignment deadlines (timed event or all-day) with two
  alarms each. It is a one-time file, so students re-import after changing deadlines.
- Account popover: signed-in students see only their picture (sidebar bottom-left and header top-right); clicking it opens
  details, Edit profile, Your account, theme (Light, Dark, Device), Help and Sign out (`components/AccountMenu.tsx`).
  Guests keep the sign-in button.
- Timetable: tap a block to edit it (dialog with Delete), a warning (not a block) when blocks clash, a clash mark on
  cards, end must be after start. Sunday blocks used to be saved as day 7, which the cloud rules and `.ics` export reject;
  Sunday is now 0 and old local 7s are converted on load.
- Notes: full-screen reader, and PDFs attached to a note that stay on the device only (`lib/localFiles.ts`, IndexedDB,
  25 MB each, PDF header checked). They do not sync, and are deleted on sign-out or account switch and when a note's undo
  window passes.
- Per-device settings survive sign-out (`utils/themePreference.ts`, `utils/devicePrefs.ts`, own localStorage entries
  `studyflow_theme` and `studyflow_device_prefs`): light, dark or Device (follows the phone or laptop live), timer lengths,
  auto-start, sound choices and volume. Signing out still wipes the student's data from the browser.
- Phone pass: every button, field and picker is at least 44px on a phone; long note links, assignment titles and the
  priority filter no longer get cut off. `e2e/phone-layout.spec.ts` guards this.

## 7. Where things live in the code

- `app/src/store/studyFlowStore.ts`: the whole app state and actions. Every cloud write goes through `services/cloud.ts`
  (lazy wrappers) so Firebase is not in the first load.
- `app/src/services/firestoreSync.ts`: listeners (one per collection, seed once from the first server snapshot) and writers;
  `firestoreMappers.ts` converts between app objects and documents (only allowed keys, matching the rules).
- `app/src/lib/auth.ts` and `authActions.ts`: guest to Google linking, account switching, `pendingMerge.ts` keeps guest
  records safe if a merge fails. `lib/firebase.ts` sets up Firebase (popup resolver is passed at sign-in, on purpose).
- `app/src/lib/timerEngine.ts`, `timerScheduler.ts`, `soundscapes.ts` (Web Audio, nothing downloaded).
- `app/src/pages/*` one file per screen; `app/src/components/*` dialogs and shared pieces (`SignInButton`, `Avatar`,
  `NoteDialog`, `GradingEditor`, ...).
- Rules: owner-only under `/users/{uid}/...`, allowed-keys lists, server-set `updatedAt`, list caps of 500, timer
  compare-and-swap, focus sessions only created together with a timer transition. `app/rules-tests/` has 54 tests.
- Collections: `assignments`, `sessions`, `grades`, `notes`, `focusSessions`, `liveState/timer`, and the user document
  (profile, picture as a small JPEG data URL, onboarding flag).

## 8. Decisions and lessons worth keeping

- Rules `size()` counts UTF-16 units (an emoji counts as 2); app inputs stop well below the rule limits.
- A phone top bar once hid the Add button off-screen because the page hides overflow. Layout tests now check that every
  button is fully inside the screen at nine widths (`e2e/header-fits.spec.ts`, `bottom-nav-fits.spec.ts`).
- The Vite **dev** server and the **production build** differ (the production build has a preload helper); bugs that only
  appear in production need `e2e-prod/`.
- Lighthouse (mobile, slow 4G): about 80 to 88 performance, 100 accessibility, 100 best practices. The main content appears
  at about 3.5 seconds. A static page shell was tried and did not improve the real number, so it was not shipped.
- Deleting an assignment, a failed sign-in merge, and similar paths were reviewed by a read-only subagent; that pattern
  (an independent reviewer) found real bugs and is worth repeating before releases.
- Checking the app at phone size in the browser pane found things the automated tests had missed (a title squeezed to
  nothing, a link running off the card). Do that after any layout change, with real content loaded.
- Playwright's desktop browser can hover even at 375px wide. For anything touch-specific (hover-only controls) use a
  context with `hasTouch: true, isMobile: true`.
- E2E tests must not assume Firestore returns lists in insertion order, and must wait for a write to reach the emulator
  before reloading (see `e2e/timetable-clash.spec.ts`).
- Some files have odd line endings (`ProfileModal.tsx` has doubled carriage returns). Edit those with a byte-exact
  replace and check `git diff --stat` stays small; a naive rewrite shows up as hundreds of changed lines.
- CI on `main` shows one red job, "Deploy Firestore rules and indexes", until the `FIREBASE_SERVICE_ACCOUNT` secret
  exists. That is expected. Public GitHub run results can be read from `api.github.com/repos/J-Derek/studyflow/...`
  without the `gh` tool (annotations list the failing test).

## 9. Open items and ideas (see also `docs/LATER.md`)

1. Reminders beyond the `.ics` file: optional in-app banners. Real push notifications need the paid Firebase plan plus a
   scheduled function.
2. A rare race: if a student edits something and reloads the page within a fraction of a second, the edit can be lost
   because the cloud write is still starting (cloud calls are lazy-loaded). Normal use is fine; not fixed.
3. Notes files that sync across devices (PDF, slides): needs Firebase Storage (paid Blaze plan). PDFs on this device only
   are built; slides (pptx) and images are not supported yet; Drive links work in notes. Decide after students use it.
4. Delete my account: the Help note says it is not built. Focus sessions cannot be deleted under the current rules, so a
   rules change is needed first.
5. Timer lengths, sound choices and the theme are per device (not synced to the account). Custom grading weights sync.
6. Connect the Vercel project to Git (project settings, Git, root directory `app`) so merges deploy themselves.
7. Add the `FIREBASE_SERVICE_ACCOUNT` GitHub secret if CI should deploy rules.
8. A real screen reader pass (NVDA or VoiceOver), the five-student usability test, and a custom domain (add it to Firebase
   Auth authorized domains too).
9. Default profile text in the store still says "Academic Workspace" and "Undergraduate" for new guests; replace with
   friendlier wording.
10. Old branches (`phase-4a-hardening`, `tester-fixes`, `account-polish`, ...) are merged and can be deleted on GitHub.

## 10. Testing with a tester agent (optional)

Derek has used Google Antigravity as a student tester through its remote-control web page, driven from the Claude in Chrome
extension. The prompt is in `docs/STUDENT-TESTER-PROMPT.md`. The agent tends to write its own scripts and cannot get past
Vercel preview logins; give it the live site, not a preview. Ask Derek for the current remote-control link.
