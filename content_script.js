let visible = false;
let backgroundMode = true;

let total = 0;
const domainCounts = new Map();
const blocked = new Set();
let lastSpike = 0;

const SAFE_DOMAINS = ["cloudflare.com","gstatic.com","googleapis.com","cdnjs.cloudflare.com","jsdelivr.net"];

const HIGH_RISK_TRACKERS = [
  "doubleclick.net",
  "hotjar.com",
  "facebook.com",
  "fullstory.com",
  "mouseflow.com"
];

const EXPLAINERS = {
  "doubleclick.net": {
    name: "Google DoubleClick",
    category: "Ads",
    risk: "High",
    what: "Tracks you across websites to build an advertising profile.",
    data: ["Pages visited", "Ads clicked", "Interests"]
  },
  "facebook.com": {
    name: "Meta Pixel",
    category: "Social",
    risk: "High",
    what: "Links your browsing to your Facebook profile.",
    data: ["Products viewed", "Articles read"]
  },
  "google-analytics.com": {
    name: "Google Analytics",
    category: "Analytics",
    risk: "Medium",
    what: "Tracks how you use websites and shares analytics with Google.",
    data: ["Pages visited", "Location", "Device info"]
  },
  "hotjar.com": {
    name: "Hotjar",
    category: "Session Recording",
    risk: "High",
    what: "Records mouse movement and interaction behavior.",
    data: ["Clicks", "Scrolling", "Form interactions"]
  }
};

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function isThirdParty(domain) {
  return !location.hostname.endsWith(domain);
}

function isSafe(domain) {
  return SAFE_DOMAINS.some(s => domain === s || domain.endsWith("." + s));
}

