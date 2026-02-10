// Fingerprint Detector - Detects browser fingerprinting attempts
// Monitors Canvas, WebGL, Audio, and Navigator API abuse

import { AnomalyDetector } from './ml_models.js';

// Fingerprinting technique signatures
const FINGERPRINT_TECHNIQUES = {
    CANVAS: 'canvas',
    WEBGL: 'webgl',
    AUDIO: 'audio',
    FONTS: 'fonts',
    NAVIGATOR: 'navigator',
    SCREEN: 'screen',
    TIMEZONE: 'timezone',
    PLUGINS: 'plugins',
    WEBRTC: 'webrtc',
    BATTERY: 'battery'
};

// Risk weights for each technique
const TECHNIQUE_RISK = {
    [FINGERPRINT_TECHNIQUES.CANVAS]: 25,
    [FINGERPRINT_TECHNIQUES.WEBGL]: 20,
    [FINGERPRINT_TECHNIQUES.AUDIO]: 30,
    [FINGERPRINT_TECHNIQUES.FONTS]: 15,
    [FINGERPRINT_TECHNIQUES.NAVIGATOR]: 10,
    [FINGERPRINT_TECHNIQUES.SCREEN]: 8,
    [FINGERPRINT_TECHNIQUES.TIMEZONE]: 5,
    [FINGERPRINT_TECHNIQUES.PLUGINS]: 12,
    [FINGERPRINT_TECHNIQUES.WEBRTC]: 25,
    [FINGERPRINT_TECHNIQUES.BATTERY]: 15
};

export class FingerprintDetector {
    constructor() {
        this.detectedTechniques = new Map(); // domain -> Set of techniques
        this.apiCallCounts = new Map(); // domain -> { api: count }
        this.anomalyDetector = new AnomalyDetector(50);
        this.thresholds = {
            canvas: 3,      // Max canvas reads before suspicious
            webgl: 5,       // Max WebGL info queries
            audio: 2,       // Max AudioContext fingerprints
            navigator: 15,  // Max navigator property accesses
            screen: 10,     // Max screen property accesses
            fonts: 20       // Max font probing attempts
        };
        this.initialized = false;
    }

