# 01 · Metadata and ASO

Everything for **App Information** and the **iOS App Version** page, ready to paste. Counts were checked by `_source/listing.py` (re-run it after any edit).

App facts this copy is built on, read from the code: Expo app "Klickers", bundle `in.co.klyra.eventshare`, version 1.0.0 (build 18), iPhone only (`supportsTablet` is not set, so no iPad screenshots are needed), light mode only, sign-in with email, Apple or Google, one-off event packages through RevenueCat (no subscriptions), API and photos in AWS Mumbai.

## Positioning

**Klickers is the shared disposable camera for events.** One QR code puts every guest on the same camera roll; the album fills up live, at original quality. The film-roll limit (shots per guest) is the emotional hook and the differentiator against "upload your photos here" gallery apps. Primary market India (wedding season, rupee pricing, Mumbai hosting), written in neutral international English so it ranks and converts everywhere.

- **Who searches:** couples and planners ("wedding photo sharing", "guest camera", "disposable camera app"), party hosts ("birthday photo album"), event and HR teams ("event photo sharing", "corporate event app").
- **Who converts:** hosts (they pay). Guests install because the host sends them, so the listing must reassure guests in the first screenshot (free, quick, live) and sell hosts by the last (control, design, packages).

## App Information

### App Name · **29/30 chars**

```text
Klickers: Event Photo Sharing
```

Brand plus the highest-volume head term, "event photo sharing". Alternative for an A/B Product Page Optimization test: `Klickers: Wedding Guest Camera` (30/30).

### Subtitle · **28/30 chars**

```text
Wedding & Party Guest Camera
```

Adds "wedding", "party", "guest" and "camera", the second most searched cluster. Alternative: `Shared camera roll for events` (29/30).

| Field | Value |
|---|---|
| Bundle ID | `in.co.klyra.eventshare` |
| SKU | `KLICKERS-IOS-001` |
| Primary category | **Photo & Video** |
| Secondary category | **Lifestyle** (not Social Networking: that invites stricter UGC review for no ranking gain) |
| Content rights | Contains third-party content: **No** (users add their own photos; you hold rights to all bundled art) |
| Privacy Policy URL | https://klickers.app/privacy |
| Age rating | See `02_privacy_pricing_availability.md` |

## iOS App Version page

### Promotional Text · **143/170 chars**

```text
Every guest's photos in one album: scan a QR, shoot your roll, watch the shared gallery fill up live. Find every photo you're in with a selfie.
```

Promotional text can change any time without a new build. Rotate it for wedding season ("Wedding season: one QR for every guest, every photo in one album.") and for corporate Q4 events.

### Keywords · **97/100 chars**

```text
disposable,qr,album,gallery,film,roll,birthday,bridal,reception,corporate,pics,video,memories,cam
```

Rules applied: no spaces after commas, no word that is already in the name or subtitle (Apple combines them: "wedding photo", "party camera", "event album" all still match), no plurals of words already used, no competitor or brand names.

**Second keyword field (free extra indexing):** add an **English (U.K.)** localization with the same name, subtitle and description and these keywords (96/100). In the India and U.K. storefronts both English localizations are indexed, which is where the Indian wedding terms earn their keep. Check Apple's current "storefronts and localizations" table before relying on it.

```text
sangeet,mehendi,shaadi,haldi,baraat,engagement,anniversary,babyshower,reunion,conference,offsite
```

### Description · **2759/4000 chars**

```text
Every photo, everyone's.

Klickers is the shared camera for weddings, parties and events. Guests scan one QR code, shoot their own roll, and every photo lands in one private album, live, at full quality. No more chasing friends for pictures the week after.

HOW IT WORKS
• The host creates the event in a minute: names, date, venue and a colour theme.
• Guests join free with a QR code, a link or a 6-digit code.
• Everyone shoots on their own roll, like a film camera, plus a short video and a voice message.
• Every shot appears in the shared album for everyone, as it's taken.

FOR GUESTS
• Your own roll of shots, so every photo feels intentional
• A live shared album with Everyone, Me and Mine views
• "Me": take a selfie to see every photo you're in. Optional, and you can turn it off anytime
• Save the original, or a framed copy with the event's names and date
• Out of shots? Ask the host for more in one tap

FOR HOSTS
• Design studio: colour themes, name fonts, cover photo, photo frames and a date stamp
• Review guest photos before they go live, or let them flow straight in
• Up to 3 designated photographers with a much bigger allowance
• Choose shots per guest and whether guests can add photos from their camera roll
• Approve shot top-ups, hide or remove photos, remove guests at any time
• Printable QR table cards, and invite links that open even without the app
• Download every original as a ZIP (Celebration and Branded Event)

ORIGINALS, NEVER COMPRESSED
Klickers keeps every photo exactly as the phone made it. The album shows quick previews; downloads are always the original.

PRIVATE BY DESIGN
• Albums are private to the people who joined the event
• No ads, no tracking, and we never sell your data
• Faceprints for "Me" are opt-in and deleted when you turn it off
• Delete your account anytime from your profile

PACKAGES: ONE PAYMENT PER EVENT, NOT A SUBSCRIPTION
Guests and photographers always join free. Hosts can try Klickers free with up to 10 guests, then upgrade that event once:
• Party: 75 guests, up to 24 shots each, gallery open 90 days
• Celebration: 200 guests, up to 50 shots each, 2 photographers, your own colours and fonts, download everything, gallery open 12 months
• Branded Event: 300 guests, 3 photographers, your logo, photo frames and photo approval

Moving to a bigger package charges only the difference. Packages are one-time in-app purchases charged to your Apple Account. Nothing renews and there is no subscription.

Made for weddings, receptions, sangeet and mehendi nights, birthdays, anniversaries, baby showers, reunions, trips, conferences, offsites and launches.

Questions? Write to support@klyra.co.in
Terms of use: https://klickers.app/terms
Privacy policy: https://klickers.app/privacy
```

