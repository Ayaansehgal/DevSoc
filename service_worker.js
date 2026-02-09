// Service Worker - Background processing and network monitoring

import { RiskEngine } from './modules/risk_engine.js';
import { PolicyEngine } from './modules/policy_engine.js';
import { EnforcementEngine } from './modules/enforcement.js';
import { ContextDetector } from './modules/context_detector.js';
import { trackerKnowledge } from './modules/tracker_knowledge.js';

// Global state
let policies = null;
let riskEngine = null;
let policyEngine = null;
let enforcementEngine = null;
let contextDetector = null;

// Per-tab tracker data
let tabTrackers = new Map(); // tabId -> Map(domain -> trackerData)
let tabContexts = new Map(); // tabId -> Set(contexts)
let tabStats = new Map(); // tabId -> { total, blocked, allowed }

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[HIMT] Extension installed');
  await initializeEngines();
});

// Initialize on browser startup (service worker restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[HIMT] Extension started');
  await initializeEngines();
});

// Initialize engines and load data
async function initializeEngines() {
  try {
    // Load policies
    const policiesResponse = await fetch(chrome.runtime.getURL('policies.json'));
    policies = await policiesResponse.json();
    console.log('[HIMT] Policies loaded');

    // Load tracker knowledge base
    await trackerKnowledge.loadDatabase();

    // Initialize engines
    riskEngine = new RiskEngine(policies);
    policyEngine = new PolicyEngine(policies);
    enforcementEngine = new EnforcementEngine();
    contextDetector = new ContextDetector(policies);

    console.log('[HIMT] All engines initialized successfully');
  } catch (error) {
    console.error('[HIMT] Failed to initialize engines:', error);
  }
}

// Extension icon click - toggle overlay
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' }).catch(() => {
    console.log('[HIMT] Could not send message to tab:', tab.id);
  });
});

// Monitor network requests
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!policies) await initializeEngines();

    const { url, tabId, type, initiator } = details;

    // Ignore invalid tabs and extension URLs
    if (tabId < 0 || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return;
    }

    // Get tracker info
    const trackerInfo = trackerKnowledge.getTrackerInfo(url);
    if (!trackerInfo) return;

    // Skip first-party requests
    if (!riskEngine.isCrossSite(url, initiator)) {
      return;
    }

    // Get current contexts for this tab
    const contexts = tabContexts.get(tabId) || new Set();

    // Calculate risk score
    const riskScore = riskEngine.calculateRisk(
      { url, type, initiator, tabId },
      trackerInfo,
      contexts
    );

    // Check for user override first
    const userOverride = await policyEngine.getUserOverride(trackerInfo.domain, tabId);
    let enforcementMode;
    let wasOverridden = false;

    if (userOverride) {
      enforcementMode = userOverride.mode;
      wasOverridden = true;
    } else {
      // Determine enforcement mode based on risk and context
      enforcementMode = policyEngine.determineEnforcementMode(
        riskScore,
        contexts,
        trackerInfo.domain
      );
    }

    // Store tracker data for this tab
    if (!tabTrackers.has(tabId)) {
      tabTrackers.set(tabId, new Map());
    }

    const existingTracker = tabTrackers.get(tabId).get(trackerInfo.domain);
    const requestCount = existingTracker ? existingTracker.requestCount + 1 : 1;

    const trackerData = {
      info: trackerInfo,
      riskScore,
      enforcementMode,
      url,
      type,
      requestCount,
      lastSeen: Date.now(),
      contexts: Array.from(contexts),
      wasOverridden,
      explanation: trackerKnowledge.explainTracker(
        trackerInfo,
        riskScore,
        enforcementMode,
        requestCount
      )
    };

    tabTrackers.get(tabId).set(trackerInfo.domain, trackerData);

    // Update tab statistics
    updateTabStats(tabId, enforcementMode);

    // Execute enforcement
    try {
      const result = await enforcementEngine.enforce(
        trackerInfo.domain,
        enforcementMode,
        tabId,
        details,
        contexts
      );

      if (result.deferred) {
        trackerData.deferred = true;
        trackerData.enforcementMode = result.mode;
      }
    } catch (error) {
      console.error('[HIMT] Enforcement failed:', error);
    }

    // Notify content script about tracker
    notifyContentScript(tabId, {
      type: 'TRACKER_DETECTED',
      tracker: trackerData,
      stats: tabStats.get(tabId)
    });

  },
  { urls: ['<all_urls>'] }
);

