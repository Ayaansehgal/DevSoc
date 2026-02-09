// Content Script - UI overlay and DOM context detection
// Enhanced with glassmorphic design and comprehensive features

let overlayVisible = false;
let backgroundMode = true;
let trackers = [];
let currentContexts = [];
let stats = { total: 0, allowed: 0, restricted: 0, sandboxed: 0, blocked: 0 };
let lastUpdate = 0;

// Initialize
(function init() {
  console.log('[HIMT Content] Initializing...');
  detectDOMContexts();
  requestTrackerUpdate();
  
  // Periodic updatesī
  setInterval(detectDOMContexts, 5000);
  setInterval(requestTrackerUpdate, 3000);
})();

// Detect DOM-based contexts (checkout, login forms)ī
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

  // Send to service worker
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

// Request tracker data from service worker
function requestTrackerUpdate() {
  chrome.runtime.sendMessage({ type: 'GET_TRACKERS' }, (response) => {
    if (response?.success) {
      trackers = response.trackers || [];
      stats = response.stats || { total: 0, allowed: 0, restricted: 0, sandboxed: 0, blocked: 0 };
      currentContexts = response.contexts || [];
      
      if (overlayVisible) {
        renderTrackerList();
        updateStats();
      } else if (backgroundMode) {
        checkForSuspiciousActivity();
      }
    }
  });
}

// Check for suspicious activity in background mode
function checkForSuspiciousActivity() {
  const highRiskTrackers = trackers.filter(t => t.riskScore >= 60);
  
  if (highRiskTrackers.length > 0 && Date.now() - lastUpdate > 10000) {
    showBackgroundAlert(highRiskTrackers.length);
    lastUpdate = Date.now();
  }
}

// Show subtle background alert
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
      <span style="font-weight: bold;">!</span>
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

// Toggle overlay visibility
function toggleOverlay() {
  overlayVisible ? hideOverlay() : showOverlay();
}

// Show overlay
function showOverlay() {
  overlayVisible = true;
  createOverlay();
  requestTrackerUpdate();
}

// Hide overlay
function hideOverlay() {
  overlayVisible = false;
  const panel = document.getElementById('himt-panel');
  if (panel) panel.remove();
}

