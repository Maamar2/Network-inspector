import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import useRequestStore from '../store/useRequestStore';

const FilterBar = () => {
  const { filters, setFilters } = useRequestStore();

  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      method: '',
      status: ''
    });
  };

  const hasActiveFilters = filters.search || filters.method || filters.status;

  return (
    <div className="bg-dark-800 border-b border-dark-700 p-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Filter by URL..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full bg-dark-900 text-gray-200 pl-10 pr-4 py-2 rounded text-sm border border-dark-700 focus:border-primary-500 focus:outline-none"
          />
        </div>

        <select
          value={filters.method}
          onChange={(e) => handleFilterChange('method', e.target.value)}
          className="bg-dark-900 text-gray-200 px-3 py-2 rounded text-sm border border-dark-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="bg-dark-900 text-gray-200 px-3 py-2 rounded text-sm border border-dark-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="2xx">2xx Success</option>
          <option value="3xx">3xx Redirect</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
