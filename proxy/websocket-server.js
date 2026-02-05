/**
 * WebSocket Server
 * Handles real-time communication with dashboard and extension
 */

const { Server } = require('socket.io');
const http = require('http');
const { config } = require('./config');

class WebSocketServer {
  constructor(options = {}) {
    this.port = options.port || config.websocket.port;
    this.httpServer = null;
    this.io = null;
    this.clients = new Map();
    this.commandHandlers = new Map();
  }

  /**
   * Start the WebSocket server
   */
  async start() {
    this.httpServer = http.createServer();
    this.io = new Server(this.httpServer, {
      cors: config.websocket.cors,
      path: config.websocket.path,
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[WebSocket] Server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket) {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    const client = {
      id: socket.id,
      socket,
      connectedAt: Date.now(),
      subscriptions: new Set(),
      clientType: null, // 'dashboard', 'extension', 'unknown'
      userAgent: socket.handshake.headers['user-agent']
    };

    this.clients.set(socket.id, client);

    // Send initial connection data
    socket.emit('connected', {
      clientId: socket.id,
      timestamp: Date.now(),
      serverVersion: '1.0.0'
    });

    // Handle client identification
    socket.on('identify', (data) => {
      client.clientType = data.clientType || 'unknown';
      console.log(`[WebSocket] Client ${socket.id} identified as: ${client.clientType}`);
    });

    // Handle subscriptions
    socket.on('subscribe', (channel) => {
      client.subscriptions.add(channel);
      socket.join(channel);
      console.log(`[WebSocket] Client ${socket.id} subscribed to: ${channel}`);
    });

    socket.on('unsubscribe', (channel) => {
      client.subscriptions.delete(channel);
      socket.leave(channel);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from: ${channel}`);
    });

    // Handle commands
    socket.on('command', (data) => {
      this.handleCommand(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
      this.clients.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });
  }

  /**
   * Handle client commands
   */
  handleCommand(socket, data) {
    const { type, payload, requestId } = data;
    console.log(`[WebSocket] Command received from ${socket.id}: ${type}`);

    const handler = this.commandHandlers.get(type);
    if (handler) {
      try {
        const result = handler(payload, socket);
        
        // If handler returns a promise, wait for it
        if (result && typeof result.then === 'function') {
          result
            .then((response) => {
              socket.emit('commandResponse', {
                requestId,
                type,
                success: true,
                data: response
              });
            })
            .catch((error) => {
              socket.emit('commandResponse', {
                requestId,
                type,
                success: false,
                error: error.message
              });
            });
        } else {
          socket.emit('commandResponse', {
            requestId,
            type,
            success: true,
            data: result
          });
        }
      } catch (error) {
        console.error(`[WebSocket] Command error: ${type}`, error);
        socket.emit('commandResponse', {
          requestId,
          type,
          success: false,
          error: error.message
        });
      }
    } else {
      console.warn(`[WebSocket] Unknown command type: ${type}`);
      socket.emit('commandResponse', {
        requestId,
        type,
        success: false,
        error: `Unknown command: ${type}`
      });
    }
  }

  /**
   * Register a command handler
   */
  onCommand(commandType, handler) {
    this.commandHandlers.set(commandType, handler);
  }

  /**
   * Remove a command handler
   */
  offCommand(commandType) {
    this.commandHandlers.delete(commandType);
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event, data, options = {}) {
    if (!this.io) return;

    if (options.channel) {
      this.io.to(options.channel).emit(event, data);
    } else {
      this.io.emit(event, data);
    }
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Send event to clients by type
   */
  sendToClientType(clientType, event, data) {
    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.clientType === clientType) {
        client.socket.emit(event, data);
        sent++;
      }
    }
    return sent;
  }

  /**
   * Get all connected clients
   */
  getClients() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      clientType: client.clientType,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      userAgent: client.userAgent
    }));
  }

  /**
   * Get client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get clients by type
   */
  getClientsByType(clientType) {
    return Array.from(this.clients.values())
      .filter(c => c.clientType === clientType)
      .map(c => ({
        id: c.id,
        connectedAt: c.connectedAt,
        subscriptions: Array.from(c.subscriptions)
      }));
  }

  /**
   * Check if any dashboard clients are connected
   */
  hasDashboardClients() {
    for (const client of this.clients.values()) {
      if (client.clientType === 'dashboard') {
        return true;
      }
    }
    return false;
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    if (this.io) {
      // Disconnect all clients
      for (const client of this.clients.values()) {
        client.socket.disconnect(true);
      }
      this.clients.clear();

      // Close server
      await new Promise((resolve) => {
        this.io.close(() => {
          console.log('[WebSocket] Server closed');
          resolve();
        });
      });
    }

    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    }
  }

  /**
   * Emit request captured event
   */
  emitRequestCaptured(requestData) {
    this.broadcast('request_captured', requestData);
  }

  /**
   * Emit response received event
   */
  emitResponseReceived(responseData) {
    this.broadcast('response_received', responseData);
  }

  /**
   * Emit breakpoint hit event
   */
  emitBreakpointHit(data) {
    this.broadcast('breakpoint_hit', data);
  }

  /**
   * Emit request paused event
   */
  emitRequestPaused(data) {
    this.broadcast('request_paused', data);
  }

  /**
   * Emit stats update event
   */
  emitStatsUpdate(stats) {
    this.broadcast('stats_update', stats, { channel: 'stats' });
  }

  /**
   * Emit session update event
   */
  emitSessionUpdate(sessionData) {
    this.broadcast('session_update', sessionData);
  }

  /**
   * Emit proxy error event
   */
  emitProxyError(error) {
    this.broadcast('proxy_error', {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }
}

module.exports = WebSocketServer;
