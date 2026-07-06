// When this page is the popped-out window itself, don't show the pop-out
// button (it would be redundant).
const isPopup = new URLSearchParams(location.search).has("popup");

// A small floating "open in a new window" icon. It's attached to the root
// element (not #content), so it survives the content re-renders.
function addPopButton() {
  if (isPopup || document.getElementById("popbtn")) return;
  const b = document.createElement("button");
  b.id = "popbtn";
  b.title = "在新窗口打开 (Open in a separate window)";
  b.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/>' +
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
    "</svg>";
  b.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "openWindow" });
    // Give the message a moment to reach the background, then close the panel.
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        /* ignore if the panel can't self-close */
      }
    }, 120);
  });
  document.documentElement.appendChild(b);
}

// The area below the top bar where files are rendered.
function clearContent() {
  const c = document.getElementById("content");
  c.innerHTML = "";
  return c;
}

function setStatus(text) {
  const c = clearContent();
  const d = document.createElement("div");
  d.id = "status";
  d.textContent = text;
  c.appendChild(d);
}

// Identify the file type from its first bytes (magic numbers).
function detectMime(b) {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return "application/pdf"; // %PDF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
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
    return "image/webp";
  if (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  )
    return "image/tiff";
  return null;
}

// Image viewer with rotate / zoom / fit / download controls.
function renderImage(blobUrl, mime) {
  const root = clearContent();

  const viewer = document.createElement("div");
  viewer.id = "viewer";

  const bar = document.createElement("div");
  bar.id = "toolbar";

  const stage = document.createElement("div");
  stage.id = "stage";
  const wrap = document.createElement("div");
  wrap.id = "imgwrap2";
  const img = document.createElement("img");
  wrap.appendChild(img);
  stage.appendChild(wrap);

  let rotation = 0;
  let zoom = 1;

  function apply() {
    const rad = (rotation * Math.PI) / 180;
    const w = img.naturalWidth * zoom;
    const h = img.naturalHeight * zoom;
    const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    img.style.width = w + "px";
    img.style.height = h + "px";
    img.style.left = (bw - w) / 2 + "px";
    img.style.top = (bh - h) / 2 + "px";
    img.style.transform = "rotate(" + rotation + "deg)";
    wrap.style.width = bw + "px";
    wrap.style.height = bh + "px";
  }

  // Scale so the image (at its current rotation) fits the panel.
  function fit() {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return;
    const sw = stage.clientWidth - 16;
    const sh = stage.clientHeight - 16;
    const rad = (rotation * Math.PI) / 180;
    const bw = Math.abs(nw * Math.cos(rad)) + Math.abs(nh * Math.sin(rad));
    const bh = Math.abs(nw * Math.sin(rad)) + Math.abs(nh * Math.cos(rad));
    zoom = Math.min(sw / bw, sh / bh);
    if (!isFinite(zoom) || zoom <= 0) zoom = 1;
    apply();
  }

  function btn(label, title, fn) {
    const b = document.createElement("button");
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", fn);
    return b;
  }

  bar.appendChild(
    btn("↺", "向左旋转 (Rotate left)", () => {
      rotation = (rotation - 90 + 360) % 360;
      fit();
    })
  );
  bar.appendChild(
    btn("↻", "向右旋转 (Rotate right)", () => {
      rotation = (rotation + 90) % 360;
      fit();
    })
  );
  bar.appendChild(
    btn("－", "缩小 (Zoom out)", () => {
      zoom = Math.max(0.05, zoom * 0.8);
      apply();
    })
  );
  bar.appendChild(
    btn("＋", "放大 (Zoom in)", () => {
      zoom = Math.min(20, zoom * 1.25);
      apply();
    })
  );
  bar.appendChild(btn("适应", "适应窗口 (Fit)", fit));

  const spacer = document.createElement("div");
  spacer.className = "spacer";
  bar.appendChild(spacer);

  const dl = document.createElement("a");
  dl.textContent = "⬇ 下载";
  dl.title = "下载 (Download)";
  dl.href = blobUrl;
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/gif"
      ? "gif"
      : mime === "image/bmp"
      ? "bmp"
      : mime === "image/webp"
      ? "webp"
      : "jpg";
  dl.download = "sap-file." + ext;
  dl.className = "tbtn";
  bar.appendChild(dl);

  viewer.appendChild(bar);
  viewer.appendChild(stage);
  root.appendChild(viewer);

  img.onload = fit;
  img.src = blobUrl;
  window.addEventListener("resize", fit);
}

