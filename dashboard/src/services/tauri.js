import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

class TauriService {
  constructor() {
    this.isTauri = this.checkIsTauri();
    this.projectPath = this.getProjectPath();
  }

  checkIsTauri() {
    return typeof window !== "undefined" && window.__TAURI__ !== undefined;
  }

  getProjectPath() {
    if (this.isTauri) {
      return import.meta.env.PROJECT_PATH || "";
    }
    return "";
  }

  async startProxyServer() {
    if (!this.isTauri) {
      console.warn("[Tauri] Not running in Tauri, skipping proxy start");
      return { running: false, port: 8080, pid: null };
    }

    try {
      return await invoke("start_proxy_server", {
        projectPath: this.projectPath,
      });
    } catch (error) {
      console.error("[Tauri] Failed to start proxy:", error);
      throw error;
    }
  }

  async stopProxyServer() {
    if (!this.isTauri) {
      console.warn("[Tauri] Not running in Tauri, skipping proxy stop");
      return { running: false, port: 8080, pid: null };
    }

    try {
      return await invoke("stop_proxy_server");
    } catch (error) {
      console.error("[Tauri] Failed to stop proxy:", error);
      throw error;
    }
  }

  async getProxyStatus() {
    if (!this.isTauri) {
      return { running: false, port: 8080, pid: null };
    }

    try {
      return await invoke("get_proxy_status");
    } catch (error) {
      console.error("[Tauri] Failed to get proxy status:", error);
      throw error;
    }
  }

  async openCertsFolder() {
    if (!this.isTauri) {
      console.warn("[Tauri] Not running in Tauri, cannot open folder");
      return;
    }

    try {
      await invoke("open_certs_folder", { projectPath: this.projectPath });
    } catch (error) {
      console.error("[Tauri] Failed to open certs folder:", error);
      throw error;
    }
  }

  openUrl(url) {
    if (this.isTauri) {
      return open(url);
    } else {
      window.open(url, "_blank");
    }
  }
}

export const tauriService = new TauriService();
export default tauriService;
