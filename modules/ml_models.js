// ML Models Core - Lightweight custom ML utilities
// No TensorFlow.js dependency - pure JavaScript implementation

/**
 * Simple Neural Network for classification tasks
 * Lightweight implementation optimized for browser extension
 */
export class SimpleNeuralNetwork {
  constructor(inputSize, hiddenSize, outputSize) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    
    // Initialize weights with Xavier initialization
    this.weightsIH = this.initializeWeights(inputSize, hiddenSize);
    this.weightsHO = this.initializeWeights(hiddenSize, outputSize);
    this.biasH = new Array(hiddenSize).fill(0);
    this.biasO = new Array(outputSize).fill(0);
  }

  initializeWeights(rows, cols) {
    const scale = Math.sqrt(2.0 / (rows + cols));
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    );
  }

  // ReLU activation
  relu(x) {
    return Math.max(0, x);
  }

  // Softmax for output layer
  softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
  }

  // Forward pass
  predict(input) {
    // Input to hidden layer
    const hidden = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.biasH[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += input[i] * this.weightsIH[i][j];
      }
      hidden[j] = this.relu(sum);
    }

    // Hidden to output layer
    const output = new Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.biasO[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weightsHO[j][k];
      }
      output[k] = sum;
    }

    return this.softmax(output);
  }

  // Load pre-trained weights
  loadWeights(weights) {
    if (weights.weightsIH) this.weightsIH = weights.weightsIH;
    if (weights.weightsHO) this.weightsHO = weights.weightsHO;
    if (weights.biasH) this.biasH = weights.biasH;
    if (weights.biasO) this.biasO = weights.biasO;
  }

  // Export weights for saving
  exportWeights() {
    return {
      weightsIH: this.weightsIH,
      weightsHO: this.weightsHO,
      biasH: this.biasH,
      biasO: this.biasO
    };
  }
}

/**
 * Feature extraction utilities for ML models
 */
export class FeatureExtractor {
  constructor() {
    // Common tracker URL patterns
    this.urlPatterns = {
      analytics: ['/analytics', '/collect', '/beacon', '/track', '/event', '/pageview', '/hit', '/ga.js', '/gtag', '/gtm'],
      advertising: ['/ad', '/ads', '/pixel', '/conversion', '/retarget', '/doubleclick', '/adsense', '/adserver', '/banner'],
      social: ['/like', '/share', '/social', '/widget', '/connect', '/fb.', '/twitter', '/linkedin'],
      sessionRecording: ['/record', '/replay', '/heatmap', '/session', '/hotjar', '/fullstory', '/mouseflow'],
      payment: ['/pay', '/checkout', '/stripe', '/paypal', '/braintree', '/square', '/billing'],
      cdn: ['/cdn', '/static', '/assets', '/dist', '/lib', '/vendor']
    };

    // Domain patterns
    this.domainPatterns = {
      analytics: ['analytics', 'stats', 'metrics', 'measure', 'insight'],
      advertising: ['ad', 'ads', 'advert', 'banner', 'sponsor', 'promo'],
      social: ['social', 'share', 'like', 'connect', 'fb', 'twitter', 'linkedin'],
      sessionRecording: ['hotjar', 'fullstory', 'mouseflow', 'logrocket', 'session', 'record'],
      payment: ['pay', 'stripe', 'paypal', 'braintree', 'square', 'checkout'],
      cdn: ['cdn', 'static', 'cloudflare', 'fastly', 'akamai', 'cloudfront']
    };
  }

