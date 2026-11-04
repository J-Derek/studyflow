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
