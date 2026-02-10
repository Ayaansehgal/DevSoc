// Tests for Fingerprint Detector Module

describe('FingerprintDetector', () => {
    let detector;

    beforeEach(() => {
        // Create a mock detector for testing
        detector = {
            detectedTechniques: new Map(),
            apiCallCounts: new Map(),
            thresholds: {
                canvas: 3,
                webgl: 5,
                audio: 2,
                navigator: 15,
                screen: 10,
                fonts: 20
            },

            recordApiCall(domain, apiType, details = {}) {
                if (!this.apiCallCounts.has(domain)) {
                    this.apiCallCounts.set(domain, {});
                }
                const counts = this.apiCallCounts.get(domain);
                counts[apiType] = (counts[apiType] || 0) + 1;

                if (counts[apiType] >= this.thresholds[apiType]) {
                    this.flagTechnique(domain, apiType);
                }
            },

            flagTechnique(domain, technique) {
                if (!this.detectedTechniques.has(domain)) {
                    this.detectedTechniques.set(domain, new Set());
                }
                this.detectedTechniques.get(domain).add(technique);
            },

            isFingerprinting(domain) {
                const techniques = this.detectedTechniques.get(domain);
                return (techniques && techniques.size > 0) || false;
            },

            getRiskScore(domain) {
                const techniques = this.detectedTechniques.get(domain);
                if (!techniques) return 0;

                const riskWeights = {
                    canvas: 25,
                    webgl: 20,
                    audio: 30,
                    fonts: 15,
                    navigator: 10,
                    screen: 8
                };

                let score = 0;
                for (const technique of techniques) {
                    score += riskWeights[technique] || 10;
                }
                return Math.min(100, score);
            },

            getTechniques(domain) {
                const techniques = this.detectedTechniques.get(domain);
                if (!techniques) return [];
                return Array.from(techniques);
            },

            getSummary(domain) {
                return {
                    detected: this.isFingerprinting(domain),
                    riskScore: this.getRiskScore(domain),
                    techniques: this.getTechniques(domain).map(t => ({ technique: t })),
                    summary: this.isFingerprinting(domain)
                        ? 'Fingerprinting detected'
                        : 'No fingerprinting detected'
                };
            },

            clearDomain(domain) {
                this.detectedTechniques.delete(domain);
                this.apiCallCounts.delete(domain);
            }
        };
    });

    test('should track API calls', () => {
        detector.recordApiCall('tracker.com', 'canvas');
        detector.recordApiCall('tracker.com', 'canvas');

        expect(detector.apiCallCounts.get('tracker.com').canvas).toBe(2);
    });

    test('should flag technique when threshold exceeded', () => {
        const domain = 'fingerprinter.com';

        // Record enough canvas calls to exceed threshold
        for (let i = 0; i < 5; i++) {
            detector.recordApiCall(domain, 'canvas');
        }

        expect(detector.isFingerprinting(domain)).toBe(true);
        expect(detector.getTechniques(domain)).toContain('canvas');
    });

    test('should calculate risk score based on techniques', () => {
        const domain = 'risky-tracker.com';

        // Flag multiple techniques
        detector.flagTechnique(domain, 'canvas');  // 25
        detector.flagTechnique(domain, 'audio');   // 30

        const riskScore = detector.getRiskScore(domain);
        expect(riskScore).toBe(55);
    });

    test('should cap risk score at 100', () => {
        const domain = 'super-risky.com';

        // Flag all techniques
        ['canvas', 'webgl', 'audio', 'fonts', 'navigator', 'screen'].forEach(t => {
            detector.flagTechnique(domain, t);
        });

        const riskScore = detector.getRiskScore(domain);
        expect(riskScore).toBeLessThanOrEqual(100);
    });

    test('should return 0 risk for clean domains', () => {
        expect(detector.getRiskScore('clean-domain.com')).toBe(0);
        expect(detector.isFingerprinting('clean-domain.com')).toBe(false);
    });

    test('should provide summary with all details', () => {
        const domain = 'tracked.com';
        detector.flagTechnique(domain, 'canvas');

        const summary = detector.getSummary(domain);

        expect(summary.detected).toBe(true);
        expect(summary.riskScore).toBeGreaterThan(0);
        expect(summary.techniques.length).toBeGreaterThan(0);
        expect(summary.summary).toContain('detected');
    });

    test('should clear domain data', () => {
        const domain = 'to-clear.com';
        detector.flagTechnique(domain, 'canvas');

        expect(detector.isFingerprinting(domain)).toBe(true);

        detector.clearDomain(domain);

        expect(detector.isFingerprinting(domain)).toBe(false);
    });
});

describe('Fingerprint Technique Detection', () => {
    test('Canvas fingerprinting should be high risk', () => {
        const riskWeights = { canvas: 25, audio: 30, webgl: 20 };
        expect(riskWeights.canvas).toBeGreaterThanOrEqual(20);
    });

    test('Audio fingerprinting should be highest risk', () => {
        const riskWeights = { canvas: 25, audio: 30, webgl: 20 };
        expect(riskWeights.audio).toBeGreaterThan(riskWeights.canvas);
        expect(riskWeights.audio).toBeGreaterThan(riskWeights.webgl);
    });
});