    /**
     * Initialize the detector and load saved state
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const saved = await this.loadState();
            if (saved) {
                if (saved.detectedTechniques) {
                    for (const [domain, techniques] of Object.entries(saved.detectedTechniques)) {
                        this.detectedTechniques.set(domain, new Set(techniques));
                    }
                }
                if (saved.anomalyState) {
                    this.anomalyDetector.loadState(saved.anomalyState);
                }
            }
            this.initialized = true;
            console.log('[HIMT FingerprintDetector] Initialized');
        } catch (error) {
            console.error('[HIMT FingerprintDetector] Init error:', error);
            this.initialized = true;
        }
    }

    /**
     * Load saved state from storage
     */
    async loadState() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['fingerprintDetectorState'], (result) => {
                    resolve(result.fingerprintDetectorState || null);
                });
            } else {
                resolve(null);
            }
        });
    }

    /**
     * Save state to storage
     */
    async saveState() {
        const state = {
            detectedTechniques: {},
            anomalyState: this.anomalyDetector.exportState()
        };

        for (const [domain, techniques] of this.detectedTechniques.entries()) {
            state.detectedTechniques[domain] = Array.from(techniques);
        }

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ fingerprintDetectorState: state }, resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Record an API call from a domain
     * @param {string} domain - The tracker domain
     * @param {string} apiType - Type of API accessed
     * @param {Object} details - Additional details about the call
     */
    recordApiCall(domain, apiType, details = {}) {
        // Initialize counters for domain
        if (!this.apiCallCounts.has(domain)) {
            this.apiCallCounts.set(domain, {});
        }

        const counts = this.apiCallCounts.get(domain);
        counts[apiType] = (counts[apiType] || 0) + 1;

        // Check if threshold exceeded
        const threshold = this.thresholds[apiType] || 10;
        if (counts[apiType] >= threshold) {
            this.flagTechnique(domain, apiType, details);
        }

        // Update anomaly detector with total API calls
        const totalCalls = Object.values(counts).reduce((a, b) => a + b, 0);
        this.anomalyDetector.addDataPoint(totalCalls);
    }

    /**
     * Flag a fingerprinting technique for a domain
     */
    flagTechnique(domain, technique, details = {}) {
        if (!this.detectedTechniques.has(domain)) {
            this.detectedTechniques.set(domain, new Set());
        }

        const techniques = this.detectedTechniques.get(domain);
        const wasNew = !techniques.has(technique);
        techniques.add(technique);

        if (wasNew) {
            console.log(`[HIMT FingerprintDetector] Detected ${technique} fingerprinting from ${domain}`);
            this.saveState();
        }

        return wasNew;
    }

    /**
     * Analyze content script events for fingerprinting
     * This is called from the service worker with data from content scripts
     */
    analyzeEvent(event) {
        const { domain, type, data } = event;

        switch (type) {
            case 'canvas_read':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.CANVAS, data);
                if (data.isDataUrl || data.isImageData) {
                    // Direct canvas fingerprinting
                    this.flagTechnique(domain, FINGERPRINT_TECHNIQUES.CANVAS, data);
                }
                break;

            case 'webgl_info':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.WEBGL, data);
                if (data.renderer || data.vendor) {
                    this.flagTechnique(domain, FINGERPRINT_TECHNIQUES.WEBGL, data);
                }
                break;

            case 'audio_fingerprint':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.AUDIO, data);
                // Audio fingerprinting is almost always suspicious
                this.flagTechnique(domain, FINGERPRINT_TECHNIQUES.AUDIO, data);
                break;

            case 'navigator_probe':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.NAVIGATOR, data);
                break;

            case 'font_probe':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.FONTS, data);
                break;

            case 'screen_probe':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.SCREEN, data);
                break;

            case 'webrtc_probe':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.WEBRTC, data);
                this.flagTechnique(domain, FINGERPRINT_TECHNIQUES.WEBRTC, data);
                break;

            case 'battery_probe':
                this.recordApiCall(domain, FINGERPRINT_TECHNIQUES.BATTERY, data);
                this.flagTechnique(domain, FINGERPRINT_TECHNIQUES.BATTERY, data);
                break;
        }
    }

    /**
     * Get fingerprinting risk score for a domain (0-100)
     */
    getRiskScore(domain) {
        const techniques = this.detectedTechniques.get(domain);
        if (!techniques || techniques.size === 0) {
            return 0;
        }

        let score = 0;
        for (const technique of techniques) {
            score += TECHNIQUE_RISK[technique] || 10;
        }

        // Cap at 100
        return Math.min(100, score);
    }

    /**
     * Get detected techniques for a domain
     */
    getTechniques(domain) {
        const techniques = this.detectedTechniques.get(domain);
        if (!techniques) return [];

        return Array.from(techniques).map(technique => ({
            technique,
            risk: TECHNIQUE_RISK[technique] || 10,
            description: this.getTechniqueDescription(technique)
        }));
    }

    /**
     * Get human-readable description of a technique
     */
    getTechniqueDescription(technique) {
        const descriptions = {
            [FINGERPRINT_TECHNIQUES.CANVAS]: 'Reading canvas data to create a unique device fingerprint',
            [FINGERPRINT_TECHNIQUES.WEBGL]: 'Querying graphics card info for device identification',
            [FINGERPRINT_TECHNIQUES.AUDIO]: 'Using audio processing to fingerprint your device',
            [FINGERPRINT_TECHNIQUES.FONTS]: 'Probing installed fonts to identify your system',
            [FINGERPRINT_TECHNIQUES.NAVIGATOR]: 'Collecting browser and device configuration details',
            [FINGERPRINT_TECHNIQUES.SCREEN]: 'Reading screen resolution and display properties',
            [FINGERPRINT_TECHNIQUES.TIMEZONE]: 'Detecting your timezone for location inference',
            [FINGERPRINT_TECHNIQUES.PLUGINS]: 'Enumerating browser plugins for fingerprinting',
            [FINGERPRINT_TECHNIQUES.WEBRTC]: 'Using WebRTC to discover your real IP address',
            [FINGERPRINT_TECHNIQUES.BATTERY]: 'Reading battery status for device identification'
        };

        return descriptions[technique] || 'Unknown fingerprinting technique';
    }

    /**
     * Check if any fingerprinting is detected for a domain
     */
    isFingerprinting(domain) {
        const techniques = this.detectedTechniques.get(domain);
        return techniques && techniques.size > 0;
    }

    /**
     * Get summary for UI display
     */
    getSummary(domain) {
        const techniques = this.getTechniques(domain);
        const riskScore = this.getRiskScore(domain);

        if (techniques.length === 0) {
            return {
                detected: false,
                riskScore: 0,
                techniques: [],
                summary: 'No fingerprinting detected'
            };
        }

        const techniqueNames = techniques.map(t => t.technique);
        let summary;

        if (riskScore >= 50) {
            summary = `⚠️ High fingerprinting risk: ${techniqueNames.join(', ')}`;
        } else if (riskScore >= 25) {
            summary = `Moderate fingerprinting: ${techniqueNames.join(', ')}`;
        } else {
            summary = `Low fingerprinting: ${techniqueNames.join(', ')}`;
        }

        return {
            detected: true,
            riskScore,
            techniques,
            summary,
            anomalyScore: this.anomalyDetector.getAnomalyScore(
                Object.values(this.apiCallCounts.get(domain) || {}).reduce((a, b) => a + b, 0)
            )
        };
    }

    /**
     * Clear data for a specific domain
     */
    clearDomain(domain) {
        this.detectedTechniques.delete(domain);
        this.apiCallCounts.delete(domain);
        this.saveState();
    }

    /**
     * Clear all fingerprinting data
     */
    clearAll() {
        this.detectedTechniques.clear();
        this.apiCallCounts.clear();
        this.anomalyDetector = new AnomalyDetector(50);
        this.saveState();
    }
}

// Singleton instance
export const fingerprintDetector = new FingerprintDetector();

console.log('[HIMT] Fingerprint Detector module loaded');
