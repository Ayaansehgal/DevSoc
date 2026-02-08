/* GhostTraffic Content Script - White Glass UI with data-testid attributes */

let visible = false;
let backgroundMode = true;
let allBlocked = false;
let total = 0;
const domainCounts = new Map();
const blocked = new Set();
let lastSpike = 0;
let trackerKB = {};

// Load tracker knowledge base from JSON file
(async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('tracker_kb.json'));
    trackerKB = await response.json();
    console.log('[GhostTraffic] Tracker KB loaded:', Object.keys(trackerKB).length, 'entries');
  } catch (e) {
    console.warn('[GhostTraffic] Failed to load tracker KB:', e);
  }
})();

const SAFE_DOMAINS = ["cloudflare.com", "gstatic.com", "googleapis.com", "cdnjs.cloudflare.com", "jsdelivr.net"];

const HIGH_RISK_TRACKERS = [
  "doubleclick.net",
  "hotjar.com",
  "facebook.com",
  "fullstory.com",
  "mouseflow.com"
];

const TRACKER_KB = {
  "doubleclick.net": {
    name: "Google DoubleClick",
    category: "Advertising",
    risk: "HIGH",
    description: "Tracks you across websites to build an advertising profile.",
    dataCollected: ["Pages visited", "Ads clicked", "Interests"],
    regulation: "Usually requires explicit consent under GDPR."
  },
  "facebook.com": {
    name: "Meta Pixel",
    category: "Social",
    risk: "HIGH",
    description: "Links your browsing to your Facebook profile.",
    dataCollected: ["Products viewed", "Articles read"],
    regulation: "Often requires consent depending on region."
  },
  "google-analytics.com": {
    name: "Google Analytics",
    category: "Analytics",
    risk: "MEDIUM",
    description: "Tracks how you use websites and shares analytics with Google.",
    dataCollected: ["Pages visited", "Location", "Device info"],
    regulation: "Allowed with anonymization and consent."
  },
  "hotjar.com": {
    name: "Hotjar",
    category: "Session Recording",
    risk: "HIGH",
    description: "Records mouse movement and interaction behavior.",
    dataCollected: ["Clicks", "Scrolling", "Form interactions"],
    regulation: "Requires explicit consent for session recording."
  },
  "fullstory.com": {
    name: "FullStory",
    category: "Session Recording",
    risk: "HIGH",
    description: "Records user sessions including clicks and inputs.",
    dataCollected: ["Session recordings", "User interactions"],
    regulation: "Requires explicit consent."
  }
};

/* ---------------- Utility Functions ---------------- */

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function isThirdParty(domain) {
  return !location.hostname.endsWith(domain);
}

function isSafe(domain) {
  return SAFE_DOMAINS.some(s => domain === s || domain.endsWith("." + s));
}

function isSpike() {
  const now = Date.now();
  const spike = (now - lastSpike) < 1200;
  lastSpike = now;
  return spike;
}

function isSuspicious(domain) {
  return HIGH_RISK_TRACKERS.some(t => domain.includes(t));
}

function calculateRiskLevel(domain, requestCount) {
  if (isSuspicious(domain)) return "HIGH";
  if (requestCount > 50) return "MEDIUM";
  return "LOW";
}

function getTrackerInfo(domain) {
  return TRACKER_KB[domain] || {
    name: domain,
    category: "Unknown",
    risk: "UNKNOWN",
    description: "Third-party service with unclear data practices.",
    dataCollected: ["Browsing behavior"],
    regulation: "No public documentation available."
  };
}

/* ---------------- UI Panel (White Glass Effect) ---------------- */

const panel = document.createElement("div");
panel.setAttribute("data-testid", "panel-main");
panel.style = `
  position: fixed;
  top: 16px;
  right: 16px;
  width: 520px;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  background: rgba(255, 255, 255, 0.85);
  color: #1e293b;
  z-index: 999999;
  border-radius: 20px;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
  font-size: 13px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: none;
  line-height: 1.5;
`;

