# eventShare — Frontend Design Guide

The single source of truth for how eventShare looks, feels and reads. Every screen and component follows this file. If something new doesn't fit, update this guide first, then build.

Reference mock: `Everroll_Mobile_UI.html` (shared 2026-11-02). We take its **visual language**, not its features.

---

## 1. Personality

**Warm, calm, keepsake.** Think of a beautifully printed wedding album or a film camera, not a social feed.

- Quiet backgrounds, one confident green, lots of breathing room.
- A serif headline, often with an *italic, olive-tinted phrase*, sets the emotion. Clean sans text does the work.
- Small film-camera details (frame numbers, viewfinder corners, film strip) give character. Use them sparingly.
- Photos are the hero. UI chrome stays out of their way.

**Never:** bright saturated colors, gradients on buttons, drop-shadow-heavy cards, emoji in UI chrome, more than one primary button per screen.

---

## 2. Color tokens

Use tokens from `src/constants/theme.ts`. **Never hard-code hex values in components.**

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FAF9F5` | App background |
| `surface` | `#FFFEFA` | Cards, menu groups, inputs |
| `surfaceBar` | `#FDFCF8` | Tab bar, sticky bars |
| `ink` | `#273C32` | Primary text, icons |
| `inkDeep` | `#243B2E` | Pressed dark states, home indicator |
| `primary` | `#385447` | Primary buttons, camera button, key accents |
| `primaryPressed` | `#283F31` | Primary pressed state |
| `onPrimary` | `#FFFEFA` | Text and icons on `primary` |
| `muted` | `#888B80` | Secondary text |
| `subtle` | `#9A9D8A` | Tertiary text, captions, inactive tab icons |
| `accent` | `#748063` | Italic serif emphasis, links |
| `line` | `#E9E9DF` | Dividers, hairlines |
| `lineStrong` | `#DEDFD3` | Input and secondary button borders |
| `sage` | `#E9EDDF` | Icon tiles, chips, selected rows |
| `sageDeep` | `#A5B18F` | Progress fills, film strip |
| `field` | `#F0F1E9` | Search fields, secondary buttons |
| `warm` | `#F0EADD` | Warm invitation cards |
| `warmDeep` | `#E3D9C2` | Icon tile inside warm cards |
| `viewfinder` | `#304538` | Camera frame, dark hero surfaces |
| `danger` | `#9F4C3E` | Destructive text |
| `dangerBg` | `#F6E6DD` | Error banners |
| `notice` | `#806F46` | Offline/upload-queue text |
| `noticeBg` | `#F3E9D6` | Offline/upload-queue banner |
| `focus` | `#A89057` | Focus ring (accessibility) |
| `overlay` | `rgba(24,42,36,0.4)` | Modal backdrop |

**Light-first.** The design is built on paper tones, so the app ships light-only for now (`userInterfaceStyle: "light"`). When we add dark mode, add a full token set; never invert colors ad hoc.

---

## 3. Typography

Two families only:
- **DM Serif Display** (regular + italic): headlines, big numbers, wordmark. Weight 400 only; never bold the serif.
- **DM Sans** (400/500/600/700): everything else.

The reference mock uses web sizes that are too small for phones. These are the **native sizes**:

| Style | Font | Size / line | Notes |
|---|---|---|---|
| `display` | Serif | 40 / 42 | Event cover title |
| `h1` | Serif | 32 / 36 | Screen hero ("Our day, *every way.*") |
| `h2` | Serif | 24 / 28 | Section headings ("Little moments, kept.") |
| `h3` | Serif | 20 / 24 | Card titles |
| `title` | Sans 600 | 17 / 22 | Header screen titles |
| `body` | Sans 400 | 15 / 22 | Default text |
| `bodyStrong` | Sans 600 | 15 / 22 | Row titles, names |
| `label` | Sans 500 | 14 / 20 | Buttons, tabs, form labels |
| `caption` | Sans 400 | 13 / 18 | Secondary lines under titles |
| `eyebrow` | Sans 600 | 11 / 14 | UPPERCASE, letterSpacing 1.5, `subtle` color |
| `mono` | Monospace | 12 / 16 | Frame numbers, counters ("01", "30 / 30") |

Rules:
- Serif headlines use negative letter-spacing (about -0.5 to -1).
- Emphasis inside a serif headline is *italic + `accent` color*, e.g. "Be here. *Keep a little of it.*"
- Minimum text size is **11**. Respect the user's Dynamic Type setting (`maxFontSizeMultiplier` 1.3 on dense UI).

---

## 4. Spacing, radius, elevation

