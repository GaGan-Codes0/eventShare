"""Writes 01_metadata_and_aso.md and 03_subscriptions_and_iap.md from listing.json,
so every pasted field and its character count come from the same checked source."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
d = json.load(open(os.path.join(HERE, 'listing.json')))
F, IAPS = d['fields'], d['iaps']

def block(k):
    f = F[k]
    lim = f" · **{f['count']}/{f['limit']} chars**" if f['limit'] else ''
    return f"### {f['label']}{lim}\n\n```text\n{f['text']}\n```\n"

UK_KW = 'sangeet,mehendi,shaadi,haldi,baraat,engagement,anniversary,babyshower,reunion,conference,offsite'
assert len(UK_KW) <= 100

md = f"""# 01 · Metadata and ASO

Everything for **App Information** and the **iOS App Version** page, ready to paste. Counts were checked by `_source/listing.py` (re-run it after any edit).

App facts this copy is built on, read from the code: Expo app "Klickers", bundle `in.co.klyra.eventshare`, version 1.0.0 (build 18), iPhone only (`supportsTablet` is not set, so no iPad screenshots are needed), light mode only, sign-in with email, Apple or Google, one-off event packages through RevenueCat (no subscriptions), API and photos in AWS Mumbai.

## Positioning

**Klickers is the shared disposable camera for events.** One QR code puts every guest on the same camera roll; the album fills up live, at original quality. The film-roll limit (shots per guest) is the emotional hook and the differentiator against "upload your photos here" gallery apps. Primary market India (wedding season, rupee pricing, Mumbai hosting), written in neutral international English so it ranks and converts everywhere.

- **Who searches:** couples and planners ("wedding photo sharing", "guest camera", "disposable camera app"), party hosts ("birthday photo album"), event and HR teams ("event photo sharing", "corporate event app").
- **Who converts:** hosts (they pay). Guests install because the host sends them, so the listing must reassure guests in the first screenshot (free, quick, live) and sell hosts by the last (control, design, packages).

## App Information

{block('name')}
Brand plus the highest-volume head term, "event photo sharing". Alternative for an A/B Product Page Optimization test: `Klickers: Wedding Guest Camera` (30/30).

{block('subtitle')}
Adds "wedding", "party", "guest" and "camera", the second most searched cluster. Alternative: `Shared camera roll for events` (29/30).

| Field | Value |
|---|---|
| Bundle ID | `{F['bundle']['text']}` |
| SKU | `{F['sku']['text']}` |
| Primary category | **{F['cat1']['text']}** |
| Secondary category | **{F['cat2']['text']}** (not Social Networking: that invites stricter UGC review for no ranking gain) |
| Content rights | Contains third-party content: **No** (users add their own photos; you hold rights to all bundled art) |
| Privacy Policy URL | {F['privacy_url']['text']} |
| Age rating | See `02_privacy_pricing_availability.md` |

## iOS App Version page

{block('promo')}
Promotional text can change any time without a new build. Rotate it for wedding season ("Wedding season: one QR for every guest, every photo in one album.") and for corporate Q4 events.

{block('keywords')}
Rules applied: no spaces after commas, no word that is already in the name or subtitle (Apple combines them: "wedding photo", "party camera", "event album" all still match), no plurals of words already used, no competitor or brand names.

**Second keyword field (free extra indexing):** add an **English (U.K.)** localization with the same name, subtitle and description and these keywords ({len(UK_KW)}/100). In the India and U.K. storefronts both English localizations are indexed, which is where the Indian wedding terms earn their keep. Check Apple's current "storefronts and localizations" table before relying on it.

```text
{UK_KW}
```

{block('description')}
Structure: emotional hook (line 1 shows above "more"), how it works, guests, hosts, quality, privacy, then plain package terms. No invented ratings or user numbers: add real press quotes or review counts once you have them, near the top.

{block('whats_new')}

| Field | Value |
|---|---|
| Support URL | {F['support_url']['text']} |
| Marketing URL | {F['marketing_url']['text']} |
| Copyright | {F['copyright']['text']} |
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
"""
open(os.path.join(OUT, '01_metadata_and_aso.md'), 'w').write(md)

rows = '\n'.join(f"| {i['ref']} | `{i['id']}` | Consumable | {i['name']} ({i['name_count']}/30) | {i['desc']} ({i['desc_count']}/45) | ₹{i['inr']:,} | ${i['usd']} |" for i in IAPS)
cards = '\n'.join(f"""### {i['ref']}

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `{i['ref']}` |
| Product ID | `{i['id']}` |
| Display Name (en) | `{i['name']}` · {i['name_count']}/30 |
| Description (en) | `{i['desc']}` · {i['desc_count']}/45 |
| Price | India ₹{i['inr']:,} (base) · U.S. ${i['usd']} |
| Promotional image | {'`subscription_banners/iap_' + i['id'].split('.')[-1] + '_1024x1024.png`' if '_to_' not in i['id'] else '`subscription_banners/promo_upgrade_difference_1024x1024.png`'} |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |
""" for i in IAPS)

md3 = f"""# 03 · Subscriptions and in-app purchases

## What the code sells

**There are no subscriptions.** Klickers sells one-off **event packages** through RevenueCat (`apps/mobile/src/features/purchases/store.ts`): `Purchases.getProducts(…, NON_SUBSCRIPTION)` then `purchaseStoreProduct`. A host pays once to move **one event** up a package; guests and photographers never pay. The product a host buys depends on where the event starts (`upgradeProductId` in `packages/shared/src/index.ts`):

