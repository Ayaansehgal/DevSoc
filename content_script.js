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

  [...domainCounts.entries()].slice(0, 10).forEach(([d,c]) => {
    const row = document.createElement("div");
    row.style = `
  display:flex;
  justify-content:space-between;
  align-items:center;
  cursor:pointer;
  padding:6px 8px;
  border-radius:8px;
  margin-bottom:4px;
  transition: background .15s ease;
`;
row.onmouseenter = () => row.style.background = "rgba(255,255,255,0.06)";
row.onmouseleave = () => row.style.background = "transparent";

    row.innerHTML = `<span>${d} (${c})</span><span>${blocked.has(d) ? "🛑" : ""}</span>`;
    row.onclick = () => showExplainer(d);
    list.appendChild(row);
  });
}

function showExplainer(domain) {
  const info = explain(domain);
  const el = document.getElementById("gt-explainer");
  el.style.display = "block";
  el.innerHTML = `
  <div style="font-weight:700; font-size:13px; margin-bottom:4px;">
    ${info.name} <span style="color:#94a3b8;">(${info.category})</span>
  </div>
  <div style="margin-bottom:6px;">
    <span style="color:#f87171;">Risk:</span> ${info.risk}
  </div>
  <div style="margin-bottom:6px;">${info.what}</div>
  <div style="color:#94a3b8; font-size:11px;">
    Data shared: ${info.data.join(", ")}
  </div>
  <button id="gt-action-btn" style="
    margin-top:8px;
    width:100%;
    padding:6px;
    border-radius:8px;
    border:none;
    background: linear-gradient(135deg, #ef4444, #fb7185);
    color:#450a0a;
    font-weight:600;
    cursor:pointer;
  ">
    ${blocked.has(domain) ? "Unblock" : "Block"}
  </button>
`;

  document.getElementById("gt-action-btn").onclick = () =>
    blocked.has(domain) ? unblock(domain) : block(domain);
}

/* ---------------- Alerts ---------------- */

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
