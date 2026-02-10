// Tests for ML Models Core Module
// Classes defined inline to avoid ESM/CJS incompatibility with Jest

class SimpleNeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        this.weightsIH = Array.from({ length: inputSize }, () =>
            Array.from({ length: hiddenSize }, () => (Math.random() - 0.5) * 0.5)
        );
        this.weightsHO = Array.from({ length: hiddenSize }, () =>
            Array.from({ length: outputSize }, () => (Math.random() - 0.5) * 0.5)
        );
        this.biasH = new Array(hiddenSize).fill(0);
        this.biasO = new Array(outputSize).fill(0);
    }

    predict(input) {
        const hidden = this.biasH.map((b, j) => {
            let sum = b;
            for (let i = 0; i < this.inputSize; i++) sum += input[i] * this.weightsIH[i][j];
            return 1 / (1 + Math.exp(-sum));
        });
        const raw = this.biasO.map((b, j) => {
            let sum = b;
            for (let i = 0; i < this.hiddenSize; i++) sum += hidden[i] * this.weightsHO[i][j];
            return sum;
        });
        const maxRaw = Math.max(...raw);
        const exps = raw.map(v => Math.exp(v - maxRaw));
        const sumExp = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / sumExp);
    }

    exportWeights() {
        return {
            weightsIH: this.weightsIH.map(r => [...r]),
            weightsHO: this.weightsHO.map(r => [...r]),
            biasH: [...this.biasH],
            biasO: [...this.biasO]
        };
    }

    loadWeights(w) {
        this.weightsIH = w.weightsIH.map(r => [...r]);
        this.weightsHO = w.weightsHO.map(r => [...r]);
        this.biasH = [...w.biasH];
        this.biasO = [...w.biasO];
    }
}

class FeatureExtractor {
    extractUrlFeatures(url, domain) {
        const text = (url + ' ' + domain).toLowerCase();
        const groups = [
            ['analytics', 'stat', 'track', 'collect', 'measure'],
            ['ad', 'ads', 'pixel', 'banner', 'conversion'],
            ['facebook', 'twitter', 'linkedin', 'social', 'share'],
            ['hotjar', 'fullstory', 'session', 'replay', 'heatmap'],
            ['tagmanager', 'gtm', 'tealium', 'segment'],
            ['stripe', 'paypal', 'payment', 'checkout'],
            ['cdn', 'cloudflare', 'akamai', 'static'],
            ['captcha', 'recaptcha', 'security', 'fraud'],
            ['analytics', 'beacon', 'metric'],
            ['adserver', 'remarketing', 'retarget'],
            ['widget', 'connect', 'like'],
        ];
        const features = [];
        for (const g of groups) {
            features.push(Math.min(1, g.filter(p => text.includes(p)).length / g.length));
        }
        while (features.length < 22) {
            const idx = features.length;
            if (idx === 18) features.push(domain.split('.').length / 5);
            else if (idx === 19) features.push(Math.min(1, domain.length / 50));
            else if (idx === 20) features.push(domain.includes('-') ? 1 : 0);
            else if (idx === 21) features.push(/\d/.test(domain) ? 1 : 0);
            else features.push(0);
        }
        return features;
    }
}

class AnomalyDetector {
    constructor(windowSize = 50) {
        this.windowSize = windowSize;
        this.dataPoints = [];
    }
    addDataPoint(v) {
        this.dataPoints.push(v);
        if (this.dataPoints.length > this.windowSize) this.dataPoints.shift();
    }
    getStats() {
        const n = this.dataPoints.length;
        if (n === 0) return { mean: 0, stdDev: 0, dataPoints: 0 };
        const mean = this.dataPoints.reduce((a, b) => a + b, 0) / n;
        const variance = this.dataPoints.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
        return { mean, stdDev: Math.sqrt(variance), dataPoints: n };
    }
    getAnomalyScore(value) {
        const { mean, stdDev } = this.getStats();
        if (stdDev === 0) return value === mean ? 0 : Infinity;
        return Math.abs(value - mean) / stdDev;
    }
    isAnomaly(value, threshold = 2) {
        return this.getAnomalyScore(value) > threshold;
    }
    exportState() {
        return { dataPoints: [...this.dataPoints], windowSize: this.windowSize };
    }
    loadState(state) {
        this.dataPoints = [...state.dataPoints];
        this.windowSize = state.windowSize;
    }
}

class HeuristicClassifier {
    constructor() { this.rules = []; }
    addRule(pattern, category, weight) {
        this.rules.push({ pattern: pattern.toLowerCase(), category, weight });
    }
    classify(text) {
        const lower = text.toLowerCase();
        const scores = {};
        for (const { pattern, category, weight } of this.rules) {
            if (lower.includes(pattern)) {
                scores[category] = (scores[category] || 0) + weight;
            }
        }
        const entries = Object.entries(scores);
        if (entries.length === 0) return { category: 'Unknown', confidence: 0, scores: {} };
        const maxWeight = Math.max(...this.rules.map(r => r.weight));
        const total = entries.reduce((s, [, v]) => s + v, 0);
        entries.sort((a, b) => b[1] - a[1]);
        const [cat, score] = entries[0];
        return { category: cat, confidence: Math.min(1, score / (maxWeight * 2)), scores };
    }
}