- From Free: `in.co.klyra.eventshare.<package>` (full price)
- From a paid package: `in.co.klyra.eventshare.<from>_to_<to>` (the difference only)

The server checks every payment with RevenueCat's REST API before it upgrades the event and stores the transaction id so it cannot be spent twice (`apps/api/src/purchases/revenuecat.service.ts`).

**Why Consumable:** the same host can buy "Party" again for their next event, which a non-consumable would block. Create no subscription group. Leave "Family Sharing" off (a package belongs to one event).

| Package (in app) | Guests | Shots per guest | Photographers (photos / videos) | Gallery open | Extras |
|---|---|---|---|---|---|
| Try Klickers (free) | 10 | 10 | 1 (50 / 1) | 7 days | Ready-made themes, Me, saving |
| Party ₹999 | 75 | up to 24 | 1 (500 / 5) | 90 days | |
| Celebration ₹2,499 | 200 | up to 50 | 2 (3,000 / 30) | 12 months | Own colours and fonts, ZIP download |
| Branded Event ₹4,999 | 300 | up to 50 | 3 (5,000 / 50) | 12 months | + logo, photo frames, approving photos |

Every guest also gets a 30-second video and 60 seconds of voice notes in every package.

## The six products to create

App Store Connect › your app › **Monetization › In-App Purchases** › **+** › Consumable.

| Reference Name | Product ID | Type | Display Name | Description | India | U.S. |
|---|---|---|---|---|---|---|
{rows}

{cards}

## Pricing strategy

- **Base country: India**, at the in-app prices (rupees, tax included: `PLANS[*].priceInr`). Apple then sets every other storefront from the Indian price, which gives purchasing-power-friendly prices in South and Southeast Asia, Latin America and Africa automatically.
- **Override the rich storefronts** by hand so they are not underpriced: U.S. $9.99 / $24.99 / $49.99; U.K. £8.99 / £21.99 / £44.99; Euro €9.99 / €24.99 / €49.99; Australia A$15.99 / A$37.99 / A$74.99; Canada C$13.99 / C$32.99 / C$64.99; UAE AED 36.99 / 89.99 / 179.99. Set each upgrade product to the difference (for example U.S. $14.99, $39.99, $24.99) so moving up never costs more than buying the bigger package outright.
- **Upgrade products:** ₹1,500 / ₹4,000 / ₹2,500 are the exact differences. If Apple's Indian price points do not include them, pick the nearest point at or below (₹1,499, ₹3,999, ₹2,499). The server only checks the product id, so a rupee of difference is safe, and the Packages screen shows the store's own price once it loads.
- **Anchoring:** the Packages screen lists all four packages with Celebration highlighted as the current-or-next step. Keep Celebration as the hero in marketing: it is the first package with downloads, own colours and a 12-month gallery.

## Free trial, introductory and promotional offers

- **Introductory offers and promotional offers exist only for auto-renewable subscriptions.** Klickers has none, so there is nothing to set there. The free "Try Klickers" package (10 guests, 7 days) is the trial.
- **Offer codes:** Apple has been extending offer codes to one-time purchases. If your App Store Connect shows "Offer Codes" on these consumables, a launch code (for example 20% off Celebration for wedding planners) can use `subscription_banners/offer_code_launch_1024x1024.png`. Redemption must reach the server as a normal RevenueCat transaction: test one in Sandbox before you hand codes out.
- **Promoted in-app purchases:** turn on promotion for **Celebration** and **Branded Event** with their 1024×1024 images so they show on the product page. When a promoted purchase starts from the App Store, the app has to know which event to apply it to; until the app handles that (`Purchases.setPromotedPurchaseCallback` or similar), keep promotion off. This is the safer launch choice.

## Images in `subscription_banners/`

| File | Use |
|---|---|
| `iap_party_1024x1024.png` | Promotional image, Party (1 star, as in the app's star tag) |
| `iap_celebration_1024x1024.png` | Promotional image, Celebration (2 stars) |
| `iap_branded_1024x1024.png` | Promotional image, Branded Event (3 stars) |
| `promo_upgrade_difference_1024x1024.png` | Promotional image for the three upgrade products |
| `offer_code_launch_1024x1024.png` | Offer code / campaign art |
| `iap_review_screenshot_packages_1200x2616.png` | **Review screenshot** for every product (the real Packages screen) |

The art follows Apple's guidance for promoted IAP images: 1024×1024, no prices, no screenshots of the UI, large type only.

## Review notes for each product

Paste this into **Review Notes** on every product ({F['iap_review']['count']} chars):

```text
{F['iap_review']['text']}
```

## Sandbox checklist

1. App Store Connect › Users and Access › Sandbox › add a tester with an Indian storefront.
2. In RevenueCat, add the six product ids to the iOS app and check the App Store Connect API key is linked (it fetches prices).
3. On a TestFlight build signed in as the tester: buy Party from Free, then Celebration from Party (should charge ₹1,500), then Restore purchases on a fresh install.
4. Check the server log: each transaction is accepted once; a second use of the same transaction answers 409.
5. Submit all six products **with** the app version (first IAPs must go in the same submission).
"""
open(os.path.join(OUT, '03_subscriptions_and_iap.md'), 'w').write(md3)
print('ok')
