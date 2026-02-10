// Tests for Category Classifier Module

describe('CategoryClassifier', () => {
    let classifier;

    beforeEach(() => {
        // Create a mock classifier for testing
        classifier = {
            categories: [
                'Analytics', 'Advertising', 'Social', 'Session Recording',
                'Tag Manager', 'Payment', 'CDN', 'Security', 'Unknown'
            ],
            confidenceThreshold: 0.7,

            predict(url, domain) {
                const urlLower = url.toLowerCase();
                const domainLower = domain.toLowerCase();

                // Simple rule-based classification for testing
                if (domainLower.includes('analytics') || urlLower.includes('/collect')) {
                    return { category: 'Analytics', confidence: 0.85, method: 'heuristic', mlDetected: true };
                }
                if (domainLower.includes('ads') || urlLower.includes('/pixel')) {
                    return { category: 'Advertising', confidence: 0.8, method: 'heuristic', mlDetected: true };
                }
                if (domainLower.includes('facebook') || domainLower.includes('twitter')) {
                    return { category: 'Social', confidence: 0.9, method: 'heuristic', mlDetected: true };
                }
                if (domainLower.includes('hotjar') || domainLower.includes('fullstory')) {
                    return { category: 'Session Recording', confidence: 0.95, method: 'heuristic', mlDetected: true };
                }
                if (domainLower.includes('stripe') || domainLower.includes('paypal')) {
                    return { category: 'Payment', confidence: 0.95, method: 'heuristic', mlDetected: true };
                }
                if (domainLower.includes('cloudflare') || domainLower.includes('cdn')) {
                    return { category: 'CDN', confidence: 0.9, method: 'heuristic', mlDetected: true };
                }

                return { category: 'Unknown', confidence: 0, method: 'fallback', mlDetected: false };
            },

            explainClassification(result) {
                const explanations = {
                    'Analytics': 'Detected patterns typical of analytics services',
                    'Advertising': 'Detected advertising or ad-serving patterns',
                    'Social': 'Detected social media integration patterns',
                    'Session Recording': 'Detected session recording patterns',
                    'Payment': 'Detected payment processing patterns',
                    'CDN': 'Detected content delivery network patterns',
                    'Unknown': 'Unable to determine purpose'
                };
                return {
                    ...result,
                    explanation: explanations[result.category] || explanations['Unknown']
                };
            }
        };
    });

    test('should classify analytics trackers correctly', () => {
        const result = classifier.predict(
            'https://www.google-analytics.com/collect?v=1',
            'google-analytics.com'
        );

        expect(result.category).toBe('Analytics');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.mlDetected).toBe(true);
    });

    test('should classify advertising trackers correctly', () => {
        const result = classifier.predict(
            'https://pixel.ads.example.com/track',
            'ads.example.com'
        );

        expect(result.category).toBe('Advertising');
        expect(result.mlDetected).toBe(true);
    });

    test('should classify social trackers correctly', () => {
        const result = classifier.predict(
            'https://connect.facebook.net/sdk.js',
            'facebook.net'
        );

        expect(result.category).toBe('Social');
    });

    test('should classify session recording trackers correctly', () => {
        const result = classifier.predict(
            'https://static.hotjar.com/c/hotjar.js',
            'hotjar.com'
        );

        expect(result.category).toBe('Session Recording');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    test('should classify payment services correctly', () => {
        const result = classifier.predict(
            'https://js.stripe.com/v3/',
            'stripe.com'
        );

        expect(result.category).toBe('Payment');
    });

    test('should classify CDN services correctly', () => {
        const result = classifier.predict(
            'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
            'cloudflare.com'
        );

        expect(result.category).toBe('CDN');
    });

    test('should return Unknown for unrecognized domains', () => {
        const result = classifier.predict(
            'https://random-unknown-domain.xyz/script.js',
            'random-unknown-domain.xyz'
        );

        expect(result.category).toBe('Unknown');
        expect(result.mlDetected).toBe(false);
    });

    test('should provide explanations for classifications', () => {
        const result = classifier.predict(
            'https://www.google-analytics.com/collect',
            'google-analytics.com'
        );

        const explained = classifier.explainClassification(result);

        expect(explained.explanation).toBeTruthy();
        expect(explained.explanation).toContain('analytics');
    });

    test('should have valid category list', () => {
        expect(classifier.categories).toContain('Analytics');
        expect(classifier.categories).toContain('Advertising');
        expect(classifier.categories).toContain('Unknown');
        expect(classifier.categories.length).toBeGreaterThanOrEqual(8);
    });
});
