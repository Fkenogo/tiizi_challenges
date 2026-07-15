# Phase 18I-7A — Official Tiizi Brand Icon Implementation

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Objective

Implement the official approved Tiizi icon across the website, PWA manifest, browser favicons, and metadata. Source icon: `public/logo-icon/Tiizi -iconlogo.png` (1295×1215 PNG, RGB).

---

## Assets Generated

All icons generated from the approved source using macOS `sips` — no redesign, recolor, or crop.

| File | Size | Purpose |
|------|------|---------|
| `public/favicon.ico` | 32×32 (PNG-in-ICO) | Browser tab / bookmarks |
| `public/favicon.png` | 32×32 | Modern browser favicon fallback |
| `public/apple-touch-icon.png` | 180×180 | iOS "Add to Home Screen" |
| `public/icons/icon-16x16.png` | 16×16 | Small favicon |
| `public/icons/icon-32x32.png` | 32×32 | Favicon |
| `public/icons/icon-48x48.png` | 48×48 | Windows taskbar |
| `public/icons/icon-72x72.png` | 72×72 | PWA / Android |
| `public/icons/icon-96x96.png` | 96×96 | PWA / Android |
| `public/icons/icon-128x128.png` | 128×128 | Chrome Web Store |
| `public/icons/icon-144x144.png` | 144×144 | Windows tile / Android |
| `public/icons/icon-152x152.png` | 152×152 | iPad touch icon |
| `public/icons/icon-180x180.png` | 180×180 | iPhone touch icon |
| `public/icons/icon-192x192.png` | 192×192 | PWA required |
| `public/icons/icon-384x384.png` | 384×384 | PWA recommended |
| `public/icons/icon-512x512.png` | 512×512 | PWA required + maskable |

---

## Files Modified

| File | Change |
|------|--------|
| `public/manifest.json` | Added all 9 icon entries (72–512px) including `"purpose": "maskable"` for 512px |
| `index.html` | Added favicon links (ICO + PNG sizes 16/32), apple-touch-icon, Open Graph tags, Twitter card tags |
| `public/favicon.ico` | New — Tiizi icon (32×32 PNG-in-ICO format) |
| `public/favicon.png` | New — Tiizi icon 32×32 |
| `public/apple-touch-icon.png` | New — Tiizi icon 180×180 |
| `public/icons/` | New directory — 12 PNG sizes from 16×16 to 512×512 |

---

## Code Diff Summary

### `public/manifest.json` — icons array populated

Previous state: `"icons": []`

New state: 9 icon entries covering 72×72 through 512×512 with a `maskable` variant.

### `index.html` — favicon and metadata links added

```html
<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />

<!-- Apple touch icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

<!-- Open Graph -->
<meta property="og:title" content="Tiizi Fitness" />
<meta property="og:description" content="Group fitness challenges, donation causes, and community wellness." />
<meta property="og:image" content="/icons/icon-512x512.png" />
<meta property="og:type" content="website" />

<!-- Twitter card -->
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Tiizi Fitness" />
<meta name="twitter:description" content="Group fitness challenges, donation causes, and community wellness." />
<meta name="twitter:image" content="/icons/icon-512x512.png" />
```

---

## App Screens Audit

| Screen | Placeholder logo? | Action |
|--------|------------------|--------|
| LoginScreen | None | No change needed |
| SignupScreen | None | No change needed |
| WelcomeScreen | Uses `tiizi-cover.png` (cover image, not placeholder) | No change needed |
| LoadingSpinner | Pure CSS spinner, no icon | No change needed |
| App.tsx Suspense | Uses `LoadingSpinner` with no icon | No change needed |
| Onboarding screens | No placeholder icon | No change needed |

No auth or loading screens required icon replacement — they had no placeholder icons, only the CSS loading spinner and an approved cover photo.

---

## Commands Executed

```bash
# Generate all icon sizes from approved source
sips -z {SIZE} {SIZE} "public/logo-icon/Tiizi -iconlogo.png" --out "public/icons/icon-{SIZE}x{SIZE}.png"
# (run for: 16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512)

# apple-touch-icon (180px) and favicon.png (32px)
sips -z 180 180 source.png --out public/apple-touch-icon.png
sips -z 32 32 source.png --out public/favicon.png

# favicon.ico (PNG-in-ICO via Python struct)
python3 << 'EOF'  # generates ICO wrapping the 32x32 PNG data

# Validation
npx tsc --noEmit
npm run build
```

---

## Dependencies Added

None.

---

## Config Changes

- `public/manifest.json` — icons array populated (was empty `[]`)

---

## Risks / Limitations

1. **Favicon.ico is a single-frame PNG-in-ICO** — modern browsers (Chrome, Firefox, Edge, Safari) all support PNG inside ICO. Legacy IE requires a true BMP-format ICO. If IE support is required, regenerate using ImageMagick `convert` with BMP frames.

2. **Maskable icon uses the full icon without a safe-zone** — proper maskable icons have the logo centered within a 20% safe zone so adaptive icon shapes (Android circles/squircles) don't clip the logo. The current source icon fills the full frame. For perfect maskable rendering, a padded variant is recommended. The current implementation still passes PWA install requirements.

3. **Existing Firestore challenges are unaffected** — this is a static asset/metadata change only.

4. **No splash screen assets** — Vite + Firebase Hosting does not have a native splash screen configuration. PWA splash screens on iOS are generated by the OS from the apple-touch-icon. Android Chrome generates splash from `background_color` + `theme_color` + the 512px icon. No additional work needed.

---

## Rollback Instructions

1. Revert `index.html` — remove the favicon, apple-touch-icon, OG, and Twitter meta tags.
2. Revert `public/manifest.json` — restore `"icons": []`.
3. Delete `public/favicon.ico`, `public/favicon.png`, `public/apple-touch-icon.png`, and the `public/icons/` directory.

---

## Manual QA Checklist

### Browser favicon
- [ ] Open Tiizi in Chrome/Firefox — browser tab shows Tiizi icon (not Vite logo)
- [ ] Bookmark the page — bookmark shows Tiizi icon

### PWA — Desktop Chrome
- [ ] Address bar shows install icon → click → Install App dialog shows Tiizi icon
- [ ] Installed desktop shortcut shows Tiizi icon

### PWA — Android Chrome
- [ ] "Add to Home Screen" prompt shows Tiizi icon
- [ ] Installed home screen icon shows Tiizi icon

### PWA — iOS Safari
- [ ] "Add to Home Screen" shows Tiizi icon
- [ ] Installed app icon on home screen shows Tiizi icon

### Metadata
- [ ] Share link in iMessage/Slack/Twitter — preview shows Tiizi icon (OG image)
- [ ] `<meta name="theme-color">` still `#ff6b00` (orange)
