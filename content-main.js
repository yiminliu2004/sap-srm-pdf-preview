// Runs in the SAP page's OWN world at document_start, before SAP's scripts.
// SAP opens document files by calling window.open(...). We intercept that call
// so a real tab never opens (no flash). Instead we hand the URL to our
// extension, which fetches the file into a hidden page and shows it in the
// side panel.

(function () {
  const nativeOpen = window.open;

  // Decide whether a window.open URL is a SAP document/file we should preview.
  // We catch the known document service (zdms_doc) plus general SAP backend
  // service paths (/sap/bc/...), which is how SAP serves file downloads. We
  // avoid hijacking normal portal windows (e.g. "New Session", which opens
  // /irj/... pages) so those keep working as usual.
  function isDocUrl(url) {
    if (typeof url !== "string") return false;
    const lower = url.toLowerCase();
    if (lower.indexOf("/irj/") !== -1) return false; // portal page, not a file
    return (
      lower.indexOf("zdms_doc") !== -1 || // known document service
      lower.indexOf("/sap/bc/") !== -1 // general SAP backend/file services
    );
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
