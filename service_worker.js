let ruleId = Date.now();

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" }).catch(() => { });
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
    }).catch(() => { });
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "BLOCK_DOMAIN") {
    chrome.declarativeNetRequest.getDynamicRules(existingRules => {
      // Check if this domain already has a blocking rule
      const existingRule = existingRules.find(r =>
        r.condition && r.condition.urlFilter === msg.domain
      );

      if (existingRule) {
        // Domain already blocked, return success
        sendResponse({ ok: true, ruleId: existingRule.id, alreadyBlocked: true });
        return;
      }

      // Generate a unique ID using timestamp + random number
      const newRuleId = Date.now() + Math.floor(Math.random() * 10000);

      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: newRuleId,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: msg.domain,
            resourceTypes: ["script", "xmlhttprequest", "sub_frame", "image", "stylesheet", "font"]
          }
        }],
        removeRuleIds: []
      })
        .then(() => sendResponse({ ok: true, ruleId: newRuleId }))
        .catch(err => {
          console.error("Failed to block domain:", err);
          sendResponse({ ok: false, error: err.message });
        });
    });

    return true;
  }
});

