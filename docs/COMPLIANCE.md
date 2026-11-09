# StudyFlow: privacy and children's-data research notes (DRAFT for a lawyer)

**Read this first.** I am not a lawyer, and this is not legal advice. These notes explain what the legal pages in the app are based on and,
just as important, **what I could not verify**. A Kenyan lawyer should confirm everything below before StudyFlow is promoted beyond a
small test group. The legal pages in the app carry a visible "draft" notice for the same reason.

Written 2026-11-09. Sources were web searches (law-firm summaries and regulator pages). The regulators' own PDFs and the Kenya Law
act text would not load as readable text in my tools, so **no section number or age threshold below was read from the primary text**
unless it says so.

## 1. What StudyFlow actually does with data (from the code)

| Data | Where | Who can see it |
|---|---|---|
| Google name, email, photo address (signed-in students) | Firebase Authentication (Google) | The student; the project owner through the Firebase console |
| Profile: name, university, programme, semester, time zone, optional chosen picture | Firestore `users/{uid}` | Only that student (rules) and the project owner via the console |
| Assignments, timetable, grades, notes, timer settings and focus sessions | Firestore `users/{uid}/...` | Same |
| PDFs attached to notes | This browser only (IndexedDB), never uploaded | The student on that device |
| Age answer (13 to 17, or 18 and over, and a guardian tick) | Device, then Firestore `users/{uid}.ageConfirmed` | Same as above |
| Ordinary server logs (IP address, browser, time) | Vercel, the host | Vercel |

- **Guests are stored too.** A guest is an anonymous Firebase account and their plan is synced to Firestore under it. If a guest clears the
  browser they lose access, but the stored records stay. **There is no automatic clean-up of abandoned guest data yet** (a real gap, see section 5).
- No advertising, no analytics, no tracking cookies, no third-party scripts except Google's own sign-in helper (verified in code on 2026-11-09).
- Firestore region: not recorded anywhere in the repository. The project owner must look it up in the Firebase console and say so in the privacy page.

## 2. Kenya (the main audience)

What I found (secondary sources, not the Act's text):
- The Data Protection Act, 2019 section 33 requires **parental or guardian consent before processing a child's personal data** (Clyde & Co and a
  school-focused commentary both say so). **I could not confirm the age that counts as a "child".** My understanding is that the Act points to the
  Children Act, which means **under 18**; I treated under 18 as children in the design. A lawyer must confirm.
- The Office of the Data Protection Commissioner (ODPC) published a Guidance Note for the Education Sector (December 2023) and a Guidance Note on
  Processing Children's Data (adopted 6 November 2025). I could not read either. A draft of the latter says age checks must be "proportionate, privacy
  preserving" and follow data minimisation, which is why StudyFlow asks only for an age band and a tick, not a birth date or ID.
- **Registration with the ODPC.** Small controllers (turnover under KES 5 million **and** fewer than ten staff) are exempt from mandatory registration, **except**
  for listed purposes where registration is required whatever the size. One law-firm source says the list includes education. **I could not confirm the
  list.** Whether a free study planner counts as "education", and whether StudyFlow must register, is the first question for the lawyer.
- Data subjects' rights (access, correction, deletion, objection, portability): the app gives download (Your account), edit (Edit profile) and delete (Delete my account).
  A written contact for requests is **missing** (section 5).

## 3. Other regimes (for students and visitors outside Kenya)

- **GDPR Article 8 (EU/EEA):** consent for an online service offered directly to a child needs a parent's authorisation below the national "digital age of
  consent", which each member state sets between 13 and 16 (default 16). StudyFlow does not target the EU, so this is for information.
- **United Kingdom:** the digital age of consent is 13; the ICO's Children's Code (Age Appropriate Design Code) lists 15 standards for services likely to be
  used by children (best interests, data minimisation, transparency, default privacy, no nudging, and so on). StudyFlow follows the spirit: minimal data,
  no profiling, no ads, nothing shared.
- **United States (COPPA):** services directed at children under 13, or that know a user is under 13, need verifiable parental consent before collecting personal data.
  The simple and safe route, which StudyFlow takes, is **not to create accounts for under-13s**; they can still use the app as a guest on their own device.

## 4. What the app does about it

1. **Age step before the first sign-in on a device** (`AgeGateDialog`): under 13 cannot create or link an account; 13 to 17 must tick that a parent or guardian
   knows and agrees; 18 and over continue. The answer is kept on the device and in the account (`ageConfirmed`), not a birth date. This is a **self-declaration**,
   not verification (anyone can tick any box); a lawyer should say whether that is enough for Kenya.
2. **Five pages**, each marked as a draft: Privacy, Terms, Children and parents, Storage on your device, Accessibility. Linked from the footer, Help and Your account.
3. **Delete my account** (Your account, signed-in students): asks them to sign in with Google again, deletes every collection under their user, the profile, and the sign-in
   account itself, then clears this device. A test (`e2e/account-deletion.spec.ts`) checks nothing is left in the emulator, and `src/services/accountDeletion.test.ts`
   fails if a new collection is added to `firestore.rules` without being added to the deletion list.
4. **Download my data** already existed (portability).
5. **No cookie banner:** the app sets no cookies. It uses the browser's local storage and IndexedDB only for what the student needs (their plan, theme, timer),
   which is generally treated as "strictly necessary" for a service the user asked for. The Storage page explains each key. A lawyer should confirm.

## 5. Open questions and known gaps (do these before promoting the app)

1. Does StudyFlow have to register with the ODPC, and does the under-18 rule need anything stronger than the tick?
2. Who is the **data controller** (Derek personally, a company)? The pages say "the StudyFlow project owner" and need a real name and contact address.
3. A contact address for privacy and security requests does not exist yet (also blocks `security.txt`).
4. The Firestore region must be looked up and stated.
5. Abandoned **guest** data is never deleted automatically. Options: a scheduled clean-up (needs Cloud Functions, not on the free plan) or a manual script run by the owner.
6. Guests have no "delete my data" button (only signed-in students do); an anonymous account cannot re-authenticate.
7. Retention wording ("until you delete it") should be confirmed against what the law expects for a study tool.
8. Cross-border transfer: data is processed by Google (Firebase) and Vercel, outside Kenya. A lawyer should confirm what the Act requires (consent or safeguards).
9. Terms of use: limitation of liability and governing law (Kenya) are placeholders.
