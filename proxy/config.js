/**
 * Proxy Server Configuration
 */

const path = require('path');

const config = {
  // Proxy settings
  proxy: {
    port: process.env.PROXY_PORT || 8080,
    host: process.env.PROXY_HOST || '0.0.0.0',
    silent: true,
    forceSNI: true,
    httpsPort: process.env.HTTPS_PORT || 8081
  },

  // WebSocket server settings
  websocket: {
    port: process.env.WS_PORT || 3001,
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  },

  // SSL Certificate settings
  ssl: {
    certsDir: process.env.CERTS_DIR || path.join(__dirname, '../certs'),
    keySize: 2048,
    defaultValidityDays: 365,
    caName: 'Network Inspector CA'
  },

  // Storage settings
  storage: {
    dbPath: process.env.DB_PATH || path.join(__dirname, '../data/proxy.db'),
    maxRequests: parseInt(process.env.MAX_REQUESTS) || 10000,
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000, // 1 hour
    maxBodySize: parseInt(process.env.MAX_BODY_SIZE) || 10 * 1024 * 1024 // 10MB
  },

  // Throttling settings
  throttling: {
    enabled: process.env.THROTTLING_ENABLED === 'true',
    defaultProfile: process.env.THROTTLING_PROFILE || '4g'
  },

  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(__dirname, '../logs/proxy.log'),
    console: process.env.LOG_CONSOLE !== 'false'
  },

  // Interceptor settings
  interceptor: {
    maxPausedRequests: 100,
    pauseTimeout: 30000, // 30 seconds
    defaultFilters: {
      urlPatterns: [],
      methods: [],
      statusCodes: []
    }
  }
};

// Validate configuration
function validateConfig() {
  const required = [
    'proxy.port',
    'websocket.port',
    'ssl.certsDir',
    'storage.dbPath'
  ];

  for (const path of required) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config);
    if (value === undefined || value === null) {
      throw new Error(`Missing required configuration: ${path}`);
    }
  }

  return config;
}

module.exports = {
  config,
  validateConfig
};
