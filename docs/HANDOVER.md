# Handover: what a new owner receives, and in what order

This is the checklist for selling or handing over StudyFlow. It lists every account the app depends on, what to prepare before a sale, and the order to transfer things so the live app never breaks and nobody gets access before payment is secured.

**Golden rule:** nothing in section 3 starts until the escrow service (for example Escrow.com) confirms the buyer's money is held. Never send passwords or two-step codes; invite the buyer to each account, then remove yourself.

## 1. What StudyFlow runs on

| Piece | Where | Identifier | Cost today |
|---|---|---|---|
| Source code | GitHub | `J-Derek/studyflow` (private) | Free |
| Website hosting | Vercel | project serving `app-beta-lilac-23.vercel.app`, root folder `app`, auto-deploys from `main` | Free (Hobby) |
| Sign-in and database | Firebase (Google Cloud) | project `studyflow-app-8f038` | Free (Spark plan) |
| Database location | Cloud Firestore | `(default)` database, location `nam5` (United States multi-region) | |
| Google sign-in | Firebase Authentication | Google provider; authorised domains include the Vercel address | |
| Browser key | Google Cloud Console, *APIs and Services, Credentials* | the "Browser key" used by the web app | |
| App Check (optional) | Firebase App Check with reCAPTCHA Enterprise | off until `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is set in Vercel (PR #26) | |
| Domain | none yet | the app lives on a `vercel.app` address | |

The Firebase web settings are written into `app/src/lib/firebase.ts` as defaults, and any `VITE_FIREBASE_*` variable set in Vercel (Project, Settings, Environment Variables) overrides them. They are public web settings, not secrets. If the Firebase project itself is handed over (section 3), they stay as they are; if the buyer moves to a new Firebase project, they must change them.

## 2. Before listing

- [ ] **User numbers.** Firebase console, *Authentication*, *Users*: the count at the bottom of the list is the number of accounts (guests included; the "Providers" column tells Google sign-ins from anonymous ones). Take a dated screenshot with the emails hidden. Do not export the list: it contains students' emails.
- [ ] **Running cost.** Firebase console, *Usage and billing*, and Vercel, *Usage*: note the monthly figure (expected to be zero on the free plans).
- [ ] **Legal pages.** Fill the contact address in `app/src/legal/privacy.md`, `terms.md`, `children.md` and `accessibility.md`, and have a lawyer read `terms.md` (see `docs/COMPLIANCE.md`).
- [ ] **ODPC registration** (Kenya's data regulator). Its FAQ lists "provision of education" among purposes that must register whatever the size; the small-business fee was KSh 4,000 when checked on 2026-11-17 ([odpc.go.ke/faqs](https://www.odpc.go.ke/faqs/)). Decide with the lawyer.
- [ ] **Students' data.** Decide one of: (a) sell the app with an empty database, after telling users and giving them time to download or delete their data; or (b) transfer the data only if the privacy page told users this could happen and they had a chance to leave. Today's privacy page promises "no selling or sharing of your data", so (a) is the honest default.
- [ ] **Database safety.** Turn on delete protection for the Firestore database (Google Cloud Console, *Firestore*, database settings). It is off today.
- [ ] **Image origins.** Confirm where `og.png` and `hero.png` came from (`THIRD-PARTY-NOTICES.md`).
- [ ] **Demo.** Record a two-minute walkthrough of the live app using an example account, not a real student's.

## 3. Transfer order (after escrow confirms the money)

1. **GitHub.** Repository *Settings*, *General*, *Danger Zone*, *Transfer ownership* to the buyer's account. Keep a local copy until the sale closes.
2. **Firebase / Google Cloud.** Google Cloud Console, *IAM and Admin*, *IAM*: add the buyer as **Owner** of `studyflow-app-8f038`. When they confirm they can open the Firebase console, remove yourself. If they want the project under their own billing account, they link it themselves.
3. **Vercel.** Project *Settings*, *General*, *Transfer Project* to the buyer's Vercel account or team. The address `app-beta-lilac-23.vercel.app` moves with it.
4. **Domain** (if one was bought): unlock it and send the transfer code through the escrow service's messages, never by chat.
5. **Their checks.** The buyer signs in on the live app, deploys the Firestore rules from the repository (below) and runs the tests. Then they release the escrow.

## 4. Running it (for the new owner)

From `app/`:

```bash
npm install
```

```bash
npm run dev
```

Checks: `npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run`, `npm run lint`, `npm run build`, `npm run test:rules`, and the browser tests under the Firebase emulators (see `README.md`).

Firestore rules deploy by hand, before the app version that needs them:

```bash
npx firebase deploy --only firestore:rules --config ../firebase.json --project studyflow-app-8f038
```

Read these first: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/COMPLIANCE.md`.

## 5. What is not finished

- No custom domain.
- No analytics or payment system (by design so far).
- App Check is built but off (PR #26) until a reCAPTCHA Enterprise key is set.
- The browser key's website restrictions should be confirmed in Google Cloud Console.
- Legal pages are drafts until the contact address is added and a lawyer has read them.
