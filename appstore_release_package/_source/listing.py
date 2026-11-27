"""Every App Store Connect text field for Klickers, in one place.
Checks Apple's limits and writes listing.json (read by the master guide).
Run: python3 listing.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))

F = {}  # key -> (label, text, limit, section)

def field(key, label, text, limit, section):
    text = text.strip('\n')
    F[key] = {'label': label, 'text': text, 'limit': limit, 'section': section, 'count': len(text)}

# ---------------- App Information ----------------
field('name', 'App Name', 'Klickers: Event Photo Sharing', 30, 'App Information')
field('subtitle', 'Subtitle', 'Wedding & Party Guest Camera', 30, 'App Information')
field('bundle', 'Bundle ID', 'in.co.klyra.eventshare', None, 'App Information')
field('sku', 'SKU', 'KLICKERS-IOS-001', None, 'App Information')
field('cat1', 'Primary Category', 'Photo & Video', None, 'App Information')
field('cat2', 'Secondary Category', 'Lifestyle', None, 'App Information')
field('privacy_url', 'Privacy Policy URL', 'https://klickers.app/privacy', None, 'App Information')
field('terms_url', 'License Agreement / Terms (in description + optional custom EULA)', 'https://klickers.app/terms', None, 'App Information')

# ---------------- Version page ----------------
field('promo', 'Promotional Text',
      "Every guest's photos in one album: scan a QR, shoot your roll, watch the shared gallery fill up live. Find every photo you're in with a selfie.",
      170, 'iOS App Version')
field('keywords', 'Keywords',
      'disposable,qr,album,gallery,film,roll,birthday,bridal,reception,corporate,pics,video,memories,cam',
      100, 'iOS App Version')
field('support_url', 'Support URL', 'https://klickers.app/support', None, 'iOS App Version')
field('marketing_url', 'Marketing URL', 'https://klickers.app', None, 'iOS App Version')
field('copyright', 'Copyright', '2026 Klyra Innovations Private Limited', None, 'iOS App Version')

DESCRIPTION = """
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
"""
field('description', 'Description', DESCRIPTION, 4000, 'iOS App Version')

WHATS_NEW = """
Welcome to Klickers, the shared camera for your event.

• Create an event and invite guests with a QR code, link or 6-digit code
• Every guest gets their own roll, plus a video and a voice message
• One live album for everyone, at full original quality
• "Me": find every photo you're in with a selfie (optional)
• Design studio: themes, fonts, frames and your logo
• Review photos, add photographers, top up guests' shots
• One-time packages per event. Guests always join free

Tell us what you think: support@klyra.co.in
"""
field('whats_new', "What's New in This Version", WHATS_NEW, 4000, 'iOS App Version')

REVIEW_NOTES = """
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
"""
field('review_notes', 'App Review Notes', REVIEW_NOTES, 4000, 'App Review')
field('review_user', 'Demo Account: User name', '[REVIEW_EMAIL e.g. appreview@klyra.co.in]', None, 'App Review')
field('review_pass', 'Demo Account: Password', '[REVIEW_PASSWORD]', None, 'App Review')
field('review_contact', 'Contact: Email', 'support@klyra.co.in', None, 'App Review')
field('review_phone', 'Contact: Phone', '[+91 PHONE NUMBER]', None, 'App Review')

# ---------------- In-app purchases ----------------
IAP = [
    # ref name, product id, display name, description, INR, USD, from, to
    ('Party (from Free)', 'in.co.klyra.eventshare.party', 'Party Package', '75 guests and a 90-day gallery, one event', 999, 9.99),
    ('Celebration (from Free)', 'in.co.klyra.eventshare.celebration', 'Celebration Package', '200 guests, 2 photographers, 12-month album', 2499, 24.99),
    ('Branded Event (from Free)', 'in.co.klyra.eventshare.branded', 'Branded Event Package', '300 guests, your logo, frames and approvals', 4999, 49.99),
    ('Upgrade Party to Celebration', 'in.co.klyra.eventshare.party_to_celebration', 'Party to Celebration', 'Upgrade this event, pay only the difference', 1500, 14.99),
    ('Upgrade Party to Branded', 'in.co.klyra.eventshare.party_to_branded', 'Party to Branded Event', 'Upgrade this event, pay only the difference', 4000, 39.99),
    ('Upgrade Celebration to Branded', 'in.co.klyra.eventshare.celebration_to_branded', 'Celebration to Branded Event', 'Upgrade this event, pay only the difference', 2500, 24.99),
]
iaps = []
for ref, pid, name, desc, inr, usd in IAP:
    iaps.append({'ref': ref, 'id': pid, 'type': 'Consumable', 'name': name, 'name_count': len(name), 'desc': desc, 'desc_count': len(desc), 'inr': inr, 'usd': usd})
    assert len(name) <= 30, name
    assert len(desc) <= 45, (desc, len(desc))
    assert len(ref) <= 64, ref

IAP_REVIEW = """
Consumable: one purchase upgrades one event (hosts can buy the same package again for a different event). To find it: sign in with the demo account, open "App Review Wedding" (you are the host) > Overview > Upgrade, or Packages from any lock pill. The store sheet confirms the purchase; the event's limits update at once (guest cap, gallery days, features). Upgrade products charge only the price difference for an event already on a paid package. Restore purchases is on the same screen.
"""
field('iap_review', 'IAP Review Notes (paste on each product)', IAP_REVIEW, 4000, 'In-App Purchases')

# ---------------- checks ----------------
kw = F['keywords']['text']
assert ', ' not in kw and ' ' not in kw, 'no spaces in keywords'
words = kw.split(',')
assert len(set(words)) == len(words), 'duplicate keyword'
title_words = set(re.findall(r"[a-z]+", (F['name']['text'] + ' ' + F['subtitle']['text']).lower()))
assert not (set(words) & title_words), set(words) & title_words
for k, v in F.items():
    if v['limit'] and v['count'] > v['limit']:
        raise SystemExit(f"{k} too long: {v['count']}/{v['limit']}")

json.dump({'fields': F, 'iaps': iaps}, open(os.path.join(HERE, 'listing.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in F.items():
    print(f"{k:14} {v['count']:5}/{v['limit'] or '-'}")
for i in iaps:
    print(f"{i['id']:46} name {i['name_count']}/30 desc {i['desc_count']}/45")
