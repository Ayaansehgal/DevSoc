import { RiskEngine } from './modules/risk_engine.js';
import { PolicyEngine } from './modules/policy_engine.js';
import { EnforcementEngine } from './modules/enforcement.js';
import { ContextDetector } from './modules/context_detector.js';
import { trackerKnowledge } from './modules/tracker_knowledge.js';
import { cloudSync } from './modules/cloud_sync.js';
import { categoryClassifier } from './modules/category_classifier.js';
import { fingerprintDetector } from './modules/fingerprint_detector.js';
import { patternAnalyzer } from './modules/pattern_analyzer.js';
import { mlInsightsEngine } from './modules/ml_insights.js';

let policies = null;
let riskEngine = null;
let policyEngine = null;
let enforcementEngine = null;
let contextDetector = null;

let tabTrackers = new Map();
let tabContexts = new Map();
let tabStats = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[HIMT] Extension installed');
  await initializeEngines();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[HIMT] Extension started');
  await initializeEngines();
});

async function initializeEngines() {
  try {
    const policiesResponse = await fetch(chrome.runtime.getURL('policies.json'));
    policies = await policiesResponse.json();

    await trackerKnowledge.loadDatabase();

    riskEngine = new RiskEngine(policies);
    policyEngine = new PolicyEngine(policies);
    enforcementEngine = new EnforcementEngine();
    await enforcementEngine.init();
    contextDetector = new ContextDetector(policies);

    await cloudSync.init();

    await categoryClassifier.initialize();
    await fingerprintDetector.initialize();
    await patternAnalyzer.initialize();
    console.log('[HIMT] All engines initialized successfully');
  } catch (error) {
    console.error('[HIMT] Failed to initialize engines:', error);
  }
}

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' }).catch(() => {
    console.log('[HIMT] Could not send message to tab:', tab.id);
  });
});

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!policies) await initializeEngines();

    const { url, tabId, type, initiator } = details;

    if (tabId < 0 || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return;
    }

    const trackerInfo = trackerKnowledge.getTrackerInfo(url);
    if (!trackerInfo) return;

    if (!riskEngine.isCrossSite(url, initiator)) {
      return;
    }

    const contexts = tabContexts.get(tabId) || new Set();

    const riskScore = riskEngine.calculateRisk(
      { url, type, initiator, tabId },
      trackerInfo,
      contexts
    );

    const userOverride = await policyEngine.getUserOverride(trackerInfo.domain, tabId);
    let enforcementMode;
    let wasOverridden = false;

    if (userOverride) {
      enforcementMode = userOverride.mode;
      wasOverridden = true;
    } else {
      enforcementMode = policyEngine.determineEnforcementMode(
        riskScore,
        contexts,
        trackerInfo.domain
      );
    }

    if (!tabTrackers.has(tabId)) {
      tabTrackers.set(tabId, new Map());
    }

    const existingTracker = tabTrackers.get(tabId).get(trackerInfo.domain);
    const requestCount = existingTracker ? existingTracker.requestCount + 1 : 1;

    const fingerprintData = fingerprintDetector.getSummary(trackerInfo.domain);

    let finalRiskScore = riskScore;
    if (fingerprintData.detected) {
      finalRiskScore = Math.min(100, riskScore + Math.round(fingerprintData.riskScore * 0.5));
    }

    const trackerData = {
      info: trackerInfo,
      riskScore: finalRiskScore,
      enforcementMode,
      url,
      type,
      requestCount,
      lastSeen: Date.now(),
      contexts: Array.from(contexts),
      wasOverridden,
      fingerprinting: fingerprintData,
      mlClassified: trackerInfo.mlDetected || false,
      explanation: trackerKnowledge.explainTracker(
        trackerInfo,
        finalRiskScore,
        enforcementMode,
        requestCount
      )
    };

    tabTrackers.get(tabId).set(trackerInfo.domain, trackerData);

    try {
      const siteDomain = initiator ? new URL(initiator).hostname : 'unknown';
      mlInsightsEngine.recordTracker(trackerInfo.domain, siteDomain, {
        category: trackerInfo.category,
        owner: trackerInfo.owner,
        riskScore: finalRiskScore,
        dataCollected: trackerInfo.dataCollected || [],
        enforcementMode
      });
    } catch (e) { }

    updateTabStats(tabId, enforcementMode);

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

    notifyContentScript(tabId, {
      type: 'TRACKER_DETECTED',
      tracker: trackerData,
      stats: tabStats.get(tabId)
    });

    const patternAlerts = patternAnalyzer.recordTrackerEvent({
      domain: trackerInfo.domain,
      category: trackerInfo.category,
      riskScore: finalRiskScore,
      websiteUrl: initiator || '',
      timestamp: Date.now()
    });

    if (patternAlerts.length > 0) {
      notifyContentScript(tabId, {
        type: 'PATTERN_ANOMALY',
        alerts: patternAlerts
      });
    }

    try {
      await cloudSync.queueEvent({
        ...trackerData,
        websiteUrl: initiator || ''
      });
    } catch (error) {
      console.error('[HIMT] Cloud sync queue failed:', error);
    }

  },
  { urls: ['<all_urls>'] }
);

