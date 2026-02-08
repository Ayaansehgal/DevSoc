/**
 * Pure utility functions for tracker logic
 * Designed for easy testing without Chrome API mocking
 */

// Known high-risk tracker domains
export const HIGH_RISK_TRACKERS = [
  "doubleclick.net",
  "hotjar.com",
  "facebook.com",
  "fullstory.com",
  "mouseflow.com"
];

// Safe domains (CDNs, essential services)
export const SAFE_DOMAINS = [
  "cloudflare.com",
  "gstatic.com",
  "googleapis.com",
  "cdnjs.cloudflare.com",
  "jsdelivr.net"
];

// Tracker knowledge base
export const TRACKER_KB = {
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

/**
 * Calculate risk level for a domain
 * @param {string} domain - The domain to evaluate
 * @param {number} requestCount - Number of requests made
 * @param {string[]} knownTrackers - List of known high-risk trackers
 * @returns {"HIGH" | "MEDIUM" | "LOW"}
 */
export function calculateRiskLevel(domain, requestCount, knownTrackers = HIGH_RISK_TRACKERS) {
  if (knownTrackers.some(t => domain.includes(t))) return "HIGH";
  if (requestCount > 50) return "MEDIUM";
  if (requestCount > 20) return "LOW";
  return "LOW";
}

/**
 * Sort trackers by request count (descending)
 * @param {Map<string, number>} domainCounts - Map of domain to request count
 * @returns {Array<{domain: string, count: number}>}
 */
export function sortTrackersByCount(domainCounts) {
  return [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Check if domain is third-party relative to current hostname
 * @param {string} domain - Domain to check
 * @param {string} currentHostname - Current page hostname
 * @returns {boolean}
 */
export function isThirdParty(domain, currentHostname) {
  return !currentHostname.endsWith(domain);
}

/**
 * Check if domain is in safe list
 * @param {string} domain - Domain to check
 * @param {string[]} safeDomains - List of safe domains
 * @returns {boolean}
 */
export function isSafeDomain(domain, safeDomains = SAFE_DOMAINS) {
  return safeDomains.some(s => domain === s || domain.endsWith("." + s));
}

/**
 * Check if domain is a known high-risk tracker
 * @param {string} domain - Domain to check
 * @returns {boolean}
 */
export function isHighRiskTracker(domain) {
  return HIGH_RISK_TRACKERS.some(t => domain.includes(t));
}

/**
 * Get tracker information from knowledge base
 * @param {string} domain - Domain to look up
 * @returns {object} Tracker info or default unknown info
 */
export function getTrackerInfo(domain) {
  return TRACKER_KB[domain] || {
    name: domain,
    category: "Unknown",
    risk: "UNKNOWN",
    description: "Third-party service with unclear data practices.",
    dataCollected: ["Browsing behavior"],
    regulation: "No public documentation available."
  };
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string|null} Domain or null if invalid
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Build privacy report data
 * @param {Map<string, number>} domainCounts - Domain request counts
 * @param {Set<string>} blocked - Blocked domains
 * @param {string} hostname - Current site hostname
 * @returns {object} Report data
 */
export function buildReportData(domainCounts, blocked, hostname) {
  const topDomains = sortTrackersByCount(domainCounts)
    .slice(0, 15)
    .map(({ domain, count }) => ({
      domain,
      requests: count,
      risk: calculateRiskLevel(domain, count),
      blocked: blocked.has(domain)
    }));

  return {
    generatedAt: new Date().toISOString(),
    site: hostname,
    totalRequests: [...domainCounts.values()].reduce((a, b) => a + b, 0),
    uniqueDomains: domainCounts.size,
    blockedCount: blocked.size,
    suspiciousCount: topDomains.filter(d => d.risk === "HIGH").length,
    topDomains
  };
}
