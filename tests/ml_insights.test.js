// Tests for ML Insights Engine
// Uses inline copy since Jest can't import ESM modules

// Inline the MLInsightsEngine class for testing
class MLInsightsEngine {
    constructor() {
        this.trackerHistory = new Map();
        this.siteTrackerMap = new Map();
        this.fingerprintEvents = new Map();
        this.sessionStartTime = Date.now();
        this.totalRequestsBlocked = 0;
        this.totalRequestsAllowed = 0;
    }

    recordTracker(trackerDomain, siteDomain, info) {
        if (!this.trackerHistory.has(trackerDomain)) {
            this.trackerHistory.set(trackerDomain, {
                sites: new Set(), count: 0,
                category: info.category || 'Unknown',
                owner: info.owner || 'Unknown',
                riskScore: info.riskScore || 0,
                dataCollected: info.dataCollected || [],
                enforcementMode: info.enforcementMode || 'allow'
            });
        }
        const tracker = this.trackerHistory.get(trackerDomain);
        tracker.sites.add(siteDomain);
        tracker.count++;
        if (info.riskScore > tracker.riskScore) tracker.riskScore = info.riskScore;
        if (info.enforcementMode) tracker.enforcementMode = info.enforcementMode;

        if (!this.siteTrackerMap.has(siteDomain)) {
            this.siteTrackerMap.set(siteDomain, new Set());
        }
        this.siteTrackerMap.get(siteDomain).add(trackerDomain);

        if (info.enforcementMode === 'block') this.totalRequestsBlocked++;
        else this.totalRequestsAllowed++;
    }

    recordFingerprint(domain, technique) {
        if (!this.fingerprintEvents.has(domain)) {
            this.fingerprintEvents.set(domain, { techniques: new Set(), count: 0 });
        }
        const fp = this.fingerprintEvents.get(domain);
        fp.techniques.add(technique);
        fp.count++;
    }

    generateInsights() {
        return {
            crossSiteTracking: this.getCrossSiteTracking(),
            dataExposure: this.getDataExposure(),
            fingerprintingThreats: this.getFingerprintingThreats(),
            recommendations: this.getRecommendations(),
            privacyScore: this.calculatePrivacyScore(),
            summary: this.getSummaryStats()
        };
    }

    getCrossSiteTracking() {
        const crossSiteTrackers = [];
        for (const [domain, data] of this.trackerHistory) {
            if (data.sites.size >= 2) {
                crossSiteTrackers.push({
                    tracker: domain, owner: data.owner,
                    sitesTracked: data.sites.size,
                    sites: Array.from(data.sites).slice(0, 5),
                    category: data.category, riskScore: data.riskScore,
                    message: `${data.owner} is tracking you across ${data.sites.size} sites`
                });
            }
        }
        crossSiteTrackers.sort((a, b) => b.sitesTracked - a.sitesTracked);

        const companyMap = {};
        for (const t of crossSiteTrackers) {
            if (!companyMap[t.owner]) {
                companyMap[t.owner] = { owner: t.owner, trackers: [], totalSites: new Set() };
            }
            companyMap[t.owner].trackers.push(t.tracker);
            t.sites.forEach(s => companyMap[t.owner].totalSites.add(s));
        }
        const companies = Object.values(companyMap)
            .map(c => ({ owner: c.owner, trackerCount: c.trackers.length, siteCount: c.totalSites.size, trackers: c.trackers }))
            .sort((a, b) => b.siteCount - a.siteCount);

        return {
            trackers: crossSiteTrackers.slice(0, 10),
            companies: companies.slice(0, 8),
            totalCrossSiteTrackers: crossSiteTrackers.length,
            headline: crossSiteTrackers.length > 0
                ? `${crossSiteTrackers.length} trackers follow you across multiple sites`
                : 'No cross-site tracking detected yet'
        };
    }