// Build a minimal one-page PDF that embeds a JPEG, sized to the image.
// No external library needed — the JPEG bytes are stored directly (DCTDecode).
function buildPdfFromJpeg(jpeg, w, h) {
  const enc = (s) => new TextEncoder().encode(s);
  const parts = [];
  let len = 0;
  const offsets = [];
  function push(bytes) {
    parts.push(bytes);
    len += bytes.length;
  }
  function pushStr(s) {
    push(enc(s));
  }

  pushStr("%PDF-1.3\n");

  offsets[1] = len;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = len;
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  offsets[3] = len;
  pushStr(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      w +
      " " +
      h +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );

  offsets[4] = len;
  pushStr(
    "4 0 obj\n<< /Type /XObject /Subtype /Image /Width " +
      w +
      " /Height " +
      h +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      jpeg.length +
      " >>\nstream\n"
  );
  push(jpeg);
  pushStr("\nendstream\nendobj\n");

  const contentBytes = enc("q " + w + " 0 0 " + h + " 0 0 cm /Im0 Do Q\n");
  offsets[5] = len;
  pushStr("5 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n");
  push(contentBytes);
  pushStr("endstream\nendobj\n");

  const xrefStart = len;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pushStr(xref);
  pushStr(
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF"
  );

  const out = new Uint8Array(len);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// Turn any image into a one-page PDF and show it in Chrome's built-in PDF
// viewer (so images get the same toolbar as PDFs). Falls back to the custom
// image viewer if anything goes wrong.
function renderImageAsPdf(bytes, mime) {
  const srcBlobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const image = new Image();
  image.onload = () => {
    try {
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      if (!w || !h) throw new Error("no dimensions");
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // flatten transparency (e.g. PNG)
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0);
      const b64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
      const jbin = atob(b64);
      const jpeg = new Uint8Array(jbin.length);
      for (let i = 0; i < jbin.length; i++) jpeg[i] = jbin.charCodeAt(i);
      const pdf = buildPdfFromJpeg(jpeg, w, h);
      const pdfUrl = URL.createObjectURL(
        new Blob([pdf], { type: "application/pdf" })
      );
      const root = clearContent();
      const iframe = document.createElement("iframe");
      iframe.src = pdfUrl;
      root.appendChild(iframe);
    } catch (e) {
      renderImage(srcBlobUrl, mime); // fall back to custom toolbar
    }
  };
  image.onerror = () => renderImage(srcBlobUrl, mime);
  image.src = srcBlobUrl;
}

