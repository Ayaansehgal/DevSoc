// Risk Scoring Engine - Calculates threat levels for trackers

import { trackerKnowledge } from './tracker_knowledge.js';

export class RiskEngine {
  constructor(policies) {
    this.policies = policies;
    this.requestCounts = new Map(); // Track frequency
    this.firstSeenTimestamps = new Map(); // Track when first seen
  }

  // Main risk calculation function
  calculateRisk(requestDetails, trackerInfo, contexts) {
    let score = 0;
    const { url, type, initiator, tabId } = requestDetails;

    // Base risk from tracker database
    score += trackerInfo.baseRisk || 0;

    // Category-based risk adjustment
    score += this.getCategoryRisk(trackerInfo.category);

    // High-risk tracker check
    if (this.isHighRiskTracker(trackerInfo.domain)) {
      score += this.policies.riskFactors.knownHighRiskTracker || 35;
    }

    // Session recording is especially risky
    if (this.isSessionRecording(trackerInfo.category)) {
      score += this.policies.riskFactors.sessionRecording || 40;
    }

    // Cross-site tracking
    if (this.isCrossSite(url, initiator)) {
      score += this.policies.riskFactors.crossSiteRequest || 15;
    }

    // Request type analysis
    if (type === 'xmlhttprequest' || type === 'fetch') {
      score += this.policies.riskFactors.thirdPartyCookie || 10;
    }

    // Frequency analysis
    const frequency = this.getRequestFrequency(url, tabId);
    if (frequency > this.policies.spikeThreshold.requests) {
      score += this.policies.riskFactors.excessiveFrequency || 15;
    }

    // Critical domain reduction (payment processors, security)
    if (this.isCriticalDomain(trackerInfo.domain)) {
      score = Math.max(0, score - 30);
    }

    // Safe domain reduction (CDNs)
    if (this.isSafeDomain(trackerInfo.domain)) {
      score = Math.max(0, score - 20);
    }

    // Context-aware adjustment - reduce risk in critical flows
    if (contexts && contexts.size > 0) {
      score = Math.max(0, score - 10);
    }

    return Math.min(100, Math.max(0, score));
  }

  // Get category-specific risk
  getCategoryRisk(category) {
    return this.policies.categoryRiskLevels[category] || 0;
  }

  // Check if tracker is in high-risk list
  isHighRiskTracker(domain) {
    return this.policies.highRiskTrackers.some(tracker => 
      domain.includes(tracker) || tracker.includes(domain)
    );
  }

  // Check if tracker does session recording
  isSessionRecording(category) {
    return category === 'Session Recording';
  }

  // Check if request is cross-site
  isCrossSite(requestUrl, initiatorUrl) {
    if (!initiatorUrl) return true;

    try {
      const requestDomain = new URL(requestUrl).hostname;
      const initiatorDomain = new URL(initiatorUrl).hostname;
      
      const requestBase = this.getBaseDomain(requestDomain);
      const initiatorBase = this.getBaseDomain(initiatorDomain);
      
      return requestBase !== initiatorBase;
    } catch {
      return true;
    }
  }

  // Extract base domain
  getBaseDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  }

  // Track and analyze request frequency
  getRequestFrequency(url, tabId) {
    const key = `${tabId}:${url}`;
    const now = Date.now();
    
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
      this.firstSeenTimestamps.set(key, now);
    }

    const timestamps = this.requestCounts.get(key);
    
    // Remove old timestamps (outside time window)
    const timeWindow = this.policies.spikeThreshold.timeWindow || 5000;
    const recentTimestamps = timestamps.filter(ts => now - ts < timeWindow);
    recentTimestamps.push(now);
    
    this.requestCounts.set(key, recentTimestamps);
    
    return recentTimestamps.length;
  }

  // Detect traffic spikes
  detectSpike(domain, tabId) {
    const frequency = this.getRequestFrequency(domain, tabId);
    return frequency > this.policies.spikeThreshold.requests;
  }

  // Check if domain is critical (payment, auth)
  isCriticalDomain(domain) {
    return this.policies.criticalDomains.some(critical => 
      domain.includes(critical) || critical.includes(domain)
    );
  }

  // Check if domain is safe (CDN)
  isSafeDomain(domain) {
    return this.policies.safeDomains.some(safe => 
      domain === safe || domain.endsWith(`.${safe}`)
    );
  }

  // Get risk level label
  getRiskLevel(score) {
    if (score >= this.policies.thresholds.block) return 'CRITICAL';
    if (score >= this.policies.thresholds.sandbox) return 'HIGH';
    if (score >= this.policies.thresholds.restrict) return 'MEDIUM';
    return 'LOW';
  }

  // Clear frequency data for tab
  clearTabData(tabId) {
    for (const key of this.requestCounts.keys()) {
      if (key.startsWith(`${tabId}:`)) {
        this.requestCounts.delete(key);
        this.firstSeenTimestamps.delete(key);
      }
    }
  }

  // Get statistics for a domain
  getDomainStats(domain, tabId) {
    const key = `${tabId}:${domain}`;
    const frequency = this.requestCounts.get(key)?.length || 0;
    const firstSeen = this.firstSeenTimestamps.get(key);
    
    return {
      requestCount: frequency,
      firstSeen: firstSeen,
      isSpike: frequency > this.policies.spikeThreshold.requests
    };
  }
}
