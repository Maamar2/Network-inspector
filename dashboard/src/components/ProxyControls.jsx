import React, { useState, useEffect } from "react";
import { Play, Square, FolderOpen, Activity } from "lucide-react";
import tauriService from "../services/tauri";

const ProxyControls = () => {
  const [status, setStatus] = useState({
    running: false,
    port: 8080,
    pid: null,
  });
  const [loading, setLoading] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    const checkEnvironment = async () => {
      const tauri = tauriService.isTauri;
      setIsTauri(tauri);
      if (tauri) {
        await checkStatus();
      }
    };
    checkEnvironment();
  }, []);

  const checkStatus = async () => {
    try {
      const currentStatus = await tauriService.getProxyStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error("Failed to get proxy status:", error);
    }
  };

  const startProxy = async () => {
    setLoading(true);
    try {
      await tauriService.startProxyServer();
      await checkStatus();
    } catch (error) {
      console.error("Failed to start proxy:", error);
      alert("Failed to start proxy server: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stopProxy = async () => {
    setLoading(true);
    try {
      await tauriService.stopProxyServer();
      await checkStatus();
    } catch (error) {
      console.error("Failed to stop proxy:", error);
      alert("Failed to stop proxy server: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openCertsFolder = async () => {
    try {
      await tauriService.openCertsFolder();
    } catch (error) {
      console.error("Failed to open certs folder:", error);
      alert("Failed to open certificates folder: " + error.message);
    }
  };

  if (!isTauri) {
    return (
      <div className="proxy-controls flex items-center gap-2 px-4 py-2 bg-dark-800 border-b border-dark-700">
        <Activity className="w-4 h-4 text-yellow-500" />
        <span className="text-sm text-gray-400">Running in browser mode</span>
        <span className="text-xs text-gray-500">(Start proxy manually)</span>
      </div>
    );
  }

  return (
    <div className="proxy-controls flex items-center gap-3 px-4 py-2 bg-dark-800 border-b border-dark-700">
      <div className="flex items-center gap-2">
        <Activity
          className={`w-4 h-4 ${status.running ? "text-green-500" : "text-gray-500"}`}
        />
        <span className="text-sm font-medium">
          Proxy: {status.running ? "Running" : "Stopped"}
        </span>
        {status.running && (
          <span className="text-xs text-gray-500">
            (PID: {status.pid} | Port: {status.port})
          </span>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={status.running ? stopProxy : startProxy}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : status.running ? (
          <>
            <Square className="w-3 h-3" />
            Stop
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            Start
          </>
        )}
      </button>

      <button
        onClick={openCertsFolder}
        className="flex items-center gap-1 px-3 py-1 text-sm rounded bg-dark-700 hover:bg-dark-600 transition-colors"
      >
        <FolderOpen className="w-3 h-3" />
        Certs
      </button>
    </div>
  );
};

export default ProxyControls;
