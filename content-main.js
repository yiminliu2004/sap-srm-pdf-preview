// Runs in the SAP page's OWN world at document_start, before SAP's scripts.
// SAP opens document files by calling window.open(...). We intercept that call
// so a real tab never opens (no flash). Instead we hand the URL to our
// extension, which fetches the file into a hidden page and shows it in the
// side panel.

(function () {
  const nativeOpen = window.open;

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
      if (typeof url === "string" && url.indexOf("zdms_doc") !== -1) {
        window.postMessage({ __sapPdfPreview: true, url: url }, "*");
        return dummyWindow();
      }
    } catch (e) {
      /* fall through to normal behavior */
    }
    return nativeOpen.apply(window, arguments);
  };
})();
