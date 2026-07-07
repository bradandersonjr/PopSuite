/**
 * PopJot extension background service worker (Manifest V3).
 *
 * Responsibilities:
 * - Persist settings to chrome.storage.local so they survive page reloads
 * - Report per-tab zoom so the radial menu can ignore browser page zoom
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "POPJOT_SAVE_SETTINGS") {
    chrome.storage.local.set(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "POPJOT_LOAD_SETTINGS") {
    chrome.storage.local.get(null).then((settings) => sendResponse({ ok: true, settings }));
    return true;
  }

  if (message.type === "POPJOT_GET_TAB_ZOOM") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, zoomFactor: 1 });
      return false;
    }

    chrome.tabs
      .getZoom(tabId)
      .then((zoomFactor) => sendResponse({ ok: true, zoomFactor }))
      .catch(() => sendResponse({ ok: false, zoomFactor: 1 }));
    return true;
  }
});

chrome.tabs.onZoomChange.addListener(({ tabId, newZoomFactor }) => {
  chrome.tabs.sendMessage(tabId, {
    type: "POPJOT_TAB_ZOOM_CHANGED",
    zoomFactor: newZoomFactor,
  }).catch(() => {
    // Ignore tabs where the content script is unavailable.
  });
});
