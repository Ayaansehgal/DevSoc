// Policy Engine - Makes enforcement decisions based on risk and context

export class PolicyEngine {
  constructor(policies) {
    this.policies = policies;
  }

  // Determine enforcement mode based on risk score and context
  determineEnforcementMode(riskScore, contexts, trackerDomain) {
    const thresholds = this.policies.thresholds;
    
    // Determine base mode from risk score
    let mode;
    if (riskScore >= thresholds.block) {
      mode = 'block';
    } else if (riskScore >= thresholds.sandbox) {
      mode = 'sandbox';
    } else if (riskScore >= thresholds.restrict) {
      mode = 'restrict';
    } else {
      mode = 'allow';
    }

    // Apply critical context overrides
    if (contexts && contexts.size > 0) {
      const override = this.policies.criticalContextOverrides[mode];
      if (override) {
        console.log(`[PolicyEngine] Context override: ${mode} -> ${override} for ${trackerDomain}`);
        return override;
      }
    }

    return mode;
  }

  // Get enforcement actions for a mode
  getEnforcementActions(mode) {
    const modeConfig = this.policies.enforcementModes[mode];
    return modeConfig ? modeConfig.actions : [];
  }

  // Get mode configuration
  getModeConfig(mode) {
    return this.policies.enforcementModes[mode] || {};
  }

  // Check if user has override for this tracker
  async getUserOverride(domain, tabId) {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};
      
      // Check tab-specific override first
      const tabKey = `${tabId}:${domain}`;
      if (overrides[tabKey]) {
        return overrides[tabKey];
      }

      // Check global override
      if (overrides[domain]) {
        return overrides[domain];
      }

      return null;
    } catch (error) {
      console.error('[PolicyEngine] Error getting user override:', error);
      return null;
    }
  }

  // Save user override
  async setUserOverride(domain, tabId, mode, scope = 'tab') {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};
      
      const key = scope === 'global' ? domain : `${tabId}:${domain}`;
      overrides[key] = { 
        mode, 
        timestamp: Date.now(), 
        scope,
        domain 
      };
      
      await chrome.storage.local.set({ userOverrides: overrides });
      console.log(`[PolicyEngine] User override saved: ${domain} -> ${mode} (${scope})`);
      return true;
    } catch (error) {
      console.error('[PolicyEngine] Error saving user override:', error);
      return false;
    }
  }

  // Remove user override
  async removeUserOverride(domain, tabId, scope = 'tab') {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};
      
      const key = scope === 'global' ? domain : `${tabId}:${domain}`;
      delete overrides[key];
      
      await chrome.storage.local.set({ userOverrides: overrides });
      console.log(`[PolicyEngine] User override removed: ${domain}`);
      return true;
    } catch (error) {
      console.error('[PolicyEngine] Error removing user override:', error);
      return false;
    }
  }

  // Get all user overrides
  async getAllOverrides() {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      return result.userOverrides || {};
    } catch (error) {
      console.error('[PolicyEngine] Error getting all overrides:', error);
      return {};
    }
  }

  // Clear all overrides for a tab
  async clearTabOverrides(tabId) {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};
      
      // Remove all tab-specific overrides
      const tabPrefix = `${tabId}:`;
      for (const key in overrides) {
        if (key.startsWith(tabPrefix)) {
          delete overrides[key];
        }
      }
      
      await chrome.storage.local.set({ userOverrides: overrides });
      console.log(`[PolicyEngine] Tab overrides cleared: ${tabId}`);
    } catch (error) {
      console.error('[PolicyEngine] Error clearing tab overrides:', error);
    }
  }

  // Check if mode should be escalated based on frequency
  shouldEscalateMode(currentMode, frequency, spikeThreshold) {
    if (frequency > spikeThreshold && currentMode === 'allow') {
      return 'restrict';
    }
    if (frequency > spikeThreshold * 2 && currentMode === 'restrict') {
      return 'sandbox';
    }
    return currentMode;
  }

  // Determine if blocking should be deferred
  shouldDeferBlocking(mode, contexts) {
    return mode === 'block' && contexts && contexts.size > 0;
  }
}
