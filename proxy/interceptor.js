/**
 * Request/Response Interceptor
 * Handles breakpoints, modifications, and filtering
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class Interceptor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.breakpoints = new Map();
    this.modificationRules = [];
    this.filters = {
      urlPatterns: [],
      methods: [],
      statusCodes: [],
      domains: []
    };
    this.pausedRequests = new Map();
    this.maxPausedRequests = options.maxPausedRequests || 100;
    this.pauseTimeout = options.pauseTimeout || 30000;
    this.requestLog = new Map();
  }

  /**
   * Set a new breakpoint
   */
  setBreakpoint(rule) {
    const id = uuidv4();
    const breakpoint = {
      id,
      name: rule.name || `Breakpoint ${this.breakpoints.size + 1}`,
      urlPattern: rule.urlPattern || '*',
      method: rule.method || '*',
      stage: rule.stage || 'request', // 'request' or 'response'
      action: rule.action || 'pause', // 'pause', 'modify', 'block'
      conditions: rule.conditions || {},
      modifications: rule.modifications || {},
      enabled: rule.enabled !== false,
      hitCount: 0,
      createdAt: Date.now(),
      description: rule.description || ''
    };

    this.breakpoints.set(id, breakpoint);
    this.emit('breakpointAdded', breakpoint);
    console.log(`[Interceptor] Breakpoint added: ${breakpoint.name} (${id})`);
    return id;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(id) {
    const breakpoint = this.breakpoints.get(id);
    if (breakpoint) {
      this.breakpoints.delete(id);
      this.emit('breakpointRemoved', breakpoint);
      console.log(`[Interceptor] Breakpoint removed: ${breakpoint.name} (${id})`);
      return true;
    }
    return false;
  }

  /**
   * Update a breakpoint
   */
  updateBreakpoint(id, updates) {
    const breakpoint = this.breakpoints.get(id);
    if (!breakpoint) return false;

    Object.assign(breakpoint, updates, { updatedAt: Date.now() });
    this.emit('breakpointUpdated', breakpoint);
    return true;
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(id) {
    const breakpoint = this.breakpoints.get(id);
    if (!breakpoint) return false;

    breakpoint.enabled = !breakpoint.enabled;
    this.emit('breakpointUpdated', breakpoint);
    return breakpoint.enabled;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints() {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Check if a request/response matches any breakpoint
   */
  async checkBreakpoint(data, stage = 'request') {
    for (const breakpoint of this.breakpoints.values()) {
      if (!breakpoint.enabled) continue;
      if (breakpoint.stage !== stage) continue;

      if (this.matchesBreakpoint(breakpoint, data)) {
        breakpoint.hitCount++;
        console.log(`[Interceptor] Breakpoint hit: ${breakpoint.name}`);

        if (breakpoint.action === 'pause') {
          return await this.pauseForBreakpoint(breakpoint, data);
        } else if (breakpoint.action === 'block') {
          return { action: 'block', breakpoint };
        } else if (breakpoint.action === 'modify') {
          return { 
            action: 'modify', 
            modifications: breakpoint.modifications,
            breakpoint 
          };
        }
      }
    }
    return null;
  }

  /**
   * Check if data matches breakpoint criteria
   */
  matchesBreakpoint(breakpoint, data) {
    // Check URL pattern
    if (breakpoint.urlPattern && breakpoint.urlPattern !== '*') {
      try {
        const regex = new RegExp(breakpoint.urlPattern, 'i');
        if (!regex.test(data.url)) return false;
      } catch (e) {
        // Invalid regex, treat as literal string
        if (!data.url.includes(breakpoint.urlPattern)) return false;
      }
    }

    // Check method
    if (breakpoint.method && breakpoint.method !== '*') {
      if (breakpoint.method.toUpperCase() !== data.method?.toUpperCase()) {
        return false;
      }
    }

    // Check custom conditions
    if (breakpoint.conditions.headers) {
      for (const [key, value] of Object.entries(breakpoint.conditions.headers)) {
        const headerValue = data.headers?.[key] || data.headers?.[key.toLowerCase()];
        if (headerValue !== value) return false;
      }
    }

    if (breakpoint.conditions.statusCodes && data.statusCode) {
      if (!breakpoint.conditions.statusCodes.includes(data.statusCode)) {
        return false;
      }
    }

    if (breakpoint.conditions.queryParams) {
      const url = new URL(data.url);
      for (const [key, value] of Object.entries(breakpoint.conditions.queryParams)) {
        if (url.searchParams.get(key) !== value) return false;
      }
    }

    return true;
  }

  /**
   * Pause request for user intervention
   */
  async pauseForBreakpoint(breakpoint, data) {
    // Check max paused requests
    if (this.pausedRequests.size >= this.maxPausedRequests) {
      console.warn('[Interceptor] Max paused requests reached, auto-continuing');
      return { action: 'continue' };
    }

    return new Promise((resolve) => {
      const pauseId = uuidv4();
      const pausedRequest = {
        pauseId,
        breakpoint,
        data,
        resolve,
        pausedAt: Date.now(),
        stage: breakpoint.stage
      };

      this.pausedRequests.set(pauseId, pausedRequest);

      // Emit event for dashboard
      this.emit('requestPaused', {
        pauseId,
        breakpoint: {
          id: breakpoint.id,
          name: breakpoint.name,
          stage: breakpoint.stage
        },
        data: {
          id: data.id,
          method: data.method,
          url: data.url,
          headers: data.headers,
          body: data.body?.substring?.(0, 10000) || data.body // Limit body size
        }
      });

      // Set timeout
      const timeout = setTimeout(() => {
        if (this.pausedRequests.has(pauseId)) {
          console.log(`[Interceptor] Request ${pauseId} timed out, auto-continuing`);
          this.resumeRequest(pauseId, { action: 'continue' });
        }
      }, this.pauseTimeout);

      pausedRequest.timeout = timeout;
    });
  }

  /**
   * Resume a paused request
   */
  resumeRequest(pauseId, action) {
    const paused = this.pausedRequests.get(pauseId);
    if (!paused) {
      console.warn(`[Interceptor] No paused request found: ${pauseId}`);
      return false;
    }

    // Clear timeout
    if (paused.timeout) {
      clearTimeout(paused.timeout);
    }

    this.pausedRequests.delete(pauseId);
    
    console.log(`[Interceptor] Resuming request ${pauseId} with action: ${action.action}`);
    paused.resolve(action);
    
    this.emit('requestResumed', { pauseId, action });
    return true;
  }

  /**
   * Get all paused requests
   */
  getPausedRequests() {
    return Array.from(this.pausedRequests.entries()).map(([id, paused]) => ({
      pauseId: id,
      breakpoint: paused.breakpoint,
      data: paused.data,
      pausedAt: paused.pausedAt,
      stage: paused.stage
    }));
  }

  /**
   * Modify a request based on rules
   */
  async modifyRequest(requestData) {
    let modified = { ...requestData };
    let modifiedBy = [];

    for (const rule of this.modificationRules) {
      if (rule.type === 'request' && this.matchesRule(rule, requestData)) {
        modified = this.applyModifications(modified, rule.modifications);
        modifiedBy.push(rule.name || rule.id);
      }
    }

    if (modifiedBy.length > 0) {
      console.log(`[Interceptor] Request modified by rules: ${modifiedBy.join(', ')}`);
    }

    return modified;
  }

  /**
   * Modify a response based on rules
   */
  async modifyResponse(responseData) {
    let modified = { ...responseData };
    let modifiedBy = [];

    for (const rule of this.modificationRules) {
      if (rule.type === 'response' && this.matchesRule(rule, responseData)) {
        modified = this.applyModifications(modified, rule.modifications);
        modifiedBy.push(rule.name || rule.id);
      }
    }

    if (modifiedBy.length > 0) {
      console.log(`[Interceptor] Response modified by rules: ${modifiedBy.join(', ')}`);
    }

    return modified;
  }

  /**
   * Apply modifications to data
   */
  applyModifications(data, modifications) {
    const result = { ...data };

    // Modify headers
    if (modifications.headers) {
      result.headers = { ...result.headers };
      for (const [key, value] of Object.entries(modifications.headers)) {
        if (value === null || value === undefined) {
          delete result.headers[key];
          delete result.headers[key.toLowerCase()];
        } else {
          result.headers[key] = value;
        }
      }
    }

    // Modify query parameters
    if (modifications.queryParams && result.url) {
      const url = new URL(result.url);
      for (const [key, value] of Object.entries(modifications.queryParams)) {
        if (value === null || value === undefined) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      }
      result.url = url.toString();
    }

    // Modify body
    if (modifications.body !== undefined) {
      result.body = modifications.body;
    }

    // Modify status code (response only)
    if (modifications.statusCode && result.statusCode !== undefined) {
      result.statusCode = modifications.statusCode;
    }

    // Modify status message (response only)
    if (modifications.statusMessage && result.statusMessage !== undefined) {
      result.statusMessage = modifications.statusMessage;
    }

    return result;
  }

  /**
   * Check if data matches a modification rule
   */
  matchesRule(rule, data) {
    if (rule.urlPattern) {
      try {
        const regex = new RegExp(rule.urlPattern, 'i');
        if (!regex.test(data.url)) return false;
      } catch (e) {
        if (!data.url.includes(rule.urlPattern)) return false;
      }
    }

    if (rule.method && rule.method !== '*') {
      if (rule.method.toUpperCase() !== data.method?.toUpperCase()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add a modification rule
   */
  addModificationRule(rule) {
    const id = uuidv4();
    const newRule = {
      id,
      name: rule.name || `Rule ${this.modificationRules.length + 1}`,
      type: rule.type || 'request',
      urlPattern: rule.urlPattern,
      method: rule.method,
      modifications: rule.modifications || {},
      enabled: rule.enabled !== false,
      priority: rule.priority || 0,
      createdAt: Date.now()
    };

    this.modificationRules.push(newRule);
    // Sort by priority (higher first)
    this.modificationRules.sort((a, b) => b.priority - a.priority);
    
    this.emit('ruleAdded', newRule);
    return id;
  }

  /**
   * Remove a modification rule
   */
  removeModificationRule(id) {
    const index = this.modificationRules.findIndex(r => r.id === id);
    if (index !== -1) {
      const rule = this.modificationRules.splice(index, 1)[0];
      this.emit('ruleRemoved', rule);
      return true;
    }
    return false;
  }

  /**
   * Set filters for request capture
   */
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    this.emit('filtersChanged', this.filters);
  }

  /**
   * Check if a request should be captured based on filters
   */
  shouldCapture(data) {
    // Check URL patterns
    if (this.filters.urlPatterns?.length > 0) {
      const matches = this.filters.urlPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(data.url);
        } catch {
          return data.url.includes(pattern);
        }
      });
      if (!matches) return false;
    }

    // Check methods
    if (this.filters.methods?.length > 0) {
      if (!this.filters.methods.includes(data.method?.toUpperCase())) {
        return false;
      }
    }

    // Check domains
    if (this.filters.domains?.length > 0) {
      try {
        const url = new URL(data.url);
        const matches = this.filters.domains.some(domain => 
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
        );
        if (!matches) return false;
      } catch {
        // Invalid URL, skip domain filter
      }
    }

    // Check status codes (for responses)
    if (data.statusCode && this.filters.statusCodes?.length > 0) {
      if (!this.filters.statusCodes.includes(data.statusCode)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints() {
    this.breakpoints.clear();
    this.emit('breakpointsCleared');
  }

  /**
   * Clear all modification rules
   */
  clearRules() {
    this.modificationRules = [];
    this.emit('rulesCleared');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      breakpoints: this.breakpoints.size,
      pausedRequests: this.pausedRequests.size,
      modificationRules: this.modificationRules.length,
      totalHits: Array.from(this.breakpoints.values()).reduce(
        (sum, b) => sum + b.hitCount, 0
      )
    };
  }
}

module.exports = Interceptor;
