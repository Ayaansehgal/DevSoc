// Pattern Analyzer - User browsing pattern analysis and anomaly detection
// Learns normal tracking patterns and alerts on unusual activity

import { AnomalyDetector } from './ml_models.js';

// Pattern types we track
const PATTERN_TYPES = {
    TRACKER_COUNT: 'tracker_count',
    CATEGORY_DISTRIBUTION: 'category_distribution',
    RISK_DISTRIBUTION: 'risk_distribution',
    TIME_PATTERNS: 'time_patterns',
    SITE_PATTERNS: 'site_patterns'
};

export class PatternAnalyzer {
    constructor() {
        this.baselineDays = 7;
        this.anomalyThreshold = 2.0; // Standard deviations
        this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit

        // Anomaly detectors for different metrics
        this.trackerCountDetector = new AnomalyDetector(100);
        this.riskScoreDetector = new AnomalyDetector(100);
        this.categoryDetectors = new Map(); // category -> AnomalyDetector

        // Session data
        this.currentSession = {
            startTime: Date.now(),
            trackerEvents: [],
            siteVisits: [],
            alerts: []
        };

        // Historical data
        this.historicalPatterns = {
            dailyAverages: {},
            categoryFrequency: {},
            sitePatterns: {},
            hourlyPatterns: new Array(24).fill(0)
        };

        this.initialized = false;
    }

    /**
     * Initialize the analyzer and load saved patterns
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const saved = await this.loadPatterns();
            if (saved) {
                this.loadSavedData(saved);
            }
            this.initialized = true;
            console.log('[HIMT PatternAnalyzer] Initialized');
        } catch (error) {
            console.error('[HIMT PatternAnalyzer] Init error:', error);
            this.initialized = true;
        }
    }

    /**
     * Load saved data into memory
     */
    loadSavedData(saved) {
        if (saved.historicalPatterns) {
            this.historicalPatterns = saved.historicalPatterns;
        }

        if (saved.trackerCountState) {
            this.trackerCountDetector.loadState(saved.trackerCountState);
        }

        if (saved.riskScoreState) {
            this.riskScoreDetector.loadState(saved.riskScoreState);
        }

        if (saved.categoryStates) {
            for (const [category, state] of Object.entries(saved.categoryStates)) {
                const detector = new AnomalyDetector(100);
                detector.loadState(state);
                this.categoryDetectors.set(category, detector);
            }
        }
    }

