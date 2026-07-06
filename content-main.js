// Runs in the SAP page's OWN world at document_start, before SAP's scripts.
// SAP opens document files by calling window.open(...). We intercept that call
// so a real tab never opens (no flash). Two cases:
//   1. A server URL (e.g. .../sap/bc/zdms_doc?...): we forward the URL and let
//      the hidden fetcher download it with the user's session.
//   2. A blob: URL (SAP built the file in the browser, e.g. the invoice
//      download): only this page can read its own blob URLs, so we fetch the
//      bytes right here and hand them over directly.

(function () {
  const nativeOpen = window.open;

  function abToB64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // Decide whether a window.open URL is a SAP document/file we should preview.
  // Catches the known document service (zdms_doc) and general SAP backend file
  // services (/sap/bc/...), but not interactive windows: portal pages (/irj/)
  // or Web Dynpro app windows (/webdynpro/).
  function isDocUrl(url) {
    if (typeof url !== "string") return false;
    const lower = url.toLowerCase();
    if (lower.indexOf("/irj/") !== -1) return false;
    if (lower.indexOf("/webdynpro/") !== -1) return false;
    return lower.indexOf("zdms_doc") !== -1 || lower.indexOf("/sap/bc/") !== -1;
  }

  // A harmless stand-in so SAP's code doesn't break when it expects a window.
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

  window.open = function (url) {
    try {
      if (typeof url === "string" && url.indexOf("blob:") === 0) {
        // SAP built the file as a blob in this page. Only this page can read
        // its own blob URLs, so fetch the bytes here and send them over.
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((buf) => {
            window.postMessage(
              { __sapPdfPreviewData: true, b64: abToB64(buf) },
              "*"
            );
          })
          .catch(() => {
            /* couldn't read the blob; nothing we can do here */
          });
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
