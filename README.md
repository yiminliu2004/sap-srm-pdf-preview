# SAP SRM PDF Preview

A Chrome extension that previews SAP SRM document files (PDFs and images) in a
side panel instead of forcing you to download them.

## What it does

- Click a **Download** link in SAP → the file opens in a **side panel**, no download, no tab flash.
- **PDFs** open in Chrome's built-in viewer (rotate, zoom, print, download).
- **Images (JPG/PNG/…)** are shown in that same viewer, so you can rotate sideways scans.
- **Excel / Word / zip / TIFF** files show a clean **Download** button (browsers can't preview them).
- A **pop-out icon** (top-right of the panel) opens the file in a **separate window** that
  updates itself every time you click a new Download link.

---

## How to install (for everyone)

You only do steps 1–2 once. After that, installing is quick.

1. **Download the extension**
   - Go to the [**Releases**](../../releases) page.
   - Under the latest release, download **`sap-srm-pdf-preview.zip`**.
   - **Unzip it** (double-click the ZIP). Remember where the unzipped folder is.

2. **Turn on Developer mode in Chrome**
   - Open a new tab and go to `chrome://extensions`.
   - Turn on the **Developer mode** toggle in the top-right corner.

3. **Load the extension**
   - Click **Load unpacked**.
   - Select the **unzipped folder** (the one containing `manifest.json`).
   - The "SAP SRM PDF Preview" card should appear.

4. **Set up your SAP address (first time only)**
   - The first time you load the extension, a **Settings** tab opens automatically.
     (You can reopen it any time from `chrome://extensions` → the extension's
     **Details** → **Extension options**.)
   - Log into SAP in another tab, copy the address from the browser's address bar,
     and paste it into the box.
   - Click **Save & enable** and choose **Allow** when Chrome asks for permission.

5. **Use it**
   - Log into SAP as usual.
   - Click a **Download** link — the preview opens in the side panel on the right.

> Tip: If a preview ever says "your SAP session expired," just refresh/log back
> into SAP and click the link again.

> Note: The SAP address is not stored in this public repository. Each person
> enters it once on their own machine (step 4), and it stays on their machine only.

---

## Updating to a new version

1. Download the new `sap-srm-pdf-preview.zip` from **Releases** and unzip it
   (replace your old folder).
2. Go to `chrome://extensions` and click the **refresh/reload icon** on the
   "SAP SRM PDF Preview" card.
3. If it doesn't pick up the change, click **Remove** and **Load unpacked** the
   new folder again.

---

## Troubleshooting

- **Nothing happens when I click Download** — Make sure the extension card is enabled
  in `chrome://extensions`, then reload the SAP tab.
- **"Extension context invalidated" errors** — Harmless; they appear if the
  extension was reloaded while an SAP tab stayed open. Reload the SAP tab to clear.
- **Preview shows a login page** — Your SAP session expired. Log back in and retry.

---

## For maintainers

The extension is plain HTML/JS (no build step). Files:

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension config (Manifest V3) — no hardcoded site address |
| `options.html` / `options.js` | Settings page; user enters their SAP address on first use |
| `content-main.js` | Captures files SAP opens/builds (window.open URLs and PDF/image blobs) so nothing downloads or flashes |
| `content.js` | Detects Download clicks, opens the side panel, forwards captured files |
| `background.js` | Requests site permission, registers content scripts, intercepts SAP document downloads, coordinates fetch/panel/pop-out |
| `offscreen.html` / `offscreen.js` | Hidden page that fetches the file with your session |
| `panel.html` / `panel.js` | The viewer (PDF, images, download fallback, pop-out) |

### Cutting a release

Releases are automatic. Bump `"version"` in `manifest.json`, commit, and push
to `main`. The GitHub Action (`.github/workflows/release.yml`) builds
`sap-srm-pdf-preview.zip` and publishes it under a matching tag on the
**Releases** page.
