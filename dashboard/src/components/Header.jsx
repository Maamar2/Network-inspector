import React from "react";
import {
  Play,
  Pause,
  Trash2,
  Download,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import useRequestStore from "../store/useRequestStore";
import socketService from "../services/socket";
import ProxyControls from "./ProxyControls";

const Header = () => {
  const { isCapturing, isConnected, requests, setCapturing, clearRequests } =
    useRequestStore();

  const handleToggleCapture = () => {
    setCapturing(!isCapturing);
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all requests?")) {
      clearRequests();
      socketService.clearRequests();
    }
  };

  const handleExport = async () => {
    try {
      const har = await socketService.exportHar();
      const blob = new Blob([JSON.stringify(har, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `network-inspector-${Date.now()}.har`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export HAR file");
    }
  };

  return (
    <>
      <ProxyControls />
      <header className="h-14 bg-dark-800 border-b border-dark-700 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></span>
            Network Inspector
          </h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className={isConnected ? "text-green-400" : "text-red-400"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <span className="text-dark-600">|</span>

            <span className="text-gray-400 text-sm">
              {requests.length} requests
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleCapture}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isCapturing
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
            }`}
          >
            {isCapturing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isCapturing ? "Pause" : "Resume"}
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export HAR
          </button>

          <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;
