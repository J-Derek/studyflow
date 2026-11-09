# StudyFlow: security notes

**Status:** rewritten 2026-11-09. The earlier version described a PostgreSQL/Supabase design that StudyFlow never shipped; it is
gone. This file describes what the app does **now** (Firebase Auth + Firestore, hosted on Vercel), and every row names the test that
proves it. If a row has no test, it says so. Nothing here is a certification or a legal compliance claim.

Commands (from `app/`): `npm test` (unit), `npm run test:rules` (rules, needs the emulator), `npm run test:e2e` and
`npm run test:e2e:prod` (browser, need the emulators). CI runs all of them on every push.

## 1. How it is built

- The browser talks **directly** to Firebase: Auth (guest sign-in first, Google when the student chooses) and Firestore. There is no
  server of ours in between, so **`firestore.rules` is the only thing that decides who can read or write what**.
- Everything the app stores for a student lives under `/users/{uid}/...`. The rules allow a request only when
  `request.auth.uid == uid`, and deny every other path.
- Vercel only serves the static site (and forwards `/__/auth/*` to Firebase so Google sign-in can happen on the same page).
- No analytics, no ads, no third-party scripts besides Google's own sign-in helper.

## 2. What is enforced, and where it is tested

| # | Risk | What stops it | Proof |
|---|---|---|---|
| 1 | One student reads or changes another's records | Owner-only rules on every path; unmapped paths and listing `/users` denied | `app/rules-tests/rules.test.ts` → "tenancy" |
| 2 | Writing fields that should not exist, or wrong types (for example `isAdmin`, progress 9999) | Every document type has a validator with `hasAll` and `hasOnly` key lists, types, lengths and ranges | `rules.test.ts` → "assignments: shape", "notes", "grades", "sessions", "user profile" |
| 3 | Forged "last changed" times | `updatedAt` must equal the server clock; `id` and `createdAt` cannot change afterwards | `rules.test.ts` → "timestamps and updates" |
| 4 | Giant records or unbounded lists | Length and count limits in the rules (mirrored in `src/utils/limits.ts`); list queries must carry `limit <= 500` | `rules.test.ts` → "list queries are capped"; `src/utils/limits.test.ts` |
| 5 | Faked study sessions (finish a 25-minute block in 5 seconds) | `focusSessions` can only be created in the same write that moves the timer from running to idle, and only after enough **server** time has passed | `rules.test.ts` → "focusSessions: forged creation is blocked" |
| 6 | Two tabs or devices updating the timer at once | Compare-and-swap counter (`rev` must go up by exactly one) | `rules.test.ts` → "timer state ... compare-and-swap" |
| 7 | One student's data showing up for the next person on a shared computer | Sign-out wipes the saved copy, the offline cache and the PDFs on this device; a different account on the same browser triggers the same wipe; another open tab is cleared too | `e2e/account-isolation.spec.ts` (sign out, direct switch, sign-out in another tab) |
| 8 | A guest's work lost or leaked when they sign in | Linking keeps the same uid; signing in to an existing account **adds** the guest's records and never overwrites existing ones | `account-isolation.spec.ts` (link, credential-already-in-use merge); `firestoreSync.test.ts` |
| 9 | Script injection through what a student types (titles, notes, course names) | React escapes everything; the app has no `innerHTML` or `dangerouslySetInnerHTML`; links in notes are only made clickable for `http://` and `https://` | `src/utils/linkify.test.ts`; **no automated scan for `innerHTML`: a code search on 2026-11-09 found none** |
| 10 | Malicious backup files | The restore code validates every field, caps the size, strips unknown keys, and refuses `__proto__` tricks | `src/utils/backupHostile.test.ts`, `backupValidator.test.ts` |
| 11 | Calendar (`.ics`) file injection | Text is escaped per RFC 5545 | `src/lib/icalExport.test.ts` |
| 12 | Impossible values arriving from the cloud (a score of 8585 written with the student's own token) | The rules cannot check every item inside a list, so grades read from the cloud are clamped to 0-100 | `firestoreMappers.test.ts`; `e2e/grades-cloud-clamp.spec.ts` |
| 13 | A stolen or injected script phoning home | `Content-Security-Policy-Report-Only` header (see section 3) | `src/utils/csp.test.ts`; `e2e-prod/csp.spec.ts` |
| 14 | A student cannot remove their data | "Delete my account" asks Google to re-confirm, deletes every collection, the timer and the profile in batches, then the sign-in account, then clears the device. A unit test fails if `firestore.rules` gains a collection that the deletion list does not name | `e2e/account-deletion.spec.ts`; `src/services/accountDeletion.test.ts` |
| 15 | A child under 13 gets an account, or a 13-17 year old without the parent tick | An age question before sign-in (self-declaration, not verification); the rules refuse to store "under 13" and refuse 13-17 without the guardian tick | `e2e/age-gate.spec.ts`; `rules.test.ts` → "ageConfirmed" |
| 16 | Other browsers framing the site, content sniffing | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` in `app/vercel.json`; Vercel adds HSTS | Header values read from `vercel.json` and the live site on 2026-11-09 (`curl -sI`); **no automated test** |

## 3. Content-Security-Policy

Shipped as **report-only**: the browser logs violations in the console and blocks nothing, because a slightly wrong enforcing policy
would stop Google sign-in for everyone and real Google sign-in cannot be tested automatically. `e2e-prod/csp.spec.ts` runs the production
build with the same policy **enforced** and finds no violation on the main screens, a note with a PDF, emulator sign-in and the account
dialog. To make it enforcing: confirm with the console open (F12) during a real Google sign-in that nothing starts with
"[Report Only] Refused to ...", then rename the header to `Content-Security-Policy` in `app/vercel.json`.
The one inline script (the theme, in `index.html`) is allowed by hash; `csp.test.ts` fails if it is edited without refreshing the hashes.

## 4. Where the data lives on a device

- `localStorage` key `studyflow_storage_v1`: the plan (assignments, timetable, grades, notes), the timer, who the data belongs to.
- `localStorage` keys for the theme and the sidebar: harmless preferences that survive sign-out on purpose.
- IndexedDB: Firebase's offline cache of the signed-in account, and **PDFs attached to notes, which never leave the device**.
- Sign-out and switching accounts remove all of it except the harmless preferences (`account-isolation.spec.ts`).

## 5. Known limits (honest list)

- **Guests cannot delete their data from the app** (an anonymous account cannot re-confirm with Google), and abandoned guest records are never cleaned up automatically. See `docs/COMPLIANCE.md`.
- **No security.txt yet.** It needs a contact address that Derek chooses; until then there is no published way to report a problem.
- **No automated header test against the live site**, and no automated search for dangerous HTML APIs (row 9, 14).
- **Guest accounts are anonymous Firebase users.** Anyone can create one; the rules treat them like any other owner of their own data,
  and the limits in section 2 apply. There is no rate limiting beyond Firebase's own quotas (no paid plan, so no Cloud Functions or App Check).
- The Firestore API key in the page is a public identifier, not a secret; the rules are what protect the data.
- A real Google sign-in is only ever tested by hand (the automated tests use the Firebase emulator).
- The privacy, terms, children, storage and accessibility pages are **drafts** that no lawyer has checked, and they still need a real contact address (`docs/COMPLIANCE.md`, section 5).
- The age question is a self-declaration. Anyone can tick any box.

## 6. Reporting a problem

There is no published contact yet (see section 5). Until there is, tell the project owner directly and do not post details publicly.