// Handle navigation events
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return; // Only main frame

    // Ensure engines are initialized
    if (!contextDetector) await initializeEngines();

    const { tabId, url } = details;

    // Detect contexts from URL
    const urlContexts = contextDetector.detectFromURL(url);
    const previousContexts = tabContexts.get(tabId) || new Set();
    tabContexts.set(tabId, urlContexts);

    // Check if leaving critical context
    const wasInCriticalContext = previousContexts.size > 0;
    const nowInCriticalContext = urlContexts.size > 0;

    // Clear tracker data on navigation
    tabTrackers.delete(tabId);
    tabStats.delete(tabId);

    // Activate deferred blocks if leaving critical context
    if (wasInCriticalContext && !nowInCriticalContext) {
      console.log('[HIMT] Leaving critical context, activating deferred blocks');
      setTimeout(() => {
        enforcementEngine.activateDeferredBlocks(tabId);
      }, policies.deferredBlockingDelay || 3000);
    }

    // Notify content script about context change
    notifyContentScript(tabId, {
      type: 'CONTEXT_CHANGED',
      contexts: Array.from(urlContexts)
    });
  });
} else {
  console.warn('[HIMT] webNavigation API not available - please reinstall the extension');
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { type, data } = message;
    const tabId = sender.tab?.id;

    try {
      switch (type) {
        case 'GET_TRACKERS':
          const trackers = tabTrackers.get(tabId);
          sendResponse({
            success: true,
            trackers: trackers ? Array.from(trackers.values()) : [],
            stats: tabStats.get(tabId) || getDefaultStats(),
            contexts: Array.from(tabContexts.get(tabId) || [])
          });
          break;

        case 'UPDATE_CONTEXT':
          // Merge URL and DOM contexts
          const urlContexts = tabContexts.get(tabId) || new Set();
          const domContexts = contextDetector.detectFromDOM(data.domSignals);
          const combinedContexts = contextDetector.combineContexts(urlContexts, domContexts);

          tabContexts.set(tabId, combinedContexts);

          sendResponse({
            success: true,
            contexts: Array.from(combinedContexts)
          });
          break;

        case 'USER_OVERRIDE':
          const success = await policyEngine.setUserOverride(
            data.domain,
            tabId,
            data.mode,
            data.scope || 'tab'
          );

          if (success) {
            // Re-evaluate and re-enforce
            const tracker = tabTrackers.get(tabId)?.get(data.domain);
            if (tracker) {
              tracker.enforcementMode = data.mode;
              tracker.wasOverridden = true;

              // Apply new enforcement
              await enforcementEngine.enforce(
                data.domain,
                data.mode,
                tabId,
                { url: tracker.url },
                tabContexts.get(tabId)
              );

              // Update stats
              updateTabStats(tabId, data.mode);
            }
          }

          sendResponse({ success });
          break;

        case 'BLOCK_DOMAIN':
          // Legacy support from reference implementation
          await enforcementEngine.blockRequest(data.domain, tabId);
          sendResponse({ success: true });
          break;

        case 'UNBLOCK_DOMAIN':
          await enforcementEngine.unblockRequest(data.domain);
          sendResponse({ success: true });
          break;

        case 'EXPORT_REPORT':
          const report = generateReport(tabId);
          sendResponse({ success: true, report });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[HIMT] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabTrackers.delete(tabId);
  tabContexts.delete(tabId);
  tabStats.delete(tabId);
  riskEngine.clearTabData(tabId);
  enforcementEngine.clearTabRules(tabId);
  policyEngine.clearTabOverrides(tabId);
  console.log('[HIMT] Cleaned up data for closed tab:', tabId);
});

// Helper: Update tab statistics
function updateTabStats(tabId, enforcementMode) {
  if (!tabStats.has(tabId)) {
    tabStats.set(tabId, getDefaultStats());
  }

  const stats = tabStats.get(tabId);
  stats.total++;

  switch (enforcementMode) {
    case 'allow':
      stats.allowed++;
      break;
    case 'restrict':
      stats.restricted++;
      break;
    case 'sandbox':
      stats.sandboxed++;
      break;
    case 'block':
      stats.blocked++;
      break;
  }
}

// Helper: Get default stats object
function getDefaultStats() {
  return {
    total: 0,
    allowed: 0,
    restricted: 0,
    sandboxed: 0,
    blocked: 0
  };
}

// Helper: Notify content script
function notifyContentScript(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Tab might not be ready or content script not injected yet
  });
}

// Helper: Generate privacy report
function generateReport(tabId) {
  const trackers = tabTrackers.get(tabId);
  const stats = tabStats.get(tabId) || getDefaultStats();
  const contexts = tabContexts.get(tabId) || new Set();

  if (!trackers || trackers.size === 0) {
    return {
      timestamp: new Date().toISOString(),
      stats,
      contexts: Array.from(contexts),
      trackers: []
    };
  }

  return {
    timestamp: new Date().toISOString(),
    stats,
    contexts: Array.from(contexts),
    trackers: Array.from(trackers.values()).map(t => ({
      domain: t.info.domain,
      owner: t.info.owner,
      category: t.info.category,
      riskScore: t.riskScore,
      enforcementMode: t.enforcementMode,
      requestCount: t.requestCount
    }))
  };
}

console.log('[HIMT] Service worker loaded');
