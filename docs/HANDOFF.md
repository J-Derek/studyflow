# StudyFlow: handoff for a new chat

Read this first. It is the current state of the project and how to work on it. Last updated 2026-11-09 (after PR #16).
The older docs in this folder (PRD, ARCHITECTURE, DESIGN and so on) describe intent; this file describes what is true now.

## 0. ROUND 2: read this first (state on 2026-11-09, `main` at `a540d96`, all of it deployed and live)

Derek sent a long list after testing the live app. It was planned as **ten small PRs**; the full plan, with files and
tests for each, is `docs/ROUND2-PLAN.md`. Read it. His decisions: the Grades tab becomes **Courses** (still 6 nav links);
an in-app **writing space** per assignment with **Word and PDF** export; **timer and sound settings per account, synced**;
**"new semester" archives everything** with a review screen to carry chosen unfinished tasks and notes.

### What is merged AND deployed (nothing is waiting on Derek except the items in "Derek still has to...")
| PR | What it did |
|---|---|
| #8 | Notes tab (typed notes, pin, search, clickable links, undo, synced, in backups) |
| #9 | Deadline reminders in the `.ics` export; account popover (just the picture, opens a panel); timetable clash warning + Sunday fix; full-screen note reader; PDFs kept on the device only |
| #10 | Tap a timetable block to edit or delete it; phone layout fixes (long links, assignment titles) |
| #11 | Dark mode survives sign-out; "Device" theme option follows the phone or laptop; timer lengths and sounds survive sign-out (per **device** for now, PR2 changes that) |
| #12 | Every phone control is at least 44px; hover-only delete cross hidden on touch |
| #13 | Sign in on the **same page** (no pop-up) when an ad blocker breaks the Google pop-up; clearer blocked-pop-up message |
| #14 | Gentle animated illustrations on empty Assignments, Notes, Timetable and Today |
| #15 | Stopped the screen shaking at sign-in/sign-out (right theme on first paint, fonts preloaded, banner folds away) |
| #16 | **PR1 of round 2:** input limits everywhere, notes now restored from backups, visible "couldn't save" message with Try again, the Saved badge watches every collection and turns red ("Not saved") |

Google/Vercel setup for same-page sign-in is **done**: the OAuth client "Web client (auto created by Google Service)" in
project `studyflow-app-8f038` has both redirect URIs (`.../__/auth/handler` on the firebaseapp.com AND the vercel.app
address) and both origins, and Vercel has `VITE_FIREBASE_AUTH_DOMAIN=app-beta-lilac-23.vercel.app` for Production.
**Never ask Derek to replace a URI, only to ADD one.** He once replaced the old one and broke everyone's sign-in until it was re-added.
Read-only check that Google still accepts both addresses (no sign-in needed): call
`identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=<apiKey>` with `continueUri` set to each handler address, fetch
the returned `authUri`, and look for `redirect_uri_mismatch` in the page.

### PR2, timer settings per account: BUILT in PR #18 (deploy rules BEFORE the app)
Done: `timerPrefs` map on the user document (rules `isValidTimerPrefs`, 4 rules tests), `syncTimerPrefs` / `applyAccountTimerPrefs`,
defaults on sign-out, old `studyflow_device_prefs` entry moved once to the owning account then deleted (`utils/devicePrefs.ts` now only
validates), scheduler stops writing when another tab switched account, Apply/Cancel form with "next block" or "restart".
E2E: `e2e/timer-prefs-account.spec.ts`. Also fixed a flake: a sync-error message dismissed while its retry was running came back.
Not done: tab labels still show new lengths mid-block; pomodoro counts still per device. The brief below is kept for reference.

Derek found that after switching accounts, "the other person's focus timers come with me". Cause (verified in code):
- `src/utils/devicePrefs.ts` keeps `timerSettings` (focus, short, long, auto-start flags), `soundscape`, `breakSoundscape`,
  `soundscapeVolume` in localStorage key `studyflow_device_prefs`, which **sign-out deliberately does not wipe**. The store reads it
  at module load (`savedPrefs`, `initialTimerSettings` in `src/store/studyFlowStore.ts`) and again in `onRehydrateStorage`.
  `resetStore` keeps `timerSettings` and builds the idle timer from it. So the next person inherits lengths and sounds.
- `pomodorosCompleted` and `focusMinutes` are local only; `focusSessions` is written to Firestore but never read, so counts do not follow
  an account either. `src/lib/timerScheduler.ts` is started in `main.tsx` before auth binds and rewrites the persisted state every second, so a stale background tab
  can write its user's data into shared localStorage (`bindUser` in `src/lib/auth.ts` catches it on the next load through `dataOwnerUid`).
- `e2e/account-isolation.spec.ts` only checks assignment text; nothing covers the timer.
Build plan (from `docs/ROUND2-PLAN.md`): additive rule for a `timerPrefs` map on the user document (`firestore.rules`, user block around
lines 74 to 88; ints in range, bools, sound from a fixed list), mapper changes in `src/services/firestoreMappers.ts` (`profileToDoc` / `docToProfile`
around lines 153 to 188) and the profile listener in `src/services/firestoreSync.ts` (around lines 78 to 92), `types`, `backupValidator` if backed up, rules tests in
`app/rules-tests/rules.test.ts`. Remove the timer parts of `devicePrefs.ts` (the theme stays per device in `utils/themePreference.ts`); `resetStore` restores defaults;
one-time upload of a device's old values to the account that owns them. Guard the scheduler so it never writes when the persisted owner is not the current uid.
**Timer lengths UX (`src/pages/FocusTimer.tsx`):** `LengthField` (lines about 26 to 53) is uncontrolled and commits on blur only, with no Apply button, and applies at once only if the timer is idle
(`updateTimerSettings` in the store); the hint text does not mention a paused timer; tab labels change mid-block. Replace with a controlled form with **Apply** and **Cancel**; while a block runs offer
"apply to the next block" or "restart with the new length". **Deploy order: rules first, then the app.** Tests: rules + mapper, e2e isolation (A sets 50/10 and signs out; a guest and B see defaults; A on a fresh browser sees 50/10), update `e2e/timer-lengths.spec.ts`.

### Then PR3 to PR10 (each from the latest `origin/main`, only after Derek merges the one before)
PR3 sign-in speed + Google name/photo + refreshed "Your account" dialog (the name stays "Student" because the guest profile seeding writes `name: 'Student'` to Firestore and the profile listener
overwrites Google's `displayName`; `providerData` is never read; signed-in state is not persisted so every reload shows the guest header for a moment). PR4 404 + error boundary + offline page + rewrite
`docs/SECURITY.md` (still describes Supabase) + `security.txt` + `/notes` in the sitemap. PR5 legal pages (privacy, terms, children, storage/cookies, accessibility), age step, delete-my-account;
**research Kenya DPA 2019, GDPR, COPPA, UK AADC first and mark everything as a draft for a Kenyan lawyer**. PR6 item kinds (exam, test, reading, project), progress from checklists, happy completion
animation, legends/keys, nudges that students can add exams and readings. PR7 month calendar + deadlines on the timetable + pending items everywhere. PR8 Grades becomes Courses.
PR9 writing space + Word/PDF export. PR10 term vs semester + "Start a new semester" archive. Every PR that changes synced data touches: `types`, `firestore.rules`, `firestoreMappers.ts`,
`backupValidator.ts`, rules tests, mapper tests.

Derek's original wishes, mapped (so nothing is lost): sign-in feels slow (PR3); import Google name and photo (PR3); what the "Saved" badge is (PR1, done); typed assignments exported as Word/PDF, shown near "Next up" on Today (PR9);
auto progress vs manual slider (PR6); input limits and validation (PR1, done, plus a check in each later PR); month calendar with tap-a-day (PR7); remind students to add reading and exams (PR6, PR7); whole app synced so
pending items show on Today, Timetable, Notes, Courses (PR7); a key/legend for anything not obvious (PR6); happy completion animation (PR6); clean-out / new semester without losing old data (PR10); term vs semester for non-university
users (PR10); child-safety and legal pages (PR5); a Classes/Courses tab (PR8); timer Apply button (PR2); account switch leak (PR2); refreshed "Your account" dialog (PR3); 404 and other pages (PR4). He said more will be found: keep a list.

### Derek still has to do or confirm
- **Try real Google sign-in on the live site with his ad blocker on** (the same-page sign-in is deployed, but only he can test real Google). Ask him what happened.
- Merge each PR, deploy rules when told (`cd app` then `npx firebase deploy --config ../firebase.json --only firestore:rules,firestore:indexes --project studyflow-app-8f038`), then `npx vercel --prod`, then hard-refresh.
- Legal pages are drafts, not advice: a Kenyan lawyer should confirm ODPC registration and under-18 consent.
- Branches already merged can be deleted on GitHub (everything above plus `docs-handoff-refresh`, whose content is already in `main`).

### How to work with Derek
- Plain, direct language; spell out acronyms the first time; casual and friendly. He often works on a flaky connection and gets interrupted: just continue.
- Give commands one per code block, exact and in order (`git checkout main`, `git pull`, `cd app`, `npx vercel --prod`). Say what to click. He sends screenshots; read them carefully.
- Honest reports: what you checked, how, and the output. **A push once silently did not happen and I told him it had**, so always run `git ls-remote origin refs/heads/<branch>` and compare with `git rev-parse --short HEAD`.
- He asks for opinions and wants corrections when he is wrong. He likes things explained simply, with the reason. Standing orders: fix bugs without asking; never merge, deploy, push `main`, or do a real Google sign-in or account creation yourself; never stage his `scripts/` files.
- Do not spend his money (Jitter Pro and similar). Jitter free exports carry a watermark, so animations are drawn in code (`components/EmptyIllustration.tsx`, keyframes in `src/index.css`).

### Practical lessons (save yourself the pain)
- **Edit files with a script written by the Write tool**, not inline shell Python: the Bash tool collapses double backslashes, which once turned `\\1` into a control character and corrupted a file. Pattern: a small Python file that reads the file, detects its
  line endings (CRLF everywhere; `ProfileModal.tsx` has some doubled `\r\r\n`), asserts every old string occurs exactly once, replaces, writes back. After any edit run `git diff --stat`: a few lines is right, hundreds means line endings were damaged. Run Python as `python -I script.py`.
- The Edit tool sometimes fails on CRLF files with no message. The script approach never does.
- **Stale emulator or Vite processes** from earlier manual runs can hold ports 9099, 8080 and 5198, and the permission system blocks killing processes. If `emulators:exec` says "port taken", run specs directly against the running emulators with
  `npx playwright test <specs>` from `app/` (its config starts Vite on 5199 itself), or ask Derek to close the old terminals. Production-build specs (`e2e-prod`) use port 5198 and may need a temporary config on another port.
- Full e2e: `npx firebase emulators:exec --config ../firebase.json --only auth,firestore --project studyflow-e2e "playwright test"` from `app/`, about 10 minutes: start it in the background and wait on a flag file.
- Some e2e tests are timing-sensitive. Known flakes: a test that reads `window.__store` while the app reloads after signing in; tests that reload before a write reaches the emulator (wait for it with the emulator REST API, see `e2e/timetable-clash.spec.ts`).
  Accessibility checks run axe on light and dark. Keep exactly 6 links in the bottom nav, and every phone control at least 44px (`e2e/phone-layout.spec.ts`).
- **Do not give a new element `role="status"`** unless needed: older tests use `getByRole('status')` and it must resolve to one element (the Saved badge uses `aria-live="polite"` for this reason).
- CI on `main` shows two skipped "Deploy Firestore rules" checks (by design: rules are deployed by hand). Read CI failures from the run page in the browser pane
  (`github.com/J-Derek/studyflow/actions/runs/<id>`, open the annotations); the anonymous GitHub API rate-limits quickly. The `gh` tool is not installed.
- Derek often switches the working folder to `main` himself. Run `git branch --show-current` before editing, and branch from `origin/main`.
- The sign-in code is delicate: popup first, same-page redirect when `window.open` is replaced by a blocker (`lib/auth.ts`, `utils/popupSupport.ts`, `lib/firebase.ts`, and `app/vercel.json` proxies `/__/auth/` to Firebase). Read `completeRedirectSignIn` and `redirectResultOnce` before touching it.
- `index.html` has a pre-paint theme script that reads `studyflow_theme`; keep it in step with `utils/themePreference.ts`.
- Failed cloud saves go through `src/lib/syncErrors.ts` (store `failed(...)` helper); new store actions that write to Firestore should use it, not `console.warn`. `src/utils/limits.ts` holds the field limits that mirror `firestore.rules`.
- Before ending a long session, update this section and `docs/ROUND2-PLAN.md`, commit, push, and verify the push.

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
- The theme survives sign-out (`utils/themePreference.ts`, key `studyflow_theme`): light, dark or Device. Timer lengths,
  auto-start and sounds belong to the account since PR2 and reset to defaults on sign-out.
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
5. The theme is per device. Timer lengths and sound choices sync to the account (PR2). Custom grading weights sync.
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
