let ruleId = 1;

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" }).catch(() => {});
});

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0) return;
    chrome.tabs.sendMessage(details.tabId, {
      type: "GHOST_TRAFFIC",
      payload: {
        url: details.url,
        resourceType: details.type
      }
    }).catch(() => {});
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // BLOCK DOMAIN
  if (msg.type === "BLOCK_DOMAIN") {
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: ruleId++,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: msg.domain,
          resourceTypes: ["script", "xmlhttprequest", "sub_frame", "image", "stylesheet", "font"]
        }
      }],
      removeRuleIds: []
    })
    .then(() => sendResponse({ ok: true }))
    .catch(err => {
      console.error("Failed to block domain:", err);
      sendResponse({ ok: false, error: err.message });
    });

    return true; // keep channel open
  }

  // UNBLOCK DOMAIN
  if (msg.type === "UNBLOCK_DOMAIN") {
    chrome.declarativeNetRequest.getDynamicRules(rules => {
      const ids = rules
        .filter(r => r.condition.urlFilter === msg.domain)
        .map(r => r.id);

      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ids
      }, () => sendResponse({ ok: true }));
    });

    return true; // async response
  }
});
