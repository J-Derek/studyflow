# Later (ideas not built yet)

Ordered roughly by how much a student would notice. Nothing here is promised; each needs a decision first.

## 1. Reminders and notifications
- **No-backend first step:** put deadlines into the student's own calendar app with alarms (the timetable
  `.ics` export already exists; add assignments with a reminder before the due time). Works when the app is closed.
- **While the app is open:** a "due tomorrow" banner or browser notification. Cheap, but only works with a tab open.
- **Real push notifications** (phone buzzes when the app is closed): needs a service worker, Firebase Cloud
  Messaging and a scheduled Cloud Function. Cloud Functions need the paid Firebase (Blaze) plan with a card on file.

## 2. Notes tab: lecture files and notes (the big one)
What a student wants: collect the lecturer's notes and slides in one orderly place, per course, and keep them.
- **Typed notes per assignment** are done (the notes box on each assignment).
- **Uploading files (PDF, slides, photos)** needs file storage. Firebase Storage now requires the paid Blaze plan,
  plus new security rules, size limits per student, and a plan for abuse (anyone can upload anything).
- **Cheaper options to decide between:** (a) text-only course notes stored in the database (no files);
  (b) let students attach a link to Google Drive / OneDrive instead of uploading; (c) paid storage with a
  per-student limit (say 25 MB) and rules that only the owner can read it.
- Privacy: uploaded lecture material may be copyrighted. The privacy note would need to say who can see it (only the owner).
