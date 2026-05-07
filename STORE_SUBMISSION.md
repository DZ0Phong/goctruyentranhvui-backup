# Store Submission Notes

Use this file as a checklist when preparing a Microsoft Edge Add-ons or Chrome Web Store submission.

## Package

Zip these files at the root of the zip:

- `manifest.json`
- `content.js`
- `popup.html`
- `popup.js`
- `icons/`
- `LICENSE`
- `PRIVACY_POLICY.md`

Do not zip the parent repo folder itself. `manifest.json` must be at the root of the zip.

## Suggested listing text

### Extension name

GocTruyenTranhVui Follow Exporter

### Short description

Export your followed manga list and reading progress from goctruyentranhvui23.com to CSV.

### Description

GocTruyenTranhVui Follow Exporter helps users export their followed manga list and reading progress from goctruyentranhvui23.com.

Features:

- Export followed manga to CSV.
- Detect reading status such as reading, unread, and latest chapter.
- Show scan progress, story count, page count, and estimated remaining time.
- Process data locally in the browser.

This is an unofficial community tool and is not affiliated with goctruyentranhvui23.com.

### Category

Productivity

### Search terms

manga, comic, csv, exporter, reading progress, goctruyentranhvui

## Permission justification

### `tabs`

Used to verify that the active tab is on `goctruyentranhvui23.com/truyen/theo-doi` before starting the export.

### Host permission: `*://goctruyentranhvui23.com/*`

Used to read the followed list page and manga detail pages on the supported website so the extension can create the CSV export.

## Privacy answers

Recommended answer if asked whether the extension collects or transmits personal information:

The extension reads visible manga follow-list and reading-progress data from the supported website and processes it locally in the user's browser. It does not transmit, sell, or share user data with any external server controlled by the developer.

Privacy policy URL:

Use the public GitHub URL for `PRIVACY_POLICY.md`, for example:

`https://github.com/DZ0Phong/<repo-name>/blob/main/PRIVACY_POLICY.md`

## Assets

Required/recommended assets:

- Extension logo: use `icons/icon128.png`.
- Screenshots: prepare 1-3 screenshots of the popup and CSV output.
- Edge screenshots can use `640x480` or `1280x800`.
- Large promotional tile is optional.

## Testing notes for reviewers

This extension only works on:

`https://goctruyentranhvui23.com/truyen/theo-doi`

Reviewer steps:

1. Install the extension.
2. Open the supported website and sign in if needed.
3. Go to the followed manga page.
4. Click the extension icon.
5. Click `Quét dữ liệu`.
6. Wait for scanning to finish.
7. Click `Tải CSV`.

If no account with followed manga is available, the extension may not produce useful output because it depends on the user's followed list.

## GitHub repo setup

Fill these fields on GitHub:

- About description: `Export followed manga and reading progress from goctruyentranhvui23.com to CSV.`
- Website: leave empty, or use the Edge/Chrome listing URL after publishing.
- Topics: `chrome-extension`, `edge-extension`, `manga`, `csv-export`, `javascript`, `browser-extension`.

Optional:

- Create a release such as `v0.1.0`.
- Attach the zipped extension package to the release.

