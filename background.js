// SAP SRM PDF Preview (no-flash version, user-configured site)
//
// The SAP site address is NOT hardcoded. The user enters it on the settings
// page; we then request permission for that site and register the content
// scripts for it dynamically.
//
// Flow when the user clicks a 下载 link:
//   1. content.js sees the click and asks us to open the side panel AND warm
//      up a hidden "offscreen" page that will do the fetch.
//   2. content-main.js intercepts SAP's window.open call (so no tab flashes)
//      and forwards the document URL to us.
//   3. The offscreen page fetches the file once, turns it into base64, sends
//      it back.
//   4. We hand the data to the side panel, which renders it. No download.

let pendingData = null;
let creating = null; // de-dupe concurrent offscreen creation
let previewWindowId = null; // the popped-out preview window, if open

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["BLOBS"],
    justification: "Fetch SAP document bytes for in-browser preview."
  });
  try {
    await creating;
  } catch (e) {
    /* another call may have created it first */
  } finally {
    creating = null;
  }
}

// --- Dynamic content-script registration (host is user-configured) ---

async function registerScripts(portalPattern) {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ids = existing
      .filter((s) => s.id === "sap-main" || s.id === "sap-iso")
      .map((s) => s.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  } catch (e) {
    /* nothing registered yet */
  }
  await chrome.scripting.registerContentScripts([
    {
      id: "sap-main",
      matches: [portalPattern],
      js: ["content-main.js"],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true,
      persistAcrossSessions: true
    },
    {
      id: "sap-iso",
      matches: [portalPattern],
      js: ["content.js"],
      runAt: "document_idle",
      allFrames: true,
      persistAcrossSessions: true
    }
  ]);
}

async function ensureRegistered() {
  const cfg = await chrome.storage.local.get(["portalPattern"]);
  if (!cfg.portalPattern) return;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    if (!existing.some((s) => s.id === "sap-iso")) {
      await registerScripts(cfg.portalPattern);
    }
  } catch (e) {
    /* ignore */
  }
}

// --- Pop-out preview window ---

function openOrFocusWindow() {
  if (previewWindowId != null) {
    chrome.windows.get(previewWindowId, {}, (win) => {
      if (chrome.runtime.lastError || !win) {
        previewWindowId = null;
        createWindow();
      } else {
        chrome.windows.update(previewWindowId, { focused: true });
      }
    });
  } else {
    createWindow();
  }
}

function createWindow() {
  chrome.windows.create(
    {
      url: chrome.runtime.getURL("panel.html?popup=1"),
      type: "popup",
      width: 820,
      height: 1000
    },
    (win) => {
      if (win) previewWindowId = win.id;
    }
  );
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === previewWindowId) previewWindowId = null;
});

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener((details) => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
  ensureRegistered();
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage(); // first-run setup
  }
});
chrome.runtime.onStartup.addListener(ensureRegistered);

// --- Messages ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "registerScripts" && msg.portalPattern) {
    registerScripts(msg.portalPattern)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }

  if (msg.type === "openPanel") {
    // A download was clicked: a file is on its way. Mark "loading" so the panel
    // shows "Loading preview…" straight away instead of the idle placeholder.
    pendingData = { loading: true };
    const windowId = sender.tab && sender.tab.windowId;
    if (windowId != null) {
      try {
        chrome.sidePanel.open({ windowId });
      } catch (e) {
        /* needs a user gesture; ignore if unavailable */
      }
    }
    ensureOffscreen(); // warm up the fetcher
    // If the panel/window is already open, switch it to the loading state now.
    chrome.runtime.sendMessage({ type: "loading" }).catch(() => {});
    return;
  }

  if (msg.type === "openWindow") {
    openOrFocusWindow();
    return;
  }

  if (msg.type === "previewUrl" && msg.url) {
    (async () => {
      await ensureOffscreen();
      chrome.runtime
        .sendMessage({ type: "offscreenFetch", url: msg.url })
        .catch(() => {});
    })();
    return;
  }

  if (msg.type === "fileData" && msg.b64) {
    pendingData = { b64: msg.b64 };
    chrome.runtime
      .sendMessage({ type: "renderData", b64: msg.b64 })
      .catch(() => {});
    return;
  }

  if (msg.type === "fileError") {
    pendingData = { error: msg.error };
    chrome.runtime
      .sendMessage({ type: "fileError", error: msg.error })
      .catch(() => {});
    return;
  }

  if (msg.type === "getPending") {
    sendResponse(pendingData);
    return true;
  }
});
