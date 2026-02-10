let overlayVisible = false;
let backgroundMode = true;
let trackers = [];
let currentContexts = [];
let stats = { total: 0, allowed: 0, restricted: 0, sandboxed: 0, blocked: 0 };
let lastUpdate = 0;
let patternAlerts = [];
let privacyScore = 100;

async function syncDeviceId() {
  const hostname = window.location.hostname;
  const port = window.location.port;

  if (hostname === 'localhost' && port === '3000') {
    try {
      const dashboardDeviceId = localStorage.getItem('himt_device_id');
      const stored = await chrome.storage.local.get(['himt_device_id']);
      const extensionDeviceId = stored.himt_device_id;

      console.log('[HIMT Content] Dashboard deviceId:', dashboardDeviceId);
      console.log('[HIMT Content] Extension deviceId:', extensionDeviceId);

      if (dashboardDeviceId && dashboardDeviceId !== extensionDeviceId) {
        await chrome.storage.local.set({ 'himt_device_id': dashboardDeviceId });
        console.log('[HIMT Content] Updated extension deviceId from dashboard:', dashboardDeviceId);

        chrome.runtime.sendMessage({
          type: 'DEVICE_ID_CHANGED',
          data: { newDeviceId: dashboardDeviceId }
        });
      } else if (!dashboardDeviceId && extensionDeviceId) {
        localStorage.setItem('himt_device_id', extensionDeviceId);
        console.log('[HIMT Content] Synced extension deviceId to dashboard:', extensionDeviceId);
      }
    } catch (error) {
      console.error('[HIMT Content] Failed to sync deviceId:', error);
    }
  }
}

(async function init() {
  console.log('[HIMT Content] Initializing...');

  await syncDeviceId();

  injectFingerprintInterceptor();

  detectDOMContexts();
  requestTrackerUpdate();
  requestPatternSummary();

  setInterval(syncDeviceId, 2000);

  setInterval(detectDOMContexts, 5000);
  setInterval(requestTrackerUpdate, 3000);
  setInterval(requestPatternSummary, 10000);

  window.addEventListener('message', handleFingerprintMessage);
})();

function injectFingerprintInterceptor() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('modules/fingerprint_interceptor.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    console.log('[HIMT Content] Fingerprint interceptor injected');
  } catch (error) {
    console.warn('[HIMT Content] Failed to inject fingerprint interceptor:', error);
  }
}

function handleFingerprintMessage(event) {
  if (event.source !== window) return;
  if (event.data?.type !== 'HIMT_FINGERPRINT_EVENTS') return;

  const events = event.data.events;
  if (events && events.length > 0) {
    chrome.runtime.sendMessage({
      type: 'FINGERPRINT_EVENTS',
      data: { events }
    }).catch(() => { });
  }
}

function requestPatternSummary() {
  chrome.runtime.sendMessage({ type: 'GET_PATTERN_SUMMARY' }, (response) => {
    if (response?.success) {
      privacyScore = response.privacyScore || 100;
      if (overlayVisible) {
        updatePrivacyScore();
      }
    }
  });
}

function detectDOMContexts() {
  const signals = {
    checkout: document.querySelectorAll(
      'input[type="text"][name*="card"], input[autocomplete="cc-number"], input[autocomplete="cc-exp"], input[autocomplete="cc-csc"], .checkout-form, #payment-form, #checkout, [data-testid*="checkout"]'
    ),
    login: document.querySelectorAll(
      'input[type="password"], input[name="username"], .login-form, #login, [data-testid*="login"], form[action*="login"]'
    )
  };

  const domSignals = {
    checkout: signals.checkout.length > 0 ? Array.from(signals.checkout).map(el => el.tagName) : [],
    login: signals.login.length > 0 ? Array.from(signals.login).map(el => el.tagName) : []
  };

  chrome.runtime.sendMessage({
    type: 'UPDATE_CONTEXT',
    data: { domSignals }
  }, (response) => {
    if (response?.success) {
      currentContexts = response.contexts || [];
      if (overlayVisible) {
        updateContextWarning();
      }
    }
  });
}

