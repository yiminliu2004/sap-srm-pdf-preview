# Handover — SAP SRM PDF Preview

Internal handover notes for whoever maintains this Chrome extension next.
This is **not** end-user documentation (see `README.md` for that).

Repo: https://github.com/yiminliu2004/sap-srm-pdf-preview
Latest version at time of writing: **v7.8**

---

## 1. What this project is

A Chrome extension (Manifest V3) that lets users **preview** SAP SRM document
files (PDFs and images) in a side panel instead of being forced to **download**
them. It works on the SRM portal (a Web Dynpro / SAP application).

Core idea: when the user clicks a **Download** link in SRM, SAP normally serves
the file with `Content-Disposition: attachment` (forces a download) or opens it
in a new tab. The extension intercepts that, fetches/reads the file bytes, and
renders it in a docked side panel (and optionally a pop-out window). No file is
saved unless the user chooses to.

---

## 2. Current status (works today)

- Preview on click of a **Download** link — no download, no tab flash.
- PDFs render in Chrome's built-in PDF viewer.
- Images (JPG/PNG/…) are wrapped into a 1-page PDF so they get the same
  zoom/rotate/print toolbar.
- Non-previewable files (Excel/Word/zip/TIFF) show a clean **Download** button.
- Pop-out window that reuses/refreshes itself on each new file.
- **Two confirmed working download spots**: the Bill of Lading link and the
  invoice-attachment **Download** button (they use different mechanisms — see
  the log).
- SAP site address is **user-configured** (settings page), not hardcoded.
- Releases are automated via GitHub Actions on push to `main`.

---

## 3. Architecture (quick map)

| File | Runs in | Job |
| --- | --- | --- |
| `content-main.js` | SAP page's MAIN world (`document_start`) | Captures files SAP opens/builds: `window.open` URLs, `blob:` URLs, and PDF/image blobs created via `URL.createObjectURL` |
| `content.js` | Isolated content-script world | Detects Download clicks (opens the panel), forwards captured URLs/bytes |
| `background.js` | Service worker | Requests site permission, registers content scripts dynamically, intercepts SAP downloads via `chrome.downloads`, coordinates offscreen/panel/pop-out |
| `offscreen.js` | Hidden offscreen page | Fetches server document URLs with the user's session cookies |
| `panel.html` / `panel.js` | Side panel & pop-out | Detects file type by magic bytes, renders PDF/image/download-fallback |
| `options.html` / `options.js` | Settings page | User enters SAP address; requests host permission; triggers script registration |

---

## 4. Dated progress log (most recent first)

### 2026-07-13 — Loading UX + scope to SRM only (v7.9)
- **Loading state restored (cleanly).** The idle "Click a Download link"
  placeholder was showing for the whole fetch on slower files. Now a Download
  click shows **"Loading…"** until the file renders. If it's still loading after
  20s (usually = not signed in), it shows a short "sign in to SAP and try again"
  hint instead of spinning forever.
- **Cleaner messages.** Not signed in → "Please sign in to SAP first…"; fetch
  failure → "Couldn't load the file. Make sure you're signed into SAP…";
  non-previewable (Excel/Word) → "This file can't be previewed. You can
  download it:" + a Download button.
- **Scoped the download interceptor to SRM only.** It previously matched the
  whole company domain, so it also fired while the user was in SAP (`nafiorip`)
  directly. Now `chrome.downloads` only acts within ~15s of a Download click in
  SRM (`expectingDownloadUntil`), which can only happen on the configured SRM
  site. In SAP, downloads are left untouched. Content scripts were already
  SRM-only. Note: the side panel is still globally openable (Chrome limitation),
  but it no longer auto-updates outside SRM.
- Because the interceptor is now gated to a real Download click, it handles
  **all** file types in that window (Excel routed to the panel's download
  button); the "Export" button is unaffected since it isn't a Download click.

