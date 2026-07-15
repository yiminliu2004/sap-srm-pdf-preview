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

No coding needed. Just follow these steps carefully — screenshots are included so
you can match your screen to each step. You only do steps 1–4 once. After that,
the extension just works whenever you're in SAP.

### Step 1 — Download and unzip the extension

1. Go to the [**Releases**](../../releases) page of this repository.
2. Under the **latest** release, find the file named **`sap-srm-pdf-preview.zip`**
   and click it to download.
3. Find the downloaded ZIP (usually in your **Downloads** folder) and **unzip it**:
   - **Windows:** right-click the ZIP → **Extract All…** → **Extract**.
   - **Mac:** double-click the ZIP.
4. You'll now have a **folder** called `sap-srm-pdf-preview` (it contains a file
   named `manifest.json`). **Remember where this folder is** — you'll point Chrome
   at it in Step 3.

> Important: Load the **unzipped folder**, not the ZIP file. If you only see a ZIP,
> you haven't extracted it yet.

### Step 2 — Open Chrome's Extensions page and turn on Developer mode

1. Open a new Chrome tab, type `chrome://extensions` in the address bar, and press
   Enter.
2. In the **top-right corner**, turn on the **Developer mode** toggle.
3. Three buttons appear on the top-left: **Load unpacked**, **Pack extension**,
   **Update**.

![Chrome Extensions page with Developer mode on and Load unpacked highlighted](docs/screenshots/1-load-unpacked.png)

### Step 3 — Load the extension

1. Click **Load unpacked** (top-left).
2. In the file picker, select the **unzipped folder** from Step 1 (the folder that
   contains `manifest.json`) and confirm.
3. The **SAP SRM PDF Preview** card appears in your list of extensions, showing the
   version number (e.g. `8.0`).

> If you get an error like "Manifest file is missing or unreadable," you probably
> selected the ZIP or the wrong folder. Go back and pick the **unzipped** folder
> that directly contains `manifest.json`.

### Step 4 — Enter your SAP address (first time only)

The extension needs to know which website is your SAP portal. You enter it once.

1. Open the **Settings** page for the extension. There are two ways:
   - The first time you load it, a **Settings** tab may open automatically, **or**
   - On `chrome://extensions`, click **Details** on the SAP SRM PDF Preview card…

![Extension card with the Details button highlighted](docs/screenshots/1-load-unpacked.png)

   …then scroll down and click **Extension options**.

![Extension details page with Extension options highlighted](docs/screenshots/2-extension-options.png)

2. On the Settings page:
   - Open SAP in another tab and **log in**.
   - Copy the full web address from your browser's address bar (for example,
     something ending in `/irj/portal`).
   - Paste it into the **SAP portal address** box.
   - Click **Save & enable**.

![Settings page with the SAP portal address box and Save & enable button](docs/screenshots/3-settings.png)

3. When Chrome asks for permission to access that site, click **Allow**.
4. After saving, the page sends you back to `chrome://extensions`. You're done
   setting up.

### Step 5 — Use it

1. Go to your SAP tab (reload it once if it was already open before you installed
   the extension).
2. Click a **Download** link on a document.
3. The file opens in a **side panel** on the right — no download, no tab flash.
   - PDFs and images open in Chrome's viewer (rotate, zoom, print).
   - Files that can't be previewed (Excel, Word, etc.) show a **Download** button.
4. Want a bigger view? Click the **pop-out icon** in the top-right of the panel to
   open the file in its own window. That window reuses itself for the next file you
   preview.

> Tip: If a preview ever says "please sign in to SAP," just refresh/log back into
> SAP and click the link again.

> Privacy note: The SAP address is **not** stored in this public repository. Each
> person enters it once on their own machine (Step 4), and it stays on their
> machine only.

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
