/**
 * Formatting utilities
 */

export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '-';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
  if (!ms || ms === 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

export function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function truncateUrl(url, maxLength = 60) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getMethodColor(method) {
  const colors = {
    GET: 'bg-blue-500/20 text-blue-400',
    POST: 'bg-green-500/20 text-green-400',
    PUT: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400',
    PATCH: 'bg-purple-500/20 text-purple-400',
    HEAD: 'bg-gray-500/20 text-gray-400',
    OPTIONS: 'bg-slate-500/20 text-slate-400'
  };
  return colors[method?.toUpperCase()] || 'bg-gray-500/20 text-gray-400';
}

export function getStatusColor(status) {
  if (!status || status === 0) return 'bg-gray-500/20 text-gray-400';
  if (status >= 200 && status < 300) return 'bg-green-500/20 text-green-400';
  if (status >= 300 && status < 400) return 'bg-yellow-500/20 text-yellow-400';
  if (status >= 400 && status < 500) return 'bg-red-500/20 text-red-400';
  if (status >= 500) return 'bg-red-600/20 text-red-500';
  return 'bg-gray-500/20 text-gray-400';
}

export function parseQueryString(url) {
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

export function formatJson(json, indent = 2) {
  try {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    return JSON.stringify(json, null, indent);
  } catch {
    return String(json);
  }
}

export function detectContentType(headers) {
  if (!headers) return 'unknown';
  const contentType = headers['content-type'] || headers['Content-Type'];
  if (!contentType) return 'unknown';
  
  if (contentType.includes('application/json')) return 'json';
  if (contentType.includes('application/xml')) return 'xml';
  if (contentType.includes('text/html')) return 'html';
  if (contentType.includes('text/plain')) return 'text';
  if (contentType.includes('application/x-www-form-urlencoded')) return 'form';
  if (contentType.includes('multipart/form-data')) return 'multipart';
  if (contentType.includes('image/')) return 'image';
  
  return 'unknown';
}

export function syntaxHighlight(json) {
  if (!json) return '';
  
  try {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }
    
    return json
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/(".*?")/g, '<span class="json-string">$1</span>')
      .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="json-number">$1</span>')
      .replace(/(".*?")\s*:/g, '<span class="json-key">$1</span>:');
  } catch {
    return escapeHtml(String(json));
  }
}
