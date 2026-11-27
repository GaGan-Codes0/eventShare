# 02 · Privacy, pricing, availability, age rating and App Review

Audited from the code on branch `pre-prod` at build 18: `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/src/**`, `apps/api/src/**`, and the published privacy policy (`apps/api/src/legal/legal.controller.ts`, updated 18 November 2026). Everything below matches that policy, which is what App Review compares the label against.

## 1. What the app actually sends off the phone

| Data | Where in code | Leaves the device to | Kept for |
|---|---|---|---|
| Name, email, password hash | `app/sign-in.tsx`, `features/auth/*`, `api/src/auth` | Klickers API (AWS Mumbai) | Until account deletion |
| Apple / Google sign-in identity (name, email) | `apple-sign-in.tsx`, `google-sign-in.tsx` | Apple / Google, then the API | Until account deletion |
| Photos and videos (originals, **EXIF kept, including GPS** if the camera wrote it) | `features/uploads/queue.ts`, ROADMAP decision 2026-11-02 | S3 Mumbai, served via CloudFront | While the event's package keeps it open |
| Voice notes | `features/capture/voice-recorder.tsx` | S3 | Same as photos |
| Event details, cover, logo, frame, likes, invitee name and email typed by a host | `create-event.tsx`, `(tabs)/design.tsx`, `(tabs)/people.tsx` | API, S3; invite emails via Resend | Same as the event |
| **Faceprints** (numeric face embeddings), opt-in | `features/faces/*` (on-device ONNX models), `api/src/faces` (pgvector) | API database | Until Me is turned off, the person leaves, or the host turns it off |
| Purchase records (product, transaction id) | `features/purchases/store.ts`, `api/src/purchases` | Apple, RevenueCat (app user id = Klickers user id), API | Account lifetime |
| User ID | RevenueCat `appUserID`, JWT | RevenueCat, API | Account lifetime |
| Server logs (IP, time) | API / Caddy | AWS | Up to 30 days, security only |

**Not present:** no analytics or crash SDK (no Firebase, Sentry, Mixpanel, Amplitude, PostHog), no ads SDK, no IDFA, no App Tracking Transparency prompt needed, no push notifications, no contacts access, no location permission. `@clerk/expo` is installed and listed as a config plugin but its code is commented out, so it collects nothing; removing it before release is tidier.

## 2. App Privacy answers (App Store Connect › App Privacy)

**Do you or your third-party partners collect data from this app?** Yes.

**Data Used to Track You:** none. Answer **No** to tracking for every type below.

**Data Linked to You** (all: purpose **App Functionality** only; linked: **Yes**; tracking: **No**)

| Apple category | Data type | Why it's declared |
|---|---|---|
| Contact Info | **Name** | Account name shown on shared photos; invitee names a host enters |
| Contact Info | **Email Address** | Sign-in, invitations |
| User Content | **Photos or Videos** | The product |
| User Content | **Audio Data** | Voice notes and video sound |
| User Content | **Other User Content** | Event details, covers, logos, frames, likes |
| Sensitive Info | **Sensitive Info** (biometric faceprint, opt-in "Me") | Apple counts biometric data here. Declare it even though it's optional |
| Location | **Precise Location** | Originals keep their GPS EXIF and anyone in the event can download them; the privacy policy says so |
| Identifiers | **User ID** | Account id, also used as the RevenueCat app user id |
| Purchases | **Purchase History** | Which package each event bought |

**Data Not Linked to You:** none.

**Data Not Collected** (leave unticked): Health and Fitness, Financial Info (Apple takes payment), Physical Address, Phone Number, Other Contact Info, Contacts, Coarse Location, Browsing History, Search History, Device ID, Product Interaction, Advertising Data, Other Usage Data, Crash Data, Performance Data, Other Diagnostic Data, Other Data Types.

