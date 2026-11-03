# eventShare — Build Roadmap

We build in stages. Each stage ends with something you can run and test on the simulator before we move on.

| Stage | What | Status |
|---|---|---|
| 0 | Dev environment + open in Xcode | ✅ |
| 1 | App shell & navigation | ✅ |
| 2 | Sign in | ✅ own email + password (argon2id, 30-day JWT, rate-limited). Clerk code kept but commented out |
| 3 | Backend foundation | ✅ |
| 4 | Events: create, join, members | ✅ code + QR + link; remove guest; reset code. Contact invites later |
| 5 | Camera + reliable upload | ✅ simulator-verified; camera capture + background upload need a real phone |
| 6 | Shared gallery | ✅ 15 s refresh; live (WebSocket) updates later |
| 7 | Downloads & albums | ⬜ |
| 8 | Hardening | ⬜ |
| 9 | AWS deploy & beta release | ⬜ |

---

## Stage 0 — Dev environment + open in Xcode
**Build:** point command-line tools at Xcode, install CocoaPods, set the iOS bundle ID, generate the native iOS project (`expo prebuild`), open `ios/eventShare.xcworkspace` in Xcode.
**Test:** the starter app launches in the iPhone simulator, from both Xcode (▶ Run) and `npx expo run:ios`.
**Note:** `ios/` is generated from `app.json`, so native settings change there, not by hand in Xcode.

## Stage 1 — App shell & navigation
**Build:** remove the template screens. Create the real screen skeletons: Welcome, My Events, Event (Gallery / Members / Settings tabs), Camera, Profile. Set up the theme and basic UI components.
**Test:** tap through every screen in the simulator, in light and dark mode.

## Stage 2 — Sign in (Clerk)
**Build:** Clerk app + publishable key, native sign-in screen (email code, Google, Apple), signed-out users locked out of the app, sign out.
**Test:** sign up, close the app, reopen it (still signed in), sign out, sign back in.

## Stage 3 — Backend foundation
**Build:** `apps/api` (NestJS) + Postgres and Redis running locally (Docker), database migrations, Clerk token verification on every request, `users` table synced from Clerk, shared types package.
**Test:** the app calls `GET /me` and shows your profile from our own database.

## Stage 4 — Events: create, join, members
**Build:** create event, My Events list, one link + QR per event, join via link / QR / invite, members list with roles, host can remove attendees and rotate the link.
**Test:** two simulators with two users: user A creates the event, user B joins by link, then the host removes user B.

## Stage 5 — Camera + reliable upload ⭐ core
**Build:** in-app camera, pick from gallery, a persistent on-device upload queue, direct upload to S3 with presigned URLs (original file byte-for-byte), retries, `client_upload_id` to prevent duplicates.
**Test:** take photos with Wi-Fi off and turn it back on, kill the app mid-upload, then reopen. Every photo uploads exactly once, at full quality.

## Stage 6 — Shared gallery
**Build:** thumbnails made on the phone (originals untouched, including EXIF/GPS location: decided 2026-11-02), paginated gallery grid, full-screen viewer, live "new photo" updates, uploader deletes own photos, host hides/removes any photo.
**Test:** user A takes a photo and user B sees it within seconds; delete and hide permissions behave correctly.

## Stage 7 — Downloads & albums
**Build:** save the original to the phone, "download all" as a background zip job, albums for organising.
**Test:** downloaded file is identical to the uploaded original (same size / checksum).

## Stage 8 — Hardening
**Build:** rate limits, audit log, soft-delete with a 30-day purge, push notifications, Sentry crash reporting, automated tests + CI.

## Stage 9 — AWS deploy & beta release
**Build:** staging + production on AWS Mumbai (S3, RDS Postgres, Redis, API, worker), backups, EAS builds, TestFlight and Play Store internal testing.
**Test:** real phones at a real (small) event.
