# Prompt for the next chat (copy everything in the block below into a fresh Claude Code chat opened in this repo)

```
You are continuing work on StudyFlow, a React 19 + Vite + Zustand + Firebase study planner for students, in this repo
(C:\Users\Jiva\Documents\Freelance\studyflow). I am Derek, the owner.

START BY READING, in this order, before you touch anything:
1. docs/HANDOFF.md, section "000. START HERE" at the very top. It is the current state, what waits on me, and the ordered
   plan for the remaining work (11 items, each with effort, what to build, files and risks).
2. The rest of docs/HANDOFF.md as needed (sections 3 "Rules of engagement", 5 "Commands", 8 "Decisions and lessons" matter most).
3. The independent audit that produced the plan (13 findings F1 to F13): https://claude.ai/artifact/Ajvh1nbyzJvnUax2U4N9H3
   Treat it as leads; the code on `main` is the truth.

Then run, to see what changed since the handoff was written:
   git fetch origin; git log --oneline -8 origin/main; "C:\Program Files\GitHub CLI\gh.exe" pr list --repo J-Derek/studyflow --state all --limit 8

WHAT TO DO: work through the plan in docs/HANDOFF.md section 000 "Remaining engineering work", in order. Items 1 (rules require
the archived flag, PR #27) is done. Start at item 2 (week workload warning), then 3 (recurring deadlines), 4 (grading scale),
5 (field-level writes), and so on. One branch and one PR per item, each from the latest origin/main. Skip any item marked as
blocked on me (reminders need my decisions first) and tell me why.

HOW TO WORK (all of this is in HANDOFF.md, the short version):
- Write the failing test first, then the fix, and prove the test fails on the old code.
- Checks for every PR, from app/: tsc (npx tsc -p tsconfig.app.json --noEmit), npx vitest run, npm run lint, npm run build, the full
  e2e (npx firebase emulators:exec --config ../firebase.json --only auth,firestore --project studyflow-e2e "npx playwright test",
  about 13 minutes, run it in the background), the prod suite, and npm run test:rules if rules change.
- Known flaky specs are listed in HANDOFF.md. If CI fails on one and it passes locally, re-run the failed job
  (gh run rerun <id> --failed) instead of merging over a red X.
- Files here use CRLF. Edit with a small Python script that preserves line endings, never `sed -i`, and check `git diff --stat`.
- Stage only your own files. NEVER stage anything under scripts/ or the untracked promo-video/ folder (not ours).
- Run `git branch --show-current` before every commit, and after every push confirm it with `git ls-remote origin refs/heads/<branch>`.
- gh is at "C:\Program Files\GitHub CLI\gh.exe". If `gh auth status` says the token is invalid, ask me to run `gh auth login`.
  Push with: git -c credential.helper= -c 'credential.helper=!"/c/Program Files/GitHub CLI/gh.exe" auth git-credential' push -u origin <branch>

WHAT YOU MUST NOT DO WITHOUT ME SAYING SO IN CHAT:
- Merge a PR, push to main, or deploy rules. (Vercel deploys the app automatically when something merges to main.)
- Firestore rules deploy by hand, BEFORE the app that needs them:
  npx firebase deploy --config ../firebase.json --only firestore:rules --project studyflow-app-8f038   (run from app/)
  The CI secret FIREBASE_SERVICE_ACCOUNT is not set, so CI cannot do it. Any PR that changes firestore.rules must say so in its description.
- Create or hold production keys or service accounts, or turn on App Check enforcement (steps are in docs/APP-CHECK.md and are mine).

WHEN YOU FINISH A PR: open it with gh, put what/why/checks/deploy-order in the description (end it with
"🤖 Generated with [Claude Code](https://claude.com/claude-code)"), and tell me. At the end of the session, update the status table
in docs/HANDOFF.md section 000 (mark items done, note anything learned) in the last PR, and keep the memory note in sync.

First message back to me: a short summary of what you found in the handoff, which item you are starting, and any question for me.
```
