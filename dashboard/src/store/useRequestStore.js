import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useRequestStore = create(
  immer((set, get) => ({
    // State
    requests: [],
    selectedRequestId: null,
    isCapturing: true,
    isConnected: false,
    filters: {
      search: '',
      method: '',
      status: '',
      urlPattern: '',
      domain: ''
    },
    sortConfig: {
      key: 'timestamp',
      direction: 'desc'
    },
    stats: {
      totalRequests: 0,
      completeRequests: 0,
      avgResponseTime: 0
    },

    // Actions
    addRequest: (request) =>
      set((state) => {
        if (state.isCapturing) {
          state.requests.unshift(request);
          // Keep only last 10000 requests
          if (state.requests.length > 10000) {
            state.requests.pop();
          }
          state.stats.totalRequests = state.requests.length;
        }
      }),

    updateRequest: (id, updates) =>
      set((state) => {
        const index = state.requests.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.requests[index] = { ...state.requests[index], ...updates };
          if (updates.responseStatus) {
            state.stats.completeRequests++;
          }
        }
      }),

    setRequests: (requests) =>
      set((state) => {
        state.requests = requests;
        state.stats.totalRequests = requests.length;
      }),

    clearRequests: () =>
      set((state) => {
        state.requests = [];
        state.selectedRequestId = null;
        state.stats = {
          totalRequests: 0,
          completeRequests: 0,
          avgResponseTime: 0
        };
      }),

    selectRequest: (id) =>
      set((state) => {
        state.selectedRequestId = id;
      }),

    setCapturing: (isCapturing) =>
      set((state) => {
        state.isCapturing = isCapturing;
      }),

    setConnected: (isConnected) =>
      set((state) => {
        state.isConnected = isConnected;
      }),

    setFilters: (filters) =>
      set((state) => {
        state.filters = { ...state.filters, ...filters };
      }),

    setSortConfig: (config) =>
      set((state) => {
        state.sortConfig = config;
      }),

    setStats: (stats) =>
      set((state) => {
        state.stats = { ...state.stats, ...stats };
      }),

    // Getters
    getSelectedRequest: () => {
      const { requests, selectedRequestId } = get();
      return requests.find((r) => r.id === selectedRequestId);
    },

    getFilteredRequests: () => {
      const { requests, filters, sortConfig } = get();

      let filtered = [...requests];

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.url?.toLowerCase().includes(search) ||
            r.method?.toLowerCase().includes(search) ||
            String(r.status)?.includes(search)
        );
      }

      // Method filter
      if (filters.method) {
        filtered = filtered.filter((r) => r.method === filters.method);
      }

      // Status filter
      if (filters.status) {
        const statusRange = filters.status;
        filtered = filtered.filter((r) => {
          const status = r.status || r.responseStatus;
          if (statusRange === '2xx') return status >= 200 && status < 300;
          if (statusRange === '3xx') return status >= 300 && status < 400;
          if (statusRange === '4xx') return status >= 400 && status < 500;
          if (statusRange === '5xx') return status >= 500;
          return true;
        });
      }

      // URL pattern filter
      if (filters.urlPattern) {
        try {
          const regex = new RegExp(filters.urlPattern, 'i');
          filtered = filtered.filter((r) => regex.test(r.url));
        } catch {
          // Invalid regex, ignore
        }
      }

      // Domain filter
      if (filters.domain) {
        filtered = filtered.filter((r) => {
          try {
            const url = new URL(r.url);
            return url.hostname.includes(filters.domain);
          } catch {
            return false;
          }
        });
      }

      // Sort
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === undefined || bVal === undefined) return 0;
        const comparison = aVal > bVal ? 1 : -1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });

      return filtered;
    },

    getRequestById: (id) => {
      return get().requests.find((r) => r.id === id);
    }
  }))
);

export default useRequestStore;
