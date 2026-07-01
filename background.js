// SAP SRM PDF Preview (no-flash version)
//
// Flow when the user clicks a 下载 link:
//   1. content.js sees the click (a real user gesture) and asks us to open the
//      side panel AND to warm up a hidden "offscreen" page that will do the
//      fetch. Warming it up now means it's ready before SAP hands over its
//      one-time document URL, so we don't lose the race.
//   2. content-main.js intercepts SAP's window.open call (so no tab flashes)
//      and forwards the document URL to us.
//   3. We tell the offscreen page to fetch the file once, turn it into base64,
//      and send it back.
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

// Open a separate preview window, or focus the existing one so we never end
// up with two. Once open, the window updates itself because it listens for the
// same "renderData" broadcast that the side panel does.
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "openPanel") {
    pendingData = null;
    const windowId = sender.tab && sender.tab.windowId;
    if (windowId != null) {
      try {
        chrome.sidePanel.open({ windowId });
      } catch (e) {
        /* needs a user gesture; ignore if unavailable */
      }
    }
    ensureOffscreen(); // warm up the fetcher
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