Structure: emotional hook (line 1 shows above "more"), how it works, guests, hosts, quality, privacy, then plain package terms. No invented ratings or user numbers: add real press quotes or review counts once you have them, near the top.

### What's New in This Version · **522/4000 chars**

```text
Welcome to Klickers, the shared camera for your event.

• Create an event and invite guests with a QR code, link or 6-digit code
• Every guest gets their own roll, plus a video and a voice message
• One live album for everyone, at full original quality
• "Me": find every photo you're in with a selfie (optional)
• Design studio: themes, fonts, frames and your logo
• Review photos, add photographers, top up guests' shots
• One-time packages per event. Guests always join free

Tell us what you think: support@klyra.co.in
```


| Field | Value |
|---|---|
| Support URL | https://klickers.app/support |
| Marketing URL | https://klickers.app |
| Copyright | 2026 Klyra Innovations Private Limited |
| Version | 1.0.0 (build 18 or later) |
| Sign-in required | Yes, demo account in App Review (see `02_…`) |

> These URLs come from `apps/api/src/legal/legal.controller.ts` and `site/site.controller.ts`, served at klickers.app. Open each one in a browser before submitting.

## Screenshots and previews (upload order)

| # | File (`screenshots/iphone_6_9/`, same names in `iphone_6_5/`) | Headline | Job |
|---|---|---|---|
| 1 | `01_hero_1320x2868.png` | Every photo, *everyone's.* | The promise, on the real guest Home |
| 2 | `02_scan_to_join_1320x2868.png` | Scan the QR. *You're in.* | Panorama left: invite QR, camera crossing the seam |
| 3 | `03_shoot_live_1320x2868.png` | Shoot your roll. *It's live.* | Panorama right: the shot lands in the album |
| 4 | `04_one_album_1320x2868.png` | The whole night, *one album.* | Photos, video and voice notes |
| 5 | `05_find_me_1320x2868.png` | Find every photo *you're in.* | "Me" face search, opt-in |
| 6 | `06_design_studio_1320x2868.png` | Make it look like *your day.* | Themes, fonts, frames |
| 7 | `07_host_control_1320x2868.png` | You stay *in control.* | Review queue, photographers |
| 8 | `08_packages_1320x2868.png` | Guests join free. *Always.* | Packages, no subscription |

Slides 2 and 3 are one picture cut in half, so keep them next to each other. Upload the App Preview video first in each slot; it plays before screenshot 1.

The photos inside the screens are illustrations in the app's own style (from `assets/images/welcome`). When you have real, consented event photos, swap them into `_source/photos.js` and run `node render-stills.mjs`: the screenshots convert better with real faces and real light.

## Localization notes

- **English (U.S.)**: primary, as above.
- **English (U.K.)**: same copy, the Indian wedding keyword set above. British spelling already used ("colour").
- **Hindi (next)**: translate the subtitle and promotional text first (`शादी और पार्टी का साझा कैमरा` style); keep the name in Latin script. Hindi screenshots only need the headlines re-typed in `_source/screenshots.html`.
- Prices show in the store's own currency in the app (the Packages screen reads the StoreKit price), so no copy changes per country.

## Custom Product Pages (suggested)

| CPP | Hero banner | Screenshot order | Keywords to target in Search Ads |
|---|---|---|---|
| Weddings | `editorial_and_search_banners/cpp_hero_weddings_1600x900.png` | 1, 2, 3, 5, 6, 4, 7, 8 | wedding photo sharing, wedding guest camera, sangeet, mehendi |
| Corporate | `cpp_hero_corporate_1600x900.png` | 7, 2, 3, 4, 6, 8, 1, 5 | event photo app, conference photos, corporate event |
| Birthdays and parties | `cpp_hero_birthdays_1600x900.png` | 3, 1, 4, 2, 5, 8, 6, 7 | birthday photo album, party camera, disposable camera |
