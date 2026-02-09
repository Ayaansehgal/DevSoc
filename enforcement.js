// Enforcement Engine - Executes blocking/sandboxing via Chrome APIs

export class EnforcementEngine {
  constructor() {
    this.activeRules = new Map(); // domain -> ruleId
    this.deferredBlocks = new Map(); // tabId -> Set<domain>
    this.nextRuleId = 1000; // Start at 1000 to avoid conflicts
    this.ruleIdsByDomain = new Map(); // Track which domains have rules
  }

  // Execute enforcement based on mode
  async enforce(domain, mode, tabId, requestDetails, contexts) {
    const actions = this.getActionsForMode(mode);

    // Handle deferred blocking
    if (mode === 'block' && contexts && contexts.size > 0) {
      this.deferBlock(domain, tabId);
      return { deferred: true, mode: 'sandbox' };
    }

    // Execute enforcement actions
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
            // Note: MV3 limitation - these require static rules
            break;
        }
      } catch (error) {
        console.error(`[Enforcement] Failed to execute ${action} for ${domain}:`, error);
      }
    }

    return { deferred: false, mode };
  }

  // Get actions for enforcement mode
  getActionsForMode(mode) {
    const modeActions = {
      'allow': [],
      'restrict': ['strip_cookies', 'limit_headers'],
      'sandbox': ['block_cookies', 'block_storage'],
      'block': ['block_request']
    };
    return modeActions[mode] || [];
  }

  // Block request using declarativeNetRequest
  async blockRequest(domain, tabId) {
    // Check if already blocked
    if (this.activeRules.has(domain)) {
      console.log(`[Enforcement] Domain already blocked: ${domain}`);
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
      console.log(`[Enforcement] Blocked: ${domain} (rule ${ruleId})`);
      return ruleId;
    } catch (error) {
      console.error(`[Enforcement] Failed to block ${domain}:`, error);
      throw error;
    }
  }

  // Unblock a domain
  async unblockRequest(domain) {
    const ruleId = this.activeRules.get(domain);
    if (!ruleId) {
      console.log(`[Enforcement] Domain not blocked: ${domain}`);
      return;
    }

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [ruleId]
      });

      this.activeRules.delete(domain);
      this.ruleIdsByDomain.delete(ruleId);
      console.log(`[Enforcement] Unblocked: ${domain} (removed rule ${ruleId})`);
    } catch (error) {
      console.error(`[Enforcement] Failed to unblock ${domain}:`, error);
      throw error;
    }
  }

  // Block cookies for domain
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
      console.log(`[Enforcement] Cookie blocking enabled for: ${domain}`);
    } catch (error) {
      console.error(`[Enforcement] Failed to block cookies for ${domain}:`, error);
    }
  }

  // Defer blocking until next safe navigation
  deferBlock(domain, tabId) {
    if (!this.deferredBlocks.has(tabId)) {
      this.deferredBlocks.set(tabId, new Set());
    }
    this.deferredBlocks.get(tabId).add(domain);
    console.log(`[Enforcement] Deferred blocking: ${domain} in tab ${tabId}`);
  }

  // Activate deferred blocks for a tab
  async activateDeferredBlocks(tabId) {
    const deferred = this.deferredBlocks.get(tabId);
    if (!deferred || deferred.size === 0) return;

    console.log(`[Enforcement] Activating ${deferred.size} deferred blocks for tab ${tabId}`);
    
    for (const domain of deferred) {
      try {
        await this.blockRequest(domain, tabId);
      } catch (error) {
        console.error(`[Enforcement] Failed to activate deferred block for ${domain}:`, error);
      }
    }

    this.deferredBlocks.delete(tabId);
  }

  // Get deferred blocks for a tab
  getDeferredBlocks(tabId) {
    return this.deferredBlocks.get(tabId) || new Set();
  }

  // Clear deferred blocks for a tab
  clearDeferredBlocks(tabId) {
    this.deferredBlocks.delete(tabId);
  }

  // Clear all rules for tab
  async clearTabRules(tabId) {
    this.deferredBlocks.delete(tabId);
    // Note: DNR rules are global, not tab-specific
  }

  // Remove all dynamic rules
  async clearAllRules() {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
        console.log(`[Enforcement] Cleared ${ruleIds.length} dynamic rules`);
      }
      
      this.activeRules.clear();
      this.ruleIdsByDomain.clear();
    } catch (error) {
      console.error('[Enforcement] Failed to clear all rules:', error);
    }
  }

  // Get all active blocking rules
  getActiveRules() {
    return Array.from(this.activeRules.entries()).map(([domain, ruleId]) => ({
      domain,
      ruleId
    }));
  }

  // Check if domain is blocked
  isBlocked(domain) {
    return this.activeRules.has(domain);
  }
}