    getDataExposure() {
        const dataTypes = {};
        const companiesWithData = new Set();
        for (const [domain, data] of this.trackerHistory) {
            companiesWithData.add(data.owner);
            const inferredData = this._inferDataFromCategory(data.category, domain);
            for (const dtype of inferredData) {
                if (!dataTypes[dtype]) dataTypes[dtype] = { type: dtype, companies: new Set(), trackers: new Set() };
                dataTypes[dtype].companies.add(data.owner);
                dataTypes[dtype].trackers.add(domain);
            }
        }
        const exposureList = Object.values(dataTypes)
            .map(d => ({ dataType: d.type, companyCount: d.companies.size }))
            .sort((a, b) => b.companyCount - a.companyCount);

        return {
            exposedDataTypes: exposureList,
            totalCompanies: companiesWithData.size,
            totalTrackers: this.trackerHistory.size,
            headline: companiesWithData.size > 0 ? `Your data is shared with ${companiesWithData.size} companies` : 'No data exposure detected'
        };
    }

    getFingerprintingThreats() {
        const threats = [];
        const techniqueLabels = {
            canvas: 'Canvas Fingerprinting', webgl: 'WebGL Fingerprinting', audio: 'Audio Fingerprinting',
            navigator: 'Navigator Probing', screen: 'Screen Fingerprinting'
        };
        for (const [domain, data] of this.fingerprintEvents) {
            threats.push({
                domain,
                techniques: Array.from(data.techniques).map(t => ({ id: t, label: techniqueLabels[t] || t })),
                techniqueCount: data.techniques.size,
                callCount: data.count,
                severity: data.techniques.size >= 3 ? 'critical' : data.techniques.size >= 2 ? 'high' : 'medium',
                message: `${domain} fingerprinting with ${data.techniques.size} techniques`
            });
        }
        threats.sort((a, b) => b.techniqueCount - a.techniqueCount);

        return { threats: threats.slice(0, 10), totalDomains: this.fingerprintEvents.size };
    }

    getRecommendations() {
        const recs = [];
        const crossSite = this.getCrossSiteTracking();
        for (const tracker of crossSite.trackers.slice(0, 3)) {
            const data = this.trackerHistory.get(tracker.tracker);
            if (data && data.enforcementMode !== 'block') {
                recs.push({
                    type: 'BLOCK_TRACKER', priority: 'high', domain: tracker.tracker,
                    icon: '🛡️', title: `Block ${tracker.owner}`,
                    description: `Tracks you across ${tracker.sitesTracked} sites`,
                    action: { type: 'block', domain: tracker.tracker }
                });
            }
        }
        const fpThreats = this.getFingerprintingThreats();
        for (const threat of fpThreats.threats.filter(t => t.severity === 'critical').slice(0, 2)) {
            recs.push({
                type: 'BLOCK_FINGERPRINTER', priority: 'critical', domain: threat.domain,
                icon: '🔒', title: `Stop ${threat.domain}`,
                description: `Uses ${threat.techniqueCount} fingerprinting techniques`,
                action: { type: 'block', domain: threat.domain }
            });
        }
        const priorityOrder = { critical: 0, high: 1, medium: 2, info: 3 };
        recs.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
        return recs.slice(0, 5);
    }

    calculatePrivacyScore() {
        let score = 100;
        const deductions = [];
        const crossSiteCount = [...this.trackerHistory.values()].filter(t => t.sites.size >= 2).length;
        if (crossSiteCount > 0) { const p = Math.min(25, crossSiteCount * 3); score -= p; deductions.push({ reason: 'cross-site', penalty: p }); }
        if (this.fingerprintEvents.size > 0) { const p = Math.min(20, this.fingerprintEvents.size * 5); score -= p; deductions.push({ reason: 'fingerprinting', penalty: p }); }
        const tc = this.trackerHistory.size;
        if (tc > 5) { const p = Math.min(20, (tc - 5)); score -= p; deductions.push({ reason: 'trackers', penalty: p }); }
        return { score: Math.max(0, Math.min(100, Math.round(score))), deductions };
    }