if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    if (!contextDetector) await initializeEngines();

    const { tabId, url } = details;

    const urlContexts = contextDetector.detectFromURL(url);
    const previousContexts = tabContexts.get(tabId) || new Set();
    tabContexts.set(tabId, urlContexts);

    const wasInCriticalContext = previousContexts.size > 0;
    const nowInCriticalContext = urlContexts.size > 0;

    tabTrackers.delete(tabId);
    tabStats.delete(tabId);

    if (wasInCriticalContext && !nowInCriticalContext) {
      setTimeout(() => {
        enforcementEngine.activateDeferredBlocks(tabId);
      }, policies.deferredBlockingDelay || 3000);
    }

    notifyContentScript(tabId, {
      type: 'CONTEXT_CHANGED',
      contexts: Array.from(urlContexts)
    });
  });
} else {
  console.warn('[HIMT] webNavigation API not available');
}

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
            const tracker = tabTrackers.get(tabId)?.get(data.domain);
            if (tracker) {
              tracker.enforcementMode = data.mode;
              tracker.wasOverridden = true;

              await enforcementEngine.enforce(
                data.domain,
                data.mode,
                tabId,
                { url: tracker.url },
                tabContexts.get(tabId)
              );

              updateTabStats(tabId, data.mode);

              try {
                await cloudSync.queueEvent({
                  domain: tracker.info?.domain || data.domain,
                  owner: tracker.info?.owner || 'Unknown',
                  category: tracker.info?.category || 'Unknown',
                  riskScore: tracker.riskScore || 0,
                  enforcementMode: data.mode,
                  requestCount: 1,
                  websiteUrl: tracker.websiteUrl || '',
                  contexts: Array.from(tabContexts.get(tabId) || [])
                });
              } catch (err) { }
            }
          }

          sendResponse({ success });
          break;

        case 'BLOCK_DOMAIN':
          await enforcementEngine.blockRequest(data.domain, tabId);
          try {
            await cloudSync.queueEvent({
              domain: data.domain,
              owner: 'Unknown',
              category: 'Unknown',
              riskScore: 50,
              enforcementMode: 'block',
              requestCount: 1,
              websiteUrl: '',
              contexts: []
            });
          } catch (err) { }
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

        case 'ACCOUNT_REGISTER':
          const newDeviceId = await cloudSync.resetForNewAccount(data.email);
          sendResponse({ success: true, deviceId: newDeviceId });
          break;

        case 'ACCOUNT_LOGIN':
          await cloudSync.setUserAccount(data.email, data.deviceId);
          sendResponse({ success: true, deviceId: cloudSync.getDeviceId() });
          break;

        case 'ACCOUNT_LOGOUT':
          await cloudSync.setUserAccount(null);
          sendResponse({ success: true });
          break;

        case 'DEVICE_ID_CHANGED':
          await cloudSync.setUserAccount(null, data.newDeviceId);
          sendResponse({ success: true });
          break;

        case 'GET_DEVICE_ID':
          sendResponse({ success: true, deviceId: cloudSync.getDeviceId() });
          break;

        case 'FINGERPRINT_EVENTS':
          for (const event of data.events) {
            fingerprintDetector.analyzeEvent({
              domain: new URL(event.url).hostname,
              type: event.type,
              data: event.data
            });
          }
          sendResponse({ success: true });
          break;

        case 'GET_PATTERN_SUMMARY':
          const sessionSummary = patternAnalyzer.getSessionSummary();
          const insights = patternAnalyzer.getInsights();
          const privacyScore = patternAnalyzer.getPrivacyScore();
          sendResponse({
            success: true,
            summary: sessionSummary,
            insights: insights,
            privacyScore: privacyScore
          });
          break;

        case 'GET_FINGERPRINT_DATA':
          const fpData = fingerprintDetector.getSummary(data.domain);
          sendResponse({ success: true, data: fpData });
          break;

        case 'CLEAR_PATTERN_DATA':
          await patternAnalyzer.clearAllData();
          sendResponse({ success: true });
          break;

        case 'CATEGORY_FEEDBACK':
          try {
            await categoryClassifier.recordFeedback(
              data.url || '',
              data.domain,
              data.newCategory
            );
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_ML_INSIGHTS':
          const actionableInsights = mlInsightsEngine.generateInsights();
          sendResponse({ success: true, data: actionableInsights });
          break;

        case 'FINGERPRINT_DETECTED':
          if (data.domain && data.technique) {
            mlInsightsEngine.recordFingerprint(data.domain, data.technique);
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[HIMT] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabTrackers.delete(tabId);
  tabContexts.delete(tabId);
  tabStats.delete(tabId);
  riskEngine.clearTabData(tabId);
  enforcementEngine.clearTabRules(tabId);
  policyEngine.clearTabOverrides(tabId);
});

function updateTabStats(tabId, enforcementMode) {
  if (!tabStats.has(tabId)) {
    tabStats.set(tabId, getDefaultStats());
  }

  const stats = tabStats.get(tabId);
  stats.total++;

  switch (enforcementMode) {
    case 'allow': stats.allowed++; break;
    case 'restrict': stats.restricted++; break;
    case 'sandbox': stats.sandboxed++; break;
    case 'block': stats.blocked++; break;
  }
}

function getDefaultStats() {
  return {
    total: 0,
    allowed: 0,
    restricted: 0,
    sandboxed: 0,
    blocked: 0
  };
}

function notifyContentScript(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(() => { });
}

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
