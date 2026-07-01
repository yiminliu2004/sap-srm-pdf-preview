const input = document.getElementById("url");
const statusEl = document.getElementById("status");

// Build a permission pattern that covers the portal AND the document server
// (usually a sibling subdomain), e.g. srm.example.com -> *://*.example.com/*
function domainPatternFromHost(host) {
  const parts = host.split(".");
  if (parts.length >= 2) {
    const base = parts.slice(-2).join(".");
    return "*://*." + base + "/*";
  }
  return "*://" + host + "/*";
}

async function refreshStatus() {
  const cfg = await chrome.storage.local.get(["portalPattern"]);
  let registered = false;
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    registered = scripts.some((s) => s.id === "sap-iso");
  } catch (e) {
    /* ignore */
  }
  if (cfg.portalPattern && registered) {
    statusEl.textContent = "Enabled for: " + cfg.portalPattern;
  } else if (cfg.portalPattern) {
    statusEl.textContent =
      "Saved, but not active yet. Click \"Save & enable\" to finish.";
  } else {
    statusEl.textContent = "Not set up yet.";
  }
}

async function load() {
  const cfg = await chrome.storage.local.get(["portalUrl"]);
  if (cfg.portalUrl) input.value = cfg.portalUrl;
  refreshStatus();
}

document.getElementById("save").addEventListener("click", async () => {
  const raw = input.value.trim();
  let url;
  try {
    url = new URL(raw);
  } catch (e) {
    statusEl.textContent =
      "Please enter a full address, including https:// — for example " +
      "https://your-sap-portal.example.com/irj/portal";
    return;
  }

  const host = url.hostname;
  const portalPattern = "*://" + host + "/*";
  const domainPattern = domainPatternFromHost(host);

  // Ask Chrome for access to that site (this click is the required gesture).
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [domainPattern] });
  } catch (e) {
    statusEl.textContent = "Could not request permission: " + e.message;
    return;
  }
  if (!granted) {
    statusEl.textContent =
      "Permission was not granted, so the extension can't run yet. " +
      "Click \"Save & enable\" again and choose Allow.";
    return;
  }

  await chrome.storage.local.set({
    portalUrl: raw,
    portalPattern,
    domainPattern
  });

  // Have the background register the content scripts for this site.
  try {
    const resp = await chrome.runtime.sendMessage({
      type: "registerScripts",
      portalPattern
    });
    if (resp && resp.ok === false) throw new Error(resp.error || "unknown");
  } catch (e) {
    statusEl.textContent = "Saved, but activation failed: " + e.message;
    return;
  }

  await refreshStatus();
  statusEl.textContent =
    "Saved and enabled for " +
    host +
    ".\nNow open (or reload) your SAP tab and click a 下载 link.";
});

load();
