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
