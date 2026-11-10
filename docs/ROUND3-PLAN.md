# Round 3: sharpen the core loop (UX plan and where it stands)

Read `docs/HANDOFF.md` first (state of the project, rules of engagement, practical lessons). This file is only the Round 3 plan.
State on 2026-11-10: **Round 2 (PR3 to PR10) is merged and deployed** (rules and app). `main` = merge of PR #22.

## Where the work stands RIGHT NOW (unfinished, not committed)
Branch `claude/ux-a-today` (from `main`) holds **uncommitted, untested** edits for PR A:
- `app/src/components/FirstDeadlineCard.tsx`: title + date chips only; course, kind and priority behind a "More options" toggle
  (`data-testid="more-options"`); course is optional (saved as "General" when blank); copy shortened.
- `app/src/pages/Dashboard.tsx`: add card now comes before the "Already use StudyFlow?" sign-in banner; Getting Started checklist hides once
  the student has finished a real (non-sample) assignment.
- `app/src/components/SaveBadge.tsx`: on phones the badge is hidden while saved/on-device and shows only for saving/offline/error.
- Tests edited: `e2e/today-edit.spec.ts` and `e2e/kinds-progress.spec.ts` now click "More options" before filling the course.
- New test file `app/e2e/today-compact.spec.ts` (5 tests) written but **never run**.
Next steps: run `npx tsc -p tsconfig.app.json --noEmit`, then `npx playwright test e2e/today-compact.spec.ts e2e/today-edit.spec.ts e2e/kinds-progress.spec.ts`,
fix failures, run the FULL e2e suite (about 11 min) and the prod suite, update HANDOFF, commit, push, verify with `git ls-remote`.

## Derek's decisions
- "Go all, recommended": do PR A to PR F in order. Priority (high/medium/low) **will sort "Next up"** (it does nothing today).
- PR E gets the full fix (merge-by-id listeners AND current-only loading with a backfill), done last and tested hardest.
- Derek merges and deploys; never push main, merge, or deploy. Stage only your own files (never `scripts/`). Check `git branch --show-current` before every commit.

## The PRs (each from the latest `origin/main`, one branch each)
**A: Phone-first Today** (in progress, see above). Also still to do for A: header on phones = Sign in + Add only (avatar stays).
**B: Screens that open on the useful thing.** Focus timer on phone: clock + Start first, "Change timer lengths" collapsed below. Empty Timetable: show only the
  add-a-class card until there is a class (not seven empty columns). Empty Courses: hide the GPA stat boxes until a course exists. One name everywhere:
  bottom bar says "Tasks", page says "Assignments" (pick "Assignments"). One theme switcher (keep the account menu; "Device" default).
**C: Copy and clutter.** One-line helper text; the "exams, tests and readings are easy to forget" hint only for the first few items; keep the "What do the labels mean?"
  key only on the Timetable; make priority sort Next up (`selectPendingDeadlines` in `utils/calendarMonth.ts`: overdue first, then date, then priority, then time); demo-data wording only in Help.
**D: Motion.** 150 to 200 ms fade/slide on complete/undo and sheet open (CSS only, `motion-reduce:` honoured). Preload the timer and assignments chunks after first paint
  (the lazy imports in `App.tsx`) to remove the grey flash.
**E: Data fixes.** (1) Known bug: ticking two checklist items very fast can lose one because an old sync echo replaces the list. Fix by merging snapshots by id in the four
  list listeners in `app/src/services/firestoreSync.ts` (do NOT just skip snapshots with pending writes: that was tried and broke notes on a second device). (2) The 500-document cap
  counts archived items: query current items only (needs an `archived:false` backfill, rules change, deploy rules first) and load past semesters on demand. Stress e2e: rapid ticks, two tabs.
**F: Installable app + offline start.** A service worker with a cached app shell, an install prompt, and offline first load. Push reminders are a separate later decision (needs a server).

## Verification for every PR
`npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`, full `npx playwright test` (about 11 min, run in the background), the prod suite
(copy `playwright.prod.config.ts`, change port 5198 to 5197, run, delete the copy; stale emulators hold ports 9099/8080 so run specs against them directly), `npx vitest run --config vitest.rules.config.ts` when rules change.
Look at 375px screenshots in light and dark. Edit files with a small Python script written by the Write tool (CRLF files), run `git diff --stat` after.
Commit messages end with the attribution line given in the session reminder.

## Progress log
- **PR A done** on `claude/ux-a-today` (2026-11-10): full e2e 256 of 256 after fixing `limits-and-saves.spec.ts` (course field is behind More options; phone Saved badge hidden when saved), prod suite 4 of 4, tsc, vitest, lint, build clean. The phone header was already Sign in + avatar + Add, so no header change was needed. Waiting for Derek to merge.