Notes:
- The 30-day server logs are kept for security only and are not tied to a data type Apple lists; most apps without analytics do not declare them. If you want zero ambiguity, add **Other Diagnostic Data → App Functionality, Linked**.
- If you later add Sentry (it's on the roadmap, Stage 8), add **Crash Data** and **Performance Data** (App Functionality, Linked or Not Linked depending on whether you attach user ids).
- If you strip GPS from uploads one day, remove Precise Location and update the policy in the same release.

**Privacy manifest:** `app.json` has no `ios.privacyManifests`. Expo and RevenueCat ship their own `PrivacyInfo.xcprivacy`, but Apple also checks the app's own use of required-reason APIs (UserDefaults, file timestamps, system boot time). Add an app-level manifest in `app.json` › `ios.privacyManifests` (Expo docs: "Privacy manifests") before you upload the release build, or App Store Connect emails a warning (ITMS-91053).

## 3. Age rating questionnaire (2025 questionnaire)

| Question | Answer |
|---|---|
| Parental controls | No |
| Age assurance | No |
| Unrestricted web access | No |
| User-generated content | **Yes** |
| Messaging and chat | No (voice notes are posted to the shared album, not sent privately) |
| Advertising | No |
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Prolonged graphic or sadistic violence | None |
| Profanity or crude humor | None |
| Mature or suggestive themes | None |
| Horror or fear themes | None |
| Medical or treatment information | None |
| Alcohol, tobacco or drug use or references | None |
| Simulated gambling | None |
| Sexual content or nudity | None |
| Graphic sexual content and nudity | None |
| Contests | No |
| Gambling | No |
| Loot boxes | No |
| Health or wellness topics | No |
| Made for Kids | **No** (the privacy policy says Klickers is not meant for under 13) |

Apple computes the rating from these answers; expect a low teen rating because of user-generated content. Do not override it downward.

## 4. Pricing and availability

| Setting | Choice | Why |
|---|---|---|
| Price | **Free** | Revenue is per-event packages (see `03_…`) |
| Base country | India | Matches the in-app rupee prices |
| Availability | **All countries and regions except China mainland** | Apps in China mainland need an ICP filing number; add it later if you file one |
| Pre-order | Off | |
| Distribution | Public, App Store | |
| iPhone and iPad apps on Apple silicon Mac | **Off** | Camera-first and QR scanning; a Mac listing would draw bad reviews |
| Apple Vision Pro | Off | |
| Export compliance | Answered by `ITSAppUsesNonExemptEncryption: false` in `app.json` (HTTPS only) | |
| Content rights | No third-party content | |
| Tax category | App Store software (default) | |

## 5. App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** |
| User name | `[REVIEW_EMAIL e.g. appreview@klyra.co.in]` |
| Password | `[REVIEW_PASSWORD]` |
| Contact first / last name | `[FIRST] [LAST]` |
| Contact phone | `[+91 PHONE NUMBER]` |
| Contact email | support@klyra.co.in |
| Attachment | Optional: `app_previews_video/app_preview_6_9_886x1920.mp4` |

**Set up the demo account before you submit** (on production, not pre-prod):

1. Create `appreview@…` with a password, and sign in once in the release build.
2. As that account, create **"App Review Wedding"** dated inside the review window (today to +5 days). Leave it on Free so a purchase can be tested.
3. As a second account, create a guest-side event with 15–20 photos, one video and one voice note, dated today. Put its 6-digit code in the notes as `[GUEST_JOIN_CODE]`.
4. Keep both events' camera windows open for the whole review (event day + 48 h; move the date if review slips).

**Review notes** (2,400 / 4,000 chars, paste as is after filling the two placeholders):

```text
Thank you for reviewing Klickers, a shared camera for events (weddings, parties, conferences).

SIGN-IN
Use the demo account below (email + password on the sign-in screen). Sign in with Apple is also available. Account deletion: Profile > Delete account.

DEMO EVENTS ON THIS ACCOUNT
1) "App Review Wedding" (the reviewer is the HOST, Free package). Shows the host tabs: Overview, Gallery, Camera, Design, People. Its date is set to the review window, so the camera is open.
2) To test as a GUEST: tap Join > Enter code and type [GUEST_JOIN_CODE]. This event already has sample photos, a video and a voice note.

CAMERA WINDOW
Guests can shoot on the event day and for 48 hours after it; hosts and photographers can shoot any time before that. Both demo events are dated inside your review window. If the camera says it is closed, open event 1 as the host.

IN-APP PURCHASES (consumable, one per event, no subscriptions)
Event 1 > Overview > Upgrade (or Design/People lock pills) opens Packages. Products: in.co.klyra.eventshare.party / .celebration / .branded, plus upgrade products (e.g. .party_to_celebration) that charge only the difference for an event already on a paid package. "Restore purchases" re-applies a payment that was made but not yet applied to the event (handled server-side through RevenueCat).

"ME" (FACE MATCHING) - OPTIONAL
Album > Me > "I agree, take a selfie". After explicit consent, the phone turns faces into a numeric faceprint used only to show this person the photos they appear in within that one event. Faceprints are never used outside the event, never shared or sold, and are deleted when the user turns Me off, leaves the event, deletes their account, or the host turns Find my photos off. This is described in the privacy policy (https://klickers.app/privacy).

USER-GENERATED CONTENT
Albums are private and invite-only. Hosts moderate their event: review guest photos before they appear (Rules > Review guest photos first), hide or delete any photo, and remove any guest. Users can delete their own photos. Our terms forbid objectionable content and we remove it, and the accounts that post it, when reported to support@klyra.co.in.

PERMISSIONS
Camera (photos/videos, QR scan), microphone (video sound and voice notes), photo library (add photos to an event; save photos you download). All requested only when the feature is used.

Contact: support@klyra.co.in
```

## 6. First-submission risk check

| Guideline | Status in the code | Action |
|---|---|---|
| **1.2 User-generated content** | Hosts can review, hide and delete photos and remove guests. **Guests have no in-app "Report" or "Block"** (no report/flag code anywhere in `apps/mobile/src`). | **Highest risk.** Add a "Report photo" action in the photo viewer (emails or posts to support) and "Hide this person's photos" for guests before submitting. The review note explains host moderation, which sometimes passes for private, invite-only albums, but don't rely on it. |
| 2.3.3 Accurate screenshots | Screens rebuilt from real code with real copy; photos are illustrations | Fine. Swap in real photos when you have them |
| 2.3.4 App Previews | Preview is rendered from recreated screens | Prefer a Simulator capture with this soundtrack (see `app_previews_video/STORYBOARD_AND_SCRIPT.md`) |
| 3.1.1 In-app purchase | StoreKit via RevenueCat, Restore purchases present | Fine. Six consumables submitted with the build |
| 3.1.2 Subscriptions | None | Nothing to do |
| 4.8 Login services | Google sign-in offered, Sign in with Apple present (`usesAppleSignIn: true`) | Fine |
| 5.1.1(v) Account deletion | Profile > Delete account (`app/profile.tsx`) | Fine |
| 5.1.1 Permission strings | Camera, microphone, photos, save-photos strings set in `app.json` and say why | Fine |
| 5.1.2 Face data | Opt-in with explicit "I agree", purpose-limited, deletable, in the policy | Fine; keep the review note |
| Privacy manifest | No app-level manifest | Add `ios.privacyManifests` (see above) |
| Links | Privacy, terms and support served by the API at klickers.app | Open each in Safari before submitting |
