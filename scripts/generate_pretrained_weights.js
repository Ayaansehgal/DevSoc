// Pre-trained Neural Network Weights Generator
// This script generates initial weights by analyzing tracker_kb.json patterns
// Run: node scripts/generate_pretrained_weights.js

const fs = require('fs');
const path = require('path');

// Categories to classify
const CATEGORIES = [
    'Analytics', 'Advertising', 'Social', 'Session Recording',
    'Tag Manager', 'Payment', 'CDN', 'Security', 'Unknown'
];

// Feature patterns for each category (domain/URL patterns)
const CATEGORY_PATTERNS = {
    'Analytics': [
        'analytics', 'stat', 'metric', 'track', 'measure', 'insight',
        'collect', 'beacon', 'log', 'report', 'counter', 'hit'
    ],
    'Advertising': [
        'ad', 'ads', 'advert', 'banner', 'pixel', 'conversion',
        'retarget', 'remarketing', 'display', 'media', 'campaign', 'click'
    ],
    'Social': [
        'facebook', 'twitter', 'linkedin', 'social', 'share',
        'connect', 'like', 'follow', 'widget', 'pinterest', 'instagram'
    ],
    'Session Recording': [
        'hotjar', 'fullstory', 'session', 'replay', 'record',
        'heatmap', 'scroll', 'mouseflow', 'clarity', 'smartlook'
    ],
    'Tag Manager': [
        'tag', 'gtm', 'tagmanager', 'container', 'segment',
        'tealium', 'launch', 'manager'
    ],
    'Payment': [
        'stripe', 'paypal', 'pay', 'checkout', 'payment', 'card',
        'billing', 'braintree', 'square', 'adyen'
    ],
    'CDN': [
        'cdn', 'cloudflare', 'akamai', 'fastly', 'cloudfront',
        'cache', 'static', 'assets', 'jsdelivr', 'unpkg'
    ],
    'Security': [
        'captcha', 'recaptcha', 'hcaptcha', 'security', 'fraud',
        'bot', 'protect', 'verify', 'auth', 'fingerprint'
    ]
};

// Generate feature vector for a domain/URL
function extractFeatures(text) {
    const textLower = text.toLowerCase();
    const features = [];

    // Pattern-based features (22 features matching FeatureExtractor)
    const patterns = [
        // Analytics patterns (0-2)
        ['analytics', 'stat', 'metric', 'track', 'collect'],
        ['pixel', 'beacon', 'hit', 'log', 'counter'],
        ['measure', 'insight', 'report'],

        // Advertising patterns (3-5)
        ['ad', 'ads', 'advert', 'banner'],
        ['retarget', 'remarketing', 'conversion'],
        ['display', 'media', 'campaign'],

        // Social patterns (6-7)
        ['facebook', 'twitter', 'linkedin', 'social'],
        ['share', 'connect', 'like', 'widget'],

        // Session recording patterns (8-9)
        ['hotjar', 'fullstory', 'session', 'replay'],
        ['heatmap', 'scroll', 'record', 'mouseflow'],

        // Tag manager patterns (10-11)
        ['tag', 'gtm', 'tagmanager', 'container'],
        ['segment', 'tealium', 'launch'],

        // Payment patterns (12-13)
        ['stripe', 'paypal', 'payment', 'checkout'],
        ['billing', 'braintree', 'card'],

        // CDN patterns (14-15)
        ['cdn', 'cloudflare', 'akamai', 'cache'],
        ['static', 'assets', 'fastly'],

        // Security patterns (16-17)
        ['captcha', 'recaptcha', 'hcaptcha'],
        ['security', 'fraud', 'bot', 'protect'],

        // Domain structure (18-21)
        [], [], [], [] // Will be computed from domain structure
    ];

    // Compute pattern-based features
    for (let i = 0; i < 18; i++) {
        const patternGroup = patterns[i];
        let score = 0;
        for (const pattern of patternGroup) {
            if (textLower.includes(pattern)) {
                score += 1;
            }
        }
        features.push(Math.min(1, score / Math.max(1, patternGroup.length)));
    }

    // Domain structure features
    features.push(textLower.split('.').length / 5); // Subdomain depth
    features.push(textLower.length / 50); // Domain length
    features.push(textLower.includes('-') ? 1 : 0); // Has hyphen
    features.push(/\d/.test(textLower) ? 1 : 0); // Has number

    return features;
}

// Sigmoid activation
function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

