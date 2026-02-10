import { categoryClassifier } from './category_classifier.js';

export class TrackerKnowledge {
  constructor() {
    this.trackerDB = {};
    this.loaded = false;
    this.mlClassifierReady = false;
  }

  async loadDatabase() {
    try {
      const response = await fetch(chrome.runtime.getURL('tracker_kb.json'));
      this.trackerDB = await response.json();
      this.loaded = true;

      try {
        await categoryClassifier.initialize();
        this.mlClassifierReady = true;
      } catch (mlError) { }
    } catch (error) { }
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  getTrackerInfo(url) {
    const domain = this.extractDomain(url);
    if (!domain) return null;

    let trackerData = this.trackerDB[domain];

    if (!trackerData) {
      for (const [knownDomain, data] of Object.entries(this.trackerDB)) {
        if (domain.endsWith(knownDomain) || knownDomain.includes(domain)) {
          trackerData = data;
          break;
        }
      }
    }

    if (trackerData) {
      return {
        domain,
        owner: trackerData.company || 'Unknown',
        category: trackerData.category || 'Unknown',
        description: this.getDescription(trackerData.category, trackerData.company),
        dataCollected: this.getDataCollected(trackerData.category),
        baseRisk: this.getCategoryBaseRisk(trackerData.category),
        regulation: this.getRegulation(trackerData.category),
        mlDetected: false
      };
    }

    if (this.mlClassifierReady) {
      try {
        const mlResult = categoryClassifier.predict(url, domain);
        const explainedResult = categoryClassifier.explainClassification(mlResult);

        if (mlResult.category !== 'Unknown' && mlResult.confidence >= 0.5) {
          return {
            domain,
            owner: 'Unknown',
            category: mlResult.category,
            description: this.getDescription(mlResult.category, 'Unknown') + ' (ML-detected)',
            dataCollected: this.getDataCollected(mlResult.category),
            baseRisk: this.getCategoryBaseRisk(mlResult.category),
            regulation: this.getRegulation(mlResult.category),
            mlDetected: true,
            mlConfidence: mlResult.confidence,
            mlMethod: mlResult.method,
            mlExplanation: explainedResult.explanation
          };
        }
      } catch (mlError) { }
    }

    return {
      domain,
      owner: 'Unknown',
      category: 'Unknown',
      description: 'Third-party resource with unclear data practices',
      dataCollected: ['Browsing behavior', 'Request metadata'],
      baseRisk: 10,
      regulation: 'No public documentation available',
      mlDetected: false
    };
  }

  getDescription(category, company) {
    const descriptions = {
      'Advertising': `Tracks your browsing to build advertising profiles and serve targeted ads`,
      'Analytics': `Monitors website usage and user behavior for analytics purposes`,
      'Session Recording': `Records your mouse movements, clicks, and interactions on the page`,
      'Social': `Connects your browsing activity to social media profiles`,
      'Tag Manager': `Coordinates multiple tracking pixels and marketing tags`,
      'Payment': `Processes payment transactions and billing information`,
      'Security': `Provides security services like bot detection and fraud prevention`,
      'CDN': `Delivers website content and resources efficiently`,
      'Content': `Serves website content and functionality`,
      'Customer Success': `Tracks customer interactions for support purposes`,
      'Unknown': `Third-party service with unclear purpose`
    };

    let desc = descriptions[category] || descriptions['Unknown'];
    if (company && company !== 'Unknown') {
      desc += ` (operated by ${company})`;
    }
    return desc;
  }

  getDataCollected(category) {
    const dataTypes = {
      'Advertising': ['Browsing history', 'Ad interactions', 'User interests', 'Device fingerprint'],
      'Analytics': ['Page views', 'User actions', 'Session duration', 'Location', 'Device info'],
      'Session Recording': ['Mouse movements', 'Clicks', 'Scrolling', 'Form inputs', 'Session replays'],
      'Social': ['Social interactions', 'Profile data', 'Shared content', 'Friend networks'],
      'Tag Manager': ['Page events', 'User actions', 'Custom data layers', 'Conversion tracking'],
      'Payment': ['Transaction data', 'Payment methods', 'Billing information'],
      'Security': ['Browser fingerprint', 'Challenge responses', 'IP address'],
      'CDN': ['Resource requests', 'Performance metrics'],
      'Customer Success': ['Support interactions', 'User feedback', 'Product usage'],
      'Unknown': ['Unknown data collection']
    };

    return dataTypes[category] || dataTypes['Unknown'];
  }

  getCategoryBaseRisk(category) {
    const riskScores = {
      'Advertising': 30,
      'Analytics': 15,
      'Session Recording': 45,
      'Social': 25,
      'Tag Manager': 20,
      'Payment': 5,
      'Security': 10,
      'CDN': 5,
      'Content': 8,
      'Customer Success': 15,
      'Unknown': 10
    };

    return riskScores[category] || 10;
  }

  getRegulation(category) {
    const regulations = {
      'Advertising': 'Usually requires explicit consent under GDPR and CCPA',
      'Analytics': 'May require consent depending on jurisdiction and data processing',
      'Session Recording': 'Requires explicit consent for recording user sessions',
      'Social': 'Often requires consent for cross-site tracking',
      'Tag Manager': 'Compliance depends on the tags being managed',
      'Payment': 'Subject to PCI-DSS and financial regulations',
      'Security': 'Generally allowed for fraud prevention purposes',
      'CDN': 'Typically does not require consent for core functionality',
      'Unknown': 'Regulatory requirements unclear'
    };

    return regulations[category] || regulations['Unknown'];
  }

  explainTracker(trackerInfo, riskScore, enforcementMode, requestCount) {
    const { owner, category, description, dataCollected, regulation } = trackerInfo;

    let explanation = {
      summary: `${owner} • ${category}`,
      description: description,
      dataCollected: dataCollected,
      riskLevel: this.getRiskLevel(riskScore),
      riskScore: riskScore,
      regulation: regulation,
      enforcementMode: enforcementMode,
      requestCount: requestCount,
      impact: this.getImpact(riskScore, enforcementMode)
    };

    return explanation;
  }

  getRiskLevel(score) {
    if (score >= 85) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  getImpact(riskScore, enforcementMode) {
    const impacts = {
      'allow': 'This tracker is currently allowed to operate freely.',
      'restrict': 'This tracker is restricted to limit fingerprinting and data collection.',
      'sandbox': 'This tracker is isolated and cannot persist data across pages.',
      'block': 'This tracker is completely blocked from loading.'
    };

    let impact = impacts[enforcementMode] || 'Unknown enforcement status.';

    if (riskScore >= 85) {
      impact += ' High privacy risk detected.';
    } else if (riskScore >= 60) {
      impact += ' Moderate privacy concerns identified.';
    }

    return impact;
  }

  isSafeDomain(domain, safeDomains) {
    return safeDomains.some(safe =>
      domain === safe || domain.endsWith(`.${safe}`)
    );
  }

  isCriticalDomain(domain, criticalDomains) {
    return criticalDomains.some(critical =>
      domain.includes(critical) || critical.includes(domain)
    );
  }
}

export const trackerKnowledge = new TrackerKnowledge();
