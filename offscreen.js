// A hidden extension page (no tab, not visible). It fetches the SAP document
// once, with the user's session cookies, turns it into base64, and sends it
// back to the background. This runs in the extension's own origin (like the
// old relay tab) so cookies flow reliably.

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "offscreenFetch" || !msg.url) return;
  (async () => {
    try {
      const resp = await fetch(msg.url, {
        credentials: "include",
        cache: "no-store"
      });
      const buf = await resp.arrayBuffer();
      chrome.runtime.sendMessage({
        type: "fileData",
        b64: arrayBufferToBase64(buf)
      });
    } catch (e) {
      chrome.runtime.sendMessage({
        type: "fileError",
        error: e && e.message ? e.message : String(e)
      });
    }
  })();
});
