// background.js (service worker)

// Import Spotify extraction functionality
importScripts('utils/extractors/spotify-extractor.js');

let lastPlayingTabsHash = null;
let forceUpdate = false;
// Track recently playing tabs (tabId -> timestamp) to show paused tabs
// Track recently playing tabs (tabId -> timestamp) to show paused tabs
let recentlyPlayingTabs = new Map();
// Track manually removed tabs to prevent them from showing up immediately if they are still audible
let manuallyRemovedTabs = new Set();
const RECENT_TAB_TIMEOUT = 30000; // Keep paused tabs visible for 30 seconds

function updateMediaTabs() {
  chrome.tabs.query({}, (tabs) => {
    const now = Date.now();

    // Update recently playing tabs map - add currently audible tabs
    tabs.forEach(tab => {
      if (tab.audible === true) {
        recentlyPlayingTabs.set(tab.id, now);
      }
    });

    // Include tabs that are currently audible OR were recently audible
    // AND are not manually removed
    const playingTabs = tabs
      .filter(tab => (tab.audible === true || recentlyPlayingTabs.has(tab.id)) && !manuallyRemovedTabs.has(tab.id))
      .map(tab => ({
        id: tab.id,
        title: tab.title || "Untitled",
        url: tab.url,
        windowId: tab.windowId,
        audible: tab.audible,
        paused: !tab.audible && recentlyPlayingTabs.has(tab.id), // Mark as paused if not audible but recently was
        muted: tab.mutedInfo?.muted || false
      }));

    // Create a simple hash to detect actual changes
    // Include id, muted, audible, paused, title, and url to catch song changes
    const currentHash = JSON.stringify(playingTabs.map(t => ({
      id: t.id,
      muted: t.muted,
      audible: t.audible,
      paused: t.paused,
      title: t.title,
      url: t.url
    })).sort((a, b) => a.id - b.id));

    // Only update if something actually changed (unless forced)
    if (!forceUpdate && currentHash === lastPlayingTabsHash && lastPlayingTabsHash !== null) {
      return; // No changes, skip update (but allow first update)
    }

    lastPlayingTabsHash = currentHash;
    forceUpdate = false; // Reset force flag

    // Check for Spotify tabs and get song details
    playingTabs.forEach(tab => {
      if (tab.url && tab.url.includes('open.spotify.com')) {
        getSpotifySongDetails(tab.id);
      }
    });

    // Optional: store in chrome.storage for popup to read quickly
    chrome.storage.local.set({ playingTabs });

    // You can also send message to popup or side panel if open
    chrome.runtime.sendMessage({
      action: "media-tabs-updated",
      tabs: playingTabs
    }).catch(err => {
      // Silently ignore — popup is probably just closed
      if (err.message.includes("Receiving end does not exist")) {
        // optional: console.debug("Popup not open, skipping update");
      } else {
        console.error("Unexpected sendMessage error:", err);
      }
    });
  });
}

// Update when something changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If a tab becomes audible again, remove it from the manual blocklist
  if (changeInfo.audible === true) {
    manuallyRemovedTabs.delete(tabId);
  }

  // Most important fields for us
  if ("audible" in changeInfo || "mutedInfo" in changeInfo || changeInfo.status === "complete") {
    updateMediaTabs();
  }
});

// Also useful when tab becomes active
chrome.tabs.onActivated.addListener(() => {
  updateMediaTabs();
});

// Clean up closed tabs from recently playing map
chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyPlayingTabs.delete(tabId);
  manuallyRemovedTabs.delete(tabId);
  updateMediaTabs();
});

// Initial load + when extension is installed/enabled
chrome.runtime.onStartup.addListener(updateMediaTabs);
chrome.runtime.onInstalled.addListener(updateMediaTabs);

// Listen for Spotify details updates and trigger refresh
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Check if any Spotify details were updated
    const spotifyDetailChanged = Object.keys(changes).some(key => key.startsWith('spotifyDetails_'));
    if (spotifyDetailChanged) {
      // Force an update when Spotify details change (ignore hash check)
      forceUpdate = true;
      updateMediaTabs();
    }
  }
});

// Handle manual update requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "request-update") {
    forceUpdate = true;
    updateMediaTabs();
  } else if (msg.action === "remove-media-tab") {
    if (msg.tabId) {
      recentlyPlayingTabs.delete(msg.tabId);
      manuallyRemovedTabs.add(msg.tabId);
      forceUpdate = true;
      updateMediaTabs();
    }
  }
});

// Optional: update every ~5 seconds (the audible flag has a small delay anyway)
// Reduced frequency since we now check for actual changes
setInterval(updateMediaTabs, 5000);