// Create main overlay panel
function createOverlay() {
  // Remove existing
  const existing = document.getElementById('himt-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'himt-panel';
  panel.setAttribute('data-testid', 'panel-main');
  panel.className = 'himt-panel';
  
  panel.innerHTML = `
    <div class="himt-header">
      <div class="himt-logo">
        <div class="himt-logo-icon"></div>
        <div class="himt-logo-text">
          <div class="himt-title">How I Met Your Tracker</div>
          <div class="himt-subtitle">Privacy Protection Active</div>
        </div>
      </div>
      <button class="himt-close-btn" id="himt-close" data-testid="btn-close">×</button>
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
        <span class="himt-btn-text">${backgroundMode ? 'Background Mode ON' : 'Background Mode OFF'}</span>
      </button>
      <button class="himt-btn himt-btn-primary" id="himt-export" data-testid="btn-export">
        <span class="himt-btn-text">Export Report</span>
      </button>
    </div>

    <div class="himt-tracker-list" id="himt-tracker-list">
      <div class="himt-empty-state">
        <div class="himt-empty-text">No third-party trackers detected</div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Attach event listeners
  document.getElementById('himt-close').addEventListener('click', hideOverlay);
  document.getElementById('himt-bg-toggle').addEventListener('click', toggleBackgroundMode);
  document.getElementById('himt-export').addEventListener('click', exportReport);

  // Initial render
  renderTrackerList();
  updateStats();
  updateContextWarning();
}

// Update statistics display
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

// Update context warning
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

// Track expanded details state
let expandedDetails = new Set();

// Render tracker list
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

  // Sort by risk score (highest first)
  const sortedTrackers = [...trackers].sort((a, b) => b.riskScore - a.riskScore);

  container.innerHTML = sortedTrackers.map(tracker => createTrackerCard(tracker)).join('');

  // Attach event listeners to tracker cards
  sortedTrackers.forEach(tracker => {
    attachTrackerListeners(tracker);
  });
}

// Create tracker card HTML
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

      <div class="himt-tracker-details" id="details-${info.domain}" style="display: ${expandedDetails.has(info.domain) ? 'block' : 'none'};">
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
          <span>${expandedDetails.has(info.domain) ? 'Hide' : 'Details'}</span>
        </button>
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

// Attach event listeners to tracker card
function attachTrackerListeners(tracker) {
  const domain = tracker.info.domain;

  // Details toggle
  const detailsBtn = document.querySelector(`.himt-action-details[data-domain="${domain}"]`);
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => toggleDetails(domain));
  }

  // Mode buttons
  const modeButtons = document.querySelectorAll(`.himt-tracker-card[data-domain="${domain}"] button[data-mode]`);
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.mode;
      handleUserOverride(domain, mode);
    });
  });
}

// Toggle tracker details
function toggleDetails(domain) {
  const details = document.getElementById(`details-${domain}`);
  const btn = document.querySelector(`.himt-action-details[data-domain="${domain}"]`);
  
  if (details && btn) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    btn.querySelector('span').textContent = isVisible ? 'Details' : 'Hide';
    
    // Persist the expanded state
    if (isVisible) {
      expandedDetails.delete(domain);
    } else {
      expandedDetails.add(domain);
    }
  }
}

// Handle user override
function handleUserOverride(domain, mode) {
  chrome.runtime.sendMessage({
    type: 'USER_OVERRIDE',
    data: { domain, mode, scope: 'tab' }
  }, (response) => {
    if (response?.success) {
      // Update local data
      const tracker = trackers.find(t => t.info.domain === domain);
      if (tracker) {
        tracker.enforcementMode = mode;
        tracker.wasOverridden = true;
      }
      renderTrackerList();
      
      // Show feedback
      showFeedback(`${domain} set to ${mode.toUpperCase()}`);
    } else {
      showFeedback('Failed to update tracker', true);
    }
  });
}

// Toggle background mode
function toggleBackgroundMode() {
  backgroundMode = !backgroundMode;
  const btn = document.getElementById('himt-bg-toggle');
  if (btn) {
    btn.querySelector('.himt-btn-text').textContent = backgroundMode ? 'Background Mode ON' : 'Background Mode OFF';
  }
  showFeedback(`Background mode ${backgroundMode ? 'enabled' : 'disabled'}`);
}

// Export privacy report
function exportReport() {
  chrome.runtime.sendMessage({ type: 'EXPORT_REPORT' }, (response) => {
    if (response?.success && response.report) {
      const report = response.report;
      
      // Generate HTML report
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Privacy Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f9fafb; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h1 { color: #111827; margin-bottom: 8px; }
    .timestamp { color: #6b7280; margin-bottom: 32px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat { background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-label { color: #6b7280; font-size: 13px; margin-bottom: 4px; }
    .stat-value { color: #111827; font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; }
    .badge-allow { background: #10b981; }
    .badge-restrict { background: #f59e0b; }
    .badge-sandbox { background: #ef4444; }
    .badge-block { background: #7f1d1d; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Tracking Report</h1>
    <div class="timestamp">Generated on ${new Date(report.timestamp).toLocaleString()}</div>
    
    <h2>Summary Statistics</h2>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${report.stats.total}</div></div>
      <div class="stat"><div class="stat-label">Allowed</div><div class="stat-value">${report.stats.allowed}</div></div>
      <div class="stat"><div class="stat-label">Restricted</div><div class="stat-value">${report.stats.restricted}</div></div>
      <div class="stat"><div class="stat-label">Sandboxed</div><div class="stat-value">${report.stats.sandboxed}</div></div>
      <div class="stat"><div class="stat-label">Blocked</div><div class="stat-value">${report.stats.blocked}</div></div>
    </div>
    
    ${report.contexts.length > 0 ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 32px; border-radius: 4px;">
        <strong>Critical Context:</strong> ${report.contexts.join(', ')}
      </div>
    ` : ''}
    
    <h2>Detected Trackers</h2>
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Owner</th>
          <th>Category</th>
          <th>Risk</th>
          <th>Requests</th>
          <th>Mode</th>
        </tr>
      </thead>
      <tbody>
        ${report.trackers.map(t => `
          <tr>
            <td>${t.domain}</td>
            <td>${t.owner}</td>
            <td>${t.category}</td>
            <td>${t.riskScore}/100</td>
            <td>${t.requestCount}</td>
            <td><span class="badge badge-${t.enforcementMode}">${t.enforcementMode.toUpperCase()}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
      `;

      // Download report
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `privacy-report-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      
      showFeedback('Report exported successfully');
    } else {
      showFeedback('Failed to export report', true);
    }
  });
}

// Show feedback toast
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

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, tracker, stats: newStats, contexts } = message;

  switch (type) {
    case 'TOGGLE_OVERLAY':
      toggleOverlay();
      break;

    case 'TRACKER_DETECTED':
      // Update in background
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
  }
});

// Add CSS animations
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
`;
document.head.appendChild(style);

console.log('[HIMT Content] Content script loaded');

