// Runs in the isolated extension world on the SAP portal.
//  - On a Download click we open the side panel (this needs the real user
//    click) and warm up the hidden fetcher.
//  - When the page world captures the file (a URL or the file's bytes), we
//    forward it to the background.

// After the extension is reloaded/updated, old copies of this script can still
// be running in an already-open SAP tab. Their connection is dead, so guard
// every send to avoid "Extension context invalidated" errors.
function safeSend(msg) {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(msg);
    }
  } catch (e) {
    /* extension was reloaded; this stale script can be ignored */
  }
}

// Match SAP's download links. Handles "Download" (English) and 下载 (Chinese)
// so it keeps working if the label ever switches back.
function isDownloadLink(text) {
  return text.toLowerCase().includes("download") || text.includes("下载");
}

document.addEventListener(
  "click",
  (e) => {
    const el = e.target;
    if (!el) return;
    // Prefer the enclosing link, but also handle non-anchor "Download" labels
    // (Web Dynpro sometimes renders them as spans/buttons). Guard on length so
    // we don't match a big container that happens to contain the word.
    const link = el.closest ? el.closest("a") : null;
    const text = ((link ? link.textContent : el.textContent) || "").trim();
    if (text.length <= 30 && isDownloadLink(text)) {
      safeSend({ type: "openPanel" });
    }
  },
  true
);

window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (d && d.__sapPdfPreview && d.url) {
    safeSend({ type: "previewUrl", url: d.url });
  } else if (d && d.__sapPdfPreviewData && d.b64) {
    // File bytes captured directly from a blob in the page.
    safeSend({ type: "fileData", b64: d.b64 });
  }
});