function requestTrackerUpdate() {
  chrome.runtime.sendMessage({ type: 'GET_TRACKERS' }, (response) => {
    if (response?.success) {
      trackers = response.trackers || [];
      stats = response.stats || { total: 0, allowed: 0, restricted: 0, sandboxed: 0, blocked: 0 };
      currentContexts = response.contexts || [];

      if (overlayVisible) {
        renderTrackerList();
        updateStats();
        renderThreatPanel();
      } else if (backgroundMode) {
        checkForSuspiciousActivity();
      }
    }
  });
}

function checkForSuspiciousActivity() {
  const highRiskTrackers = trackers.filter(t => t.riskScore >= 60);

  if (highRiskTrackers.length > 0 && Date.now() - lastUpdate > 10000) {
    showBackgroundAlert(highRiskTrackers.length);
    lastUpdate = Date.now();
  }
}

function showBackgroundAlert(count) {
  const existing = document.getElementById('himt-bg-alert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.id = 'himt-bg-alert';
  alert.setAttribute('data-testid', 'bg-alert');
  alert.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(239, 68, 68, 0.95);
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    cursor: pointer;
    animation: slideIn 0.3s ease;
  `;

  alert.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 14px; font-weight: bold;">!</span>
      <span><strong>${count}</strong> high-risk tracker${count > 1 ? 's' : ''} detected</span>
    </div>
  `;

  alert.addEventListener('click', () => {
    alert.remove();
    showOverlay();
  });

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

function toggleOverlay() {
  overlayVisible ? hideOverlay() : showOverlay();
}

function showOverlay() {
  overlayVisible = true;
  createOverlay();
  requestTrackerUpdate();
  renderThreatPanel();
}

function hideOverlay() {
  overlayVisible = false;
  const panel = document.getElementById('himt-panel');
  if (panel) panel.remove();
}

function createOverlay() {
  const existing = document.getElementById('himt-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'himt-panel';
  panel.setAttribute('data-testid', 'panel-main');
  panel.className = 'himt-panel';

  panel.innerHTML = `
    <div class="himt-header">
      <div class="himt-logo">
        <img class="himt-logo-icon" src="${chrome.runtime.getURL('assets/icon48.png')}" alt="Logo" />
        <div class="himt-logo-text">
          <div class="himt-subtitle">Privacy Protection Active</div>
        </div>
      </div>
      <button class="himt-close-btn" id="himt-close" data-testid="btn-close">X</button>
    </div>

    <div id="himt-context-warning" class="himt-context-warning" style="display: none;">
      <div class="himt-warning-icon">!</div>
      <div class="himt-warning-content">
        <div class="himt-warning-title">Critical Context Detected</div>
        <div class="himt-warning-text" id="himt-context-text"></div>
        <div class="himt-warning-note">Blocking is limited to prevent breaking functionality</div>
      </div>
    </div>

    <div class="himt-stats-grid" id="himt-stats">
      <div class="himt-stat-card">
        <div class="himt-stat-label">Total Requests</div>
        <div class="himt-stat-value" data-testid="stats-count" id="himt-total">0</div>
      </div>
      <div class="himt-stat-card himt-stat-allowed">
        <div class="himt-stat-label">Allowed</div>
        <div class="himt-stat-value" id="himt-allowed">0</div>
      </div>
      <div class="himt-stat-card himt-stat-restricted">
        <div class="himt-stat-label">Restricted</div>
        <div class="himt-stat-value" id="himt-restricted">0</div>
      </div>
      <div class="himt-stat-card himt-stat-sandboxed">
        <div class="himt-stat-label">Sandboxed</div>
        <div class="himt-stat-value" id="himt-sandboxed">0</div>
      </div>
      <div class="himt-stat-card himt-stat-blocked">
        <div class="himt-stat-label">Blocked</div>
        <div class="himt-stat-value" id="himt-blocked">0</div>
      </div>
    </div>

    <div class="himt-controls">
      <button class="himt-btn himt-btn-secondary" id="himt-bg-toggle" data-testid="toggle-background">
        <div class="himt-btn-text">${backgroundMode ? 'Background Mode ON' : 'Background Mode OFF'}</div>
      </button>
      <button class="himt-btn himt-btn-primary" id="himt-dashboard" data-testid="btn-dashboard">
        <span class="himt-btn-text">View Dashboard</span>
      </button>
    </div>

    <div class="himt-ml-section" id="himt-ml-section">
      <div class="himt-threat-panel" id="himt-threat-panel">
        <div class="himt-threat-header">
          <span class="himt-threat-title">Threat Intelligence</span>
          <span class="himt-threat-score" id="himt-privacy-score">--</span>
        </div>
        <div id="himt-threat-content" class="himt-threat-content">
          <div class="himt-threat-loading">Analyzing threats...</div>
        </div>
      </div>
    </div>

    <div class="himt-tracker-list" id="himt-tracker-list">
      <div class="himt-empty-state">
        <div class="himt-empty-text">No third-party trackers detected</div>
      </div>
    </div>

    <button class="himt-scroll-top" id="himt-scroll-top" title="Back to Top">
      ↑ Top
    </button>
  `;

  document.body.appendChild(panel);

  document.getElementById('himt-close').addEventListener('click', hideOverlay);
  document.getElementById('himt-bg-toggle').addEventListener('click', toggleBackgroundMode);
  document.getElementById('himt-dashboard').addEventListener('click', () => {
    window.open('http://localhost:3000/', '_blank');
  });

  document.getElementById('himt-scroll-top').addEventListener('click', () => {
    const panel = document.getElementById('himt-panel');
    if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
  });

  renderTrackerList();
  updateStats();
  updateContextWarning();
}

function updateStats() {
  const elements = {
    total: document.getElementById('himt-total'),
    allowed: document.getElementById('himt-allowed'),
    restricted: document.getElementById('himt-restricted'),
    sandboxed: document.getElementById('himt-sandboxed'),
    blocked: document.getElementById('himt-blocked')
  };

  if (elements.total) elements.total.textContent = stats.total || 0;
  if (elements.allowed) elements.allowed.textContent = stats.allowed || 0;
  if (elements.restricted) elements.restricted.textContent = stats.restricted || 0;
  if (elements.sandboxed) elements.sandboxed.textContent = stats.sandboxed || 0;
  if (elements.blocked) elements.blocked.textContent = stats.blocked || 0;
}

function renderThreatPanel() {
  chrome.runtime.sendMessage({ type: 'GET_ML_INSIGHTS' }, (response) => {
    const container = document.getElementById('himt-threat-content');
    const scoreEl = document.getElementById('himt-privacy-score');
    if (!container) return;

    if (!response?.success || !response.data) {
      container.innerHTML = '<div class="himt-threat-empty">Browse more to generate insights</div>';
      return;
    }

    const insights = response.data;
    const { crossSiteTracking, dataExposure, fingerprintingThreats, recommendations, privacyScore } = insights;

    if (scoreEl && privacyScore) {
      const s = privacyScore.score;
      scoreEl.textContent = `${s}/100`;
      scoreEl.style.color = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
    }

    let html = '';

    if (crossSiteTracking.companies.length > 0) {
      html += `<div class="himt-insight-section">
        <div class="himt-insight-header">
          <span class="himt-insight-icon"></span>
          <span class="himt-insight-title">Who's Watching You</span>
        </div>`;
      for (const company of crossSiteTracking.companies.slice(0, 3)) {
        html += `<div class="himt-insight-item himt-insight-warning">
          <div class="himt-insight-text"><strong>${company.owner}</strong> follows you across <strong>${company.siteCount} sites</strong> using ${company.trackerCount} tracker${company.trackerCount > 1 ? 's' : ''}</div>
        </div>`;
      }
      html += `</div>`;
    }

    if (dataExposure.exposedDataTypes.length > 0) {
      html += `<div class="himt-insight-section">
        <div class="himt-insight-header">
          <span class="himt-insight-icon"></span>
          <span class="himt-insight-title">Your Data Exposure</span>
        </div>
        <div class="himt-insight-item himt-insight-info">
          <div class="himt-insight-text">${dataExposure.headline}</div>
        </div>`;
      for (const dtype of dataExposure.exposedDataTypes.slice(0, 4)) {
        html += `<div class="himt-insight-item himt-insight-data himt-expandable" data-type="${dtype.dataType}">
          <div class="himt-data-header">
            <span class="himt-data-type">${dtype.dataType}</span>
            <div class="himt-data-right">
              <span class="himt-data-count">→ ${dtype.companyCount} compan${dtype.companyCount > 1 ? 'ies' : 'y'}</span>
              <span class="himt-chevron">▼</span>
            </div>
          </div>
          <div class="himt-data-companies" style="display: none;">
            ${dtype.companies.map(c => `<div class="himt-company-item">• ${c}</div>`).join('')}
            ${dtype.companyCount > 5 ? `<div class="himt-company-more">+${dtype.companyCount - 5} others</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    if (fingerprintingThreats.threats.length > 0) {
      html += `<div class="himt-insight-section">
        <div class="himt-insight-header">
          <span class="himt-insight-icon"></span>
          <span class="himt-insight-title">Fingerprinting Detected</span>
        </div>`;
      for (const threat of fingerprintingThreats.threats.slice(0, 3)) {
        const sevColor = threat.severity === 'critical' ? '#ef4444' : threat.severity === 'high' ? '#f59e0b' : '#6366f1';
        html += `<div class="himt-insight-item" style="border-left: 3px solid ${sevColor}">
          <div class="himt-insight-text"><strong>${threat.domain}</strong> — ${threat.techniques.map(t => t.id).join(', ')}</div>
          <div class="himt-insight-sub">${threat.message}</div>
        </div>`;
      }
      html += `</div>`;
    }

    if (recommendations.length > 0) {
      html += `<div class="himt-insight-section">
        <div class="himt-insight-header">
          <span class="himt-insight-icon"></span>
          <span class="himt-insight-title">Recommended Actions</span>
        </div>`;
      for (const rec of recommendations) {
        const priColor = rec.priority === 'critical' ? '#ef4444' : rec.priority === 'high' ? '#f59e0b' : '#6366f1';
        html += `<div class="himt-insight-item himt-recommendation" style="border-left: 3px solid ${priColor}">
          <div class="himt-rec-header">
            <span>${rec.icon} ${rec.title}</span>
          </div>
          <div class="himt-insight-sub">${rec.description}</div>
          ${rec.action?.type === 'block' ? `
            <button class="himt-rec-action" data-action="block" data-domain="${rec.domain}">Block Now</button>
          ` : ''}
        </div>`;
      }
      html += `</div>`;
    }

    if (!html) {
      html = `<div class="himt-threat-empty">
        <div>No threats detected yet</div>
        <div class="himt-insight-sub">Browse more sites to generate insights</div>
      </div>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('.himt-rec-action[data-action="block"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const domain = btn.dataset.domain;
        chrome.runtime.sendMessage({
          type: 'USER_OVERRIDE',
          data: { domain, mode: 'block', scope: 'global' }
        }, () => {
          btn.textContent = 'Blocked!';
          btn.disabled = true;
          btn.classList.add('himt-rec-done');
        });
      });
    });

    container.querySelectorAll('.himt-expandable').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;

        const list = item.querySelector('.himt-data-companies');
        const chevron = item.querySelector('.himt-chevron');
        if (list) {
          const isVisible = list.style.display !== 'none';
          list.style.display = isVisible ? 'none' : 'block';
          if (chevron) {
            chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
          }
        }
      });
    });
  });
}

function updatePrivacyScore() {
  renderThreatPanel();
}

function updateContextWarning() {
  const warning = document.getElementById('himt-context-warning');
  const warningText = document.getElementById('himt-context-text');

  if (!warning || !warningText) return;

  if (currentContexts.length > 0) {
    warning.style.display = 'flex';
    const contextLabels = {
      'payment': 'Payment Processing',
      'checkout': 'Checkout Flow',
      'login': 'Login/Authentication'
    };
    const labels = currentContexts.map(c => contextLabels[c] || c).join(', ');
    warningText.textContent = labels;
  } else {
    warning.style.display = 'none';
  }
}

function renderTrackerList() {
  const container = document.getElementById('himt-tracker-list');
  if (!container) return;

  if (trackers.length === 0) {
    container.innerHTML = `
      <div class="himt-empty-state">
        <div class="himt-empty-text">No third-party trackers detected</div>
      </div>
    `;
    return;
  }

  const sortedTrackers = [...trackers].sort((a, b) => b.riskScore - a.riskScore);

  container.innerHTML = sortedTrackers.map(tracker => createTrackerCard(tracker)).join('');

  sortedTrackers.forEach(tracker => {
    attachTrackerListeners(tracker);
  });
}

function createTrackerCard(tracker) {
  const { info, riskScore, enforcementMode, requestCount, explanation, wasOverridden, deferred } = tracker;

  const modeColors = {
    'allow': '#10b981',
    'restrict': '#f59e0b',
    'sandbox': '#ef4444',
    'block': '#7f1d1d'
  };

  const riskLevels = {
    LOW: { color: '#10b981', label: 'Low Risk' },
    MEDIUM: { color: '#f59e0b', label: 'Medium Risk' },
    HIGH: { color: '#ef4444', label: 'High Risk' },
    CRITICAL: { color: '#7f1d1d', label: 'Critical Risk' }
  };

  const riskLevel = explanation?.riskLevel || 'LOW';
  const riskConfig = riskLevels[riskLevel] || riskLevels.LOW;

  return `
    <div class="himt-tracker-card" data-domain="${info.domain}" data-testid="card-${info.domain}">
      <div class="himt-tracker-header">
        <div class="himt-tracker-info">
          <div class="himt-tracker-domain">${info.domain}</div>
          <div class="himt-tracker-meta">${info.owner} • ${info.category}</div>
        </div>
        <div class="himt-tracker-badge" style="background-color: ${modeColors[enforcementMode]}">
          ${enforcementMode.toUpperCase()}${deferred ? ' (DEFERRED)' : ''}${wasOverridden ? ' *' : ''}
        </div>
      </div>

      ${tracker.mlClassified ? `
        <div class="himt-ml-badge">
          <span class="himt-ml-icon"></span>
          <span class="himt-ml-text">ML Classified${tracker.info?.mlConfidence ? ` (${Math.round(tracker.info.mlConfidence * 100)}%)` : ''}</span>
        </div>
      ` : ''}

      ${tracker.fingerprinting?.detected ? `
        <div class="himt-fingerprint-badge">
          <span class="himt-fp-icon"></span>
          <span class="himt-fp-text">Fingerprinting: ${tracker.fingerprinting.techniques.map(t => t.technique).join(', ')}</span>
        </div>
      ` : ''}

      <div class="himt-tracker-description">${info.description}</div>

      <div class="himt-tracker-metrics">
        <div class="himt-metric">
          <div class="himt-metric-label">Risk Score</div>
          <div class="himt-metric-value" style="color: ${riskConfig.color}">${riskScore}/100</div>
        </div>
        <div class="himt-metric">
          <div class="himt-metric-label">Risk Level</div>
          <div class="himt-metric-value" style="color: ${riskConfig.color}">${riskConfig.label}</div>
        </div>
        <div class="himt-metric">
          <div class="himt-metric-label">Requests</div>
          <div class="himt-metric-value">${requestCount}</div>
        </div>
      </div>

      <div class="himt-tracker-details" id="details-${info.domain}" style="display: none;">
        <div class="himt-detail-section">
          <div class="himt-detail-label">Data Collected</div>
          <div class="himt-detail-value">${info.dataCollected.join(', ')}</div>
        </div>
        <div class="himt-detail-section">
          <div class="himt-detail-label">Regulation</div>
          <div class="himt-detail-value">${info.regulation}</div>
        </div>
        <div class="himt-detail-section">
          <div class="himt-detail-label">Impact</div>
          <div class="himt-detail-value">${explanation?.impact || 'Unknown'}</div>
        </div>
      </div>

      <div class="himt-tracker-actions">
        <button class="himt-action-btn himt-action-details" data-domain="${info.domain}">
          <span>Details</span>
        </button>
        ${tracker.mlClassified ? `
          <button class="himt-action-btn himt-action-feedback" data-domain="${info.domain}" data-category="${info.category}" title="Correct this classification">
            <span>Fix Category</span>
          </button>
        ` : ''}
        <button class="himt-action-btn himt-action-allow" data-domain="${info.domain}" data-mode="allow">
          <span>Allow</span>
        </button>
        <button class="himt-action-btn himt-action-restrict" data-domain="${info.domain}" data-mode="restrict">
          <span>Restrict</span>
        </button>
        <button class="himt-action-btn himt-action-sandbox" data-domain="${info.domain}" data-mode="sandbox">
          <span>Sandbox</span>
        </button>
        <button class="himt-action-btn himt-action-block" data-domain="${info.domain}" data-mode="block">
          <span>Block</span>
        </button>
      </div>
    </div>
  `;
}

function attachTrackerListeners(tracker) {
  const domain = tracker.info.domain;

  const detailsBtn = document.querySelector(`.himt-action-details[data-domain="${domain}"]`);
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => toggleDetails(domain));
  }

  const feedbackBtn = document.querySelector(`.himt-action-feedback[data-domain="${domain}"]`);
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', () => showFeedbackModal(tracker));
  }

  const modeButtons = document.querySelectorAll(`.himt-tracker-card[data-domain="${domain}"] button[data-mode]`);
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.mode;
      handleUserOverride(domain, mode);
    });
  });
}

function showFeedbackModal(tracker) {
  const existingModal = document.getElementById('himt-feedback-modal');
  if (existingModal) existingModal.remove();

  const categories = [
    'Analytics', 'Advertising', 'Social', 'Session Recording',
    'Tag Manager', 'Payment', 'CDN', 'Security', 'Unknown'
  ];

  const modal = document.createElement('div');
  modal.id = 'himt-feedback-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000000;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      color: white;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    ">
      <h3 style="margin: 0 0 8px 0; font-size: 18px;">Correct Category</h3>
      <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 14px;">
        Help improve our ML by correcting the category for <strong>${tracker.info.domain}</strong>
      </p>
      <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 12px;">
        Current: <span style="color: #c4b5fd;">${tracker.info.category}</span>
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
        ${categories.map(cat => `
          <button class="himt-category-btn" data-category="${cat}" style="
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid ${cat === tracker.info.category ? '#8b5cf6' : '#374151'};
            background: ${cat === tracker.info.category ? 'rgba(139, 92, 246, 0.3)' : 'rgba(55, 65, 81, 0.5)'};
            color: white;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
          ">${cat}</button>
        `).join('')}
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="himt-feedback-cancel" style="
          padding: 10px 20px;
          border-radius: 8px;
          border: 1px solid #374151;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
        ">Cancel</button>
        <button id="himt-feedback-submit" style="
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          cursor: pointer;
          font-weight: 600;
        ">Submit Correction</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedCategory = tracker.info.category;

  modal.querySelectorAll('.himt-category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      modal.querySelectorAll('.himt-category-btn').forEach(b => {
        b.style.borderColor = '#374151';
        b.style.background = 'rgba(55, 65, 81, 0.5)';
      });
      e.target.style.borderColor = '#8b5cf6';
      e.target.style.background = 'rgba(139, 92, 246, 0.3)';
      selectedCategory = e.target.dataset.category;
    });
  });

  document.getElementById('himt-feedback-cancel').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('himt-feedback-submit').addEventListener('click', () => {
    if (selectedCategory !== tracker.info.category) {
      chrome.runtime.sendMessage({
        type: 'CATEGORY_FEEDBACK',
        data: {
          domain: tracker.info.domain,
          url: tracker.url,
          oldCategory: tracker.info.category,
          newCategory: selectedCategory
        }
      }, (response) => {
        if (response?.success) {
          showFeedback(`Thanks! Category updated to ${selectedCategory}`);
          tracker.info.category = selectedCategory;
          renderTrackerList();
        } else {
          showFeedback('Failed to save feedback', true);
        }
      });
    }
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function toggleDetails(domain) {
  const details = document.getElementById(`details-${domain}`);
  const btn = document.querySelector(`.himt-action-details[data-domain="${domain}"]`);

  if (details && btn) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    btn.querySelector('span:last-child').textContent = isVisible ? 'Details' : 'Hide';
  }
}

function handleUserOverride(domain, mode) {
  chrome.runtime.sendMessage({
    type: 'USER_OVERRIDE',
    data: { domain, mode, scope: 'tab' }
  }, (response) => {
    if (response?.success) {
      const tracker = trackers.find(t => t.info.domain === domain);
      if (tracker) {
        tracker.enforcementMode = mode;
        tracker.wasOverridden = true;
      }
      renderTrackerList();

      showFeedback(`${domain} set to ${mode.toUpperCase()}`);
    } else {
      showFeedback('Failed to update tracker', true);
    }
  });
}

function toggleBackgroundMode() {
  backgroundMode = !backgroundMode;
  const btn = document.getElementById('himt-bg-toggle');
  if (btn) {
    btn.querySelector('.himt-btn-text').textContent = backgroundMode ? 'Background Mode ON' : 'Background Mode OFF';
  }
  showFeedback(`Background mode ${backgroundMode ? 'enabled' : 'disabled'}`);
}

function showFeedback(message, isError = false) {
  const existing = document.getElementById('himt-feedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.id = 'himt-feedback';
  feedback.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'};
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    animation: slideUp 0.3s ease;
  `;
  feedback.textContent = message;

  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, tracker, stats: newStats, contexts } = message;

  switch (type) {
    case 'TOGGLE_OVERLAY':
      toggleOverlay();
      break;

    case 'TRACKER_DETECTED':
      if (!overlayVisible && backgroundMode) {
        requestTrackerUpdate();
      }
      break;

    case 'CONTEXT_CHANGED':
      if (contexts) {
        currentContexts = contexts;
        if (overlayVisible) {
          updateContextWarning();
        }
      }
      break;

    case 'PATTERN_ANOMALY':
      if (message.alerts) {
        patternAlerts.push(...message.alerts);
        message.alerts.forEach(alert => {
          if (overlayVisible) {
            showPatternAlert(alert);
          } else if (backgroundMode && alert.severity === 'alert') {
            showBackgroundAlert(1);
          }
        });
      }
      break;
  }
});

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  @keyframes slideUp {
    from { transform: translate(-50%, 20px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }
  @keyframes slideDown {
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, 20px); opacity: 0; }
  }
  .himt-ml-section {
    padding: 12px 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  .himt-privacy-score {
    text-align: center;
    margin-bottom: 8px;
  }
  .himt-score-label {
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 4px;
  }
  .himt-score-value {
    font-size: 28px;
    font-weight: 700;
    color: #10b981;
  }
  .himt-score-bar {
    height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    margin-top: 8px;
  }
  .himt-score-fill {
    height: 100%;
    background: #10b981;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .himt-pattern-alerts {
    max-height: 80px;
    overflow-y: auto;
  }
  .himt-pattern-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 4px;
    animation: slideIn 0.3s ease;
  }
  .himt-alert-info { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .himt-alert-warning { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
  .himt-alert-alert { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
  .himt-ml-badge, .himt-fingerprint-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    margin: 4px 0;
  }
  .himt-ml-badge {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
  }
  .himt-fingerprint-badge {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  .himt-threat-panel {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  .himt-threat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
  .himt-threat-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .himt-threat-score {
    font-size: 13px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  .himt-threat-content {
  }
  .himt-threat-empty {
    text-align: center;
    padding: 16px;
    color: #94a3b8;
    font-size: 13px;
  }
  .himt-threat-loading {
    text-align: center;
    padding: 12px;
    color: #94a3b8;
    font-size: 12px;
  }
  .himt-insight-section {
    margin-bottom: 12px;
  }
  .himt-insight-section:last-child {
    margin-bottom: 0;
  }
  .himt-insight-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .himt-insight-icon {
    font-size: 14px;
  }
  .himt-insight-title {
    font-size: 11px;
    font-weight: 700;
    color: #1D4ED8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .himt-insight-item {
    padding: 8px 10px;
    border-radius: 8px;
    margin-bottom: 4px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.04);
    font-size: 12px;
  }
  .himt-insight-text {
    color: #334155;
    line-height: 1.4;
  }
  .himt-insight-text strong {
    color: #0f172a;
    font-weight: 600;
  }
  .himt-insight-sub {
    color: #64748b;
    font-size: 11px;
    margin-top: 2px;
    line-height: 1.3;
  }
  .himt-insight-warning {
    border-left: 3px solid #f59e0b;
    background: rgba(245, 158, 11, 0.04);
  }
  .himt-insight-info {
    border-left: 3px solid #1D4ED8;
    background: rgba(29, 78, 216, 0.03);
  }
  .himt-insight-data {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .himt-data-type {
    color: #334155;
    text-transform: capitalize;
    font-weight: 500;
  }
  .himt-data-count {
    color: #f59e0b;
    font-weight: 600;
    font-size: 11px;
  }
  .himt-recommendation {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.04);
  }
  .himt-rec-header {
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 3px;
    font-size: 12px;
  }
  .himt-rec-action {
    display: inline-block;
    margin-top: 6px;
    padding: 4px 14px;
    border: 1px solid #1D4ED8;
    background: rgba(29, 78, 216, 0.08);
    color: #1D4ED8;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .himt-rec-action:hover {
    background: #1D4ED8;
    color: white;
  }
  .himt-rec-done {
    background: rgba(16, 185, 129, 0.1) !important;
    border-color: #10b981 !important;
    color: #10b981 !important;
    cursor: default;
  }
`;
document.head.appendChild(style);

console.log('[HIMT Content] Content script loaded');