function explain(domain) {
  return EXPLAINERS[domain] || {
    name: domain,
    category: "Unknown",
    risk: "Unknown",
    what: "Third-party service receiving data from this site.",
    data: ["Browsing behavior"]
  };
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

/* ---------------- UI ---------------- */

const panel = document.createElement("div");
panel.style = `
  position: fixed;
  top: 16px;
  right: 16px;
  width: 360px;
  backdrop-filter: blur(14px);
  background: linear-gradient(180deg, rgba(17,25,40,0.85), rgba(2,6,23,0.9));
  color: #e5e7eb;
  z-index: 999999;
  border-radius: 18px;
  padding: 14px 14px 12px 14px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Inter, sans-serif;
  font-size: 12.5px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.06);
  display: none;
`;


panel.innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <div style="display:flex; align-items:center; gap:8px;">
      <div style="font-size:18px;">👻</div>
      <div>
        <div style="font-weight:700; letter-spacing:.3px;">GhostTraffic</div>
        <div style="font-size:11px; color:#94a3b8;">Live Privacy Monitor</div>
      </div>
    </div>
    <button id="gt-close" style="
      background: rgba(255,255,255,0.06);
      border: none;
      color: #cbd5f5;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
    ">✕</button>
  </div>

  <div id="gt-stats" style="
    background: rgba(255,255,255,0.06);
    padding: 8px 10px;
    border-radius: 10px;
    margin-bottom: 10px;
    display:flex;
    justify-content:space-between;
    align-items:center;
  ">
    <span>📡 Requests</span>
    <b>0</b>
  </div>

  <button id="gt-bg-toggle" style="
    width:100%;
    padding:8px;
    border-radius:10px;
    border:none;
    background: linear-gradient(135deg, #16a34a, #22c55e);
    color:#052e16;
    font-weight:600;
    margin-bottom:8px;
    cursor:pointer;
  ">🟢 Background Mode: ON</button>

  <button id="gt-block-all" style="
    width:100%;
    padding:8px;
    border-radius:10px;
    border:none;
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    color:#022c44;
    font-weight:600;
    margin-bottom:8px;
    cursor:pointer;
  ">🛡️ Block All Trackers</button>
  <button id="gt-export" style="width:100%; margin-top:6px;">
  📤 Export Privacy Report
</button>


  <div style="margin-bottom:6px; font-size:11px; color:#94a3b8;">
    Top third-party connections
  </div>

  <div id="gt-domains" style="
    max-height:160px;
    overflow:auto;
    border-radius:10px;
    background: rgba(2,6,23,0.6);
    padding:6px;
  "></div>

  <div id="gt-explainer" style="
    margin-top:10px;
    font-size:11.5px;
    background: rgba(2,6,23,0.9);
    padding:10px;
    border-radius:12px;
    display:none;
    line-height:1.4;
    border: 1px solid rgba(255,255,255,0.05);
  "></div>
`;

document.body.appendChild(panel);

document.getElementById("gt-close").onclick = () => {
  panel.style.display = "none";
  visible = false;
};

document.getElementById("gt-bg-toggle").onclick = () => {
  backgroundMode = !backgroundMode;
  document.getElementById("gt-bg-toggle").textContent =
    backgroundMode ? "🟢 Background Mode: ON" : "🔴 Background Mode: OFF";
};

document.getElementById("gt-block-all").onclick = () => {
  for (const d of domainCounts.keys()) {
    if (isThirdParty(d) && !isSafe(d)) block(d);
  }
};

/* ---------------- Logic ---------------- */

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

function render() {
  const list = document.getElementById("gt-domains");
  list.innerHTML = "";

  [...domainCounts.entries()].slice(0, 10).forEach(([domain, count]) => {
    const row = document.createElement("div");
    row.className = "gt-row";
    row.style = `
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:6px;
      padding:6px 8px;
      border-radius:8px;
      margin-bottom:4px;
      background: rgba(255,255,255,0.03);
      cursor: default;
    `;

    const left = document.createElement("div");
    left.innerHTML = `<b>${domain}</b> <span style="color:#94a3b8">(${count})</span>`;

    const actions = document.createElement("div");
    actions.style = "display:flex; gap:6px;";

    const explainBtn = document.createElement("button");
    explainBtn.textContent = "Why?";
    explainBtn.style = `
      padding:4px 6px;
      border-radius:6px;
      border:none;
      cursor:pointer;
      background:rgba(255,255,255,0.08);
      color:#e5e7eb;
      font-size:11px;
    `;
    explainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showExplainer(domain);
    });

    const blockBtn = document.createElement("button");
    blockBtn.textContent = blocked.has(domain) ? "Unblock" : "Block";
    blockBtn.style = `
      padding:4px 6px;
      border-radius:6px;
      border:none;
      cursor:pointer;
      background:${blocked.has(domain) ? "#334155" : "#ef4444"};
      color:#fff;
      font-size:11px;
    `;
    blockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      blocked.has(domain) ? unblock(domain) : block(domain);
    });

    actions.appendChild(explainBtn);
    actions.appendChild(blockBtn);

    row.appendChild(left);
    row.appendChild(actions);
    list.appendChild(row);
  });
}



function showExplainer(domain) {
  const info = EXPLAINERS[domain] || {
    name: domain,
    category: "Unknown",
    what: "Third-party service receiving data from this site.",
    risk: "Unknown",
    data: ["Browsing behavior"]
  };

  alert(
    `🔍 ${info.name}\n\n` +
    `Category: ${info.category}\n\n` +
    `What it does:\n${info.what}\n\n` +
    `Risk:\n${info.risk}\n\n` +
    `Data collected:\n- ${info.data.join("\n- ")}`
  );
}



function showAlert(domain) {
  if (document.getElementById("gt-alert")) return;

  const alert = document.createElement("div");
  alert.id = "gt-alert";
  alert.style = `
    position:fixed; bottom:20px; right:20px;
    background:#020617; color:#fff;
    padding:10px 12px; border-radius:10px;
    box-shadow:0 10px 30px rgba(0,0,0,0.5);
    z-index:999999;
    font-size:12px;
  `;

  alert.innerHTML = `
    🚨 Suspicious tracking detected<br/>
    <b>${domain}</b><br/>
    <button id="gt-alert-open" style="margin-top:6px;">Inspect</button>
    <button id="gt-alert-dismiss" style="margin-left:6px;">Dismiss</button>
  `;

  document.body.appendChild(alert);

  document.getElementById("gt-alert-open").onclick = () => {
    panel.style.display = "block";
    visible = true;
    alert.remove();
  };

  document.getElementById("gt-alert-dismiss").onclick = () => alert.remove();
  setTimeout(() => alert.remove(), 7000);
}

/* ---------------- Events ---------------- */

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "TOGGLE_OVERLAY") {
    visible = !visible;
    panel.style.display = visible ? "block" : "none";
  }

  if (msg.type === "GHOST_TRAFFIC") {
    const d = getDomain(msg.payload.url);
    if (!d) return;

    total++;
    document.getElementById("gt-stats").textContent = `Requests: ${total}`;
    domainCounts.set(d, (domainCounts.get(d) || 0) + 1);

    if (visible) render();

    if (backgroundMode && isThirdParty(d) && (isSuspicious(d) || domainCounts.size > 12 || isSpike())) {
      showAlert(d);
    }
  }
});

function buildPrivacyReport() {
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({
      domain,
      requests: count,
      risk: isSuspicious(domain) ? "high" : "normal",
      blocked: blocked.has(domain)
    }));

  return {
    generatedAt: new Date().toISOString(),
    site: location.hostname,
    totalRequests: total,
    uniqueDomains: domainCounts.size,
    suspiciousCount: topDomains.filter(d => d.risk === "high").length,
    topDomains
  };
}
const exportBtn = document.getElementById("gt-export");
if (exportBtn) {
  exportBtn.onclick = () => {
    const report = buildPrivacyReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `ghosttraffic-report-${location.hostname}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };
}
function buildPrettyReportHTML() {
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => {
      const status = blocked.has(domain) ? "Blocked" : "Allowed";
      const risk = isSuspicious(domain) ? "High" : "Normal";
      return `<li><b>${domain}</b> — ${risk} risk — ${status}</li>`;
    })
    .join("");

  return `
  <html>
    <head>
      <title>GhostTraffic Privacy Report</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 32px; color: #0f172a; }
        h1 { margin-bottom: 4px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .metric { font-size: 14px; margin: 6px 0; }
        .bad { color: #dc2626; font-weight: 600; }
        .good { color: #16a34a; font-weight: 600; }
        ul { padding-left: 18px; }
        footer { margin-top: 24px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <h1>👻 GhostTraffic Privacy Report</h1>
      <div style="color:#475569;">Site: ${location.hostname}</div>
      <div style="color:#475569;">Date: ${new Date().toLocaleString()}</div>

      <div class="card">
        <div class="metric bad">🚨 Total requests: ${total}</div>
        <div class="metric">🌐 Third-party domains: ${domainCounts.size}</div>
        <div class="metric good">🛡️ Blocked trackers: ${[...blocked].length}</div>
      </div>

      <div class="card">
        <h3>Top Third-Party Trackers</h3>
        <ul>${topDomains}</ul>
      </div>

      <div class="card">
        <h3>Why this matters</h3>
        <p>
          Many websites embed third-party services that track your behavior across the web.
          GhostTraffic makes these hidden data flows visible and lets you block high-risk trackers.
        </p>
      </div>

      <footer>
        Generated locally by GhostTraffic. No data was sent to any server.
      </footer>
    </body>
  </html>
  `;
}
document.getElementById("gt-export").onclick = () => {
  const html = buildPrettyReportHTML();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ghosttraffic-report-${location.hostname}.html`;
  a.click();

  URL.revokeObjectURL(url);
};
function explainDomain(domain) {
  const info = TRACKER_KB[domain] || {
    category: "Unknown",
    risks: ["Third-party service with unclear data practices."],
    regulation: "No public documentation available."
  };

  showModal(`
    🔍 ${domain}
    Category: ${info.category}

    Why this matters:
    ${info.risks.map(r => `• ${r}`).join("\n")}

    Legal context:
    ${info.regulation}
  `);
}
function renderDomainRow(domain, count) {
  const row = document.createElement("div");
  row.className = "gt-row";

  row.innerHTML = `
    <span class="gt-domain">${domain}</span>
    <span class="gt-count">${count}</span>
    <button class="gt-block">Block</button>
    <button class="gt-explain">Why is this risky?</button>
  `;

  // Block handler (you already have this)
  row.querySelector(".gt-block").onclick = () => {
    chrome.runtime.sendMessage({ type: "BLOCK_DOMAIN", domain });
  };

  // Explain handler (new)
  row.querySelector(".gt-explain").onclick = () => {
    explainDomain(domain);
  };

  return row;
}
function renderDomains() {
  list.innerHTML = "";
  domainCounts.forEach((count, domain) => {
    list.appendChild(renderDomainRow(domain, count));
  });
}
const TRACKER_KB = {
  "doubleclick.net": {
    category: "Advertising Tracker",
    risks: [
      "Tracks you across multiple websites",
      "Builds a behavioral profile for ad targeting"
    ],
    regulation: "Usually requires explicit consent under GDPR."
  },
  "facebook.com": {
    category: "Social Media Tracker",
    risks: [
      "Links browsing behavior to Facebook profile",
      "Enables cross-site tracking even when logged out"
    ],
    regulation: "Often requires consent depending on region."
  },
  "google-analytics.com": {
    category: "Analytics",
    risks: [
      "Collects browsing behavior and device information",
      "Shares data with Google services"
    ],
    regulation: "Allowed with anonymization and consent."
  }
};
function explainDomain(domain) {
  const info = TRACKER_KB[domain] || {
    category: "Unknown third-party service",
    risks: ["This domain is a third-party request with unclear data practices."],
    regulation: "No public documentation available."
  };

  alert(
    `🔍 ${domain}\n\n` +
    `Category: ${info.category}\n\n` +
    `Why this matters:\n- ${info.risks.join("\n- ")}\n\n` +
    `Legal context:\n${info.regulation}`
  );
}
