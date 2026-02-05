import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import useRequestStore from '../store/useRequestStore';
import { formatBytes, formatDuration, formatJson, detectContentType, escapeHtml } from '../utils/formatters';

const RequestDetail = () => {
  const { getSelectedRequest, selectRequest } = useRequestStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const request = getSelectedRequest();

  if (!request) {
    return (
      <div className="w-96 bg-dark-800 border-l border-dark-700 flex items-center justify-center text-gray-500">
        <p>Select a request to view details</p>
      </div>
    );
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHeaders = (headers) => {
    if (!headers || Object.keys(headers).length === 0) {
      return <p className="text-gray-500 text-sm">No headers</p>;
    }

    return (
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(headers).map(([key, value]) => (
            <tr key={key} className="border-b border-dark-700">
              <td className="py-1.5 pr-4 text-gray-400 font-medium w-1/3">{key}</td>
              <td className="py-1.5 text-gray-300 break-all">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderBody = (body, headers) => {
    if (!body) {
      return <p className="text-gray-500 text-sm">No body</p>;
    }

    const contentType = detectContentType(headers);
    let formattedBody = body;

    if (contentType === 'json') {
      try {
        formattedBody = formatJson(body);
      } catch {
        formattedBody = body;
      }
    }

    return (
      <div className="relative">
        <button
          onClick={() => handleCopy(body)}
          className="absolute top-2 right-2 p-1.5 bg-dark-700 rounded text-gray-400 hover:text-white transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <pre className="code-block text-xs max-h-96 overflow-auto">
          <code>{formattedBody}</code>
        </pre>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body' },
    { id: 'response', label: 'Response' }
  ];

  return (
    <div className="w-96 bg-dark-800 border-l border-dark-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700">
        <h3 className="font-semibold text-white">Request Details</h3>
        <button
          onClick={() => selectRequest(null)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">General</h4>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-gray-500 w-24">Method:</span>
                  <span className="text-white">{request.method}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">URL:</span>
                  <span className="text-white break-all">{request.url}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">Status:</span>
                  <span className="text-white">
                    {request.status || request.responseStatus || '-'} {request.statusText || ''}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">Time:</span>
                  <span className="text-white">{formatDuration(request.time || request.responseTime)}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">Size:</span>
                  <span className="text-white">{formatBytes(request.size || request.responseBodySize)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Request Headers</h4>
              {renderHeaders(request.headers)}
            </div>
            {request.responseHeaders && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Response Headers</h4>
                {renderHeaders(request.responseHeaders)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Request Body</h4>
            {renderBody(request.body, request.headers)}
          </div>
        )}

        {activeTab === 'response' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Response Body</h4>
            {renderBody(request.responseBody, request.responseHeaders)}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetail;