**Spacing (4-pt grid):** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 48`
- Screen horizontal padding: **20**.
- Gap between sections: **24–32**.
- Row vertical padding: **16**.

**Radius:**
| Token | Value | Use |
|---|---|---|
| `sm` | 8 | Chips, small badges |
| `md` | 12 | Buttons, inputs, photo tiles |
| `lg` | 14 | Menu groups, info cards |
| `xl` | 18 | Event cover, hero cards |
| `sheet` | 24 | Bottom sheets (top corners) |
| `full` | 999 | Avatars, pills, round buttons |

**Elevation:** almost flat. Separate with `line` hairlines and `surface` vs `paper` contrast, not shadows. One exception: the floating camera tab button gets a 5-px `paper` ring around it.

---

## 5. Iconography

- **Lucide** line icons (`lucide-react-native`): stroke **1.6**, size **20** (inline) / **22** (tab bar) / **18** (in rows).
- Color is `ink` by default, `subtle` when inactive, `onPrimary` on green.
- Icon tiles: a 40×40 rounded square (`radius md`) in `sage`, icon centered.
- No filled or duotone icons, no emoji.

---

## 6. Components

All shared components live in `src/components/ui/`. Build screens from these; don't restyle them inline.

| Component | Spec |
|---|---|
| **Button** | Height 48, radius `md`, `label` text, icon gap 8. Variants: `primary` (green/onPrimary), `secondary` (`field` bg + `lineStrong` border), `ghost` (text only, `accent`), `danger`. Full-width option. Pressed: darker shade + scale 0.98. Disabled: 45% opacity. |
| **IconButton** | 40×40 circular hit area, icon 20. `outlined` variant adds a `lineStrong` 1-px ring (e.g. "→" section link). |
| **Header** | 60 tall, `paper` bg, hairline bottom. Left: wordmark or screen `title`. Right: actions plus avatar. |
| **Avatar** | Circle 34, `sage`/`#ECEBDF` bg, serif initials. Sizes 28 / 34 / 40. |
| **EventCover** | Full-width photo, radius `xl`, height ~300, dark bottom gradient. Eyebrow date, `display` serif title (2nd line italic + light accent), location row. Optional glass badge top-left. |
| **SectionHeading** | Eyebrow above `h2`; optional outlined round arrow on the right. |
| **PhotoTile** | Radius `md`, `sage` placeholder, cover-fit image, optional mono frame number bottom-left in white, optional status chip top-left. Caption below: name (`bodyStrong` small) + line (`caption`). |
| **MenuGroup / MenuRow** | `surface` card, radius `lg`, 1-px `line` border. Rows are 58+ tall: icon 18 (`accent`), title + optional caption, chevron right (`subtle`). Hairline between rows. |
| **ListRow** | Avatar/icon + title/caption + trailing element, hairline bottom. Used for guests and events. |
| **Tabs (segmented underline)** | Equal-width text tabs, active = `ink` 600 + 2-px `primary` underline, inactive = `subtle`. |
| **SearchField** | Height 44, `field` bg, radius `md`, search icon left, placeholder `subtle`. |
| **TextField** | Label above (`label`, `accent`), input 48 tall, `surface` bg, `lineStrong` border, radius `md`. Error text in `danger` below. |
| **Pill / RoleBadge** | `sage` bg, radius `sm`, caption text (e.g. "Host", "Guest"). |
| **Banner** | Full-width strip. `notice` variant for "3 photos waiting to upload", `danger` variant for errors. |
| **Toast** | Floats above the tab bar. `primary` bg, `onPrimary` text, radius `md`, auto-dismiss 3 s. |
| **BottomSheet** | `paper` bg, top radius `sheet`, grab handle 36×4 (`lineStrong`), close icon top-right, backdrop `overlay`. Used for Join, Create, QR, confirmations. |
| **EmptyState** | Centered icon tile + serif `h2` + caption + one button. Always say what to do next. |

---

## 7. Navigation pattern

- **Bottom tab bar** inside an event: **Home · Album · [Camera] · People · More**.
  - `surfaceBar` bg, hairline top, labels 11 pt.
  - Active: `ink` + a 4-px `primary` dot under the icon. Inactive: `subtle`.
  - **Camera** is a raised green rounded square (52×44, radius 15) with a `paper` ring; it's always one tap away.
- **More** holds the event switcher ("Your events"), invite / QR, download all, profile and settings.
- Create event, Join event, QR invite and photo detail open as **bottom sheets or full-screen modals**, never as a new tab.
- Use native stack transitions; don't build custom page animations.

---

## 8. Motion & feedback

- Durations: 150 ms (press), 250 ms (sheet/fade), 350 ms max. Ease-out.
- Press feedback on everything tappable: opacity 0.85 or scale 0.98.
- Haptics: light impact on the shutter and on successful upload; warning haptic on destructive confirms.
- Honor **Reduce Motion**: no scaling or pulsing, cross-fades only.
- Images fade in over a `sage` placeholder (blurhash once the backend provides it); never pop in.

---

## 9. Writing (voice & tone)

- Warm, short and human. Talk about **moments and memories**, not "content" or "files".
- Headlines are a feeling: "Little moments, kept." Body copy is the plain instruction: "Take photos and they'll appear here for everyone."
- Sentence case everywhere except eyebrows (UPPERCASE).
- Buttons are verbs: "Open camera", "Join event", "Download all".
- Errors say what happened and what to do, without blame: "No connection. Your photos are safe and will upload when you're back online."

---

## 10. Photos (non-negotiable)

- Originals are never recompressed. The UI shows thumbnails, and downloads always deliver the original.
- Grids: 2 columns on the album, 3 columns in dense views, gap 10, tiles keep the photo's aspect ratio or use a consistent crop (4:5).
- Always reserve the tile's space before the image loads, so the layout never jumps.

---

## 11. Accessibility checklist

- Tap targets ≥ 44×44.
- Text contrast ≥ 4.5:1 (`muted` on `paper` passes for 13 pt+; use `ink` for anything smaller).
- Every icon-only button has an `accessibilityLabel`.
- Screens work with VoiceOver / TalkBack focus order top to bottom.
- Respect Dynamic Type and Reduce Motion.

---

## 12. Before shipping any screen

- [ ] Uses only theme tokens and `ui/` components
- [ ] Serif headline + sans body; nothing under 11 pt
- [ ] Screen padding 20, hairlines instead of shadows
- [ ] Has loading, empty and error states
- [ ] Copy follows the voice rules
- [ ] Checked on a small phone (iPhone SE size) and a large one
