# App Preview: storyboard and script

| File | Size | Use |
|---|---|---|
| `app_preview_6_9_886x1920.mp4` | 886×1920, 29.0 s | App Preview for the **iPhone 6.9"** and **6.5"** slots (Apple's portrait spec for both) |
| `app_preview_1080x1920.mp4` | 1080×1920, 29.0 s | Same cut at 1080×1920, for social and for the 5.5" slot if you ever add it |
| `poster_frame_886x1920.png` | 886×1920 | The end card (26.5 s). Set it as the poster frame in App Store Connect |
| `app_preview_captions.srt` | | Voiceover transcript, for review and for social uploads |

**Specs (checked with ffprobe):** H.264 High profile, 30 fps, yuv420p, AAC-LC 256 kbps stereo at 48 kHz, loudness −16 LUFS, `+faststart`. Within Apple's limits (15–30 s, ≤500 MB).

**How it was made:** every screen is rebuilt from the app's real code (`apps/mobile/src`: copy, layout, theme tokens), animated in `_source/video.html` and captured frame by frame at 30 fps by `_source/render-video.mjs`. The voice is macOS `say` (Samantha) placed on the scene timings; the music bed and shutter click are synthesized in `_source/make_audio.py` and ducked under the voice.

> **Before you upload:** Apple asks that previews show footage captured from the app. These are faithful recreations of the real screens, not a screen recording. For zero risk, record the same seven beats in the Simulator (`xcrun simctl io booted recordVideo preview.mov`) and lay this soundtrack and these captions over it. The beat sheet below is your shot list.

## Beat sheet (29 s)

| Time | Scene (real screen) | Caption on screen | Voiceover | Action |
|---|---|---|---|---|
| 0.0–3.4 | Invite sheet → Join preview (`invite.tsx`, `join-preview.tsx`) | JOIN IN SECONDS · *Scan the QR. You're in.* | "Scan the code, and you're in." | Scan line sweeps the QR, cross-fade to the event preview, tap **Enter the event** |
| 3.4–7.4 | Guest Home (`(tabs)/home.tsx`) | EVERY GUEST · *Your own roll of film.* | "Every guest gets their own roll of shots, just like film." | Roll counter counts down 36 → 24, tap **Open camera** |
| 7.4–11.4 | Camera (`(tabs)/camera.tsx`) | SHOOT · *Snap it. It's live.* | "Take a photo, and it's live for everyone." | Shutter tap, flash, counter 24 → 23, pill "Live in the album · 1s" |
| 11.4–17.6 | The album, Everyone (`album-view.tsx`) | EVERY GUEST · ONE ALBUM · *The whole night, full quality.* | "Photos, videos and voice notes from every guest, in one album, at full quality." | Tiles pop in one by one (video and voice chips), slow scroll |
| 17.6–21.4 | The album, Me (`find-me.tsx`) | "ME" · *Find every photo you're in.* | "Take a selfie to find every photo you're in." | Face boxes lock onto matching photos |
| 21.4–25.2 | Design studio → Overview (`(tabs)/design.tsx`, `(tabs)/overview.tsx`) | FOR HOSTS · *Your look. Your rules.* | "Hosts choose the look, and approve every shot." | Theme and frame, cross-fade to Overview, tap approve on a photo in review |
| 25.2–29.0 | End card (app icon) | Klickers · *Every photo, everyone's.* · GUESTS JOIN FREE | "Klickers. Every photo, everyone's." | Icon, name and tagline rise in |

## Search Ads and social cut (15 s), in `../editorial_and_search_banners/`

| Time | Visual | Caption | Voiceover |
|---|---|---|---|
| 0–3 | Six event prints drop in | *Your event. Every guest.* | "Your event. Every guest." |
| 3–6 | Phone in camera mode, shutter flash | *One shared camera roll.* | "One shared camera roll." |
| 6–9 | Album filling up | *Live, at full quality.* | "Live, and at full quality." |
| 9–12 | "Me" face matches | *Find every photo you're in.* | "Find every photo you're in." |
| 12–15 | End card | Klickers · FREE FOR GUESTS · ON THE APP STORE | "Klickers. Free to join." |

Files: `search_ads_promo_1080x1080.mp4` and `search_ads_promo_1080x1920.mp4` (15.0 s, same specs as above).

## Re-rendering

```bash
cd appstore_release_package/_source
npm i playwright-core            # once; uses your Playwright Chromium
node render-video.mjs preview 443 960 2 /tmp/preview_silent.mp4
python3 make_audio.py /tmp/klickers_audio
ffmpeg -i /tmp/preview_silent.mp4 -i /tmp/klickers_audio/preview.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart ../app_previews_video/app_preview_6_9_886x1920.mp4
```

Change a caption in `video.html` or a voiceover line in `make_audio.py` (keep each line inside its scene: the times are listed at the top of that file), then run the three commands again. Set `VO_VOICE` to try another installed voice; a Premium or Enhanced voice from System Settings › Accessibility › Spoken Content sounds more natural.
