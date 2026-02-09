// Context Detection Module - Identifies critical user flows

export class ContextDetector {
  constructor(policies) {
    this.policies = policies;
    this.contextCache = new Map(); // tabId -> contexts
  }

  // Detect contexts from URL patterns
  detectFromURL(url) {
    const contexts = new Set();
    const urlLower = url.toLowerCase();

    for (const [contextType, patterns] of Object.entries(this.policies.contextPatterns)) {
      for (const pattern of patterns) {
        if (urlLower.includes(pattern)) {
          contexts.add(contextType);
        }
      }
    }

    return contexts;
  }

  // Detect contexts from DOM signals
  detectFromDOM(domSignals) {
    const contexts = new Set();

    for (const [contextType, selectors] of Object.entries(this.policies.domSignals)) {
      if (domSignals[contextType] && domSignals[contextType].length > 0) {
        contexts.add(contextType);
      }
    }

    return contexts;
  }

  // Combine URL and DOM contexts
  combineContexts(urlContexts, domContexts) {
    return new Set([...urlContexts, ...domContexts]);
  }

  // Check if any critical context is active
  isCriticalContext(contexts) {
    return contexts && contexts.size > 0;
  }

  // Get context priority (for override decisions)
  getContextPriority(contexts) {
    const priorities = {
      'payment': 3,
      'checkout': 2,
      'login': 1
    };

    let maxPriority = 0;
    for (const context of contexts) {
      maxPriority = Math.max(maxPriority, priorities[context] || 0);
    }
    return maxPriority;
  }

  // Apply context-based enforcement override
  applyContextOverride(enforcementMode, contexts) {
    if (!this.isCriticalContext(contexts)) {
      return enforcementMode;
    }

    const override = this.policies.criticalContextOverrides[enforcementMode];
    return override || enforcementMode;
  }

  // Store context for tab
  setTabContext(tabId, contexts) {
    this.contextCache.set(tabId, contexts);
  }

  // Get stored context for tab
  getTabContext(tabId) {
    return this.contextCache.get(tabId) || new Set();
  }

  // Clear context for tab
  clearTabContext(tabId) {
    this.contextCache.delete(tabId);
  }

  // Get human-readable context description
  getContextDescription(contexts) {
    if (contexts.size === 0) return 'No critical context detected';
    
    const contextLabels = {
      'payment': 'Payment Processing',
      'checkout': 'Checkout Flow',
      'login': 'Login/Authentication'
    };

    const descriptions = Array.from(contexts).map(ctx => 
      contextLabels[ctx] || ctx
    );

    return descriptions.join(', ');
  }

  // Check if context requires special handling
  requiresCarefulHandling(contexts) {
    return contexts.has('payment') || contexts.has('checkout');
  }
}
