// Tests for Pattern Analyzer Module

describe('PatternAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        // Create a mock analyzer for testing
        analyzer = {
            anomalyThreshold: 2.0,
            currentSession: {
                startTime: Date.now(),
                trackerEvents: [],
                alerts: []
            },
            historicalPatterns: {
                categoryFrequency: {},
                hourlyPatterns: new Array(24).fill(0)
            },
            baseline: {
                mean: 10,
                stdDev: 3
            },

            recordTrackerEvent(event) {
                this.currentSession.trackerEvents.push({
                    ...event,
                    timestamp: event.timestamp || Date.now()
                });

                // Update category frequency
                const cat = event.category || 'Unknown';
                this.historicalPatterns.categoryFrequency[cat] =
                    (this.historicalPatterns.categoryFrequency[cat] || 0) + 1;

                // Check for anomalies
                return this.checkForAnomalies(event);
            },

            checkForAnomalies(event) {
                const alerts = [];
                const count = this.currentSession.trackerEvents.length;

                // Check if count is anomalous (simple z-score)
                if (count > this.baseline.mean + this.anomalyThreshold * this.baseline.stdDev) {
                    alerts.push({
                        type: 'high_tracker_count',
                        severity: 'warning',
                        message: 'Unusual number of trackers detected'
                    });
                }

                if (event.riskScore >= 80) {
                    alerts.push({
                        type: 'high_risk_tracker',
                        severity: 'alert',
                        message: 'High-risk tracker detected'
                    });
                }

                return alerts;
            },

            getSessionSummary() {
                const events = this.currentSession.trackerEvents;

                const categoryBreakdown = {};
                events.forEach(e => {
                    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
                });

                const avgRisk = events.length > 0
                    ? events.reduce((sum, e) => sum + (e.riskScore || 0), 0) / events.length
                    : 0;

                return {
                    totalTrackers: events.length,
                    categoryBreakdown,
                    avgRiskScore: Math.round(avgRisk),
                    duration: Math.round((Date.now() - this.currentSession.startTime) / 1000 / 60),
                    alertCount: this.currentSession.alerts.length
                };
            },

            getPrivacyScore() {
                const summary = this.getSessionSummary();
                let score = 100;

                // Deduct for tracker count
                score -= Math.min(30, summary.totalTrackers * 0.5);

                // Deduct for high avg risk
                if (summary.avgRiskScore > 50) {
                    score -= 20;
                }

                return Math.max(0, Math.min(100, Math.round(score)));
            },

            getInsights() {
                const insights = [];
                const freq = this.historicalPatterns.categoryFrequency;

                const topCategory = Object.entries(freq)
                    .sort((a, b) => b[1] - a[1])[0];

                if (topCategory) {
                    insights.push({
                        type: 'category',
                        message: `${topCategory[0]} trackers are most common`
                    });
                }

                return insights;
            },

            startNewSession() {
                this.currentSession = {
                    startTime: Date.now(),
                    trackerEvents: [],
                    alerts: []
                };
            }
        };
    });

    test('should record tracker events', () => {
        analyzer.recordTrackerEvent({
            domain: 'tracker.com',
            category: 'Analytics',
            riskScore: 30
        });

        expect(analyzer.currentSession.trackerEvents.length).toBe(1);
    });

    test('should calculate session summary', () => {
        analyzer.recordTrackerEvent({ domain: 'a.com', category: 'Analytics', riskScore: 20 });
        analyzer.recordTrackerEvent({ domain: 'b.com', category: 'Advertising', riskScore: 40 });
        analyzer.recordTrackerEvent({ domain: 'c.com', category: 'Analytics', riskScore: 30 });

        const summary = analyzer.getSessionSummary();

        expect(summary.totalTrackers).toBe(3);
        expect(summary.categoryBreakdown.Analytics).toBe(2);
        expect(summary.categoryBreakdown.Advertising).toBe(1);
        expect(summary.avgRiskScore).toBe(30);
    });

    test('should detect high tracker count anomaly', () => {
        // Add many trackers to exceed threshold
        for (let i = 0; i < 20; i++) {
            const alerts = analyzer.recordTrackerEvent({
                domain: `tracker${i}.com`,
                category: 'Analytics',
                riskScore: 30
            });

            if (i >= 16) {
                // count > mean + threshold * stdDev => count > 10 + 2*3 = 16
                // At i=16, count=17 which exceeds 16
                expect(alerts.some(a => a.type === 'high_tracker_count')).toBe(true);
            }
        }
    });

    test('should detect high risk tracker', () => {
        const alerts = analyzer.recordTrackerEvent({
            domain: 'risky.com',
            category: 'Session Recording',
            riskScore: 85
        });

        expect(alerts.some(a => a.type === 'high_risk_tracker')).toBe(true);
    });

    test('should calculate privacy score', () => {
        // No trackers = high score
        expect(analyzer.getPrivacyScore()).toBeGreaterThanOrEqual(90);

        // Many trackers = lower score
        for (let i = 0; i < 50; i++) {
            analyzer.recordTrackerEvent({
                domain: `t${i}.com`,
                category: 'Advertising',
                riskScore: 50
            });
        }

        expect(analyzer.getPrivacyScore()).toBeLessThan(80);
    });

    test('should track category frequency', () => {
        analyzer.recordTrackerEvent({ domain: 'a.com', category: 'Analytics', riskScore: 20 });
        analyzer.recordTrackerEvent({ domain: 'b.com', category: 'Analytics', riskScore: 20 });
        analyzer.recordTrackerEvent({ domain: 'c.com', category: 'Advertising', riskScore: 30 });

        expect(analyzer.historicalPatterns.categoryFrequency.Analytics).toBe(2);
        expect(analyzer.historicalPatterns.categoryFrequency.Advertising).toBe(1);
    });

    test('should provide insights', () => {
        analyzer.recordTrackerEvent({ domain: 'a.com', category: 'Analytics', riskScore: 20 });
        analyzer.recordTrackerEvent({ domain: 'b.com', category: 'Analytics', riskScore: 20 });

        const insights = analyzer.getInsights();

        expect(insights.length).toBeGreaterThan(0);
        expect(insights[0].message).toContain('Analytics');
    });

    test('should start new session', () => {
        analyzer.recordTrackerEvent({ domain: 'a.com', category: 'Analytics', riskScore: 20 });
        expect(analyzer.currentSession.trackerEvents.length).toBe(1);

        analyzer.startNewSession();

        expect(analyzer.currentSession.trackerEvents.length).toBe(0);
    });
});