panel.innerHTML = `
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div style="display: flex; align-items: center;">
      <img src="${chrome.runtime.getURL('assets/logo2.png')}" 
           alt="Logo" 
           style="height: 65px; width: auto;"
           data-testid="panel-logo" />
    </div>
    <button 
      data-testid="btn-close"
      id="gt-close" 
      style="
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.06);
        color: #475569;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.15s ease;
      "
      onmouseover="this.style.background='rgba(0,0,0,0.08)'"
      onmouseout="this.style.background='rgba(0,0,0,0.04)'"
    >&#x2715;</button>
  </div>

  <div 
    id="gt-stats" 
    data-testid="stats-container"
    style="
      background: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    "
  >
    <span style="color: #64748b; font-weight: 500;">Requests Tracked</span>
    <span data-testid="stats-count" id="gt-count" style="font-weight: 700; font-size: 16px; color: #0f172a;">0</span>
  </div>

  <div style="display: flex; gap: 8px; margin-bottom: 12px;">
    <button 
      id="gt-bg-toggle" 
      data-testid="toggle-background"
      style="
        flex: 1;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(22, 163, 74, 0.25);
        background: rgba(22, 163, 74, 0.1);
        color: #15803d;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
      "
    >Background: ON</button>

    <button 
      id="gt-block-all" 
      data-testid="btn-block-all"
      style="
        flex: 1;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(220, 38, 38, 0.25);
        background: rgba(220, 38, 38, 0.1);
        color: #dc2626;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
      "
    >Block All</button>
  </div>

  <button 
    id="gt-export" 
    data-testid="btn-dashboard"
    style="
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.25);
      background: rgba(99, 102, 241, 0.1);
      color: #4f46e5;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      margin-bottom: 16px;
      transition: all 0.15s ease;
    "
    onmouseover="this.style.background='rgba(99, 102, 241, 0.15)'"
    onmouseout="this.style.background='rgba(99, 102, 241, 0.1)'"
  >Analytics Dashboard</button>

  <div style="font-size: 11px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
    Third-Party Connections
  </div>

  <div 
    id="gt-domains" 
    data-testid="domains-table"
    style="
      max-height: 260px;
      overflow-y: auto;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.05);
    "
  >
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: rgba(0, 0, 0, 0.04); position: sticky; top: 0;">
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569;">Site URL</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569;">Company</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569;">Category</th>
          <th style="padding: 10px 8px; text-align: center; font-weight: 600; color: #475569;">Action</th>
        </tr>
      </thead>
      <tbody id="gt-domains-body"></tbody>
    </table>
  </div>
`;

document.body.appendChild(panel);

/* ---------------- Event Handlers ---------------- */

document.getElementById("gt-close").onclick = () => {
  panel.style.display = "none";
  visible = false;
};

document.getElementById("gt-bg-toggle").onclick = () => {
  backgroundMode = !backgroundMode;
  const btn = document.getElementById("gt-bg-toggle");
  if (backgroundMode) {
    btn.textContent = "Background: ON";
    btn.style.borderColor = "rgba(22, 163, 74, 0.25)";
    btn.style.background = "rgba(22, 163, 74, 0.1)";
    btn.style.color = "#15803d";
  } else {
    btn.textContent = "Background: OFF";
    btn.style.borderColor = "rgba(220, 38, 38, 0.25)";
    btn.style.background = "rgba(220, 38, 38, 0.1)";
    btn.style.color = "#dc2626";
  }
};

document.getElementById("gt-block-all").onclick = () => {
  const btn = document.getElementById("gt-block-all");
  allBlocked = !allBlocked;

  if (allBlocked) {
    // Block all third-party connections
    for (const d of domainCounts.keys()) {
      if (isThirdParty(d) && !isSafe(d)) block(d);
    }
    btn.textContent = "Unblock All";
    btn.style.borderColor = "rgba(22, 163, 74, 0.25)";
    btn.style.background = "rgba(22, 163, 74, 0.1)";
    btn.style.color = "#15803d";
  } else {
    // Unblock all connections
    for (const d of blocked) {
      unblock(d);
    }
    btn.textContent = "Block All";
    btn.style.borderColor = "rgba(220, 38, 38, 0.25)";
    btn.style.background = "rgba(220, 38, 38, 0.1)";
    btn.style.color = "#dc2626";
  }
};

document.getElementById("gt-export").onclick = () => {
  const html = buildPrettyReportHTML();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `privacy-report-${location.hostname}.html`;
  a.click();

  URL.revokeObjectURL(url);
};

/* ---------------- Blocking Logic ---------------- */

function block(domain) {
  chrome.runtime.sendMessage({ type: "BLOCK_DOMAIN", domain });
  blocked.add(domain);
  render();
}

function unblock(domain) {
  chrome.runtime.sendMessage({ type: "UNBLOCK_DOMAIN", domain });
  blocked.delete(domain);
  render();
}

/* ---------------- Render Functions ---------------- */