    getSummaryStats() {
        return {
            totalTrackers: this.trackerHistory.size,
            totalSitesVisited: this.siteTrackerMap.size,
            blocked: this.totalRequestsBlocked,
            allowed: this.totalRequestsAllowed,
            fingerprintAttempts: this.fingerprintEvents.size,
            uniqueCompanies: new Set([...this.trackerHistory.values()].map(t => t.owner)).size
        };
    }

    _inferDataFromCategory(category) {
        const categoryData = {
            'Analytics': ['browsing history', 'page views', 'click behavior'],
            'Advertising': ['browsing history', 'interests', 'demographics'],
            'Social': ['social profile', 'browsing history'],
            'Session Recording': ['mouse movements', 'keystrokes'],
            'Unknown': ['browsing history']
        };
        return categoryData[category] || categoryData['Unknown'];
    }

    resetSession() {
        this.trackerHistory.clear();
        this.siteTrackerMap.clear();
        this.fingerprintEvents.clear();
        this.sessionStartTime = Date.now();
        this.totalRequestsBlocked = 0;
        this.totalRequestsAllowed = 0;
    }
}

// =================== TESTS ===================

describe('MLInsightsEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new MLInsightsEngine();
    });

    describe('recordTracker', () => {
        test('should record a tracker with site association', () => {
            engine.recordTracker('tracker.example.com', 'site1.com', {
                category: 'Advertising', owner: 'ExampleCo', riskScore: 50, enforcementMode: 'allow'
            });
            const insights = engine.generateInsights();
            expect(insights.summary.totalTrackers).toBe(1);
        });

        test('should track cross-site presence', () => {
            engine.recordTracker('tracker.example.com', 'site1.com', { category: 'Advertising', owner: 'ExampleCo', riskScore: 50 });
            engine.recordTracker('tracker.example.com', 'site2.com', { category: 'Advertising', owner: 'ExampleCo', riskScore: 50 });
            const crossSite = engine.getCrossSiteTracking();
            expect(crossSite.totalCrossSiteTrackers).toBe(1);
            expect(crossSite.trackers[0].sitesTracked).toBe(2);
        });
    });

    describe('getCrossSiteTracking', () => {
        test('should group trackers by company', () => {
            engine.recordTracker('google-analytics.com', 'site1.com', { category: 'Analytics', owner: 'Google', riskScore: 40 });
            engine.recordTracker('google-analytics.com', 'site2.com', { category: 'Analytics', owner: 'Google', riskScore: 40 });
            engine.recordTracker('doubleclick.net', 'site1.com', { category: 'Advertising', owner: 'Google', riskScore: 60 });
            engine.recordTracker('doubleclick.net', 'site3.com', { category: 'Advertising', owner: 'Google', riskScore: 60 });

            const result = engine.getCrossSiteTracking();
            expect(result.companies[0].owner).toBe('Google');
            expect(result.companies[0].trackerCount).toBe(2);
        });

        test('should not include single-site trackers', () => {
            engine.recordTracker('single.com', 'only-one-site.com', { category: 'Analytics', owner: 'SingleCo', riskScore: 20 });
            const result = engine.getCrossSiteTracking();
            expect(result.totalCrossSiteTrackers).toBe(0);
        });
    });

    describe('getDataExposure', () => {
        test('should infer data types from tracker categories', () => {
            engine.recordTracker('ads.example.com', 'site.com', { category: 'Advertising', owner: 'AdCo', riskScore: 50 });
            const exposure = engine.getDataExposure();
            expect(exposure.exposedDataTypes.length).toBeGreaterThan(0);
            expect(exposure.totalCompanies).toBe(1);
        });

        test('should count unique companies', () => {
            engine.recordTracker('t1.com', 'site.com', { category: 'Analytics', owner: 'CompanyA', riskScore: 30 });
            engine.recordTracker('t2.com', 'site.com', { category: 'Advertising', owner: 'CompanyB', riskScore: 40 });
            engine.recordTracker('t3.com', 'site.com', { category: 'Social', owner: 'CompanyC', riskScore: 50 });
            const exposure = engine.getDataExposure();
            expect(exposure.totalCompanies).toBe(3);
        });
    });

    describe('recordFingerprint + getFingerprintingThreats', () => {
        test('should track fingerprinting techniques per domain', () => {
            engine.recordFingerprint('fp.example.com', 'canvas');
            engine.recordFingerprint('fp.example.com', 'webgl');
            engine.recordFingerprint('fp.example.com', 'audio');
            const threats = engine.getFingerprintingThreats();
            expect(threats.totalDomains).toBe(1);
            expect(threats.threats[0].techniqueCount).toBe(3);
            expect(threats.threats[0].severity).toBe('critical');
        });

        test('should rate severity based on technique count', () => {
            engine.recordFingerprint('low.com', 'canvas');
            engine.recordFingerprint('high.com', 'canvas');
            engine.recordFingerprint('high.com', 'webgl');
            const threats = engine.getFingerprintingThreats();
            const low = threats.threats.find(t => t.domain === 'low.com');
            const high = threats.threats.find(t => t.domain === 'high.com');
            expect(low.severity).toBe('medium');
            expect(high.severity).toBe('high');
        });
    });

    describe('getRecommendations', () => {
        test('should recommend blocking cross-site trackers', () => {
            engine.recordTracker('doubleclick.net', 'site1.com', { category: 'Advertising', owner: 'Google', riskScore: 70, enforcementMode: 'allow' });
            engine.recordTracker('doubleclick.net', 'site2.com', { category: 'Advertising', owner: 'Google', riskScore: 70, enforcementMode: 'allow' });
            const recs = engine.getRecommendations();
            const blockRec = recs.find(r => r.type === 'BLOCK_TRACKER');
            expect(blockRec).toBeDefined();
            expect(blockRec.domain).toBe('doubleclick.net');
        });

        test('should recommend blocking critical fingerprinters', () => {
            engine.recordFingerprint('evil.com', 'canvas');
            engine.recordFingerprint('evil.com', 'webgl');
            engine.recordFingerprint('evil.com', 'audio');
            const recs = engine.getRecommendations();
            const fpRec = recs.find(r => r.type === 'BLOCK_FINGERPRINTER');
            expect(fpRec).toBeDefined();
            expect(fpRec.priority).toBe('critical');
        });
    });

    describe('calculatePrivacyScore', () => {
        test('should start at 100 with no data', () => {
            const score = engine.calculatePrivacyScore();
            expect(score.score).toBe(100);
        });

        test('should decrease with cross-site trackers', () => {
            engine.recordTracker('t1.com', 's1.com', { category: 'Advertising', owner: 'A', riskScore: 50 });
            engine.recordTracker('t1.com', 's2.com', { category: 'Advertising', owner: 'A', riskScore: 50 });
            const score = engine.calculatePrivacyScore();
            expect(score.score).toBeLessThan(100);
        });

        test('should decrease with fingerprinting', () => {
            engine.recordFingerprint('fp.com', 'canvas');
            const score = engine.calculatePrivacyScore();
            expect(score.score).toBeLessThan(100);
        });
    });

    describe('generateInsights', () => {
        test('should return all insight sections', () => {
            const insights = engine.generateInsights();
            expect(insights).toHaveProperty('crossSiteTracking');
            expect(insights).toHaveProperty('dataExposure');
            expect(insights).toHaveProperty('fingerprintingThreats');
            expect(insights).toHaveProperty('recommendations');
            expect(insights).toHaveProperty('privacyScore');
            expect(insights).toHaveProperty('summary');
        });
    });

    describe('resetSession', () => {
        test('should clear all data', () => {
            engine.recordTracker('t.com', 's.com', { category: 'Analytics', owner: 'X', riskScore: 30 });
            engine.recordFingerprint('fp.com', 'canvas');
            engine.resetSession();
            const insights = engine.generateInsights();
            expect(insights.summary.totalTrackers).toBe(0);
            expect(insights.summary.fingerprintAttempts).toBe(0);
        });
    });
});
