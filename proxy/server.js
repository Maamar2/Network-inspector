/**
 * Network Inspector - MITM Proxy Server
 * Main entry point for the proxy server
 */

const Proxy = require('http-mitm-proxy');
const CertificateManager = require('./ssl/certificate-manager');
const Interceptor = require('./interceptor');
const WebSocketServer = require('./websocket-server');
const RequestStore = require('./request-store');
const ThrottleEngine = require('./throttle');
const { config } = require('./config');

class MitmProxyServer {
  constructor(options = {}) {
    this.port = options.port || config.proxy.port;
    this.host = options.host || config.proxy.host;
    this.httpsPort = options.httpsPort || config.proxy.httpsPort;
    
    this.proxy = new Proxy();
    this.certManager = new CertificateManager();
    this.interceptor = new Interceptor(config.interceptor);
    this.wsServer = new WebSocketServer();
    this.requestStore = new RequestStore(config.storage);
    this.throttle = new ThrottleEngine();
    
    this.isRunning = false;
    this.requestBodyBuffers = new Map();
    this.responseBodyBuffers = new Map();
  }

  /**
   * Start the proxy server
   */
  async start() {
    try {
      console.log('[Proxy] Starting Network Inspector Proxy Server...');

      // Initialize certificate authority
      await this.certManager.initialize();

      // Initialize request store
      await this.requestStore.initialize();

      // Start WebSocket server
      await this.wsServer.start();
      this.setupWebSocketHandlers();

      // Configure proxy
      this.setupProxy();

      // Start proxy server
      this.proxy.listen({
        port: this.port,
        host: this.host,
        silent: config.proxy.silent,
        forceSNI: config.proxy.forceSNI
      });

      this.isRunning = true;

      console.log(`[Proxy] HTTP Proxy running on ${this.host}:${this.port}`);
      console.log(`[Proxy] HTTPS Proxy will use dynamically generated certificates`);
      console.log(`[Proxy] CA Certificate: ${this.certManager.caCertPath}`);
      console.log('[Proxy] Configure your browser to use this proxy');
      console.log('[Proxy] Import the CA certificate to trust HTTPS connections');

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      return true;
    } catch (error) {
      console.error('[Proxy] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Setup proxy event handlers
   */
  setupProxy() {
    // Handle proxy errors
    this.proxy.onError((ctx, err, errorKind) => {
      const url = ctx?.clientToProxyRequest?.url || 'unknown';
      console.error(`[Proxy] Error [${errorKind}] for ${url}:`, err.message);
      
      this.wsServer.emitProxyError({
        message: err.message,
        url,
        kind: errorKind
      });
    });

    // Handle CONNECT requests (HTTPS)
    this.proxy.onConnect((req, socket, head, callback) => {
      console.log(`[Proxy] CONNECT ${req.url}`);
      callback();
    });

    // Handle request
    this.proxy.onRequest((ctx, callback) => {
      this.handleRequest(ctx, callback);
    });

    // Handle response
    this.proxy.onResponse((ctx, callback) => {
      this.handleResponse(ctx, callback);
    });

    // Handle WebSocket connections
    this.proxy.onWebSocketConnection((ctx, callback) => {
      console.log(`[Proxy] WebSocket connection: ${ctx.clientToProxyWebSocket.url}`);
      callback();
    });

    // Handle WebSocket frame
    this.proxy.onWebSocketFrame((ctx, type, fromServer, data, flags, callback) => {
      // Log WebSocket traffic if needed
      callback();
    });
  }

  /**
   * Handle incoming request
   */
  async handleRequest(ctx, callback) {
    const startTime = Date.now();
    const requestId = generateId();
    
    try {
      const clientReq = ctx.clientToProxyRequest;
      const serverReq = ctx.proxyToServerRequestOptions;

      // Extract request data
      const requestData = {
        id: requestId,
        timestamp: startTime,
        method: clientReq.method,
        url: `${ctx.isSSL ? 'https' : 'http'}://${clientReq.headers.host}${clientReq.url}`,
        protocol: ctx.isSSL ? 'HTTPS' : 'HTTP',
        httpVersion: clientReq.httpVersion,
        headers: { ...clientReq.headers },
        clientIp: clientReq.connection?.remoteAddress,
        body: null
      };

      // Check filters
      if (!this.interceptor.shouldCapture(requestData)) {
        return callback();
      }

      // Capture request body
      let requestBody = '';
      ctx.onRequestData((ctx, chunk, callback) => {
        requestBody += chunk.toString();
        callback();
      });

      ctx.onRequestEnd((ctx, callback) => {
        requestData.body = requestBody;
        this.processRequest(ctx, requestData, callback);
      });

      callback();
    } catch (error) {
      console.error('[Proxy] Error handling request:', error);
      callback();
    }
  }

  /**
   * Process captured request
   */
  async processRequest(ctx, requestData, callback) {
    try {
      // Check for breakpoints
      const breakpoint = await this.interceptor.checkBreakpoint(requestData, 'request');

      if (breakpoint) {
        if (breakpoint.action === 'block') {
          // Send error response
          ctx.proxyToClientResponse.writeHead(403, { 'Content-Type': 'text/plain' });
          ctx.proxyToClientResponse.end('Request blocked by breakpoint');
          return callback();
        } else if (breakpoint.action === 'modify') {
          // Apply modifications
          const modified = this.interceptor.applyModifications(
            requestData, 
            breakpoint.modifications
          );
          Object.assign(requestData, modified);
        }
      }

      // Apply request modifications
      const modifiedRequest = await this.interceptor.modifyRequest(requestData);

      // Apply modifications to actual request
      if (modifiedRequest.headers) {
        ctx.proxyToServerRequestOptions.headers = modifiedRequest.headers;
      }
      if (modifiedRequest.url) {
        const url = new URL(modifiedRequest.url);
        ctx.proxyToServerRequestOptions.path = url.pathname + url.search;
      }

      // Store request
      const storedRequest = await this.requestStore.storeRequest(modifiedRequest);

      // Associate request ID with context
      ctx.requestId = storedRequest.id;

      // Broadcast to clients
      this.wsServer.emitRequestCaptured({
        id: storedRequest.id,
        timestamp: storedRequest.timestamp,
        method: storedRequest.method,
        url: storedRequest.url,
        headers: storedRequest.headers,
        body: storedRequest.body?.substring(0, 1000), // Limit body in broadcast
        sessionId: storedRequest.sessionId
      });

      // Apply throttling latency
      await this.throttle.applyLatency();

      callback();
    } catch (error) {
      console.error('[Proxy] Error processing request:', error);
      callback();
    }
  }

  /**
   * Handle incoming response
   */
  async handleResponse(ctx, callback) {
    const requestId = ctx.requestId;
    
    if (!requestId) {
      return callback();
    }

    try {
      const serverRes = ctx.serverToProxyResponse;
      const clientRes = ctx.proxyToClientResponse;

      // Capture response body
      let responseBody = '';
      const chunks = [];

      ctx.onResponseData((ctx, chunk, callback) => {
        chunks.push(chunk);
        callback();
      });

      ctx.onResponseEnd(async (ctx, callback) => {
        try {
          // Combine chunks
          const buffer = Buffer.concat(chunks);
          
          // Try to decode as text
          const contentType = serverRes.headers['content-type'] || '';
          if (contentType.includes('text') || 
              contentType.includes('json') || 
              contentType.includes('xml') ||
              contentType.includes('javascript')) {
            responseBody = buffer.toString('utf8');
          } else {
            // Store as base64 for binary data
            responseBody = buffer.toString('base64');
          }

          const responseData = {
            requestId,
            statusCode: serverRes.statusCode,
            statusMessage: serverRes.statusMessage,
            headers: { ...serverRes.headers },
            body: responseBody,
            httpVersion: serverRes.httpVersion
          };

          await this.processResponse(ctx, responseData, callback);
        } catch (error) {
          console.error('[Proxy] Error processing response end:', error);
          callback();
        }
      });

      callback();
    } catch (error) {
      console.error('[Proxy] Error handling response:', error);
      callback();
    }
  }

  /**
   * Process captured response
   */
  async processResponse(ctx, responseData, callback) {
    try {
      // Check for response breakpoints
      const breakpoint = await this.interceptor.checkBreakpoint(responseData, 'response');

      if (breakpoint) {
        if (breakpoint.action === 'block') {
          // Modify response to error
          responseData.statusCode = 403;
          responseData.statusMessage = 'Blocked';
          responseData.body = 'Response blocked by breakpoint';
        } else if (breakpoint.action === 'modify') {
          // Apply modifications
          const modified = this.interceptor.applyModifications(
            responseData,
            breakpoint.modifications
          );
          Object.assign(responseData, modified);
        }
      }

      // Apply response modifications
      const modifiedResponse = await this.interceptor.modifyResponse(responseData);

      // Update stored request with response
      const updatedRequest = await this.requestStore.updateRequest(
        responseData.requestId,
        modifiedResponse
      );

      if (updatedRequest) {
        // Broadcast to clients
        this.wsServer.emitResponseReceived({
          requestId: responseData.requestId,
          statusCode: modifiedResponse.statusCode,
          statusMessage: modifiedResponse.statusMessage,
          headers: modifiedResponse.headers,
          body: modifiedResponse.body?.substring(0, 1000), // Limit body in broadcast
          responseTime: updatedRequest.responseTime
        });

        // Update stats
        this.broadcastStats();
      }

      callback();
    } catch (error) {
      console.error('[Proxy] Error processing response:', error);
      callback();
    }
  }

  /**
   * Setup WebSocket command handlers
   */
  setupWebSocketHandlers() {
    // Resume paused request
    this.wsServer.onCommand('resume_request', (payload) => {
      const { pauseId, action } = payload;
      return this.interceptor.resumeRequest(pauseId, action);
    });

    // Set breakpoint
    this.wsServer.onCommand('set_breakpoint', (payload) => {
      return this.interceptor.setBreakpoint(payload);
    });

    // Remove breakpoint
    this.wsServer.onCommand('remove_breakpoint', (payload) => {
      return this.interceptor.removeBreakpoint(payload.id);
    });

    // Get breakpoints
    this.wsServer.onCommand('get_breakpoints', () => {
      return this.interceptor.getBreakpoints();
    });

    // Get paused requests
    this.wsServer.onCommand('get_paused_requests', () => {
      return this.interceptor.getPausedRequests();
    });

    // Set filter
    this.wsServer.onCommand('set_filter', (payload) => {
      this.interceptor.setFilters(payload);
      return { success: true };
    });

    // Get requests
    this.wsServer.onCommand('get_requests', (payload) => {
      return this.requestStore.getRequests(payload);
    });

    // Get request by ID
    this.wsServer.onCommand('get_request', (payload) => {
      return this.requestStore.getRequest(payload.id);
    });

    // Delete request
    this.wsServer.onCommand('delete_request', (payload) => {
      return this.requestStore.deleteRequest(payload.id);
    });

    // Clear requests
    this.wsServer.onCommand('clear_requests', () => {
      return this.requestStore.clearRequests();
    });

    // Get stats
    this.wsServer.onCommand('get_stats', () => {
      return this.requestStore.getStats();
    });

    // Set throttling profile
    this.wsServer.onCommand('set_throttle', (payload) => {
      if (payload.profile) {
        this.throttle.setProfile(payload.profile);
      } else if (payload.custom) {
        this.throttle.setCustomSettings(payload.custom);
      } else {
        this.throttle.disable();
      }
      return this.throttle.getStats();
    });

    // Get throttling stats
    this.wsServer.onCommand('get_throttle', () => {
      return this.throttle.getStats();
    });

    // Start new session
    this.wsServer.onCommand('start_session', (payload) => {
      const session = this.requestStore.startSession(payload.name);
      return session;
    });

    // End session
    this.wsServer.onCommand('end_session', (payload) => {
      return this.requestStore.endSession(payload.id);
    });

    // Get sessions
    this.wsServer.onCommand('get_sessions', () => {
      return this.requestStore.getAllSessions();
    });

    // Export to HAR
    this.wsServer.onCommand('export_har', (payload) => {
      return this.requestStore.exportToHar(payload?.requestIds);
    });

    // Handle interceptor events
    this.interceptor.on('requestPaused', (data) => {
      this.wsServer.emitRequestPaused(data);
    });

    this.interceptor.on('breakpointAdded', (data) => {
      this.wsServer.broadcast('breakpoint_added', data);
    });

    this.interceptor.on('breakpointRemoved', (data) => {
      this.wsServer.broadcast('breakpoint_removed', data);
    });
  }

  /**
   * Broadcast current stats to all clients
   */
  broadcastStats() {
    const stats = this.requestStore.getStats();
    this.wsServer.emitStatsUpdate(stats);
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      console.log(`\n[Proxy] Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
      console.error('[Proxy] Uncaught exception:', err);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Proxy] Unhandled rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Stop the proxy server
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('[Proxy] Stopping server...');

    // Stop WebSocket server
    await this.wsServer.stop();

    // Stop proxy
    this.proxy.close();

    this.isRunning = false;
    console.log('[Proxy] Server stopped');
  }

  /**
   * Get proxy status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      host: this.host,
      clients: this.wsServer.getClientCount(),
      requests: this.requestStore.requests.size,
      sessions: this.requestStore.sessions.size,
      breakpoints: this.interceptor.breakpoints.size,
      throttling: this.throttle.getStats()
    };
  }
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Start server if run directly
if (require.main === module) {
  const server = new MitmProxyServer();
  
  server.start().catch((error) => {
    console.error('[Proxy] Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = MitmProxyServer;
