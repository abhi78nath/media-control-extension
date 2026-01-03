// popup.js
function renderTabs(tabs = []) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  if (tabs.length === 0) {
    list.innerHTML = "<li>No tabs playing media right now</li>";
    return;
  }

  tabs.forEach((tab) => {
    const li = document.createElement("li");
    li.className = tab.muted ? "muted" : "playing";
    li.title = tab.url;

    // Title + hostname
    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `
          <strong>${tab.title || "Untitled"}</strong><br>
          <small>${new URL(tab.url).hostname}</small>
        `;

    // Mute toggle button
    const muteBtn = document.createElement("button");
    muteBtn.textContent = tab.muted ? "Unmute 🔊" : "Mute 🔇";
    muteBtn.className = "mute-btn";
    muteBtn.title = tab.muted ? "Unmute this tab" : "Mute this tab";

    muteBtn.onclick = async (e) => {
      e.stopPropagation(); // Prevent li click (focus tab)
      try {
        await chrome.tabs.update(tab.id, { muted: !tab.muted });
        // The tab will update → onUpdated listener in background will refresh storage → popup gets message → re-renders
      } catch (err) {
        console.error("Failed to toggle mute:", err);
      }
    };

    // Click anywhere else on the row → focus the tab
    li.onclick = () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    };

    li.appendChild(info);
    li.appendChild(muteBtn);
    list.appendChild(li);
  });
}

// Load once
chrome.storage.local.get("playingTabs", (data) => {
  renderTabs(data.playingTabs);
});

// Listen to live updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "media-tabs-updated") {
    renderTabs(msg.tabs);
  }
});

// Refresh when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, () => {
  chrome.runtime.sendMessage({ action: "request-update" });
});