// Helper function to get tracker info from KB
function getTrackerKBInfo(domain) {
  // Normalize domain - remove www. prefix
  let normalizedDomain = domain.replace(/^www\./, '');

  // Try exact match first
  if (trackerKB[normalizedDomain]) {
    return trackerKB[normalizedDomain];
  }

  // Generate all possible variations to check
  const variations = [
    normalizedDomain,
    domain,
    `www.${normalizedDomain}`,
    `http://${normalizedDomain}/`,
    `https://${normalizedDomain}/`,
    `http://${normalizedDomain}`,
    `https://${normalizedDomain}`,
    `http://www.${normalizedDomain}/`,
    `https://www.${normalizedDomain}/`,
    `http://www.${normalizedDomain}`,
    `https://www.${normalizedDomain}`
  ];

  for (const variation of variations) {
    if (trackerKB[variation]) {
      return trackerKB[variation];
    }
  }

  // Try matching parent domains (e.g., ads.google.com -> google.com)
  const parts = normalizedDomain.split('.');
  for (let i = 1; i < parts.length; i++) {
    const parentDomain = parts.slice(i).join('.');
    // Skip TLDs alone (like .com, .net)
    if (parentDomain.split('.').length < 2) continue;

    const parentVariations = [
      parentDomain,
      `http://${parentDomain}/`,
      `https://${parentDomain}/`,
      `http://${parentDomain}`,
      `https://${parentDomain}`
    ];

    for (const v of parentVariations) {
      if (trackerKB[v]) {
        return trackerKB[v];
      }
    }
  }

  // Fallback: Common tracker categorization based on domain patterns
  const fallbackCategories = {
    // Google
    'google': { company: 'Google', category: 'Analytics' },
    'googleadservices': { company: 'Google', category: 'Advertising' },
    'googlesyndication': { company: 'Google', category: 'Advertising' },
    'googletagmanager': { company: 'Google', category: 'Analytics' },
    'google-analytics': { company: 'Google', category: 'Analytics' },
    'googleapis': { company: 'Google', category: 'Content' },
    'gstatic': { company: 'Google', category: 'Content' },
    'youtube': { company: 'Google', category: 'Content' },
    'doubleclick': { company: 'Google', category: 'Advertising' },
    // Facebook/Meta
    'facebook': { company: 'Meta', category: 'Social' },
    'fbcdn': { company: 'Meta', category: 'Social' },
    'fb': { company: 'Meta', category: 'Social' },
    'instagram': { company: 'Meta', category: 'Social' },
    'meta': { company: 'Meta', category: 'Social' },
    // Microsoft
    'microsoft': { company: 'Microsoft', category: 'Analytics' },
    'bing': { company: 'Microsoft', category: 'Analytics' },
    'msn': { company: 'Microsoft', category: 'Content' },
    'azure': { company: 'Microsoft', category: 'Content' },
    'clarity': { company: 'Microsoft', category: 'Analytics' },
    // Amazon
    'amazon': { company: 'Amazon', category: 'Advertising' },
    'amazonaws': { company: 'Amazon', category: 'Content' },
    'cloudfront': { company: 'Amazon', category: 'Content' },
    // Twitter/X
    'twitter': { company: 'X Corp', category: 'Social' },
    'twimg': { company: 'X Corp', category: 'Social' },
    // Analytics
    'hotjar': { company: 'Hotjar', category: 'Analytics' },
    'mixpanel': { company: 'Mixpanel', category: 'Analytics' },
    'segment': { company: 'Segment', category: 'Analytics' },
    'amplitude': { company: 'Amplitude', category: 'Analytics' },
    'heap': { company: 'Heap', category: 'Analytics' },
    'fullstory': { company: 'FullStory', category: 'Analytics' },
    'mouseflow': { company: 'Mouseflow', category: 'Analytics' },
    'crazyegg': { company: 'Crazy Egg', category: 'Analytics' },
    'optimizely': { company: 'Optimizely', category: 'Analytics' },
    'newrelic': { company: 'New Relic', category: 'Analytics' },
    'sentry': { company: 'Sentry', category: 'Analytics' },
    'logrocket': { company: 'LogRocket', category: 'Analytics' },
    'smartlook': { company: 'Smartlook', category: 'Analytics' },
    // Advertising
    'criteo': { company: 'Criteo', category: 'Advertising' },
    'taboola': { company: 'Taboola', category: 'Advertising' },
    'outbrain': { company: 'Outbrain', category: 'Advertising' },
    'adroll': { company: 'AdRoll', category: 'Advertising' },
    'pubmatic': { company: 'PubMatic', category: 'Advertising' },
    'rubiconproject': { company: 'Rubicon', category: 'Advertising' },
    'openx': { company: 'OpenX', category: 'Advertising' },
    'appnexus': { company: 'AppNexus', category: 'Advertising' },
    'adsrvr': { company: 'The Trade Desk', category: 'Advertising' },
    'adnxs': { company: 'AppNexus', category: 'Advertising' },
    'moatads': { company: 'Oracle', category: 'Advertising' },
    'serving-sys': { company: 'Sizmek', category: 'Advertising' },
    'amazon-adsystem': { company: 'Amazon', category: 'Advertising' },
    // CDN/Content
    'cloudflare': { company: 'Cloudflare', category: 'Content' },
    'akamai': { company: 'Akamai', category: 'Content' },
    'jsdelivr': { company: 'jsDelivr', category: 'Content' },
    'cdnjs': { company: 'Cloudflare', category: 'Content' },
    'unpkg': { company: 'Unpkg', category: 'Content' },
    'fontawesome': { company: 'Font Awesome', category: 'Content' },
    'bootstrapcdn': { company: 'Bootstrap', category: 'Content' },
    // Social
    'linkedin': { company: 'LinkedIn', category: 'Social' },
    'pinterest': { company: 'Pinterest', category: 'Social' },
    'tiktok': { company: 'TikTok', category: 'Social' },
    'snapchat': { company: 'Snapchat', category: 'Social' },
    'reddit': { company: 'Reddit', category: 'Social' },
    // Other
    'intercom': { company: 'Intercom', category: 'Analytics' },
    'zendesk': { company: 'Zendesk', category: 'Content' },
    'hubspot': { company: 'HubSpot', category: 'Analytics' },
    'salesforce': { company: 'Salesforce', category: 'Analytics' },
    'stripe': { company: 'Stripe', category: 'Content' },
    'paypal': { company: 'PayPal', category: 'Content' },
    'recaptcha': { company: 'Google', category: 'Anti-fraud' },
    'hcaptcha': { company: 'hCaptcha', category: 'Anti-fraud' }
  };

  // Check if any fallback pattern matches the domain
  const lowerDomain = normalizedDomain.toLowerCase();
  for (const [pattern, info] of Object.entries(fallbackCategories)) {
    if (lowerDomain.includes(pattern)) {
      return info;
    }
  }

  return null;
}

