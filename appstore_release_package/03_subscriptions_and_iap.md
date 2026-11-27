# 03 · Subscriptions and in-app purchases

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
| Party (from Free) | `in.co.klyra.eventshare.party` | Consumable | Party Package (13/30) | 75 guests and a 90-day gallery, one event (41/45) | ₹999 | $9.99 |
| Celebration (from Free) | `in.co.klyra.eventshare.celebration` | Consumable | Celebration Package (19/30) | 200 guests, 2 photographers, 12-month album (43/45) | ₹2,499 | $24.99 |
| Branded Event (from Free) | `in.co.klyra.eventshare.branded` | Consumable | Branded Event Package (21/30) | 300 guests, your logo, frames and approvals (43/45) | ₹4,999 | $49.99 |
| Upgrade Party to Celebration | `in.co.klyra.eventshare.party_to_celebration` | Consumable | Party to Celebration (20/30) | Upgrade this event, pay only the difference (43/45) | ₹1,500 | $14.99 |
| Upgrade Party to Branded | `in.co.klyra.eventshare.party_to_branded` | Consumable | Party to Branded Event (22/30) | Upgrade this event, pay only the difference (43/45) | ₹4,000 | $39.99 |
| Upgrade Celebration to Branded | `in.co.klyra.eventshare.celebration_to_branded` | Consumable | Celebration to Branded Event (28/30) | Upgrade this event, pay only the difference (43/45) | ₹2,500 | $24.99 |

### Party (from Free)

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Party (from Free)` |
| Product ID | `in.co.klyra.eventshare.party` |
| Display Name (en) | `Party Package` · 13/30 |
| Description (en) | `75 guests and a 90-day gallery, one event` · 41/45 |
| Price | India ₹999 (base) · U.S. $9.99 |
| Promotional image | `subscription_banners/iap_party_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |

### Celebration (from Free)

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Celebration (from Free)` |
| Product ID | `in.co.klyra.eventshare.celebration` |
| Display Name (en) | `Celebration Package` · 19/30 |
| Description (en) | `200 guests, 2 photographers, 12-month album` · 43/45 |
| Price | India ₹2,499 (base) · U.S. $24.99 |
| Promotional image | `subscription_banners/iap_celebration_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |

### Branded Event (from Free)

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Branded Event (from Free)` |
| Product ID | `in.co.klyra.eventshare.branded` |
| Display Name (en) | `Branded Event Package` · 21/30 |
| Description (en) | `300 guests, your logo, frames and approvals` · 43/45 |
| Price | India ₹4,999 (base) · U.S. $49.99 |
| Promotional image | `subscription_banners/iap_branded_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |

### Upgrade Party to Celebration

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Upgrade Party to Celebration` |
| Product ID | `in.co.klyra.eventshare.party_to_celebration` |
| Display Name (en) | `Party to Celebration` · 20/30 |
| Description (en) | `Upgrade this event, pay only the difference` · 43/45 |
| Price | India ₹1,500 (base) · U.S. $14.99 |
| Promotional image | `subscription_banners/promo_upgrade_difference_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |

### Upgrade Party to Branded

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Upgrade Party to Branded` |
| Product ID | `in.co.klyra.eventshare.party_to_branded` |
| Display Name (en) | `Party to Branded Event` · 22/30 |
| Description (en) | `Upgrade this event, pay only the difference` · 43/45 |
| Price | India ₹4,000 (base) · U.S. $39.99 |
| Promotional image | `subscription_banners/promo_upgrade_difference_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |

### Upgrade Celebration to Branded

| Field | Value |
|---|---|
| Type | **Consumable** |
| Reference Name | `Upgrade Celebration to Branded` |
| Product ID | `in.co.klyra.eventshare.celebration_to_branded` |
| Display Name (en) | `Celebration to Branded Event` · 28/30 |
| Description (en) | `Upgrade this event, pay only the difference` · 43/45 |
| Price | India ₹2,500 (base) · U.S. $24.99 |
| Promotional image | `subscription_banners/promo_upgrade_difference_1024x1024.png` |
| Review screenshot | `subscription_banners/iap_review_screenshot_packages_1200x2616.png` |


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

Paste this into **Review Notes** on every product (488 chars):

```text
Consumable: one purchase upgrades one event (hosts can buy the same package again for a different event). To find it: sign in with the demo account, open "App Review Wedding" (you are the host) > Overview > Upgrade, or Packages from any lock pill. The store sheet confirms the purchase; the event's limits update at once (guest cap, gallery days, features). Upgrade products charge only the price difference for an event already on a paid package. Restore purchases is on the same screen.
```

## Sandbox checklist

1. App Store Connect › Users and Access › Sandbox › add a tester with an Indian storefront.
2. In RevenueCat, add the six product ids to the iOS app and check the App Store Connect API key is linked (it fetches prices).
3. On a TestFlight build signed in as the tester: buy Party from Free, then Celebration from Party (should charge ₹1,500), then Restore purchases on a fresh install.
4. Check the server log: each transaction is accepted once; a second use of the same transaction answers 409.
5. Submit all six products **with** the app version (first IAPs must go in the same submission).