### 2026-07-12
- Wrote this handover.
- No code changes; explained the previous week's work (label change + second
  download button) to the owner.

### 2026-07-06 — Second Download button + UI cleanup (v7.1 → v7.8)
The invoice-attachment **Download** button was not being previewed. Root cause
turned out to be that SRM triggers downloads in several different ways.

- **v7.1** — SAP changed link labels from `下载` to **Download**; the click
  detector only matched `下载`, so the panel stopped auto-opening. Fixed by
  matching both labels, case-insensitively (`content.js` → `isDownloadLink`).
- **v7.2 / v7.3 / v7.4** — Iterated on the "Loading preview…" UX. Final
  decision (v7.4): **no loading screen**. Keep the current view (previous file
  or idle message) until the new file is actually ready, then swap it in.
- **v7.5** — Broadened the `window.open` interception from just `zdms_doc` to
  general SAP backend paths (`/sap/bc/...`), excluding `/irj/` and
  `/webdynpro/` (interactive windows). This alone did **not** fix the invoice.
- **v7.6** — Discovered (via the owner's DevTools Network capture) that the
  invoice file is built in the browser as a **blob** and opened via
  `window.open(blob:...)`. Added blob handling. Blob URLs can only be read by
  the page that created them, so this must run in the MAIN world.
- **v7.7** — The invoice still downloaded, because that button doesn't use
  `window.open` at all — the Web Dynpro framework does a server round-trip and
  then triggers the download programmatically. Added **two catch-alls**:
  1. Wrap `URL.createObjectURL` and preview any blob whose bytes are a PDF/image
     (checked by magic bytes), regardless of how SAP later opens it.
  2. `chrome.downloads.onCreated` — cancel + preview SAP document/image
     downloads (only PDF/image, so Excel **Export** still downloads normally).
  Added the `downloads` permission. **Invoice button confirmed working.**
- **v7.8** — Cleanup. Removed all *visible* Chinese UI text (placeholder,
  tooltips, buttons, messages) now that SAP is English. Kept `下载` in the
  click matcher (invisible) as a safety net. Updated comments + README.

### 2026-06-30 → 2026-07-01 — User-configurable SAP address (v7.0)
- Company URL was hardcoded in a public repo. Made it user-entered instead.
- Removed hardcoded `host_permissions` and static `content_scripts` from the
  manifest. Added `optional_host_permissions`, `scripting`, `storage`, and an
  options page.
- Settings page collects the SAP portal URL, calls `chrome.permissions.request`
  for the parent-domain pattern (`*://*.<domain>/*`), stores it in
  `chrome.storage.local`, and registers content scripts dynamically via
  `chrome.scripting.registerContentScripts`.
- **Decision:** keep the repo public; **git history was NOT scrubbed** (owner
  chose to defer this — see Known issues).

### Earlier (context, pre-handover)
- Evolved from header-rewrite attempts → single-fetch blob viewer → side panel
  with a relay tab (had a tab flash) → **offscreen document** for no-flash
  fetching (v6.x).
- Added image-to-PDF conversion, download fallback, pop-out window, and
  automated GitHub Releases.

---

## 5. How key problems were solved (reference)

- **Forced downloads** → intercept at multiple layers: `window.open`,
  `URL.createObjectURL` (blobs), and `chrome.downloads` (actual downloads).
- **Tab flash** → never open a real tab; return a dummy window object from the
  `window.open` override, and fetch in a hidden offscreen page.
- **One-shot document URLs** (valid for a single fetch) → fetch exactly once,
  with `credentials: "include"` and `cache: "no-store"`.
- **Blob files unreadable by the extension** → read them in the SAP page's MAIN
  world (only the creating origin can read its own blob URLs), then hand the
  base64 bytes to the panel.
- **"Preview" shows a login/HTML page** → detect HTML in the bytes and show a
  friendly "your SAP session expired, log in again" message.
- **Excel Export getting hijacked** → the downloads interceptor only acts on
  PDF/image files (by mime/extension); everything else downloads normally.
- **Privacy of the company URL** → user-entered settings + runtime permissions,
  nothing company-specific in the manifest.

---

## 6. Known issues & blockers — ⚠️ DO NOT GUESS THESE

If you touch the areas below, **get real evidence first** (DevTools Network tab,
console logs, or Basis/IT input). Guessing has repeatedly wasted time here.

1. **Users must be logged into BOTH SRM and the document backend.**
   The portal (e.g. `srm.<domain>`) and the document server (e.g.
   `nafiorip.<domain>`) are **separate systems with separate sessions**. If the
   document server session isn't established, the fetch returns a login page
   instead of the file. An extension **cannot** silently log the user into a
   second server (security). The correct fix is **server-side SSO** (shared SAP
   logon ticket `MYSAPSSO2` scoped to the parent domain, or SAML/Kerberos).
   👉 **Do not guess how their SSO/session works — this needs the SAP Basis
   team.** Confirm with them before promising a "no second login" solution.

2. **New download spots may use yet another mechanism.**
   We already found three: `window.open(serverUrl)`, `window.open(blob:)`, and
   programmatic download after a Web Dynpro round-trip. If a *new* Download
   button still downloads:
   👉 **Do not guess the mechanism.** Capture it first: DevTools → Network →
   enable "Preserve log", click the button, and inspect the request (URL,
   whether it's a `blob:`, the `Content-Disposition`/`Content-Type`). Only then
   decide which hook is needed.

3. **Permission/domain assumption.**
   The settings page derives the permission pattern from the portal host by
   taking the last two labels (`srm.minthgroup.com` → `*://*.minthgroup.com/*`).
   This assumes the document server lives on the **same parent domain**. It also
   won't be correct for multi-part TLDs (e.g. `*.co.uk`).
   👉 **Do not assume the doc server shares the domain.** Verify the actual doc
   host; if it differs, the permission request must include it explicitly.

4. **Managed / corporate Chrome (work laptops).**
   Earlier we hit "Service worker registration failed. status code: 10" on a
   managed Windows laptop — most likely security software stripping/altering
   files during unzip, or policy blocking unpacked extensions/Developer mode.
   👉 **Do not assume it's a code bug.** For managed machines, the realistic
   path is the **Chrome Web Store (unlisted)** + an IT allowlist entry. Involve
   IT rather than debugging the unpacked load.

---

## 7. Next steps / plan

- [ ] **Sweep all SRM download locations.** For each place a file can be
      downloaded, confirm it previews. For any that don't, capture the Network
      request (see #6.2) before changing code.
- [ ] **Distribution for the team / managed laptops.** Evaluate publishing to
      the Chrome Web Store as an **unlisted** item so non-technical teammates
      can install/update without Developer mode, and so managed machines can be
      allowlisted by IT.
- [ ] **SSO conversation with Basis** to remove the double-login requirement
      (#6.1). This is the biggest remaining UX gap and is **not** solvable in
      the extension alone.
- [ ] (Optional) Add a subtle in-corner spinner during fetch — currently there
      is intentionally no loading screen, so there's no "working…" cue for the
      ~1s fetch.
- [ ] (Optional, deferred by owner) Scrub the old hardcoded company URL from
      git history (`git filter-repo` / BFG + force-push). Only do this with the
      owner's explicit go-ahead; it rewrites history and requires re-cloning.

---

## 8. Build / release notes

- No build step; plain HTML/JS.
- To release: bump `"version"` in `manifest.json`, commit, push to `main`. The
  GitHub Action (`.github/workflows/release.yml`) builds
  `sap-srm-pdf-preview.zip` and publishes it under a matching tag.
- To load locally: `chrome://extensions` → Developer mode → **Load unpacked**.
  After any change to `content-main.js` / `content.js`, **reload the SAP tab**
  (content scripts only re-inject on page load).