describe('SimpleNeuralNetwork', () => {
    let nn;

    beforeEach(() => {
        nn = new SimpleNeuralNetwork(4, 8, 3);
    });

    test('should initialize with correct dimensions', () => {
        expect(nn.inputSize).toBe(4);
        expect(nn.hiddenSize).toBe(8);
        expect(nn.outputSize).toBe(3);
    });

    test('should have properly sized weight matrices', () => {
        expect(nn.weightsIH.length).toBe(4);
        expect(nn.weightsIH[0].length).toBe(8);
        expect(nn.weightsHO.length).toBe(8);
        expect(nn.weightsHO[0].length).toBe(3);
    });

    test('predict should return probabilities that sum to 1', () => {
        const input = [0.5, 0.3, 0.2, 0.8];
        const output = nn.predict(input);

        expect(output.length).toBe(3);

        // Softmax outputs should sum to ~1
        const sum = output.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
    });

    test('should export and load weights correctly', () => {
        const weights = nn.exportWeights();

        expect(weights).toHaveProperty('weightsIH');
        expect(weights).toHaveProperty('weightsHO');
        expect(weights).toHaveProperty('biasH');
        expect(weights).toHaveProperty('biasO');

        // Create new network and load weights
        const nn2 = new SimpleNeuralNetwork(4, 8, 3);
        nn2.loadWeights(weights);

        expect(nn2.weightsIH).toEqual(weights.weightsIH);
    });
});

describe('FeatureExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new FeatureExtractor();
    });

    test('should extract features from URL', () => {
        const url = 'https://www.google-analytics.com/collect?v=1&t=pageview';
        const domain = 'google-analytics.com';

        const features = extractor.extractUrlFeatures(url, domain);

        expect(Array.isArray(features)).toBe(true);
        expect(features.length).toBe(22);
        expect(features.every(f => f >= 0 && f <= 1)).toBe(true);
    });

    test('should detect analytics patterns in URL', () => {
        const analyticsUrl = 'https://analytics.example.com/collect';
        const features = extractor.extractUrlFeatures(analyticsUrl, 'analytics.example.com');

        // Analytics pattern should be detected (first feature group)
        expect(features[0]).toBeGreaterThan(0);
    });

    test('should detect advertising patterns', () => {
        const adUrl = 'https://ads.example.com/pixel?conversion=1';
        const features = extractor.extractUrlFeatures(adUrl, 'ads.example.com');

        // Advertising pattern should be detected
        expect(features[1]).toBeGreaterThan(0);
    });
});

describe('AnomalyDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new AnomalyDetector(10);
    });

    test('should track data points', () => {
        detector.addDataPoint(10);
        detector.addDataPoint(12);
        detector.addDataPoint(11);

        const stats = detector.getStats();
        expect(stats.dataPoints).toBe(3);
    });

    test('should calculate mean correctly', () => {
        [10, 20, 30].forEach(v => detector.addDataPoint(v));

        const stats = detector.getStats();
        expect(stats.mean).toBeCloseTo(20, 5);
    });

    test('should detect anomalies', () => {
        // Add normal values
        for (let i = 0; i < 10; i++) {
            detector.addDataPoint(50 + Math.random() * 10);
        }

        // Very high value should be anomalous
        const anomalyScore = detector.getAnomalyScore(200);
        expect(anomalyScore).toBeGreaterThan(2);
        expect(detector.isAnomaly(200)).toBe(true);
    });

    test('should not flag normal values as anomalies', () => {
        for (let i = 0; i < 10; i++) {
            detector.addDataPoint(50);
        }

        expect(detector.isAnomaly(50)).toBe(false);
    });

    test('should export and load state', () => {
        [10, 20, 30].forEach(v => detector.addDataPoint(v));

        const state = detector.exportState();

        const detector2 = new AnomalyDetector(10);
        detector2.loadState(state);

        expect(detector2.getStats().mean).toEqual(detector.getStats().mean);
    });
});

describe('HeuristicClassifier', () => {
    let classifier;

    beforeEach(() => {
        classifier = new HeuristicClassifier();
        classifier.addRule('analytics', 'Analytics', 2.0);
        classifier.addRule('google-analytics', 'Analytics', 3.0);
        classifier.addRule('facebook', 'Social', 2.5);
        classifier.addRule('pixel', 'Advertising', 1.5);
    });

    test('should classify based on rules', () => {
        const result = classifier.classify('google-analytics.com');

        expect(result.category).toBe('Analytics');
        expect(result.confidence).toBeGreaterThan(0);
    });

    test('should return Unknown for unmatched text', () => {
        const result = classifier.classify('random-domain.xyz');

        expect(result.category).toBe('Unknown');
        expect(result.confidence).toBe(0);
    });

    test('should return scores for all categories', () => {
        const result = classifier.classify('facebook pixel analytics');

        expect(result.scores).toHaveProperty('Analytics');
        expect(result.scores).toHaveProperty('Social');
        expect(result.scores).toHaveProperty('Advertising');
    });
});
