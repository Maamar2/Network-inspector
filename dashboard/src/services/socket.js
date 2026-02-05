import { io } from 'socket.io-client';
import useRequestStore from '../store/useRequestStore';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    this.listeners = new Map();
  }

  connect(url = 'ws://localhost:3001') {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    console.log('[Socket] Connecting to', url);

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      useRequestStore.getState().setConnected(true);

      // Identify as dashboard
      this.socket.emit('identify', { clientType: 'dashboard' });

      // Subscribe to channels
      this.socket.emit('subscribe', 'requests');
      this.socket.emit('subscribe', 'stats');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.isConnected = false;
      useRequestStore.getState().setConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
    });

    // Handle incoming events
    this.socket.on('request_captured', (data) => {
      useRequestStore.getState().addRequest(data);
    });

    this.socket.on('response_received', (data) => {
      useRequestStore.getState().updateRequest(data.requestId, data);
    });

    this.socket.on('stats_update', (stats) => {
      useRequestStore.getState().setStats(stats);
    });

    this.socket.on('breakpoint_hit', (data) => {
      this.emit('breakpointHit', data);
    });

    this.socket.on('request_paused', (data) => {
      this.emit('requestPaused', data);
    });

    this.socket.on('proxy_error', (error) => {
      console.error('[Socket] Proxy error:', error);
    });

    return this;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event).delete(callback);
    };
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Send command to server
  sendCommand(type, payload) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);

      const handleResponse = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          this.socket.off('commandResponse', handleResponse);
          
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Command failed'));
          }
        }
      };

      this.socket.on('commandResponse', handleResponse);
      this.socket.emit('command', { type, payload, requestId });
    });
  }

  // Convenience methods for common commands
  async getRequests(filter = {}) {
    return this.sendCommand('get_requests', filter);
  }

  async getRequest(id) {
    return this.sendCommand('get_request', { id });
  }

  async clearRequests() {
    return this.sendCommand('clear_requests', {});
  }

  async deleteRequest(id) {
    return this.sendCommand('delete_request', { id });
  }

  async setBreakpoint(rule) {
    return this.sendCommand('set_breakpoint', rule);
  }

  async removeBreakpoint(id) {
    return this.sendCommand('remove_breakpoint', { id });
  }

  async getBreakpoints() {
    return this.sendCommand('get_breakpoints', {});
  }

  async resumeRequest(pauseId, action) {
    return this.sendCommand('resume_request', { pauseId, action });
  }

  async getStats() {
    return this.sendCommand('get_stats', {});
  }

  async setThrottle(profile) {
    return this.sendCommand('set_throttle', { profile });
  }

  async exportHar(requestIds) {
    return this.sendCommand('export_har', { requestIds });
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
