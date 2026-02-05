/**
 * Request Store
 * Handles persistence of captured requests
 */

const { v4: uuidv4 } = require('uuid');

class RequestStore {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 10000;
    this.maxBodySize = options.maxBodySize || 10 * 1024 * 1024; // 10MB
    this.requests = new Map();
    this.sessions = new Map();
    this.currentSession = null;
  }

  /**
   * Initialize the store
   */
  async initialize() {
    console.log('[Store] Request store initialized');
    // Start a default session
    this.startSession('Default Session');
  }

  /**
   * Start a new capture session
   */
  startSession(name) {
    const session = {
      id: uuidv4(),
      name: name || `Session ${this.sessions.size + 1}`,
      startTime: Date.now(),
      endTime: null,
      requestIds: [],
      isRecording: true,
      metadata: {
        userAgent: null,
        platform: process.platform
      }
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    console.log(`[Store] Session started: ${session.name} (${session.id})`);
    return session;
  }

  /**
   * End the current session
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId || this.currentSession?.id);
    if (session) {
      session.endTime = Date.now();
      session.isRecording = false;
      console.log(`[Store] Session ended: ${session.name}`);
      return session;
    }
    return null;
  }

  /**
   * Store a request
   */
  async storeRequest(requestData) {
    const id = requestData.id || uuidv4();
    const timestamp = requestData.timestamp || Date.now();

    // Limit body size
    let requestBody = requestData.body;
    let requestBodySize = 0;
    if (requestBody) {
      const bodyStr = typeof requestBody === 'string' 
        ? requestBody 
        : JSON.stringify(requestBody);
      requestBodySize = Buffer.byteLength(bodyStr, 'utf8');
      if (requestBodySize > this.maxBodySize) {
        requestBody = `[Body too large: ${requestBodySize} bytes]`;
        requestBodySize = Buffer.byteLength(requestBody, 'utf8');
      }
    }

    const request = {
      id,
      sessionId: this.currentSession?.id,
      timestamp,
      method: requestData.method || 'GET',
      url: requestData.url,
      protocol: requestData.protocol || 'HTTP/1.1',
      httpVersion: requestData.httpVersion,
      headers: requestData.headers || {},
      queryParams: this.parseQueryParams(requestData.url),
      requestBody,
      requestBodySize,
      requestBodyType: this.detectContentType(requestData.headers),
      clientIp: requestData.clientIp,
      
      // Response fields (will be filled later)
      responseStatus: null,
      responseStatusText: null,
      responseHeaders: null,
      responseBody: null,
      responseBodySize: 0,
      responseBodyType: null,
      responseTime: null,
      
      // Timing fields
      timings: {
        start: timestamp,
        requestSent: timestamp,
        responseReceived: null,
        end: null
      },
      
      // Metadata
      tags: [],
      collectionId: null,
      folderId: null,
      notes: '',
      isComplete: false
    };

    // Store request
    this.requests.set(id, request);

    // Add to current session
    if (this.currentSession) {
      this.currentSession.requestIds.push(id);
    }

    // Cleanup old requests if limit exceeded
    if (this.requests.size > this.maxRequests) {
      this.cleanup();
    }

    return request;
  }

  /**
   * Update a request with response data
   */
  async updateRequest(id, responseData) {
    const request = this.requests.get(id);
    if (!request) {
      console.warn(`[Store] Request not found: ${id}`);
      return null;
    }

    const now = Date.now();

    // Limit response body size
    let responseBody = responseData.body;
    let responseBodySize = 0;
    if (responseBody) {
      const bodyStr = typeof responseBody === 'string' 
        ? responseBody 
        : JSON.stringify(responseBody);
      responseBodySize = Buffer.byteLength(bodyStr, 'utf8');
      if (responseBodySize > this.maxBodySize) {
        responseBody = `[Body too large: ${responseBodySize} bytes]`;
        responseBodySize = Buffer.byteLength(responseBody, 'utf8');
      }
    }

    // Update request with response data
    request.responseStatus = responseData.statusCode;
    request.responseStatusText = responseData.statusMessage;
    request.responseHeaders = responseData.headers || {};
    request.responseBody = responseBody;
    request.responseBodySize = responseBodySize;
    request.responseBodyType = this.detectContentType(responseData.headers);
    request.responseTime = now - request.timestamp;
    request.timings.responseReceived = now;
    request.timings.end = now;
    request.isComplete = true;

    return request;
  }

  /**
   * Get a request by ID
   */
  getRequest(id) {
    return this.requests.get(id);
  }

  /**
   * Get all requests
   */
  getAllRequests(options = {}) {
    let requests = Array.from(this.requests.values());

    // Filter by session
    if (options.sessionId) {
      requests = requests.filter(r => r.sessionId === options.sessionId);
    }

    // Filter by completeness
    if (options.completeOnly) {
      requests = requests.filter(r => r.isComplete);
    }

    // Apply limit
    if (options.limit) {
      requests = requests.slice(0, options.limit);
    }

    // Sort by timestamp (newest first by default)
    const sortDirection = options.sort === 'asc' ? 1 : -1;
    requests.sort((a, b) => sortDirection * (a.timestamp - b.timestamp));

    return requests;
  }

  /**
   * Get requests with filtering
   */
  getRequests(filter = {}) {
    let requests = Array.from(this.requests.values());

    // Apply filters
    if (filter.method) {
      requests = requests.filter(r => 
        r.method.toUpperCase() === filter.method.toUpperCase()
      );
    }

    if (filter.urlPattern) {
      try {
        const regex = new RegExp(filter.urlPattern, 'i');
        requests = requests.filter(r => regex.test(r.url));
      } catch {
        requests = requests.filter(r => r.url.includes(filter.urlPattern));
      }
    }

    if (filter.statusCode) {
      requests = requests.filter(r => r.responseStatus === filter.statusCode);
    }

    if (filter.statusRange) {
      const min = filter.statusRange.min;
      const max = filter.statusRange.max;
      requests = requests.filter(r => 
        r.responseStatus >= min && r.responseStatus <= max
      );
    }

    if (filter.startTime) {
      requests = requests.filter(r => r.timestamp >= filter.startTime);
    }

    if (filter.endTime) {
      requests = requests.filter(r => r.timestamp <= filter.endTime);
    }

    if (filter.hasResponse !== undefined) {
      requests = requests.filter(r => r.isComplete === filter.hasResponse);
    }

    // Sort
    const sortBy = filter.sortBy || 'timestamp';
    const sortDirection = filter.sortDirection === 'asc' ? 1 : -1;
    requests.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal === undefined || bVal === undefined) return 0;
      return sortDirection * (aVal > bVal ? 1 : -1);
    });

    // Pagination
    if (filter.limit) {
      const offset = filter.offset || 0;
      requests = requests.slice(offset, offset + filter.limit);
    }

    return requests;
  }

  /**
   * Delete a request
   */
  deleteRequest(id) {
    const deleted = this.requests.delete(id);
    if (deleted) {
      // Remove from session
      for (const session of this.sessions.values()) {
        const index = session.requestIds.indexOf(id);
        if (index !== -1) {
          session.requestIds.splice(index, 1);
        }
      }
    }
    return deleted;
  }

  /**
   * Delete multiple requests
   */
  deleteRequests(ids) {
    let deleted = 0;
    for (const id of ids) {
      if (this.deleteRequest(id)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Clear all requests
   */
  clearRequests() {
    const count = this.requests.size;
    this.requests.clear();
    
    // Clear session request IDs
    for (const session of this.sessions.values()) {
      session.requestIds = [];
    }
    
    console.log(`[Store] Cleared ${count} requests`);
    return count;
  }

  /**
   * Get a session by ID
   */
  getSession(id) {
    const session = this.sessions.get(id);
    if (session) {
      // Populate requests
      return {
        ...session,
        requests: session.requestIds.map(id => this.requests.get(id)).filter(Boolean)
      };
    }
    return null;
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      ...session,
      requestCount: session.requestIds.length
    }));
  }

  /**
   * Delete a session
   */
  deleteSession(id) {
    const session = this.sessions.get(id);
    if (session) {
      // Delete associated requests
      for (const requestId of session.requestIds) {
        this.requests.delete(requestId);
      }
      this.sessions.delete(id);
      
      if (this.currentSession?.id === id) {
        this.currentSession = null;
      }
      
      return true;
    }
    return false;
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get statistics
   */
  getStats() {
    const requests = Array.from(this.requests.values());
    const completeRequests = requests.filter(r => r.isComplete);

    // Calculate response time stats
    const responseTimes = completeRequests
      .map(r => r.responseTime)
      .filter(t => t !== null);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Status code distribution
    const statusCodes = {};
    for (const r of completeRequests) {
      const code = r.responseStatus;
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    }

    // Method distribution
    const methods = {};
    for (const r of requests) {
      const method = r.method;
      methods[method] = (methods[method] || 0) + 1;
    }

    // Total data transferred
    const totalRequestSize = requests.reduce((sum, r) => sum + r.requestBodySize, 0);
    const totalResponseSize = completeRequests.reduce((sum, r) => sum + r.responseBodySize, 0);

    return {
      totalRequests: requests.length,
      completeRequests: completeRequests.length,
      pendingRequests: requests.length - completeRequests.length,
      sessions: this.sessions.size,
      avgResponseTime: Math.round(avgResponseTime),
      statusCodes,
      methods,
      totalRequestSize,
      totalResponseSize,
      totalDataTransferred: totalRequestSize + totalResponseSize
    };
  }

  /**
   * Parse query parameters from URL
   */
  parseQueryParams(url) {
    try {
      const urlObj = new URL(url);
      const params = {};
      for (const [key, value] of urlObj.searchParams) {
        params[key] = value;
      }
      return params;
    } catch {
      return {};
    }
  }

  /**
   * Detect content type from headers
   */
  detectContentType(headers) {
    if (!headers) return 'unknown';
    
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (!contentType) return 'unknown';

    if (contentType.includes('application/json')) return 'json';
    if (contentType.includes('application/xml')) return 'xml';
    if (contentType.includes('text/html')) return 'html';
    if (contentType.includes('text/plain')) return 'text';
    if (contentType.includes('application/x-www-form-urlencoded')) return 'form';
    if (contentType.includes('multipart/form-data')) return 'multipart';
    if (contentType.includes('application/javascript')) return 'javascript';
    if (contentType.includes('text/css')) return 'css';
    if (contentType.includes('image/')) return 'image';

    return 'unknown';
  }

  /**
   * Cleanup old requests
   */
  cleanup() {
    const toDelete = this.requests.size - this.maxRequests;
    if (toDelete <= 0) return 0;

    // Get oldest requests
    const sorted = Array.from(this.requests.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    let deleted = 0;
    for (let i = 0; i < toDelete && i < sorted.length; i++) {
      if (this.deleteRequest(sorted[i].id)) {
        deleted++;
      }
    }

    console.log(`[Store] Cleaned up ${deleted} old requests`);
    return deleted;
  }

  /**
   * Export requests to HAR format
   */
  exportToHar(requestIds) {
    const requests = requestIds 
      ? requestIds.map(id => this.requests.get(id)).filter(Boolean)
      : Array.from(this.requests.values());

    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Network Inspector',
          version: '1.0.0'
        },
        entries: requests.map(r => this.toHarEntry(r))
      }
    };

    return har;
  }

  /**
   * Convert request to HAR entry
   */
  toHarEntry(request) {
    return {
      startedDateTime: new Date(request.timestamp).toISOString(),
      time: request.responseTime || 0,
      request: {
        method: request.method,
        url: request.url,
        httpVersion: request.httpVersion || 'HTTP/1.1',
        headers: this.objectToHeaders(request.headers),
        queryString: this.objectToQueryString(request.queryParams),
        headersSize: -1,
        bodySize: request.requestBodySize,
        postData: request.requestBody ? {
          mimeType: request.requestBodyType || 'text/plain',
          text: request.requestBody
        } : undefined
      },
      response: request.isComplete ? {
        status: request.responseStatus,
        statusText: request.responseStatusText || '',
        httpVersion: request.httpVersion || 'HTTP/1.1',
        headers: this.objectToHeaders(request.responseHeaders || {}),
        content: {
          size: request.responseBodySize,
          mimeType: request.responseBodyType || 'text/plain',
          text: request.responseBody
        },
        headersSize: -1,
        bodySize: request.responseBodySize
      } : undefined,
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: request.responseTime || 0,
        receive: 0,
        ssl: -1
      }
    };
  }

  /**
   * Convert object to HAR headers format
   */
  objectToHeaders(obj) {
    return Object.entries(obj).map(([name, value]) => ({
      name,
      value: String(value)
    }));
  }

  /**
   * Convert object to HAR query string format
   */
  objectToQueryString(obj) {
    return Object.entries(obj).map(([name, value]) => ({
      name,
      value: String(value)
    }));
  }
}

module.exports = RequestStore;
