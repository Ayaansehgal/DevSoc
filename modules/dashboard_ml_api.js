// Dashboard ML Integration API
// This module provides ML insights to the dashboard

export class DashboardMLAPI {
    constructor() {
        this.initialized = false;
    }

    /**
     * Get comprehensive ML insights for the dashboard
     */
    async getMLInsights() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'GET_ML_INSIGHTS' }, (response) => {
                    if (response?.success) {
                        resolve(response.data);
                    } else {
                        resolve(this.getDefaultInsights());
                    }
                });
            } else {
                resolve(this.getDefaultInsights());
            }
        });
    }

    /**
     * Get pattern analysis summary
     */
    async getPatternSummary() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'GET_PATTERN_SUMMARY' }, (response) => {
                    if (response?.success) {
                        resolve(response);
                    } else {
                        resolve({
                            summary: { totalTrackers: 0, categoryBreakdown: {} },
                            insights: [],
                            privacyScore: 100
                        });
                    }
                });
            } else {
                resolve({
                    summary: { totalTrackers: 0, categoryBreakdown: {} },
                    insights: [],
                    privacyScore: 100
                });
            }
        });
    }

    /**
     * Get fingerprinting data for a specific domain
     */
    async getFingerprintData(domain) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'GET_FINGERPRINT_DATA',
                    data: { domain }
                }, (response) => {
                    if (response?.success) {
                        resolve(response.data);
                    } else {
                        resolve({ detected: false, techniques: [], riskScore: 0 });
                    }
                });
            } else {
                resolve({ detected: false, techniques: [], riskScore: 0 });
            }
        });
    }

    /**
     * Submit category feedback
     */
    async submitCategoryFeedback(domain, url, oldCategory, newCategory) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'CATEGORY_FEEDBACK',
                    data: { domain, url, oldCategory, newCategory }
                }, (response) => {
                    resolve(response?.success || false);
                });
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Clear all pattern data
     */
    async clearPatternData() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'CLEAR_PATTERN_DATA' }, (response) => {
                    resolve(response?.success || false);
                });
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Get default insights when extension is not available
     */
    getDefaultInsights() {
        return {
            patternSummary: {
                totalTrackers: 0,
                categoryBreakdown: {},
                avgRiskScore: 0,
                duration: 0,
                alertCount: 0
            },
            privacyScore: 100,
            insights: [],
            fingerprintStats: {
                domainsDetected: 0,
                techniquesUsed: []
            },
            classifierStats: {
                totalClassified: 0,
                feedbackCount: 0
            }
        };
    }
}

// Singleton export
export const dashboardMLAPI = new DashboardMLAPI();

// Also expose to window for non-module usage
if (typeof window !== 'undefined') {
    window.DashboardMLAPI = DashboardMLAPI;
    window.dashboardMLAPI = dashboardMLAPI;
}

console.log('[HIMT] Dashboard ML API loaded');
