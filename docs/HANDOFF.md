# StudyFlow: handoff for a new chat

Read this first. It is the current state of the project and how to work on it. Last updated 2026-11-09 (after PR #18,
with PR #19 open). The older docs in this folder (PRD, ARCHITECTURE, DESIGN and so on) describe intent; this file describes what is true now.

## 0. ROUND 2: read this first (state on 2026-11-09)

Derek sent a long list after testing the live app. It was planned as **ten small PRs**; the full plan, with files and
tests for each, is `docs/ROUND2-PLAN.md`. Read it. His decisions: the Grades tab becomes **Courses** (still 6 nav links);
an in-app **writing space** per assignment with **Word and PDF** export; **timer and sound settings per account, synced**;
**"new semester" archives everything** with a review screen to carry chosen unfinished tasks and notes.

### Status at a glance
| Where | What |
|---|---|
| Live (merged, rules + app deployed) | everything up to and including **PR #18 (PR2: timer settings per account)** |
| Merged by Derek (#19, #20; app deploy is Derek's step, no rules change) | **PR3 complete**: Google name and photo; signed-in header on reload; "Signing you in…"; refreshed "Your account" dialog |
| Merged by Derek (#21), app deploy is his step | from the Antigravity audit: grades read from the cloud held to 0-100; Content-Security-Policy as **report-only** (see "Audit verdicts") |
| Branch `claude/pr4-shell` (PR4, waiting for Derek) | page-not-found screen, calm crash screen, offline banner, `/notes` in the sitemap, `docs/SECURITY.md` rewritten for Firebase. **`security.txt` skipped** until Derek picks a contact address |
| Branch `claude/pr5-legal` (PR5, stacked on PR4, waiting for Derek) | draft legal pages, age question before sign-in, "Delete my account". **Rules change: deploy rules FIRST, then the app** |
| Next to build | PR6 to PR10 (each stacked on the one before) |

### What is merged AND deployed
| PR | What it did |
|---|---|
| #8 | Notes tab (typed notes, pin, search, clickable links, undo, synced, in backups) |
| #9 | Deadline reminders in the `.ics` export; account popover (just the picture, opens a panel); timetable clash warning + Sunday fix; full-screen note reader; PDFs kept on the device only |
| #10 | Tap a timetable block to edit or delete it; phone layout fixes (long links, assignment titles) |
| #11 | Dark mode survives sign-out; "Device" theme option follows the phone or laptop |
| #12 | Every phone control is at least 44px; hover-only delete cross hidden on touch |
| #13 | Sign in on the **same page** (no pop-up) when an ad blocker breaks the Google pop-up; clearer blocked-pop-up message |
| #14 | Gentle animated illustrations on empty Assignments, Notes, Timetable and Today |
| #15 | Stopped the screen shaking at sign-in/sign-out (right theme on first paint, fonts preloaded, banner folds away) |
| #16 | **PR1 of round 2:** input limits everywhere, notes restored from backups, visible "couldn't save" message with Try again, Saved badge turns red ("Not saved") |
| #17 | Handoff docs for round 2 |
| #18 | **PR2 of round 2:** timer lengths, auto-start and sounds belong to the **account** (fixes "the other person's timers come with me"); Apply/Cancel form for lengths; a dismissed save message no longer comes back |

### PR #18 (PR2), what was built (live; Derek tested the account switch by hand and it was good)
- `timerPrefs` map on the user document. Rules: `isValidTimerPrefs` in `firestore.rules` (seconds as ints: focus 1..10800, short 1..3600,
  long 1..5400; two bools; sounds from a fixed list; volume 0..1); 4 rules tests.
- Mappers `timerPrefsToDoc` / `docToTimerPrefs` (`services/firestoreMappers.ts`); writer `syncTimerPrefs` (merge write; creates the
  profile with it when the account has none yet); the profile listener applies the account's values through `applyAccountTimerPrefs`
  and ignores echoes of its own pending writes. The volume slider saves once it settles (600 ms).
- `resetStore` puts the defaults back (25/5/15, sounds off, volume 0.35), so the next person on the device starts clean.
- `utils/devicePrefs.ts` now only validates; the old `studyflow_device_prefs` entry is read once, given to the account that owns the
  device's data, and deleted.
- `lib/timerScheduler.ts`: if another tab switches the saved data to a different account, this tab reloads instead of overwriting it.
- `pages/FocusTimer.tsx`: lengths form with Apply and Cancel (`noValidate`, so 0 or 500 is clamped on Apply rather than blocked by the
  browser); while a block runs or is paused: "Apply to the next block" or "Restart with the new length".
- Fixed `lib/syncErrors.ts`: a message dismissed while its Try again was still running came back when the retry failed (this made
  `limits-and-saves.spec.ts` flaky on main too).
- Tests: `e2e/timer-prefs-account.spec.ts` (A sets 50/10, signs out; guest and B see defaults; A on a fresh browser gets 50/10; old entry
  migrated; damaged entry harmless), rewritten `e2e/timer-lengths.spec.ts`.
- Not done (small): the mode tabs show the new lengths while an older block is still running; pomodoro counts are still per device.

### PR #19 (merged): the real name instead of "Alex Vance"
Cause: a very early build had a fictional sample student ("Alex Vance", Polytechnic Institute, Computer Engineering /
"Computer Science & Mathematics"). It was saved into Derek's cloud profile, and the stored profile wins on every device. Separately, a
guest who links Google keeps the guest account, whose own `displayName` and `photoURL` are empty; Google's are in `providerData`,
which was never read (so the avatar showed initials).
- `utils/placeholderProfile.ts`: `googleProfileOf` (name and photo with a `providerData` fallback, used in `bindUser`), `isPlaceholderName`
  ("Student", "Alex Vance", "Guest"), `isPlaceholderDetail`, `cleanUpProfile`.
- `services/firestoreSync.ts` `cleanUpStoredProfile(uid, googleName)`: once per account per page load, reads the stored profile **from the
  server** and changes only placeholder fields (name to the Google name; the sample university and programme to "My university" /
  "My programme"). Called from `bindUser` for signed-in users.
- `setAuthUser` shows the Google name in place of a placeholder **on this device only** and never writes. Lesson from CI: the first version
  wrote this device's profile at sign-in, so a second device's guest name "Student" got replaced by the Google name and overwrote the
  real stored name (`e2e/profile-sync.spec.ts` caught it). Never write a local profile to the cloud before the stored one has arrived.
- Account menu hides default wording ("My programme", "Academic Workspace", ...).
- Tests: `utils/placeholderProfile.test.ts`, `e2e/google-name.spec.ts`. Also `e2e/undo-and-scores.spec.ts` now matches the Undo button
  exactly (it sometimes matched a button labelled "... undo me").

### What Derek tests by hand
After PR #19 is merged and the app is deployed (no rules change in #19, so app only), Ctrl+Shift+R on the live site:
1. Account menu shows his Google name and photo; no "Alex Vance", no "Computer Science & Mathematics".
2. Edit profile, type a programme, save: it shows in the account menu and survives a reload.
3. On a second device (or a private window), sign in to the same account: the name he typed is still there (not replaced).
4. A brand-new Google account shows its Google name, not "Student".
Still worth repeating after any sign-in change: timers (A sets 50/10, sign out, guest and B show 25/5/15, A gets 50/10 back) and
**real Google sign-in with his ad blocker on** (same-page sign-in, never confirmed by him yet).

Google/Vercel setup for same-page sign-in is **done**: the OAuth client "Web client (auto created by Google Service)" in
project `studyflow-app-8f038` has both redirect URIs (`.../__/auth/handler` on the firebaseapp.com AND the vercel.app
address) and both origins, and Vercel has `VITE_FIREBASE_AUTH_DOMAIN=app-beta-lilac-23.vercel.app` for Production.
**Never ask Derek to replace a URI, only to ADD one.** He once replaced the old one and broke everyone's sign-in until it was re-added.
Read-only check that Google still accepts both addresses (no sign-in needed): call
`identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=<apiKey>` with `continueUri` set to each handler address, fetch
the returned `authUri`, and look for `redirect_uri_mismatch` in the page.

### PR3 part 2 (merged as #20)
- **CI flake on #19 explained and fixed (tests only).** "credential-already-in-use: the guest records are merged..." timed out because every
  Google sign-in helper in `e2e/` clicked the emulator account and only *then* waited for the pop-up's `close` event; when the pop-up closed
  first, the wait never ended. Reproduced locally with 24 runs, 4 at a time, a fresh account per run: 8 of 24 hung right after the click while
  the page had already reloaded from the finished merge. Fixed in all ten specs (listen before clicking). `cleanUpStoredProfile` was ruled
  out: it is skipped while the merge runs, never blocks it, and switching it off did not lower the failure rate. Remaining local failures under
  heavy parallel load were slowness on this laptop (a context close stuck writing its trace), not a hang.
- **Signed-in header right after a reload.** Firebase takes a moment to say who is signed in, and the header showed the guest Sign in button
  meanwhile. The store keeps `signedInHint` (uid, email, photo) with the device's saved data, wiped with it at sign-out. `utils/accountView.ts`
  uses it only while `userId` is still null and only if its uid equals `dataOwnerUid`; `store/useAccountView.ts` is the hook (Header, Sidebar,
  AccountMenu, Today banner). Display only: `userId`/`isAnonymous` stay what Firebase said, so sync and tests are unchanged.
  Test: `e2e/signed-in-reload.spec.ts` (fails on the old code: "the guest Sign in button flashed before auth answered").
- **"Signing you in…"** (`lib/signInProgress.ts`, `components/SignInProgress.tsx`): signing in to an existing account moves the guest's
  records, clears the device and reloads, which took seconds with nothing on screen. Now a small note says "moving your guest work", and after
  the reload "loading your plan" until the account's assignments arrive from the cloud (`announceAccountLoaded` in the assignments listener;
  20 s cap). A sessionStorage flag set after the wipe carries it across the reload. Polite live region, not `role="status"`.
- **Refreshed "Your account" dialog** (`components/BackupModal.tsx`, words in `utils/accountSummary.ts`): picture, name, email, typed
  programme/university, "Signed in with Google", a saved/saving/offline/not-saved line (same state as the top-bar badge), Edit profile
  (new `onOpenProfile` prop from `App.tsx`), Sign out, what the plan holds, Download / Restore (file input now keyboard-reachable). PR5 adds
  "Delete my account" at the bottom. Test: `e2e/account-dialog.spec.ts`.
- Sign-in speed itself was not measured with real Google (only Derek can do that); the slow part found in code is the existing-account path above.
- Full e2e on the branch: 209 of 210 passed; `timer-lengths.spec.ts` failed once under the full run and passed 15 of 15 alone (timing flake, untouched code).

### Audit verdicts (Antigravity ran a functional and a security audit on the live site; each claim checked against the code)
| Claim | Verdict |
|---|---|
| Grades 8585 gives 8837.5% | Real, but not from typing (the store clamps typed scores). A record written straight to the cloud with the student's own token held 8585, and `docToGrade` copied it. Rules cannot check each assessment in a list. **Fixed** on `claude/audit-fixes`: clamp on read (`firestoreMappers.ts`) and when adding up (`academicCalculations.ts`, `Grades.tsx`); `e2e/grades-cloud-clamp.spec.ts` |
| Notes: click does nothing, no reader, no PDF | Wrong. The card opens the note, "Read full screen" opens the reader, PDFs attach there (`e2e/notes-reader.spec.ts`). Notes are plain text with clickable links on purpose; markdown would be a product decision |
| Guest header flash after hard refresh | Real, fixed in #20 |
| Title has no maxlength | Wrong: `maxLength` has been there since PR1 |
| Timer "0" not clamped on blur | By design (PR2): the form clamps when Apply is pressed |
| No Content-Security-Policy | Real. Added as `Content-Security-Policy-Report-Only` in `app/vercel.json` (blocks nothing, logs violations in the console) |
| HSTS missing | Wrong: Vercel already sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| IDOR, schema injection, XSS, .ics injection, file leaks | Blocked, matches the code (strict `hasOnly` rules, React escaping, no `innerHTML`) |

**CSP is report-only on purpose.** Real Google sign-in cannot be tested without Derek, and an enforcing policy that is slightly wrong would
stop everyone signing in. `e2e-prod/csp.spec.ts` already runs the production build with the same policy **enforced** and finds no violation on
boot, the dark-theme script, a note with a PDF, emulator sign-in, the account dialog and every page. What is left to confirm by hand: Derek signs
in with real Google (ad blocker on and off) on the live site with the browser console open (F12) and reports any line starting
"[Report Only] Refused to ...". When there are none, a small PR renames the header to `Content-Security-Policy` (enforcing). If a violation shows
up, add the address to the matching directive in `vercel.json`. The theme script in `index.html` is allowed by its hash: `src/utils/csp.test.ts`
fails if that script is edited without refreshing the two hashes (LF and CRLF forms).

### PR4 (branch `claude/pr4-shell`)
- `getTabFromPath` (`store/studyFlowStore.ts`) now answers `'notfound'` for an address the app does not have (it used to quietly show Today);
  `pages/NotFound.tsx` ("We can't find that page", Go to Today, links to the six pages, `noindex` while shown). Vercel answers every address
  without a dot with the app, so this screen is how unknown addresses are handled.
- `components/ErrorBoundary.tsx`: around the page area (menus keep working; the `key` retries when another page is opened) and around the whole
  app in `main.tsx`. "Reload" and "Download my data", which reads the saved copy on this device through `utils/exportBackup.ts`
  (`backupFromSavedCopy`) and so works even when the store is the broken part. The Your account dialog uses the same `buildBackup`/`downloadBackup`.
- `components/OfflineBanner.tsx` (shared `lib/useOnline.ts`, also used by the Saved badge and the account dialog). There is **no offline page**: the app
  has no service worker, so a first visit with no connection cannot load anything. A service worker is a bigger decision, not done.
- Sitemap has `/notes`. `docs/SECURITY.md` is rewritten: every row names its test, and the "known limits" list is honest (no account deletion, no
  security.txt, headers not auto-tested).
- Tests: `e2e/app-shell.spec.ts` (404 light/dark with axe and 44px, Back from 404, a forced crash on Notes with the menus still working and the
  download containing the record, offline banner), unit `tabFromPath.test.ts`, `exportBackup.test.ts`.
- Gap found, not fixed: a bad value saved in `localStorage` would crash the same page again after Reload (the error screen's Download still works).
- To do when Derek chooses a contact: `app/public/.well-known/security.txt` (RFC 9116: Contact, Expires, Preferred-Languages) and a link in SECURITY.md section 6.

### PR5 (branch `claude/pr5-legal`, stacked on `claude/pr4-shell`)
**Deploy order: rules first** (`cd app`, `npx firebase deploy --config ../firebase.json --only firestore:rules,firestore:indexes --project studyflow-app-8f038`), **then** `npx vercel --prod`.
Reason: the app now writes `ageConfirmed` in the profile; the old rules reject unknown keys, so a profile save would fail until the rules are live.
- Research and honest gaps: `docs/COMPLIANCE.md` (I could not read the Kenyan Act or the ODPC notes as text: age of a "child", registration list and
  s.33 wording are for a lawyer to confirm). Open questions there: contact address, controller name, Firestore region, guest data clean-up.
- Pages: `src/legal/*.md` (privacy, terms, children, storage, accessibility) loaded lazily by `pages/LegalPage.tsx` through `components/MiniMarkdown.tsx` and
  `utils/miniMarkdown.ts` (no HTML is ever produced, unsafe link addresses are dropped; PR9 reuses the parser). Routes `/privacy` etc. in
  `store/studyFlowStore.ts` (`LegalTab`, `LEGAL_TABS`), footer `components/LegalFooter.tsx`, sitemap, Help and Your account link to them. Each shows a **Draft** notice.
  Placeholders on purpose: "Contact address: to be added before launch", "Data location: to be confirmed".
- Age question: `components/AgeGateDialog.tsx` + `lib/ageGate.ts` (promise bridge) + `utils/ageGate.ts`; `lib/authActions.ts` `signInOrLinkWithGoogle` asks first.
  Under 13: no account, carry on as guest. 13-17: guardian tick. 18+: continue. Kept in `localStorage` key `studyflow_age_confirmed`, copied to the account
  (`ageConfirmed` map on the user doc, rules `isValidAgeConfirmed`: band never "under13", 13-17 needs `guardian == true`), forgotten at sign-out
  (`wipeLocalUserData`, except while a sign-in reloads the page). Tests that click a sign-in button call `e2e/ageHelper.ts` `continueThroughAgeGate`.
  Tests calling `__auth.signInOrLinkWithGoogle` directly skip the question (they use `lib/auth`, not `lib/authActions`).
- Delete my account: `lib/auth.ts` `deleteMyAccount` (Google re-sign-in, flush writes, stop listeners, `services/accountDeletion.ts` `deleteAllUserData`, `deleteUser`,
  wipe, reload). `accountDeletion.test.ts` fails if `firestore.rules` gets a collection the list does not name. **Anyone adding a collection (PR9 drafts, PR10 semesters)
  must add it to `ACCOUNT_COLLECTIONS`.** Guests have no delete button.
- Safari risk (untested): the Google pop-up now opens after the age dialog's Continue click plus an async import; Safari is strict about pop-ups after waits.
- Tests: `e2e/legal-pages.spec.ts`, `age-gate.spec.ts`, `account-deletion.spec.ts`, unit `miniMarkdown`, `ageGate`, `accountDeletion`, 4 rules tests.

### Next: PR6 to PR10 (stacked: each branch starts from the one before; merge in order)
PR3, PR4, PR5 are done. PR6 item kinds (exam, test, reading, project), progress from checklists, happy completion
animation, legends/keys, nudges that students can add exams and readings. PR7 month calendar + deadlines on the timetable + pending items everywhere. PR8 Grades becomes Courses.
PR9 writing space + Word/PDF export. PR10 term vs semester + "Start a new semester" archive. Every PR that changes synced data touches: `types`, `firestore.rules`, `firestoreMappers.ts`,
`backupValidator.ts`, rules tests, mapper tests.

Derek's original wishes, mapped (so nothing is lost): sign-in feels slow (PR3); import Google name and photo (PR #19); what the "Saved" badge is (PR1, done); typed assignments exported as Word/PDF, shown near "Next up" on Today (PR9);
auto progress vs manual slider (PR6); input limits and validation (PR1, done, plus a check in each later PR); month calendar with tap-a-day (PR7); remind students to add reading and exams (PR6, PR7); whole app synced so
pending items show on Today, Timetable, Notes, Courses (PR7); a key/legend for anything not obvious (PR6); happy completion animation (PR6); clean-out / new semester without losing old data (PR10); term vs semester for non-university
users (PR10); child-safety and legal pages (PR5); a Classes/Courses tab (PR8); timer Apply button (PR2, done #18); account switch leak (PR2, done #18); refreshed "Your account" dialog (PR3); 404 and other pages (PR4). He said more will be found: keep a list.

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
- Some e2e tests are timing-sensitive. Known flakes: a test that reads `window.__store` while the app reloads after signing in; a pop-up `close` wait added after the click (always create it before clicking, fixed in every spec on `claude/pr3-rest`); tests that reload before a write reaches the emulator (wait for it with the emulator REST API, see `e2e/timetable-clash.spec.ts`).
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
