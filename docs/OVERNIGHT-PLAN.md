# Overnight plan (autonomous run)

Approved by Derek: push branch `phase-4a-hardening` (never main, never merge), Vercel **preview** deploys only (never `--prod`), Firebase emulators only (CLI not logged in), full timer refactor.

## Rules for this run
- Every step ends green: `npx tsc -b`, `npm test`, `npm run test:rules`, `npm run test:e2e`, `npm run build`. Do not start the next step on red.
- One commit per logical change, message ends with the Co-Authored-By line. Stage only files I changed; never touch `scripts/`.
- Push after each finished step: `git push origin phase-4a-hardening`. Never force push. Never push `main`. Never merge.
- Log every step in `docs/OVERNIGHT-LOG.md`: what I ran, real output (counts), what failed, what I skipped and why.
- If blocked for more than two attempts, log it and move to the next step. Do not fabricate results.
- Verify before saying done: executed output only.

## Steps (in order)
1. **Push + CI read.** Push branch. Read GitHub Actions results (public API) and fix any CI-only failures (Linux paths, Java, Playwright deps).
2. **Timer refactor.**
   - Pure timer module `src/lib/timerEngine.ts`: state = `{ mode, status: idle|running|paused, startedAtMs, durationSec, remainingSecAtPause }`. Remaining time is always derived from timestamps, never decremented.
   - Scheduler outside React (`src/lib/timerScheduler.ts`): single interval/visibility/focus listeners, emits completion once.
   - Store keeps only the timer state; `FocusTimer.tsx` reads derived values.
   - Cloud sync to `liveState/timer` with `rev` compare-and-swap and `focusSessions/run-{rev}` batch on completion, matching `firestore.rules`.
   - Tests: engine unit tests (pause, resume, sleep gap, clock jump, completion once), rules test already exist, add emulator test for the client write path, Playwright test for two tabs.
3. **Leftovers.** Profile fields for semester start/end and timezone feeding `.ics`; verify guest warning appears after first saved deadline (fix if not); sync grades to Firestore with rules + tests.
4. **Accessibility.** Playwright + axe-core on every route, light and dark, desktop and 375px; keyboard-only walk; modal focus trap, Escape, aria labels; contrast fixes; timer announced to screen readers. Fix all serious/critical.
5. **Preview + Lighthouse.** `vercel deploy` (preview), Lighthouse mobile throttling on preview URL, fix top issues (bundle size, font loading, CLS). Verify 404 and rewrite behaviour on the preview.
6. **Close-out.** README and docs match reality (test counts, claims), final summary in `docs/OVERNIGHT-LOG.md`, push.

## Out of scope tonight
Production deploy, custom domain, rules deploy to the real Firebase project, merging, the five-student usability test.
