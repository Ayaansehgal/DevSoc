export class PolicyEngine {
  constructor(policies) {
    this.policies = policies;
  }

  determineEnforcementMode(riskScore, contexts, trackerDomain) {
    const thresholds = this.policies.thresholds;

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

    if (contexts && contexts.size > 0) {
      const override = this.policies.criticalContextOverrides[mode];
      if (override) {
        return override;
      }
    }

    return mode;
  }

  getEnforcementActions(mode) {
    const modeConfig = this.policies.enforcementModes[mode];
    return modeConfig ? modeConfig.actions : [];
  }

  getModeConfig(mode) {
    return this.policies.enforcementModes[mode] || {};
  }

  async getUserOverride(domain, tabId) {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};

      const tabKey = `${tabId}:${domain}`;
      if (overrides[tabKey]) {
        return overrides[tabKey];
      }

      if (overrides[domain]) {
        return overrides[domain];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

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
      return true;
    } catch (error) {
      return false;
    }
  }

  async removeUserOverride(domain, tabId, scope = 'tab') {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};

      const key = scope === 'global' ? domain : `${tabId}:${domain}`;
      delete overrides[key];

      await chrome.storage.local.set({ userOverrides: overrides });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAllOverrides() {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      return result.userOverrides || {};
    } catch (error) {
      return {};
    }
  }

  async clearTabOverrides(tabId) {
    try {
      const result = await chrome.storage.local.get(['userOverrides']);
      const overrides = result.userOverrides || {};

      const tabPrefix = `${tabId}:`;
      for (const key in overrides) {
        if (key.startsWith(tabPrefix)) {
          delete overrides[key];
        }
      }

      await chrome.storage.local.set({ userOverrides: overrides });
    } catch (error) { }
  }

  shouldEscalateMode(currentMode, frequency, spikeThreshold) {
    if (frequency > spikeThreshold && currentMode === 'allow') {
      return 'restrict';
    }
    if (frequency > spikeThreshold * 2 && currentMode === 'restrict') {
      return 'sandbox';
    }
    return currentMode;
  }

  shouldDeferBlocking(mode, contexts) {
    return mode === 'block' && contexts && contexts.size > 0;
  }
}
