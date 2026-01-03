// popup.js
function renderTabs(tabs = []) {
    const list = document.getElementById("list");
    list.innerHTML = "";
  
    if (tabs.length === 0) {
      list.innerHTML = "<li>No tabs playing media right now</li>";
      return;
    }
  
    tabs.forEach(tab => {
      const li = document.createElement("li");
      li.className = tab.muted ? "muted" : "";
      li.innerHTML = `<strong>${tab.speaker ? "🔊" : ""}${tab.title}</strong><br>
                      <small>${new URL(tab.url).hostname}</small>`;
      li.title = tab.url;
      
      li.onclick = () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      };
      
      list.appendChild(li);
    });
  }
  
  // Load once
  chrome.storage.local.get("playingTabs", data => {
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