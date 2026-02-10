// Category Classifier - ML-based tracker categorization
// Classifies unknown trackers into categories using neural network + heuristics

import { SimpleNeuralNetwork, FeatureExtractor, HeuristicClassifier } from './ml_models.js';

// Categories for classification
const CATEGORIES = [
    'Analytics',
    'Advertising',
    'Social',
    'Session Recording',
    'Tag Manager',
    'Payment',
    'CDN',
    'Security',
    'Unknown'
];

// Pre-trained weights (trained on tracker_kb.json patterns)
// This is a compact representation that will be expanded on load
const PRETRAINED_WEIGHTS = {
    version: '1.0.0',
    inputSize: 22,
    hiddenSize: 16,
    outputSize: 9,
    // Weights will be initialized with heuristic-based values
    initialized: false
};

export class CategoryClassifier {
    constructor() {
        this.categories = CATEGORIES;
        this.featureExtractor = new FeatureExtractor();
        this.heuristicClassifier = new HeuristicClassifier();
        this.neuralNetwork = null;
        this.confidenceThreshold = 0.7;
        this.initialized = false;

        this.initializeHeuristics();
    }

    /**
     * Initialize heuristic rules for fallback classification
     */
    initializeHeuristics() {
        // Analytics patterns
        this.heuristicClassifier.addRule('analytics', 'Analytics', 2.0);
        this.heuristicClassifier.addRule('google-analytics', 'Analytics', 3.0);
        this.heuristicClassifier.addRule('gtag', 'Analytics', 2.5);
        this.heuristicClassifier.addRule('gtm', 'Tag Manager', 2.5);
        this.heuristicClassifier.addRule('ga.js', 'Analytics', 2.5);
        this.heuristicClassifier.addRule('collect', 'Analytics', 1.5);
        this.heuristicClassifier.addRule('beacon', 'Analytics', 1.5);
        this.heuristicClassifier.addRule('metrics', 'Analytics', 1.5);
        this.heuristicClassifier.addRule('stats', 'Analytics', 1.0);
        this.heuristicClassifier.addRule('amplitude', 'Analytics', 2.5);
        this.heuristicClassifier.addRule('mixpanel', 'Analytics', 2.5);
        this.heuristicClassifier.addRule('segment', 'Analytics', 2.0);
        this.heuristicClassifier.addRule('heap', 'Analytics', 2.0);
        this.heuristicClassifier.addRule('plausible', 'Analytics', 2.0);
        this.heuristicClassifier.addRule('matomo', 'Analytics', 2.0);

        // Advertising patterns
        this.heuristicClassifier.addRule('doubleclick', 'Advertising', 3.0);
        this.heuristicClassifier.addRule('adsense', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('adserver', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('advert', 'Advertising', 2.0);
        this.heuristicClassifier.addRule('/ads/', 'Advertising', 2.0);
        this.heuristicClassifier.addRule('/ad/', 'Advertising', 1.5);
        this.heuristicClassifier.addRule('pixel', 'Advertising', 1.5);
        this.heuristicClassifier.addRule('retarget', 'Advertising', 2.0);
        this.heuristicClassifier.addRule('conversion', 'Advertising', 1.5);
        this.heuristicClassifier.addRule('criteo', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('taboola', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('outbrain', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('pubmatic', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('adroll', 'Advertising', 2.5);
        this.heuristicClassifier.addRule('bidswitch', 'Advertising', 2.0);

        // Social patterns
        this.heuristicClassifier.addRule('facebook', 'Social', 2.5);
        this.heuristicClassifier.addRule('fb.com', 'Social', 2.5);
        this.heuristicClassifier.addRule('fbcdn', 'Social', 2.0);
        this.heuristicClassifier.addRule('twitter', 'Social', 2.5);
        this.heuristicClassifier.addRule('linkedin', 'Social', 2.5);
        this.heuristicClassifier.addRule('pinterest', 'Social', 2.0);
        this.heuristicClassifier.addRule('instagram', 'Social', 2.0);
        this.heuristicClassifier.addRule('/like', 'Social', 1.5);
        this.heuristicClassifier.addRule('/share', 'Social', 1.5);
        this.heuristicClassifier.addRule('social', 'Social', 1.5);
        this.heuristicClassifier.addRule('widget', 'Social', 1.0);

        // Session Recording patterns
        this.heuristicClassifier.addRule('hotjar', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('fullstory', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('mouseflow', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('logrocket', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('smartlook', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('inspectlet', 'Session Recording', 3.0);
        this.heuristicClassifier.addRule('clarity', 'Session Recording', 2.5);
        this.heuristicClassifier.addRule('heatmap', 'Session Recording', 2.0);
        this.heuristicClassifier.addRule('session', 'Session Recording', 1.0);
        this.heuristicClassifier.addRule('record', 'Session Recording', 1.0);
        this.heuristicClassifier.addRule('replay', 'Session Recording', 1.5);

        // Tag Manager patterns
        this.heuristicClassifier.addRule('tagmanager', 'Tag Manager', 3.0);
        this.heuristicClassifier.addRule('tags', 'Tag Manager', 1.5);
        this.heuristicClassifier.addRule('tealium', 'Tag Manager', 2.5);
        this.heuristicClassifier.addRule('segment', 'Tag Manager', 1.5);
        this.heuristicClassifier.addRule('ensighten', 'Tag Manager', 2.5);

        // Payment patterns
        this.heuristicClassifier.addRule('stripe', 'Payment', 3.0);
        this.heuristicClassifier.addRule('paypal', 'Payment', 3.0);
        this.heuristicClassifier.addRule('braintree', 'Payment', 3.0);
        this.heuristicClassifier.addRule('square', 'Payment', 2.5);
        this.heuristicClassifier.addRule('checkout', 'Payment', 1.5);
        this.heuristicClassifier.addRule('payment', 'Payment', 2.0);
        this.heuristicClassifier.addRule('billing', 'Payment', 1.5);
        this.heuristicClassifier.addRule('klarna', 'Payment', 2.5);
        this.heuristicClassifier.addRule('affirm', 'Payment', 2.5);

        // CDN patterns
        this.heuristicClassifier.addRule('cloudflare', 'CDN', 3.0);
        this.heuristicClassifier.addRule('cloudfront', 'CDN', 3.0);
        this.heuristicClassifier.addRule('akamai', 'CDN', 3.0);
        this.heuristicClassifier.addRule('fastly', 'CDN', 3.0);
        this.heuristicClassifier.addRule('jsdelivr', 'CDN', 2.5);
        this.heuristicClassifier.addRule('unpkg', 'CDN', 2.5);
        this.heuristicClassifier.addRule('cdnjs', 'CDN', 2.5);
        this.heuristicClassifier.addRule('/cdn/', 'CDN', 1.5);
        this.heuristicClassifier.addRule('/static/', 'CDN', 1.0);

        // Security patterns
        this.heuristicClassifier.addRule('recaptcha', 'Security', 3.0);
        this.heuristicClassifier.addRule('hcaptcha', 'Security', 3.0);
        this.heuristicClassifier.addRule('captcha', 'Security', 2.5);
        this.heuristicClassifier.addRule('sentry', 'Security', 2.0);
        this.heuristicClassifier.addRule('bugsnag', 'Security', 2.0);
        this.heuristicClassifier.addRule('errortracking', 'Security', 2.0);
    }

    /**
     * Initialize the neural network with pre-trained weights
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Create neural network
            this.neuralNetwork = new SimpleNeuralNetwork(
                PRETRAINED_WEIGHTS.inputSize,
                PRETRAINED_WEIGHTS.hiddenSize,
                PRETRAINED_WEIGHTS.outputSize
            );

            // Try to load saved weights from storage
            const saved = await this.loadSavedWeights();
            if (saved) {
                this.neuralNetwork.loadWeights(saved);
                console.log('[HIMT CategoryClassifier] Loaded saved weights');
            } else {
                // Initialize with heuristic-based weights
                await this.initializeWeightsFromHeuristics();
                console.log('[HIMT CategoryClassifier] Initialized with heuristic-based weights');
            }

            this.initialized = true;
            console.log('[HIMT CategoryClassifier] Initialized successfully');
        } catch (error) {
            console.error('[HIMT CategoryClassifier] Initialization failed:', error);
            this.initialized = true; // Still mark as initialized to use heuristics
        }
    }

    /**
     * Initialize neural network weights based on feature-category correlations
     */
    async initializeWeightsFromHeuristics() {
        try {
            // Try to load pre-trained weights from JSON file
            const response = await fetch(chrome.runtime.getURL('modules/pretrained_weights.json'));
            const pretrainedWeights = await response.json();

            if (pretrainedWeights && pretrainedWeights.weightsIH) {
                this.neuralNetwork.loadWeights({
                    weightsIH: pretrainedWeights.weightsIH,
                    weightsHO: pretrainedWeights.weightsHO,
                    biasH: pretrainedWeights.biasH,
                    biasO: pretrainedWeights.biasO
                });
                console.log('[HIMT CategoryClassifier] Loaded pre-trained weights from file');
                return;
            }
        } catch (error) {
            console.warn('[HIMT CategoryClassifier] Could not load pre-trained weights:', error);
        }

        // Fallback: the neural network will use random initialization
        // and rely primarily on the heuristic classifier
        console.log('[HIMT CategoryClassifier] Using default weight initialization');
    }

    /**
     * Load saved weights from chrome.storage
     */
    async loadSavedWeights() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['categoryClassifierWeights'], (result) => {
                    resolve(result.categoryClassifierWeights || null);
                });
            } else {
                resolve(null);
            }
        });
    }

    /**
     * Save weights to chrome.storage
     */
    async saveWeights() {
        if (!this.neuralNetwork) return;

        const weights = this.neuralNetwork.exportWeights();

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ categoryClassifierWeights: weights }, resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Classify a tracker URL into a category
     * @param {string} url - The tracker URL
     * @param {string} domain - The tracker domain
     * @returns {Object} Classification result with category and confidence
     */
    predict(url, domain) {
        // Combined approach: heuristics + neural network

        // 1. Try heuristic classification first (fast and reliable for known patterns)
        const heuristicResult = this.heuristicClassifier.classify(url + ' ' + domain);

        // 2. If confidence is high, use heuristic result
        if (heuristicResult.confidence >= this.confidenceThreshold) {
            return {
                category: heuristicResult.category,
                confidence: heuristicResult.confidence,
                method: 'heuristic',
                mlDetected: true
            };
        }

        // 3. Try neural network if heuristics are uncertain
        if (this.neuralNetwork) {
            const features = this.featureExtractor.extractUrlFeatures(url, domain);
            const probabilities = this.neuralNetwork.predict(features);

            // Find highest probability category
            let maxProb = 0;
            let maxIndex = this.categories.length - 1; // Default to 'Unknown'

            for (let i = 0; i < probabilities.length; i++) {
                if (probabilities[i] > maxProb) {
                    maxProb = probabilities[i];
                    maxIndex = i;
                }
            }

            // If NN confidence is higher than heuristic, use NN result
            if (maxProb > heuristicResult.confidence && maxProb >= 0.5) {
                return {
                    category: this.categories[maxIndex],
                    confidence: maxProb,
                    method: 'neural_network',
                    mlDetected: true,
                    probabilities: this.categories.reduce((acc, cat, i) => {
                        acc[cat] = probabilities[i];
                        return acc;
                    }, {})
                };
            }
        }

        // 4. Return heuristic result (even if low confidence) or Unknown
        if (heuristicResult.confidence > 0.3) {
            return {
                category: heuristicResult.category,
                confidence: heuristicResult.confidence,
                method: 'heuristic_low_confidence',
                mlDetected: true
            };
        }

        // 5. Fallback to Unknown
        return {
            category: 'Unknown',
            confidence: 0,
            method: 'fallback',
            mlDetected: false
        };
    }

    /**
     * Learn from user feedback (for future training)
     * @param {string} url - The tracker URL
     * @param {string} domain - The tracker domain
     * @param {string} correctCategory - The correct category
     */
    async recordFeedback(url, domain, correctCategory) {
        // Store feedback for future model improvement
        const feedback = {
            url,
            domain,
            correctCategory,
            timestamp: Date.now(),
            features: this.featureExtractor.extractUrlFeatures(url, domain)
        };

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['classifierFeedback'], (result) => {
                    const feedbackList = result.classifierFeedback || [];
                    feedbackList.push(feedback);

                    // Keep only last 1000 feedback entries
                    if (feedbackList.length > 1000) {
                        feedbackList.shift();
                    }

                    chrome.storage.local.set({ classifierFeedback: feedbackList }, resolve);
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get classification explanation for UI
     */
    explainClassification(result) {
        const explanations = {
            'Analytics': 'Detected patterns typical of analytics and measurement services',
            'Advertising': 'Detected advertising, retargeting, or ad-serving patterns',
            'Social': 'Detected social media integration or sharing functionality',
            'Session Recording': 'Detected session recording or heatmap service patterns',
            'Tag Manager': 'Detected tag management or marketing automation patterns',
            'Payment': 'Detected payment processing or checkout service patterns',
            'CDN': 'Detected content delivery network or static asset hosting',
            'Security': 'Detected security, captcha, or error tracking service',
            'Unknown': 'Unable to determine the purpose of this tracker'
        };

        return {
            ...result,
            explanation: explanations[result.category] || explanations['Unknown'],
            confidenceLabel: result.confidence >= 0.9 ? 'Very High' :
                result.confidence >= 0.7 ? 'High' :
                    result.confidence >= 0.5 ? 'Medium' :
                        result.confidence >= 0.3 ? 'Low' : 'Very Low'
        };
    }
}

// Singleton instance
export const categoryClassifier = new CategoryClassifier();

console.log('[HIMT] Category Classifier module loaded');
