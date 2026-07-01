// Runs in the isolated extension world on the SAP portal.
//  - On a 下载 click we open the side panel (this needs the real user click)
//    and warm up the hidden fetcher so it's ready by the time SAP hands over
//    the one-time document URL.
//  - When the page world intercepts that URL, we forward it to the background.

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

document.addEventListener(
  "click",
  (e) => {
    const link = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!link) return;
    const text = (link.textContent || "").trim();
    if (text.includes("下载")) {
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
  }
});
