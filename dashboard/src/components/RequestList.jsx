import React from 'react';
import useRequestStore from '../store/useRequestStore';
import { formatBytes, formatDuration, truncateUrl, getMethodColor, getStatusColor } from '../utils/formatters';

const RequestList = () => {
  const { 
    getFilteredRequests, 
    selectedRequestId, 
    selectRequest 
  } = useRequestStore();

  const requests = getFilteredRequests();

  if (requests.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No requests captured</p>
          <p className="text-sm text-gray-600">Navigate to a website to start capturing traffic</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-dark-800 sticky top-0 z-10">
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-gray-400 w-20">Method</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-400 w-16">Status</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-400">URL</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-400 w-20">Time</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-400 w-20">Size</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr
              key={request.id}
              onClick={() => selectRequest(request.id)}
              className={`cursor-pointer border-b border-dark-700 hover:bg-dark-700/50 transition-colors ${
                selectedRequestId === request.id ? 'bg-dark-700' : ''
              }`}
            >
              <td className="py-2 px-3">
                <span className={`method-badge ${getMethodColor(request.method)}`}>
                  {request.method}
                </span>
              </td>
              <td className="py-2 px-3">
                {request.status || request.responseStatus ? (
                  <span className={`status-badge ${getStatusColor(request.status || request.responseStatus)}`}>
                    {request.status || request.responseStatus}
                  </span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 truncate max-w-md" title={request.url}>
                    {truncateUrl(request.url, 80)}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono text-gray-400">
                {formatDuration(request.time || request.responseTime)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-gray-400">
                {formatBytes(request.size || request.responseBodySize)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RequestList;
