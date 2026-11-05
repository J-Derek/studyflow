# Overnight log

Started after the plan in OVERNIGHT-PLAN.md was approved.

## Step 1: push + CI
- Pushed `phase-4a-hardening`. First CI run on GitHub: all three jobs green (unit/build, rules emulator, Playwright); deploy job skipped as intended. Needed a workflow change: it only ran on PRs and main pushes, now runs on every branch push.

## Step 2: timer refactor (done)
- `src/lib/timerEngine.ts`: pure timestamp-based engine, 12 unit tests (pause/resume, sleep gap, clock moving backwards, double start, cloud adoption, same-run tolerance).
- `src/lib/timerScheduler.ts`: one scheduler outside React, completes a block exactly once even if the Timer page is not open, and on load if the block finished while closed.
- Store holds `timer` (timestamps) + `nowMs`; the decrementing counter and `tickTimer/syncInactiveTime` are gone. Timer state is persisted, so a refresh keeps the real time.
- Cloud: `liveState/timer` writes use the rev compare-and-swap; finishing a focus block writes `focusSessions/run-{rev}` and idles the timer in one batch. Rules gained a `paused` state with `remainingSeconds` (2 new rules tests, 40 total).
- Bug found by my own e2e test: after a refresh the timer jumped back, because the server's start time is later than the local one. Fixed with a tolerance check (`sameRun`), not by trusting the server copy.
- Evidence: unit 98 pass, rules 40 pass, Playwright 8 pass (3 new: refresh/pause no drift, completion recorded once in the cloud, second tab follows the first), build ok.
- Known limits: pomodoro counter is still per-device; a block started offline is not recorded as a cloud focus session (rules require server-time elapsed); pausing on one device idles the other until it resumes.

## Step 3: leftovers (done)
- Profile: term start/end and time zone fields feed the `.ics` export (Playwright downloads the file and checks TZID, first occurrence, UNTIL, SEQUENCE; a second export raises SEQUENCE). Blank profile fields no longer invent "Fall 2026".
- Guest notice: absent on first load, appears after the first real (non-sample) assignment, remembered when dismissed. Sample data alone does not trigger it. Playwright covers all three.
- Grades now sync: new `grades` rules (+4 rules tests, 44 total), mappers (undefined scores omitted), listener with one-time upload, add/edit/delete, sample/clear/import/guest-merge all include grades. Playwright proves create, edit and delete reach the emulator.
- Evidence: unit 101, rules 44, Playwright 13, build ok.

## Step 4: accessibility (done)
- Added axe-core to Playwright (WCAG 2.0/2.1/2.2 A + AA tags). First scan: **all 20 page scans failed** (192 contrast nodes, 12 unnamed selects, 4 unlabeled sliders, nav name mismatches).
- Fixes: systematic colour remap (light `zinc-400/500` -> `zinc-600`, dark `zinc-500` -> `zinc-400`, red/blue/amber/indigo tweaks); aria-labels on every select, slider, number/date/time input; nav link names match visible text; icon-only close buttons named; tour dots get a 24px hit area.
- Dialogs: only Help had role="dialog". New `useDialog` hook gives all five modals (Help, Backup, Profile, Add assignment, Search) role/aria-modal/name, Escape to close, focus trap, focus restored to the opener.
- Keyboard: skip link + focused `main`, global visible focus ring (light and dark) incl. inputs/sliders, which had none. 80 Tab stops per route checked.
- Timer: `role="timer"` with a name, and a polite live region that announces state changes and each remaining minute, not every second.
- Evidence: Playwright 56 passed (20 page scans = 5 routes x light/dark x desktop/375px mobile; 10 dialog tests; 10 keyboard walks + skip link + keyboard add + timer announcements), all axe violations 0.
- Not covered: a real screen reader (NVDA/VoiceOver) was not run; axe cannot judge reading order or meaningful labels. Contrast was measured by axe only; text on gradient/image backgrounds would be flagged as "incomplete" and none appeared.

## Step 5: preview deploy and Lighthouse (done, with limits)
- Deployed **preview** builds only (never `--prod`). The preview is behind Vercel login, so I checked it with `vercel curl`. On the final preview: `/`, `/assignments`, `/timer`, `/grades` return 200; `/assets/x.js` and `/nope.png` return 404; X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy and HSTS are present; no request goes to fonts.googleapis.com.
- Lighthouse (mobile, simulated slow 4G, 4x CPU) ran against a local production build wired to the emulators, NOT the preview URL, so I did not create throwaway users in your real Firebase project. Scores are therefore indicative, not a measurement of Vercel.
- Before: performance 64-83, accessibility 98-100, best practices 96-100, SEO 100.
- After: performance 80-88 (median 84 on Today over three runs), accessibility 100, best practices 100, SEO 100. First paint went from about 3.4-5.8 s to 2.7 s. LCP is about 3.7 s, which Lighthouse still rates "needs improvement"; it stays a client-rendered app, so the next real gain would be pre-rendering the shell.
- What changed: Inter is now self-hosted (removed a 1.25 s render-blocking Google Fonts request and the unused JetBrains Mono); text under 12px raised to 12px (only 37-54% of text was legible size); Firebase (640 KB) loads after first paint via dynamic imports; Google's api.js is no longer loaded on every visit (the popup resolver is passed only when someone clicks sign-in); heading order fixed (every page has an h1, no skipped levels); the Today page loads eagerly because it is the landing page.
- Honest note: eager vs lazy Today differed by about 130 ms of LCP, inside run-to-run noise; I kept eager.
- 20 new Playwright tests check there is no horizontal scrolling at 320, 375, 768 and 1440 px on every screen.

## Step 6: close-out
- README rewritten to match reality: real test commands and what each proves, what is NOT covered, security claims limited to what is tested, roadmap statuses.
- CI: first run on GitHub was green. The run for the accessibility commit failed once in the Playwright job and passed on the identical code when re-run, so it was a flake I could not attribute (logs need credentials). I added GitHub annotations to the Playwright reporter and ONE retry on CI only; if a retried test passes, Playwright reports it as flaky rather than hiding it.

## Final state at the end of the run
- Unit 101 passed, rules 44 passed, Playwright 76 passed, build ok, lint warnings only.

## Still needs you
1. `firebase login`, then deploy the rules (after shipping this app version, not before).
2. Add the `FIREBASE_SERVICE_ACCOUNT` GitHub secret if you want CI to deploy rules.
3. Confirm your production domain is on Firebase Auth's authorized domains, then try a real Google sign-in once.
4. Review the diff and merge the branch (I never merged, never deployed to production).
5. Phase 4B-2 (custom domain), a manual screen-reader pass, and the five-student usability test.
