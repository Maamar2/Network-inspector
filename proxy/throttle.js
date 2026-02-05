/**
 * Network Throttling Engine
 * Simulates various network conditions (3G, 4G, slow connections)
 */

const { Transform, PassThrough } = require('stream');

class ThrottleEngine {
  constructor() {
    this.profiles = {
      '3g': {
        downloadSpeed: 750 * 1024 / 8, // 750 Kbps
        uploadSpeed: 250 * 1024 / 8,   // 250 Kbps
        latency: 300
      },
      '4g': {
        downloadSpeed: 4 * 1024 * 1024 / 8, // 4 Mbps
        uploadSpeed: 3 * 1024 * 1024 / 8,   // 3 Mbps
        latency: 100
      },
      'slow-3g': {
        downloadSpeed: 400 * 1024 / 8,
        uploadSpeed: 150 * 1024 / 8,
        latency: 2000
      },
      'offline': {
        downloadSpeed: 0,
        uploadSpeed: 0,
        latency: 0
      }
    };

    this.activeProfile = null;
    this.customSettings = null;
    this.enabled = false;
  }

  /**
   * Enable throttling with a predefined profile
   */
  setProfile(profileName) {
    if (this.profiles[profileName]) {
      this.activeProfile = this.profiles[profileName];
      this.customSettings = null;
      this.enabled = true;
      console.log(`[Throttle] Enabled profile: ${profileName}`);
      return true;
    }
    console.warn(`[Throttle] Unknown profile: ${profileName}`);
    return false;
  }

  /**
   * Enable throttling with custom settings
   */
  setCustomSettings(settings) {
    this.customSettings = {
      downloadSpeed: settings.downloadSpeed || Infinity,
      uploadSpeed: settings.uploadSpeed || Infinity,
      latency: settings.latency || 0
    };
    this.activeProfile = null;
    this.enabled = true;
    console.log('[Throttle] Enabled custom settings:', this.customSettings);
  }

  /**
   * Disable throttling
   */
  disable() {
    this.enabled = false;
    this.activeProfile = null;
    this.customSettings = null;
    console.log('[Throttle] Disabled');
  }

  /**
   * Check if throttling is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get current settings
   */
  getCurrentSettings() {
    if (!this.enabled) {
      return {
        downloadSpeed: Infinity,
        uploadSpeed: Infinity,
        latency: 0
      };
    }
    return this.customSettings || this.activeProfile || {
      downloadSpeed: Infinity,
      uploadSpeed: Infinity,
      latency: 0
    };
  }

  /**
   * Get active profile name
   */
  getActiveProfile() {
    if (this.activeProfile) {
      return Object.keys(this.profiles).find(
        key => this.profiles[key] === this.activeProfile
      );
    }
    return this.customSettings ? 'custom' : null;
  }

  /**
   * Get available profiles
   */
  getProfiles() {
    return Object.keys(this.profiles).map(key => ({
      name: key,
      ...this.profiles[key]
    }));
  }

  /**
   * Apply latency delay
   */
  async applyLatency() {
    const settings = this.getCurrentSettings();
    if (settings.latency > 0) {
      await sleep(settings.latency);
    }
  }

  /**
   * Create a throttled stream
   */
  createStream(direction) {
    if (!this.enabled) {
      return new PassThrough();
    }

    const settings = this.getCurrentSettings();
    const speed = direction === 'download' 
      ? settings.downloadSpeed 
      : settings.uploadSpeed;

    if (speed === Infinity || speed === 0) {
      return new PassThrough();
    }

    return new ThrottleStream(speed);
  }

  /**
   * Create a download stream (client to proxy to server)
   */
  createDownloadStream() {
    return this.createStream('download');
  }

  /**
   * Create an upload stream (server to proxy to client)
   */
  createUploadStream() {
    return this.createStream('upload');
  }

  /**
   * Get stats about current throttling
   */
  getStats() {
    const settings = this.getCurrentSettings();
    return {
      enabled: this.enabled,
      profile: this.getActiveProfile(),
      downloadSpeed: settings.downloadSpeed,
      uploadSpeed: settings.uploadSpeed,
      latency: settings.latency
    };
  }
}

/**
 * Throttled Transform Stream
 */
class ThrottleStream extends Transform {
  constructor(bytesPerSecond) {
    super();
    this.bytesPerSecond = bytesPerSecond;
    this.chunkSize = Math.max(1, Math.floor(bytesPerSecond / 10));
    this.interval = 100; // 100ms chunks
    this.buffer = Buffer.alloc(0);
    this.processing = false;
    this.totalBytes = 0;
    this.startTime = Date.now();
  }

  _transform(chunk, encoding, callback) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.totalBytes += chunk.length;

    if (!this.processing) {
      this.processBuffer();
    }

    callback();
  }

  async processBuffer() {
    this.processing = true;

    while (this.buffer.length > 0) {
      const toSend = Math.min(this.buffer.length, this.chunkSize);
      const chunk = this.buffer.slice(0, toSend);
      this.buffer = this.buffer.slice(toSend);

      this.push(chunk);

      if (this.buffer.length > 0) {
        await sleep(this.interval);
      }
    }

    this.processing = false;
  }

  _flush(callback) {
    // Send any remaining data
    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }
    callback();
  }

  getStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      totalBytes: this.totalBytes,
      elapsedSeconds: elapsed,
      averageSpeed: elapsed > 0 ? this.totalBytes / elapsed : 0
    };
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = ThrottleEngine;
