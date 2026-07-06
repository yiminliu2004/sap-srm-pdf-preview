// Runs in the SAP page's OWN world at document_start, before SAP's scripts.
// SAP triggers document downloads in several ways. We catch them here so the
// file is previewed instead of downloaded:
//   1. window.open(serverUrl)  -> forward the URL; the hidden fetcher gets it.
//   2. window.open(blob:...)   -> read the blob's bytes here and hand them over.
//   3. URL.createObjectURL(pdf/image blob) -> SAP built a file in the browser;
//      read it and hand the bytes over regardless of how it's later opened.
// Blob URLs can only be read by the page that created them, which is why this
// has to happen in the page's own world.

(function () {
  const nativeOpen = window.open;
  const nativeCreateObjectURL = URL.createObjectURL;

  function abToB64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // Only preview blobs that really are a document/image (by magic bytes), so we
  // never hijack unrelated blobs SAP might create.
  function looksLikeDoc(b) {
    if (!b || b.length < 4) return false;
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
      return true; // %PDF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
      return true; // PNG
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
    if (b[0] === 0x42 && b[1] === 0x4d) return true; // BMP
    if (
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    )
      return true; // WEBP
    return false;
  }

  // De-dupe: the same file can arrive via more than one hook (e.g. blob create
  // + window.open). Skip if we just sent an identical-looking payload.
  let lastKey = "";
  let lastTime = 0;
  function sendBytes(buf) {
    const bytes = new Uint8Array(buf);
    const key =
      bytes.length +
      ":" +
      (bytes[0] || 0) +
      "-" +
      (bytes[bytes.length - 1] || 0);
    const now = Date.now();
    if (key === lastKey && now - lastTime < 4000) return;
    lastKey = key;
    lastTime = now;
    window.postMessage({ __sapPdfPreviewData: true, b64: abToB64(buf) }, "*");
  }

  // Decide whether a window.open URL is a SAP document/file (server URL).
  function isDocUrl(url) {
    if (typeof url !== "string") return false;
    const lower = url.toLowerCase();
    if (lower.indexOf("/irj/") !== -1) return false;
    if (lower.indexOf("/webdynpro/") !== -1) return false;
    return lower.indexOf("zdms_doc") !== -1 || lower.indexOf("/sap/bc/") !== -1;
  }

  function dummyWindow() {
    return {
      closed: false,
      close() {},
      focus() {},
      blur() {},
      postMessage() {},
      document: { write() {}, writeln() {}, close() {} },
      location: { href: "", replace() {}, assign() {} }
    };
  }

  // Hook 3: SAP building a file blob in the browser.
  URL.createObjectURL = function (obj) {
    const url = nativeCreateObjectURL.call(URL, obj);
    try {
      if (obj instanceof Blob) {
        obj
          .arrayBuffer()
          .then((buf) => {
            if (looksLikeDoc(new Uint8Array(buf))) sendBytes(buf);
          })
          .catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
    return url;
  };

  // Hooks 1 & 2: SAP opening a window for the file.
  window.open = function (url) {
    try {
      if (typeof url === "string" && url.indexOf("blob:") === 0) {
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((buf) => {
            if (looksLikeDoc(new Uint8Array(buf))) sendBytes(buf);
          })
          .catch(() => {});
        return dummyWindow();
      }
      if (isDocUrl(url)) {
        window.postMessage({ __sapPdfPreview: true, url: url }, "*");
        return dummyWindow();
      }
    } catch (e) {
      /* fall through to normal behavior */
    }
    return nativeOpen.apply(window, arguments);
  };
})();
