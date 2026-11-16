# App Check: switching it on safely

Why: StudyFlow signs every visitor in anonymously, and the Firebase web config is public by design. Without App Check, a
script can create guest accounts and write data without limit, and the owner pays for it (audit finding F2).

The code is ready (`app/src/lib/firebase.ts`): App Check starts only when `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is set, and
never against the local emulators. Nothing changes for students until these steps are done.

## Steps (owner, in this order)

1. **Create the reCAPTCHA Enterprise key.** Firebase console, project `studyflow-app-8f038`, Build, App Check, Apps, the
   web app, reCAPTCHA Enterprise, "Create a key in the Google Cloud console". Add the domains
   `app-beta-lilac-23.vercel.app` and `localhost`. Copy the **site key** (it is public, not a secret).
2. **Register it in App Check** with that site key (same screen), and save.
3. **Give the app the key.** Vercel project `app`, Settings, Environment Variables: `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` =
   the site key, for Production. Redeploy.
4. **Watch before enforcing.** Firebase console, App Check, APIs: Cloud Firestore and Authentication show "verified" vs
   "unverified" requests. Wait until nearly all recent requests are verified (a day of normal use), and sign in with real
   Google (popup and same-page) once.
5. **Enforce.** In App Check, enforce for Cloud Firestore, then for Authentication. If anything breaks, "Unenforce" undoes
   it at once.

## Also

- Set a budget alert: Google Cloud console, Billing, Budgets and alerts, for example $10 a month with email alerts.
- The Content-Security-Policy in `app/vercel.json` already allows Google's reCAPTCHA script and frame.
