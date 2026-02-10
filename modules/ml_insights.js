// ML Insights Engine - Generates actionable, concrete recommendations
// Instead of generic badges, this produces real threat intelligence

export class MLInsightsEngine {
    constructor() {
        this.trackerHistory = new Map(); // domain -> {sites: Set, count, category, riskScore}
        this.siteTrackerMap = new Map(); // site -> Set of tracker domains
        this.fingerprintEvents = new Map(); // domain -> {techniques: Set, count}
        this.sessionStartTime = Date.now();
        this.totalRequestsBlocked = 0;
        this.totalRequestsAllowed = 0;
    }

    /**
     * Record a tracker event for analysis
     */
    recordTracker(trackerDomain, siteDomain, info) {
        // Track which sites each tracker appears on (cross-site tracking)
        if (!this.trackerHistory.has(trackerDomain)) {
            this.trackerHistory.set(trackerDomain, {
                sites: new Set(),
                count: 0,
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

        // Track which trackers are on each site
        if (!this.siteTrackerMap.has(siteDomain)) {
            this.siteTrackerMap.set(siteDomain, new Set());
        }
        this.siteTrackerMap.get(siteDomain).add(trackerDomain);

        if (info.enforcementMode === 'block') this.totalRequestsBlocked++;
        else this.totalRequestsAllowed++;
    }

    /**
     * Record a fingerprinting event
     */
    recordFingerprint(domain, technique) {
        if (!this.fingerprintEvents.has(domain)) {
            this.fingerprintEvents.set(domain, { techniques: new Set(), count: 0 });
        }
        const fp = this.fingerprintEvents.get(domain);
        fp.techniques.add(technique);
        fp.count++;
    }

    /**
     * Generate all actionable insights
     */
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

    /**
     * INSIGHT 1: Cross-site tracking — "Who follows you across the web"
     */
    getCrossSiteTracking() {
        const crossSiteTrackers = [];

        for (const [domain, data] of this.trackerHistory) {
            if (data.sites.size >= 2) {
                crossSiteTrackers.push({
                    tracker: domain,
                    owner: data.owner,
                    sitesTracked: data.sites.size,
                    sites: Array.from(data.sites).slice(0, 5),
                    category: data.category,
                    riskScore: data.riskScore,
                    message: `${data.owner} is tracking you across ${data.sites.size} site${data.sites.size > 1 ? 's' : ''}`
                });
            }
        }

        crossSiteTrackers.sort((a, b) => b.sitesTracked - a.sitesTracked);

        // Group by company
        const companyMap = {};
        for (const t of crossSiteTrackers) {
            if (!companyMap[t.owner]) {
                companyMap[t.owner] = { owner: t.owner, trackers: [], totalSites: new Set() };
            }
            companyMap[t.owner].trackers.push(t.tracker);
            t.sites.forEach(s => companyMap[t.owner].totalSites.add(s));
        }

        const companies = Object.values(companyMap)
            .map(c => ({
                owner: c.owner,
                trackerCount: c.trackers.length,
                siteCount: c.totalSites.size,
                trackers: c.trackers,
                message: `${c.owner} follows you across ${c.totalSites.size} sites using ${c.trackers.length} tracker${c.trackers.length > 1 ? 's' : ''}`
            }))
            .sort((a, b) => b.siteCount - a.siteCount);

        return {
            trackers: crossSiteTrackers.slice(0, 10),
            companies: companies.slice(0, 8),
            totalCrossSiteTrackers: crossSiteTrackers.length,
            headline: crossSiteTrackers.length > 0
                ? `${crossSiteTrackers.length} tracker${crossSiteTrackers.length > 1 ? 's' : ''} follow${crossSiteTrackers.length === 1 ? 's' : ''} you across multiple sites`
                : 'No cross-site tracking detected yet'
        };
    }

    /**
     * INSIGHT 2: Data exposure — "What data is being collected"
     */
    getDataExposure() {
        const dataTypes = {};
        const companiesWithData = new Set();

        for (const [domain, data] of this.trackerHistory) {
            companiesWithData.add(data.owner);

            // Infer data types from category
            const inferredData = this._inferDataFromCategory(data.category, domain);
            for (const dtype of inferredData) {
                if (!dataTypes[dtype]) {
                    dataTypes[dtype] = { type: dtype, companies: new Set(), trackers: new Set() };
                }
                dataTypes[dtype].companies.add(data.owner);
                dataTypes[dtype].trackers.add(domain);
            }

            // Add explicit data collected
            for (const d of data.dataCollected) {
                const normalized = d.toLowerCase();
                if (!dataTypes[normalized]) {
                    dataTypes[normalized] = { type: normalized, companies: new Set(), trackers: new Set() };
                }
                dataTypes[normalized].companies.add(data.owner);
                dataTypes[normalized].trackers.add(domain);
            }
        }

        const exposureList = Object.values(dataTypes)
            .map(d => ({
                dataType: d.type,
                companyCount: d.companies.size,
                companies: Array.from(d.companies).slice(0, 5),
                message: `Your ${d.type} is shared with ${d.companies.size} compan${d.companies.size > 1 ? 'ies' : 'y'}`
            }))
            .sort((a, b) => b.companyCount - a.companyCount);

        return {
            exposedDataTypes: exposureList,
            totalCompanies: companiesWithData.size,
            totalTrackers: this.trackerHistory.size,
            headline: companiesWithData.size > 0
                ? `Your data is potentially shared with ${companiesWithData.size} companies`
                : 'No data exposure detected'
        };
    }

    /**
     * INSIGHT 3: Fingerprinting threats — "How you're being identified"
     */
    getFingerprintingThreats() {
        const threats = [];

        const techniqueLabels = {
            canvas: 'Canvas Fingerprinting — reads your GPU rendering to create a unique ID',
            webgl: 'WebGL Fingerprinting — probes your graphics card for identification',
            audio: 'Audio Fingerprinting — uses audio processing to uniquely identify your device',
            navigator: 'Navigator Probing — reads your browser/OS/device details',
            screen: 'Screen Fingerprinting — reads your screen resolution and display config',
            fonts: 'Font Enumeration — detects your installed fonts for identification',
            battery: 'Battery Status — monitors your battery to track you',
            webrtc: 'WebRTC Leak — can expose your real IP address'
        };

        for (const [domain, data] of this.fingerprintEvents) {
            threats.push({
                domain,
                techniques: Array.from(data.techniques).map(t => ({
                    id: t,
                    label: techniqueLabels[t] || `${t} fingerprinting`,
                })),
                techniqueCount: data.techniques.size,
                callCount: data.count,
                severity: data.techniques.size >= 3 ? 'critical' : data.techniques.size >= 2 ? 'high' : 'medium',
                message: `${domain} is fingerprinting your browser using ${data.techniques.size} technique${data.techniques.size > 1 ? 's' : ''}`
            });
        }

        threats.sort((a, b) => b.techniqueCount - a.techniqueCount);

        const allTechniques = new Set();
        for (const [, data] of this.fingerprintEvents) {
            data.techniques.forEach(t => allTechniques.add(t));
        }

        return {
            threats: threats.slice(0, 10),
            totalDomains: this.fingerprintEvents.size,
            techniquesUsed: Array.from(allTechniques).map(t => ({
                id: t,
                label: techniqueLabels[t] || t
            })),
            headline: threats.length > 0
                ? `${threats.length} site${threats.length > 1 ? 's' : ''} attempting to fingerprint your browser`
                : 'No fingerprinting detected'
        };
    }

    /**
     * INSIGHT 4: Smart recommendations — "What you should do"
     */
    getRecommendations() {
        const recs = [];

        // Rec 1: Block high-impact cross-site trackers
        const crossSite = this.getCrossSiteTracking();
        for (const tracker of crossSite.trackers.slice(0, 3)) {
            const data = this.trackerHistory.get(tracker.tracker);
            if (data && data.enforcementMode !== 'block') {
                const impactPct = Math.min(95, Math.round((tracker.sitesTracked / Math.max(1, this.siteTrackerMap.size)) * 100));
                recs.push({
                    type: 'BLOCK_TRACKER',
                    priority: 'high',
                    domain: tracker.tracker,
                    icon: '',
                    title: `Block ${tracker.owner}`,
                    description: `${tracker.owner} tracks you across ${tracker.sitesTracked} sites. Blocking ${tracker.tracker} reduces cross-site tracking by ~${impactPct}%`,
                    action: { type: 'block', domain: tracker.tracker }
                });
            }
        }

        // Rec 2: Fingerprinting protection
        const fpThreats = this.getFingerprintingThreats();
        for (const threat of fpThreats.threats.filter(t => t.severity === 'critical').slice(0, 2)) {
            recs.push({
                type: 'BLOCK_FINGERPRINTER',
                priority: 'critical',
                domain: threat.domain,
                icon: '',
                title: `Stop ${threat.domain} from fingerprinting you`,
                description: `This site uses ${threat.techniqueCount} fingerprinting techniques (${threat.techniques.map(t => t.id).join(', ')}). Block it to prevent device identification.`,
                action: { type: 'block', domain: threat.domain }
            });
        }

        // Rec 3: Data exposure reduction
        const exposure = this.getDataExposure();
        if (exposure.totalCompanies > 10) {
            recs.push({
                type: 'REDUCE_EXPOSURE',
                priority: 'medium',
                icon: '',
                title: `Reduce your data footprint`,
                description: `${exposure.totalCompanies} companies have access to your browsing data. Consider blocking advertising and session recording trackers to minimize exposure.`,
                action: { type: 'bulk_block', categories: ['Advertising', 'Session Recording'] }
            });
        }

        // Rec 4: Safe site praise
        for (const [site, trackers] of this.siteTrackerMap) {
            if (trackers.size === 0) {
                recs.push({
                    type: 'SAFE_SITE',
                    priority: 'info',
                    icon: '',
                    title: `${site} is tracker-free`,
                    description: 'No third-party trackers detected on this site. Your privacy is well protected here.',
                    action: null
                });
                break; // Only show one
            }
        }

        // Rec 5: Privacy score improvement
        const score = this.calculatePrivacyScore();
        if (score < 60) {
            const blockedCount = [...this.trackerHistory.values()].filter(t => t.enforcementMode === 'block').length;
            const unblocked = this.trackerHistory.size - blockedCount;
            recs.push({
                type: 'IMPROVE_SCORE',
                priority: 'medium',
                icon: '',
                title: `Your privacy score is ${score}/100`,
                description: `${unblocked} trackers are still allowed. Blocking the top 5 riskiest ones could improve your score by ~${Math.min(30, Math.round(unblocked * 2))} points.`,
                action: { type: 'block_risky', count: 5 }
            });
        }

        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, info: 3 };
        recs.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

        return recs.slice(0, 5);
    }

    /**
     * Calculate a concrete privacy score with explanation
     */
    calculatePrivacyScore() {
        let score = 100;
        const deductions = [];

        // Cross-site tracking penalty
        const crossSiteCount = [...this.trackerHistory.values()].filter(t => t.sites.size >= 2).length;
        if (crossSiteCount > 0) {
            const penalty = Math.min(25, crossSiteCount * 3);
            score -= penalty;
            deductions.push({ reason: `${crossSiteCount} cross-site trackers`, penalty });
        }

        // Fingerprinting penalty
        if (this.fingerprintEvents.size > 0) {
            const penalty = Math.min(20, this.fingerprintEvents.size * 5);
            score -= penalty;
            deductions.push({ reason: `${this.fingerprintEvents.size} fingerprinting attempts`, penalty });
        }

        // Total tracker penalty
        const trackerCount = this.trackerHistory.size;
        if (trackerCount > 5) {
            const penalty = Math.min(20, (trackerCount - 5) * 1);
            score -= penalty;
            deductions.push({ reason: `${trackerCount} unique trackers`, penalty });
        }

        // High risk tracker penalty
        const highRisk = [...this.trackerHistory.values()].filter(t => t.riskScore >= 70).length;
        if (highRisk > 0) {
            const penalty = Math.min(15, highRisk * 5);
            score -= penalty;
            deductions.push({ reason: `${highRisk} high-risk trackers`, penalty });
        }

        // Bonus for blocking
        const blockedPct = this.totalRequestsBlocked / Math.max(1, this.totalRequestsBlocked + this.totalRequestsAllowed);
        if (blockedPct > 0.5) {
            const bonus = Math.min(10, Math.round(blockedPct * 15));
            score += bonus;
            deductions.push({ reason: `${Math.round(blockedPct * 100)}% requests blocked`, penalty: -bonus });
        }

        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
            deductions,
            headline: score >= 80
                ? 'Your privacy is well protected'
                : score >= 60
                    ? 'Your privacy has some gaps'
                    : score >= 40
                        ? 'Your privacy needs attention'
                        : 'Your privacy is seriously compromised'
        };
    }

    /**
     * Get summary stats
     */
    getSummaryStats() {
        const sessionMinutes = Math.round((Date.now() - this.sessionStartTime) / 60000);
        return {
            totalTrackers: this.trackerHistory.size,
            totalSitesVisited: this.siteTrackerMap.size,
            totalRequests: this.totalRequestsBlocked + this.totalRequestsAllowed,
            blocked: this.totalRequestsBlocked,
            allowed: this.totalRequestsAllowed,
            sessionDuration: sessionMinutes,
            fingerprintAttempts: this.fingerprintEvents.size,
            uniqueCompanies: new Set([...this.trackerHistory.values()].map(t => t.owner)).size
        };
    }

    /**
     * Infer data types from tracker category
     */
    _inferDataFromCategory(category, domain) {
        const categoryData = {
            'Analytics': ['browsing history', 'page views', 'click behavior'],
            'Advertising': ['browsing history', 'interests', 'demographics', 'ad interactions'],
            'Social': ['social profile', 'browsing history', 'social connections'],
            'Session Recording': ['mouse movements', 'keystrokes', 'form inputs', 'page interactions'],
            'Tag Manager': ['browsing history', 'page views'],
            'Payment': ['transaction data'],
            'CDN': ['ip address'],
            'Security': ['device info', 'ip address'],
            'Unknown': ['browsing history']
        };
        return categoryData[category] || categoryData['Unknown'];
    }

    /**
     * Export state for dashboard
     */
    exportForDashboard() {
        return this.generateInsights();
    }

    /**
     * Reset session data
     */
    resetSession() {
        this.trackerHistory.clear();
        this.siteTrackerMap.clear();
        this.fingerprintEvents.clear();
        this.sessionStartTime = Date.now();
        this.totalRequestsBlocked = 0;
        this.totalRequestsAllowed = 0;
    }
}

// Singleton
export const mlInsightsEngine = new MLInsightsEngine();

console.log('[HIMT] ML Insights Engine loaded');