// Category color mapping
const categoryColors = {
  'Advertising': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Analytics': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'Social': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  'Content': { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  'Cryptomining': { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  'FingerprintingInvasive': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'FingerprintingGeneral': { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  'EmailAggressive': { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  'Anti-fraud': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  'Unknown': { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }
};

function render() {
  const tbody = document.getElementById("gt-domains-body");
  tbody.innerHTML = "";

  const sorted = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  sorted.forEach(([domain, count]) => {
    const isBlocked = blocked.has(domain);
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Get tracker info from KB
    const kbInfo = getTrackerKBInfo(domain);
    const company = kbInfo?.company || 'Unknown';
    const category = kbInfo?.category || 'Unknown';
    const categoryStyle = categoryColors[category] || categoryColors.Unknown;

    const row = document.createElement("tr");
    row.setAttribute("data-testid", `row-${sanitizedDomain}`);
    row.style = `
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      transition: background 0.1s ease;
    `;
    row.onmouseover = () => row.style.background = "rgba(0, 0, 0, 0.02)";
    row.onmouseout = () => row.style.background = "transparent";

    row.innerHTML = `
      <td style="padding: 10px 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
               style="width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0;" 
               onerror="this.style.display='none'" />
          <span style="font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${domain}">${domain}</span>
        </div>
      </td>
      <td style="padding: 10px 12px; color: #475569;">
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${company}">${company}</span>
      </td>
      <td style="padding: 10px 12px;">
        <span style="
          font-size: 9px; 
          color: ${categoryStyle.text}; 
          background: ${categoryStyle.bg};
          border: 1px solid ${categoryStyle.border};
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase; 
          font-weight: 600;
          white-space: nowrap;
        ">${category}</span>
      </td>
      <td style="padding: 10px 8px; text-align: center;"></td>
    `;

    // Add block/unblock button to last cell
    const actionCell = row.querySelector('td:last-child');
    const blockBtn = document.createElement("button");
    blockBtn.textContent = isBlocked ? "Unblock" : "Block";
    blockBtn.setAttribute("data-testid", `toggle-${sanitizedDomain}`);
    blockBtn.style = `
      padding: 4px 10px;
      border-radius: 5px;
      border: none;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      transition: all 0.1s ease;
      ${isBlocked
        ? "background: #e2e8f0; color: #64748b;"
        : "background: #dc2626; color: white;"}
    `;
    blockBtn.onclick = (e) => {
      e.stopPropagation();
      isBlocked ? unblock(domain) : block(domain);
    };
    actionCell.appendChild(blockBtn);

    tbody.appendChild(row);
  });
}

