export class EnforcementEngine {
  constructor() {
    this.activeRules = new Map();
    this.deferredBlocks = new Map();
    this.nextRuleId = Date.now() % 1000000;
    this.ruleIdsByDomain = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

      let maxId = this.nextRuleId;
      for (const rule of existingRules) {
        if (rule.id >= maxId) {
          maxId = rule.id + 1;
        }
        const match = rule.condition?.urlFilter?.match(/\*:\/\/\*\.(.+)\/\*/);
        if (match) {
          this.activeRules.set(match[1], rule.id);
          this.ruleIdsByDomain.set(rule.id, match[1]);
        }
      }

      this.nextRuleId = maxId;
      this.initialized = true;
    } catch (error) {
      console.error('[Enforcement] Init failed:', error);
    }
  }

  async enforce(domain, mode, tabId, requestDetails, contexts) {
    const actions = this.getActionsForMode(mode);

    if (mode === 'block' && contexts && contexts.size > 0) {
      this.deferBlock(domain, tabId);
      return { deferred: true, mode: 'sandbox' };
    }

    for (const action of actions) {
      try {
        switch (action) {
          case 'block_request':
            await this.blockRequest(domain, tabId);
            break;
          case 'block_cookies':
            await this.blockCookies(domain, tabId);
            break;
          case 'strip_cookies':
          case 'limit_headers':
            break;
        }
      } catch (error) {
        console.error(`[Enforcement] Failed to execute ${action} for ${domain}:`, error);
      }
    }

    return { deferred: false, mode };
  }

  getActionsForMode(mode) {
    const modeActions = {
      'allow': [],
      'restrict': ['strip_cookies', 'limit_headers'],
      'sandbox': ['block_cookies', 'block_storage'],
      'block': ['block_request']
    };
    return modeActions[mode] || [];
  }

  async blockRequest(domain, tabId) {
    if (this.activeRules.has(domain)) {
      return this.activeRules.get(domain);
    }

    const ruleId = this.nextRuleId++;

    const rule = {
      id: ruleId,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: `*://*.${domain}/*`,
        resourceTypes: [
          'script',
          'xmlhttprequest',
          'image',
          'stylesheet',
          'font',
          'media',
          'sub_frame'
        ]
      }
    };

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [rule],
        removeRuleIds: []
      });

      this.activeRules.set(domain, ruleId);
      this.ruleIdsByDomain.set(ruleId, domain);
      return ruleId;
    } catch (error) {
      throw error;
    }
  }

  async unblockRequest(domain) {
    const ruleId = this.activeRules.get(domain);
    if (!ruleId) {
      return;
    }

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [ruleId]
      });

      this.activeRules.delete(domain);
      this.ruleIdsByDomain.delete(ruleId);
    } catch (error) {
      throw error;
    }
  }

  async blockCookies(domain, tabId) {
    const ruleId = this.nextRuleId++;

    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'set-cookie', operation: 'remove' }
        ]
      },
      condition: {
        urlFilter: `*://*.${domain}/*`,
        resourceTypes: ['script', 'xmlhttprequest', 'sub_frame', 'main_frame']
      }
    };

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [rule],
        removeRuleIds: []
      });
    } catch (error) { }
  }

  deferBlock(domain, tabId) {
    if (!this.deferredBlocks.has(tabId)) {
      this.deferredBlocks.set(tabId, new Set());
    }
    this.deferredBlocks.get(tabId).add(domain);
  }

  async activateDeferredBlocks(tabId) {
    const deferred = this.deferredBlocks.get(tabId);
    if (!deferred || deferred.size === 0) return;

    for (const domain of deferred) {
      try {
        await this.blockRequest(domain, tabId);
      } catch (error) { }
    }

    this.deferredBlocks.delete(tabId);
  }

  getDeferredBlocks(tabId) {
    return this.deferredBlocks.get(tabId) || new Set();
  }

  clearDeferredBlocks(tabId) {
    this.deferredBlocks.delete(tabId);
  }

  async clearTabRules(tabId) {
    this.deferredBlocks.delete(tabId);
  }

  async clearAllRules() {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);

      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }

      this.activeRules.clear();
      this.ruleIdsByDomain.clear();
    } catch (error) { }
  }

  getActiveRules() {
    return Array.from(this.activeRules.entries()).map(([domain, ruleId]) => ({
      domain,
      ruleId
    }));
  }

  isBlocked(domain) {
    return this.activeRules.has(domain);
  }
}
