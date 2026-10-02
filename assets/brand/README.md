# PlayWeld brand assets

**Last updated:** 2026-10-02

This is the portable artwork handoff for the desktop product and the separate website project. It contains images and editable vector artwork, with no website application or hosting code. The user confirmed the PlayWeld name; this visual treatment is an authored engineering/art default under the request to complete the rebrand, not a separately user-approved logo or trademark policy.

## Visual direction

The mark is an angular W with a four-point welding spark at its central join. It suggests separate pieces becoming one creative workspace. Keep the mark flat and legible; dimensional effects belong in supporting illustrations. Use the existing app's violet-and-lime direction: lime `#BAFF2C`, ink violet `#120D1E`, soft white `#F7F4FF`, and muted violet supporting text. The desktop mark follows the active theme's semantic accent color so alternate and high-contrast themes retain control.

Use **PlayWeld** capitalization in public text and `playweld.com` in the domain. Keep at least one spark-width of clear space around standalone marks. Use the dark mark on light backgrounds and the lime or white mark on dark backgrounds. Keep app-icon artwork within its rounded-square canvas. At tiny sizes, use the exported app icon rather than squeezing in the wordmark.

## Deliverables

| Asset | Files and dimensions | Use |
| --- | --- | --- |
| Standalone mark | `mark.svg`, `mark-white.svg`, `mark-black.svg`, matching transparent PNGs; 512 × 512 | Product identity and small layouts |
| Horizontal logo | `logo-dark.svg`, `logo-light.svg`, `logo-white.svg`, matching transparent PNGs; 1500 × 400 | Headers, documentation, presentations |
| Wordmark | `wordmark-dark.svg`, `wordmark-light.svg`, matching transparent PNGs; 1180 × 280 | Text-only brand placement |
| App icon | `app-icon.svg`, `app-icon-*.png`; 16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024 square | Windows/Linux application and launcher |
| Windows icon | `app-icon.ico`; seven PNG frames from 16 through 256 | Executable and installer resources |
| Portable small icons | `favicon.ico`, `apple-touch-icon.png` (180 square), `avatar.svg`, `avatar.png` (192 square) | Asset handoff for other projects |
| Wide banner | `banner-wide.svg`, `banner-wide.png`; 2400 × 800 | Repository and community headers |
| Social card | `social-card.svg`, `social-card.png`; 1200 × 630 | Sharing and announcements |
| Illustrated banner | `promo-banner.png`; actual dimensions recorded in `validation.json` | Finished promotional artwork |
| Text-free illustration | `wallpaper.png`; actual dimensions recorded in `validation.json` | Wallpaper or layout background |
| Contact sheet | `brand-preview.png`; 1600 × 1060 | Compare the core logo variants |

The SVGs retain editable paths and text. The wordmark uses system **Segoe UI Bold**, with Arial/sans-serif fallbacks; no font files are redistributed. SVG text metrics can differ on systems without Segoe UI. Use the supplied PNGs for fixed typography or outline text in your vector editor before printer/vendor handoff.

## Sources, generation, and rights

Canonical geometry, palette, vector layout, and raster exports are authored in [export-brand-assets.cjs](../../scripts/export-brand-assets.cjs). Run `node scripts/export-brand-assets.cjs` from the repository with npm dependencies installed to regenerate the SVG/PNG/icon family and the app's shared geometry module. The exporter uses the installed Puppeteer browser for rasterization. It does not repaint or overwrite the AI illustrations.

The illustrated banner and wallpaper were created with the built-in image-generation tool, using the canonical app icon as the banner reference and the banner as the wallpaper edit target. [generation-prompts.json](generation-prompts.json) preserves the exact prompts and provenance. The original generated outputs remain in the Codex generated-images folder; the project copies are self-contained here. No third-party stock artwork or fonts are bundled. These images depict creative intent and are not screenshots or proof of engine functionality.

Repository-authored assets are distributed under the repository's [Apache-2.0 license](../../LICENSE). The generated illustrations are included as project artwork under the same distribution terms. This does not establish trademark clearance, exclusive ownership, or a community trademark policy; fork-branding rules remain an open product decision.

## Integration and evidence

The desktop/browser home header and favicon use the canonical mark. Electron Builder uses the PNG/ICO exports for Windows/Linux app packaging. Public product text and future release filenames use PlayWeld; storage paths and technical contracts retain their compatibility identity as documented in [BRANDING.md](../../docs/BRANDING.md).

[validation.json](validation.json) records actual dimensions, format information, ICO frames, and checksums. Packaging and runtime verification are recorded in the [0.1.4 release notes](../../docs/releases/v0.1.4.md). No website deployment or domain configuration is part of this handoff.