function showExplainer(domain) {
  const info = getTrackerInfo(domain);

  alert(
    `${info.name}\n\n` +
    `Category: ${info.category}\n` +
    `Risk Level: ${info.risk}\n\n` +
    `What it does:\n${info.description}\n\n` +
    `Data collected:\n- ${info.dataCollected.join("\n- ")}\n\n` +
    `Legal context:\n${info.regulation}`
  );
}

function showAlert(domain) {
  if (document.getElementById("gt-alert")) return;

  const alertBox = document.createElement("div");
  alertBox.id = "gt-alert";
  alertBox.setAttribute("data-testid", "alert-notification");
  alertBox.style = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    background: rgba(255, 255, 255, 0.92);
    color: #1e293b;
    padding: 16px 20px;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    z-index: 999999;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 320px;
  `;

  alertBox.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 6px; color: #dc2626;">Suspicious Tracker Detected</div>
    <div style="color: #64748b; margin-bottom: 12px; font-size: 12px;">${domain}</div>
    <div style="display: flex; gap: 8px;">
      <button 
        id="gt-alert-open" 
        data-testid="alert-inspect"
        style="
          flex: 1;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(37, 99, 235, 0.25);
          background: rgba(37, 99, 235, 0.1);
          color: #1d4ed8;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        "
      >Inspect</button>
      <button 
        id="gt-alert-dismiss" 
        data-testid="alert-dismiss"
        style="
          flex: 1;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.03);
          color: #475569;
          font-weight: 500;
          font-size: 12px;
          cursor: pointer;
        "
      >Dismiss</button>
    </div>
  `;

  document.body.appendChild(alertBox);

  document.getElementById("gt-alert-open").onclick = () => {
    panel.style.display = "block";
    visible = true;
    alertBox.remove();
  };

  document.getElementById("gt-alert-dismiss").onclick = () => alertBox.remove();
  setTimeout(() => alertBox.remove(), 7000);
}

/* ---------------- Report Generation ---------------- */

function buildPrettyReportHTML() {
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => {
      const status = blocked.has(domain) ? "Blocked" : "Allowed";
      const risk = calculateRiskLevel(domain, count);
      return `<tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${domain}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${count}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <span style="
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            ${risk === 'HIGH' ? 'background: #fef2f2; color: #dc2626;' :
          risk === 'MEDIUM' ? 'background: #fffbeb; color: #d97706;' :
            'background: #f0fdf4; color: #16a34a;'}
          ">${risk}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${status}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Report - ${location.hostname}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      padding: 40px; 
      color: #1e293b;
      background: #f8fafc;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
    .subtitle { color: #64748b; margin-bottom: 32px; }
    .card { 
      background: white; 
      border-radius: 16px; 
      padding: 24px; 
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(0, 0, 0, 0.05);
    }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #334155; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric { text-align: center; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
    .metric-value { font-size: 36px; font-weight: 700; color: #0f172a; }
    .metric-label { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; }
    th { 
      text-align: left; 
      padding: 12px 16px; 
      background: #f8fafc; 
      font-size: 11px; 
      text-transform: uppercase; 
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
    }
    footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Report</h1>
    <div class="subtitle">Site: ${location.hostname} | Generated: ${new Date().toLocaleString()}</div>
    
    <div class="card">
      <h2>Summary</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${total}</div>
          <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${domainCounts.size}</div>
          <div class="metric-label">Third-Party Domains</div>
        </div>
        <div class="metric">
          <div class="metric-value">${blocked.size}</div>
          <div class="metric-label">Blocked Trackers</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Top Third-Party Connections</h2>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Requests</th>
            <th>Risk</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${topDomains}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Why This Matters</h2>
      <p style="color: #475569;">
        Many websites embed third-party services that track your behavior across the web. 
        This report shows which domains are receiving data from your browsing session 
        and their associated privacy risk levels.
      </p>
    </div>

    <footer>
      Generated locally by GhostTraffic. No data was sent to any external server.
    </footer>
  </div>
</body>
</html>`;
}

/* ---------------- Message Handling ---------------- */

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "TOGGLE_OVERLAY") {
    visible = !visible;
    panel.style.display = visible ? "block" : "none";
  }

  if (msg.type === "GHOST_TRAFFIC") {
    const d = getDomain(msg.payload.url);
    if (!d) return;

    total++;
    document.getElementById("gt-count").textContent = total;
    domainCounts.set(d, (domainCounts.get(d) || 0) + 1);

    if (visible) render();

    if (backgroundMode && isThirdParty(d) && (isSuspicious(d) || domainCounts.size > 12 || isSpike())) {
      showAlert(d);
    }
  }
});