  /**
   * Extract features from a URL for classification
   * Returns a normalized feature vector
   */
  extractUrlFeatures(url, domain) {
    const features = [];
    const urlLower = url.toLowerCase();
    const domainLower = domain.toLowerCase();

    // URL path pattern matching (6 features)
    for (const [category, patterns] of Object.entries(this.urlPatterns)) {
      const matchCount = patterns.filter(p => urlLower.includes(p)).length;
      features.push(matchCount / patterns.length); // Normalized 0-1
    }

    // Domain pattern matching (6 features)
    for (const [category, patterns] of Object.entries(this.domainPatterns)) {
      const matchCount = patterns.filter(p => domainLower.includes(p)).length;
      features.push(matchCount / patterns.length); // Normalized 0-1
    }

    // URL structure features (6 features)
    features.push(this.normalizeLength(url.length, 200)); // URL length
    features.push(this.normalizeLength(domain.split('.').length, 5)); // Subdomain depth
    features.push(url.includes('?') ? 1 : 0); // Has query params
    features.push((url.match(/[&=]/g) || []).length / 20); // Query param count (normalized)
    features.push(domain.includes('www') ? 0 : 1); // No www (tracker indicator)
    features.push(/\d+/.test(domain) ? 1 : 0); // Contains numbers

    // Special endpoint patterns (4 features)
    features.push(urlLower.includes('.js') ? 1 : 0); // JavaScript file
    features.push(urlLower.includes('.gif') || urlLower.includes('.png') ? 1 : 0); // Pixel image
    features.push(urlLower.includes('callback') || urlLower.includes('jsonp') ? 1 : 0); // JSONP/Callback
    features.push(urlLower.includes('sync') || urlLower.includes('match') ? 1 : 0); // Cookie sync

    return features; // Total: 22 features
  }

  normalizeLength(value, maxValue) {
    return Math.min(1, value / maxValue);
  }
}

/**
 * Anomaly Detection using statistical methods
 * Used for pattern analysis and fingerprinting detection
 */
export class AnomalyDetector {
  constructor(windowSize = 100) {
    this.windowSize = windowSize;
    this.dataPoints = [];
    this.mean = 0;
    this.stdDev = 1;
  }

  // Add a data point and update statistics
  addDataPoint(value) {
    this.dataPoints.push(value);
    
    // Keep only recent data points
    if (this.dataPoints.length > this.windowSize) {
      this.dataPoints.shift();
    }

    this.updateStatistics();
  }

  updateStatistics() {
    if (this.dataPoints.length < 2) return;

    // Calculate mean
    this.mean = this.dataPoints.reduce((a, b) => a + b, 0) / this.dataPoints.length;

    // Calculate standard deviation
    const squaredDiffs = this.dataPoints.map(x => Math.pow(x - this.mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / this.dataPoints.length;
    this.stdDev = Math.sqrt(avgSquaredDiff) || 1;
  }

  // Check if a value is anomalous (returns z-score)
  getAnomalyScore(value) {
    if (this.dataPoints.length < 5) return 0; // Need baseline data
    return Math.abs((value - this.mean) / this.stdDev);
  }

  // Check if value is anomalous (threshold-based)
  isAnomaly(value, threshold = 2.0) {
    return this.getAnomalyScore(value) > threshold;
  }

  // Get current statistics
  getStats() {
    return {
      mean: this.mean,
      stdDev: this.stdDev,
      dataPoints: this.dataPoints.length
    };
  }

  // Load saved state
  loadState(state) {
    if (state.dataPoints) this.dataPoints = state.dataPoints;
    if (state.mean) this.mean = state.mean;
    if (state.stdDev) this.stdDev = state.stdDev;
  }

  // Export state for saving
  exportState() {
    return {
      dataPoints: this.dataPoints,
      mean: this.mean,
      stdDev: this.stdDev
    };
  }
}

/**
 * Simple heuristic-based classifier for quick predictions
 */
export class HeuristicClassifier {
  constructor() {
    this.rules = new Map();
  }

  addRule(pattern, category, weight = 1.0) {
    if (!this.rules.has(category)) {
      this.rules.set(category, []);
    }
    this.rules.get(category).push({ pattern, weight });
  }

  classify(text) {
    const textLower = text.toLowerCase();
    const scores = {};

    for (const [category, rules] of this.rules.entries()) {
      scores[category] = 0;
      for (const { pattern, weight } of rules) {
        if (textLower.includes(pattern.toLowerCase())) {
          scores[category] += weight;
        }
      }
    }

    // Find highest scoring category
    let maxCategory = 'Unknown';
    let maxScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category;
      }
    }

    // Calculate confidence
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;

    return {
      category: maxScore > 0 ? maxCategory : 'Unknown',
      confidence: confidence,
      scores: scores
    };
  }
}

console.log('[HIMT ML] ML Models module loaded');
