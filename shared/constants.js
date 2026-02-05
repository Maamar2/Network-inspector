/**
 * Shared constants for Network Inspector
 */

// HTTP Methods
const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  CONNECT: 'CONNECT',
  TRACE: 'TRACE'
};

// Content Types
const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  HTML: 'text/html',
  TEXT: 'text/plain',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  JAVASCRIPT: 'application/javascript',
  CSS: 'text/css'
};

// WebSocket Events
const WS_EVENTS = {
  // Client -> Server
  CLIENT: {
    START_RECORDING: 'start_recording',
    STOP_RECORDING: 'stop_recording',
    PAUSE_CAPTURE: 'pause_capture',
    RESUME_CAPTURE: 'resume_capture',
    APPLY_FILTER: 'apply_filter',
    SET_BREAKPOINT: 'set_breakpoint',
    REMOVE_BREAKPOINT: 'remove_breakpoint',
    MODIFY_REQUEST: 'modify_request',
    MODIFY_RESPONSE: 'modify_response',
    REPLAY_REQUEST: 'replay_request',
    RESUME_REQUEST: 'resume_request',
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    COMMAND: 'command'
  },
  // Server -> Client
  SERVER: {
    CONNECTED: 'connected',
    REQUEST_CAPTURED: 'request_captured',
    RESPONSE_RECEIVED: 'response_received',
    BREAKPOINT_HIT: 'breakpoint_hit',
    REQUEST_PAUSED: 'request_paused',
    SESSION_UPDATE: 'session_update',
    STATS_UPDATE: 'stats_update',
    PROXY_ERROR: 'proxy_error',
    DISCONNECTED: 'disconnected'
  }
};

// Breakpoint Actions
const BREAKPOINT_ACTIONS = {
  PAUSE: 'pause',
  MODIFY: 'modify',
  BLOCK: 'block'
};

// Network Throttling Profiles
const THROTTLING_PROFILES = {
  '3G': {
    downloadSpeed: 750 * 1024 / 8, // 750 Kbps
    uploadSpeed: 250 * 1024 / 8,   // 250 Kbps
    latency: 300
  },
  '4G': {
    downloadSpeed: 4 * 1024 * 1024 / 8, // 4 Mbps
    uploadSpeed: 3 * 1024 * 1024 / 8,   // 3 Mbps
    latency: 100
  },
  'SLOW_3G': {
    downloadSpeed: 400 * 1024 / 8,
    uploadSpeed: 150 * 1024 / 8,
    latency: 2000
  },
  OFFLINE: {
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0
  }
};

// Default Configuration
const DEFAULT_CONFIG = {
  proxy: {
    port: 8080,
    host: '0.0.0.0',
    silent: true,
    forceSNI: true
  },
  websocket: {
    port: 3001,
    path: '/socket.io'
  },
  server: {
    port: 3000,
    host: 'localhost'
  },
  dashboard: {
    port: 5173,
    host: 'localhost'
  },
  storage: {
    maxRequests: 10000,
    cleanupInterval: 3600000 // 1 hour
  }
};

// Status Code Categories
const STATUS_CATEGORIES = {
  SUCCESS: { min: 200, max: 299, label: 'Success', color: '#22c55e' },
  REDIRECT: { min: 300, max: 399, label: 'Redirect', color: '#eab308' },
  CLIENT_ERROR: { min: 400, max: 499, label: 'Client Error', color: '#ef4444' },
  SERVER_ERROR: { min: 500, max: 599, label: 'Server Error', color: '#dc2626' }
};

// Request Stages
const REQUEST_STAGES = {
  REQUEST: 'request',
  RESPONSE: 'response'
};

// Export based on environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HTTP_METHODS,
    CONTENT_TYPES,
    WS_EVENTS,
    BREAKPOINT_ACTIONS,
    THROTTLING_PROFILES,
    DEFAULT_CONFIG,
    STATUS_CATEGORIES,
    REQUEST_STAGES
  };
}