// Search for a short ASCII marker inside the file bytes (bounded for speed).
function bytesIncludes(bytes, str) {
  const n = Math.min(bytes.length, 1000000);
  const m = str.length;
  outer: for (let i = 0; i + m <= n; i++) {
    for (let j = 0; j < m; j++) {
      if (bytes[i + j] !== str.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

// Best-guess filename (mostly for the extension) for non-previewable files.
function guessName(bytes) {
  const b = bytes;
  if (b[0] === 0x50 && b[1] === 0x4b) {
    // PK = zip container (Office files are zips)
    if (bytesIncludes(b, "xl/")) return "sap-file.xlsx";
    if (bytesIncludes(b, "word/")) return "sap-file.docx";
    if (bytesIncludes(b, "ppt/")) return "sap-file.pptx";
    return "sap-file.zip";
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0)
    return "sap-file.xls"; // legacy MS Office
  if (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  )
    return "sap-file.tif";
  return "sap-file";
}

// For file types the browser can't preview (Excel, Word, zip, TIFF, ...),
// show a clean Download button instead of an error.
function renderDownload(bytes, filename) {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/octet-stream" })
  );
  const root = clearContent();
  const wrap = document.createElement("div");
  wrap.id = "status";

  const line1 = document.createElement("div");
  line1.textContent = "This file type can't be previewed in the browser.";

  const line2 = document.createElement("div");
  line2.textContent = filename;
  line2.style.cssText = "margin:8px 0 4px;opacity:0.75;";

  const a = document.createElement("a");
  a.textContent = "⬇ 下载 (Download)";
  a.href = url;
  a.download = filename;
  a.style.cssText =
    "display:inline-block;margin-top:12px;background:#4a4e51;color:#fff;" +
    "padding:8px 14px;border-radius:4px;text-decoration:none;font-size:14px;";

  wrap.appendChild(line1);
  wrap.appendChild(line2);
  wrap.appendChild(a);
  root.appendChild(wrap);
}

function renderBase64(b64) {
  setStatus("Loading preview…");
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    if (bytes.byteLength === 0) {
      throw new Error("The file came back empty.");
    }

    const mime = detectMime(bytes);

    if (!mime) {
      const peek = new TextDecoder().decode(bytes.slice(0, 400)).toLowerCase();
      const looksLikeHtml =
        peek.indexOf("<!doctype html") !== -1 || peek.indexOf("<html") !== -1;
      if (looksLikeHtml) {
        throw new Error(
          "Couldn't load the file — SAP sent back a web page instead.\n\n" +
            "This almost always means your SAP session expired or you're " +
            "not logged in.\n\nFix: click into the SAP tab, make sure you're " +
            "logged in (log in again if it asks), then click the Download " +
            "(下载) link " +
            "again."
        );
      }
      // Not a PDF or image (e.g. Excel/Word/zip) — offer a download instead.
      renderDownload(bytes, guessName(bytes));
      return;
    }

    if (mime === "image/tiff") {
      // Browsers can't render TIFF — offer a download.
      renderDownload(bytes, "sap-file.tif");
      return;
    }

    if (mime === "application/pdf") {
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const root = clearContent();
      const iframe = document.createElement("iframe");
      iframe.src = blobUrl;
      root.appendChild(iframe);
    } else {
      renderImageAsPdf(bytes, mime);
    }
  } catch (e) {
    setStatus("Preview failed: " + (e && e.message ? e.message : e));
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "renderData" && msg.b64) {
    renderBase64(msg.b64);
  } else if (msg.type === "loading") {
    setStatus("Loading preview…");
  } else if (msg.type === "fileError") {
    setStatus("Preview failed: " + msg.error);
  }
});

addPopButton();

// Show a setup prompt if the SAP site hasn't been configured yet.
function showSetup() {
  const c = clearContent();
  const d = document.createElement("div");
  d.id = "status";
  d.textContent =
    "This extension isn't set up yet.\n\nClick below to enter your SAP site address.";
  const btn = document.createElement("button");
  btn.textContent = "Open settings";
  btn.style.cssText =
    "display:block;margin-top:14px;background:#4a4e51;color:#fff;border:0;" +
    "border-radius:4px;padding:8px 14px;font-size:14px;cursor:pointer;";
  btn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  d.appendChild(btn);
  c.appendChild(d);
}

// If a file was already fetched (or is on its way) before this panel finished
// opening, reflect that immediately so we skip the idle placeholder.
chrome.runtime.sendMessage({ type: "getPending" }, (resp) => {
  if (chrome.runtime.lastError) return;
  if (resp && resp.b64) {
    renderBase64(resp.b64);
  } else if (resp && resp.error) {
    setStatus("Preview failed: " + resp.error);
  } else if (resp && resp.loading) {
    setStatus("Loading preview…");
  } else if (!isPopup) {
    // Nothing pending: show the setup prompt if not configured yet.
    chrome.storage.local.get(["portalPattern"], (cfg) => {
      if (!cfg || !cfg.portalPattern) showSetup();
    });
  }
});