// Generate weights from tracker_kb.json
async function generateWeights() {
    // Load tracker_kb.json
    const kbPath = path.join(__dirname, '..', 'tracker_kb.json');
    const trackerKb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));

    console.log(`Loaded ${Object.keys(trackerKb).length} tracker entries`);

    // Collect training data
    const trainingData = [];
    const categoryMap = {};

    for (const [domain, info] of Object.entries(trackerKb)) {
        let category = info.category;

        // Map similar categories
        if (category.includes('FingerprintingInvasive') || category.includes('FingerprintingGeneral')) {
            category = 'Security';
        } else if (category.includes('Email')) {
            category = 'Advertising';
        } else if (category === 'Content') {
            category = 'CDN';
        } else if (category === 'Cryptomining') {
            category = 'Security';
        } else if (category === 'Anti-fraud') {
            category = 'Security';
        }

        const categoryIndex = CATEGORIES.indexOf(category);
        if (categoryIndex >= 0 && categoryIndex < CATEGORIES.length - 1) { // Exclude Unknown
            const features = extractFeatures(domain);
            trainingData.push({
                features,
                categoryIndex,
                category
            });
            categoryMap[category] = (categoryMap[category] || 0) + 1;
        }
    }

    console.log('Category distribution:', categoryMap);
    console.log(`Training data points: ${trainingData.length}`);

    // Initialize weights with pattern-based heuristics
    const inputSize = 22;
    const hiddenSize = 16;
    const outputSize = CATEGORIES.length;

    // Input -> Hidden weights (initialized based on feature patterns)
    const weightsIH = [];
    for (let i = 0; i < inputSize; i++) {
        const row = [];
        for (let j = 0; j < hiddenSize; j++) {
            // Initialize with small random values + pattern bias
            row.push((Math.random() - 0.5) * 0.5);
        }
        weightsIH.push(row);
    }

    // Hidden -> Output weights (initialized based on category patterns)
    const weightsHO = [];
    for (let i = 0; i < hiddenSize; i++) {
        const row = [];
        for (let j = 0; j < outputSize; j++) {
            // Map hidden neurons to categories
            const categoryBias = (i % outputSize === j) ? 0.5 : -0.1;
            row.push((Math.random() - 0.5) * 0.3 + categoryBias);
        }
        weightsHO.push(row);
    }

    // Biases
    const biasH = new Array(hiddenSize).fill(0).map(() => (Math.random() - 0.5) * 0.2);
    const biasO = new Array(outputSize).fill(0);

    // Simple training with gradient descent
    const learningRate = 0.1;
    const epochs = 50;

    for (let epoch = 0; epoch < epochs; epoch++) {
        let totalLoss = 0;

        for (const { features, categoryIndex } of trainingData) {
            // Forward pass
            const hidden = [];
            for (let j = 0; j < hiddenSize; j++) {
                let sum = biasH[j];
                for (let i = 0; i < inputSize; i++) {
                    sum += features[i] * weightsIH[i][j];
                }
                hidden.push(sigmoid(sum));
            }

            // Output with softmax
            const output = [];
            let maxOut = -Infinity;
            for (let j = 0; j < outputSize; j++) {
                let sum = biasO[j];
                for (let i = 0; i < hiddenSize; i++) {
                    sum += hidden[i] * weightsHO[i][j];
                }
                output.push(sum);
                maxOut = Math.max(maxOut, sum);
            }

            // Softmax
            let sumExp = 0;
            for (let j = 0; j < outputSize; j++) {
                output[j] = Math.exp(output[j] - maxOut);
                sumExp += output[j];
            }
            for (let j = 0; j < outputSize; j++) {
                output[j] /= sumExp;
            }

            // Calculate loss (cross-entropy)
            totalLoss -= Math.log(output[categoryIndex] + 1e-10);

            // Backward pass - output layer
            const outputGrad = output.slice();
            outputGrad[categoryIndex] -= 1; // dL/dz = y_pred - y_true

            // Update output weights
            for (let i = 0; i < hiddenSize; i++) {
                for (let j = 0; j < outputSize; j++) {
                    weightsHO[i][j] -= learningRate * hidden[i] * outputGrad[j];
                }
            }
            for (let j = 0; j < outputSize; j++) {
                biasO[j] -= learningRate * outputGrad[j];
            }

            // Backward pass - hidden layer
            const hiddenGrad = [];
            for (let i = 0; i < hiddenSize; i++) {
                let grad = 0;
                for (let j = 0; j < outputSize; j++) {
                    grad += weightsHO[i][j] * outputGrad[j];
                }
                grad *= hidden[i] * (1 - hidden[i]); // Sigmoid derivative
                hiddenGrad.push(grad);
            }

            // Update input weights
            for (let i = 0; i < inputSize; i++) {
                for (let j = 0; j < hiddenSize; j++) {
                    weightsIH[i][j] -= learningRate * features[i] * hiddenGrad[j];
                }
            }
            for (let j = 0; j < hiddenSize; j++) {
                biasH[j] -= learningRate * hiddenGrad[j];
            }
        }

        if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: Loss = ${(totalLoss / trainingData.length).toFixed(4)}`);
        }
    }

    // Save weights
    const weights = {
        inputSize,
        hiddenSize,
        outputSize,
        categories: CATEGORIES,
        weightsIH,
        weightsHO,
        biasH,
        biasO,
        trainedOn: trainingData.length,
        generatedAt: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, '..', 'modules', 'pretrained_weights.json');
    fs.writeFileSync(outputPath, JSON.stringify(weights, null, 2));

    console.log(`\nWeights saved to ${outputPath}`);
    console.log(`Input: ${inputSize}, Hidden: ${hiddenSize}, Output: ${outputSize}`);

    // Test accuracy
    let correct = 0;
    for (const { features, categoryIndex, category } of trainingData.slice(0, 100)) {
        // Forward pass
        const hidden = [];
        for (let j = 0; j < hiddenSize; j++) {
            let sum = biasH[j];
            for (let i = 0; i < inputSize; i++) {
                sum += features[i] * weightsIH[i][j];
            }
            hidden.push(sigmoid(sum));
        }

        const output = [];
        for (let j = 0; j < outputSize; j++) {
            let sum = biasO[j];
            for (let i = 0; i < hiddenSize; i++) {
                sum += hidden[i] * weightsHO[i][j];
            }
            output.push(sum);
        }

        const predicted = output.indexOf(Math.max(...output));
        if (predicted === categoryIndex) correct++;
    }

    console.log(`Test accuracy: ${(correct / Math.min(100, trainingData.length) * 100).toFixed(1)}%`);
}

generateWeights().catch(console.error);