    /**
     * Load patterns from storage
     */
    async loadPatterns() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['patternAnalyzerState'], (result) => {
                    resolve(result.patternAnalyzerState || null);
                });
            } else {
                resolve(null);
            }
        });
    }

    /**
     * Save patterns to storage
     */
    async savePatterns() {
        const categoryStates = {};
        for (const [category, detector] of this.categoryDetectors.entries()) {
            categoryStates[category] = detector.exportState();
        }

        const state = {
            historicalPatterns: this.historicalPatterns,
            trackerCountState: this.trackerCountDetector.exportState(),
            riskScoreState: this.riskScoreDetector.exportState(),
            categoryStates,
            lastSaved: Date.now()
        };

        // Check storage size
        const stateSize = JSON.stringify(state).length;
        if (stateSize > this.maxStorageSize) {
            console.warn('[HIMT PatternAnalyzer] State too large, pruning old data');
            this.pruneOldData();
        }

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ patternAnalyzerState: state }, resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Prune old data to stay within storage limits
     */
    pruneOldData() {
        // Keep only last 7 days of daily averages
        const cutoffDate = Date.now() - (this.baselineDays * 24 * 60 * 60 * 1000);

        for (const date of Object.keys(this.historicalPatterns.dailyAverages)) {
            if (new Date(date).getTime() < cutoffDate) {
                delete this.historicalPatterns.dailyAverages[date];
            }
        }

        // Limit site patterns to top 100 sites
        const sites = Object.entries(this.historicalPatterns.sitePatterns);
        if (sites.length > 100) {
            sites.sort((a, b) => b[1].visitCount - a[1].visitCount);
            this.historicalPatterns.sitePatterns = {};
            for (const [site, data] of sites.slice(0, 100)) {
                this.historicalPatterns.sitePatterns[site] = data;
            }
        }
    }

    /**
     * Record a tracker event
     * @param {Object} event - Tracker event data
     */
    recordTrackerEvent(event) {
        const { domain, category, riskScore, websiteUrl, timestamp } = event;

        // Add to current session
        this.currentSession.trackerEvents.push({
            domain,
            category,
            riskScore,
            websiteUrl,
            timestamp: timestamp || Date.now()
        });

        // Update anomaly detectors
        this.trackerCountDetector.addDataPoint(this.currentSession.trackerEvents.length);
        this.riskScoreDetector.addDataPoint(riskScore);

        // Update category detector
        if (!this.categoryDetectors.has(category)) {
            this.categoryDetectors.set(category, new AnomalyDetector(100));
        }
        const categoryCount = this.currentSession.trackerEvents.filter(e => e.category === category).length;
        this.categoryDetectors.get(category).addDataPoint(categoryCount);

        // Update historical patterns
        this.updateHistoricalPatterns(event);

        // Check for anomalies
        return this.checkForAnomalies(event);
    }

    /**
     * Record a site visit
     */
    recordSiteVisit(url) {
        try {
            const domain = new URL(url).hostname;
            this.currentSession.siteVisits.push({
                domain,
                timestamp: Date.now()
            });

            // Update site patterns
            if (!this.historicalPatterns.sitePatterns[domain]) {
                this.historicalPatterns.sitePatterns[domain] = {
                    visitCount: 0,
                    avgTrackers: 0,
                    lastVisit: null
                };
            }
            this.historicalPatterns.sitePatterns[domain].visitCount++;
            this.historicalPatterns.sitePatterns[domain].lastVisit = Date.now();
        } catch (e) {
            // Invalid URL, ignore
        }
    }

    /**
     * Update historical patterns with new event
     */
    updateHistoricalPatterns(event) {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const hour = new Date().getHours();

        // Update daily averages
        if (!this.historicalPatterns.dailyAverages[date]) {
            this.historicalPatterns.dailyAverages[date] = {
                trackerCount: 0,
                avgRiskScore: 0,
                categories: {}
            };
        }

        const daily = this.historicalPatterns.dailyAverages[date];
        const prevCount = daily.trackerCount;
        daily.trackerCount++;
        daily.avgRiskScore = ((daily.avgRiskScore * prevCount) + event.riskScore) / daily.trackerCount;
        daily.categories[event.category] = (daily.categories[event.category] || 0) + 1;

        // Update category frequency
        this.historicalPatterns.categoryFrequency[event.category] =
            (this.historicalPatterns.categoryFrequency[event.category] || 0) + 1;

        // Update hourly patterns
        this.historicalPatterns.hourlyPatterns[hour]++;

        // Periodic save (every 50 events)
        if (this.currentSession.trackerEvents.length % 50 === 0) {
            this.savePatterns();
        }
    }

    /**
     * Check for anomalies and return alerts
     */
    checkForAnomalies(event) {
        const alerts = [];

        // Check tracker count anomaly
        const trackerCountAnomaly = this.trackerCountDetector.getAnomalyScore(
            this.currentSession.trackerEvents.length
        );
        if (trackerCountAnomaly > this.anomalyThreshold) {
            alerts.push({
                type: 'high_tracker_count',
                severity: 'warning',
                message: `Unusual number of trackers detected (${Math.round(trackerCountAnomaly)}x normal)`,
                score: trackerCountAnomaly
            });
        }

        // Check risk score anomaly
        const riskAnomaly = this.riskScoreDetector.getAnomalyScore(event.riskScore);
        if (riskAnomaly > this.anomalyThreshold) {
            alerts.push({
                type: 'high_risk_tracker',
                severity: 'alert',
                message: `Unusually high-risk tracker detected (risk score: ${event.riskScore})`,
                score: riskAnomaly
            });
        }

        // Check category anomaly
        if (this.categoryDetectors.has(event.category)) {
            const categoryCount = this.currentSession.trackerEvents.filter(
                e => e.category === event.category
            ).length;
            const categoryAnomaly = this.categoryDetectors.get(event.category).getAnomalyScore(categoryCount);

            if (categoryAnomaly > this.anomalyThreshold) {
                alerts.push({
                    type: 'category_spike',
                    severity: 'info',
                    message: `Unusual spike in ${event.category} trackers`,
                    category: event.category,
                    score: categoryAnomaly
                });
            }
        }

        // Store alerts
        if (alerts.length > 0) {
            this.currentSession.alerts.push(...alerts.map(a => ({
                ...a,
                timestamp: Date.now(),
                domain: event.domain
            })));
        }

        return alerts;
    }

    /**
     * Get current session summary
     */
    getSessionSummary() {
        const events = this.currentSession.trackerEvents;
        const duration = Date.now() - this.currentSession.startTime;

        // Category breakdown
        const categoryBreakdown = {};
        for (const event of events) {
            categoryBreakdown[event.category] = (categoryBreakdown[event.category] || 0) + 1;
        }

        // Risk breakdown
        const riskBreakdown = {
            low: events.filter(e => e.riskScore < 30).length,
            medium: events.filter(e => e.riskScore >= 30 && e.riskScore < 60).length,
            high: events.filter(e => e.riskScore >= 60 && e.riskScore < 85).length,
            critical: events.filter(e => e.riskScore >= 85).length
        };

        // Average risk
        const avgRisk = events.length > 0
            ? events.reduce((sum, e) => sum + e.riskScore, 0) / events.length
            : 0;

        // Unique domains
        const uniqueDomains = new Set(events.map(e => e.domain)).size;

        return {
            duration: Math.round(duration / 1000 / 60), // minutes
            totalTrackers: events.length,
            uniqueTrackers: uniqueDomains,
            avgRiskScore: Math.round(avgRisk),
            categoryBreakdown,
            riskBreakdown,
            alertCount: this.currentSession.alerts.length,
            recentAlerts: this.currentSession.alerts.slice(-5)
        };
    }

    /**
     * Get insights based on historical patterns
     */
    getInsights() {
        const insights = [];
        const stats = this.trackerCountDetector.getStats();

        // Compare current session to baseline
        if (stats.dataPoints >= 10) {
            const currentCount = this.currentSession.trackerEvents.length;
            const comparison = ((currentCount - stats.mean) / stats.mean * 100).toFixed(0);

            if (Math.abs(comparison) > 20) {
                insights.push({
                    type: comparison > 0 ? 'increase' : 'decrease',
                    message: `${Math.abs(comparison)}% ${comparison > 0 ? 'more' : 'fewer'} trackers than your usual browsing`
                });
            }
        }

        // Most active tracker category
        const categoryFreq = this.historicalPatterns.categoryFrequency;
        const topCategory = Object.entries(categoryFreq)
            .sort((a, b) => b[1] - a[1])[0];

        if (topCategory) {
            insights.push({
                type: 'category',
                message: `${topCategory[0]} trackers are most common in your browsing (${topCategory[1]} detected)`
            });
        }

        // Peak tracking hour
        const peakHour = this.historicalPatterns.hourlyPatterns.indexOf(
            Math.max(...this.historicalPatterns.hourlyPatterns)
        );

        if (this.historicalPatterns.hourlyPatterns[peakHour] > 0) {
            insights.push({
                type: 'time',
                message: `You encounter the most trackers around ${peakHour}:00`
            });
        }

        return insights;
    }

    /**
     * Get browsing privacy score (0-100, higher is better)
     */
    getPrivacyScore() {
        const summary = this.getSessionSummary();

        // Base score
        let score = 100;

        // Deduct for tracker count
        score -= Math.min(30, summary.totalTrackers * 0.5);

        // Deduct for high-risk trackers
        score -= summary.riskBreakdown.high * 5;
        score -= summary.riskBreakdown.critical * 10;

        // Deduct for alerts
        score -= summary.alertCount * 3;

        // Bonus for blocking
        // (This would need integration with enforcement data)

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Compare site to baseline
     */
    compareSiteToBaseline(url) {
        try {
            const domain = new URL(url).hostname;
            const sitePattern = this.historicalPatterns.sitePatterns[domain];

            if (!sitePattern || sitePattern.visitCount < 3) {
                return { hasBaseline: false };
            }

            // Get current trackers for this site
            const currentTrackers = this.currentSession.trackerEvents.filter(e => {
                try {
                    return new URL(e.websiteUrl).hostname === domain;
                } catch {
                    return false;
                }
            });

            const comparison = {
                hasBaseline: true,
                currentTrackers: currentTrackers.length,
                avgTrackers: sitePattern.avgTrackers,
                visitCount: sitePattern.visitCount,
                isUnusual: currentTrackers.length > sitePattern.avgTrackers * 1.5
            };

            return comparison;
        } catch {
            return { hasBaseline: false };
        }
    }

    /**
     * Start a new session
     */
    startNewSession() {
        // Save previous session data before starting new
        this.savePatterns();

        this.currentSession = {
            startTime: Date.now(),
            trackerEvents: [],
            siteVisits: [],
            alerts: []
        };
    }

    /**
     * Clear all pattern data
     */
    async clearAllData() {
        this.historicalPatterns = {
            dailyAverages: {},
            categoryFrequency: {},
            sitePatterns: {},
            hourlyPatterns: new Array(24).fill(0)
        };

        this.trackerCountDetector = new AnomalyDetector(100);
        this.riskScoreDetector = new AnomalyDetector(100);
        this.categoryDetectors.clear();

        this.startNewSession();

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.remove(['patternAnalyzerState'], resolve);
            } else {
                resolve();
            }
        });
    }
}

// Singleton instance
export const patternAnalyzer = new PatternAnalyzer();

console.log('[HIMT] Pattern Analyzer module loaded');
