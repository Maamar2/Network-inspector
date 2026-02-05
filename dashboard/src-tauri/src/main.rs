#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct ProxyStatus {
    running: bool,
    port: u16,
    pid: Option<u32>,
}

struct ProxyServer(Mutex<Option<Child>>);

#[tauri::command]
async fn start_proxy_server(
    proxy: State<'_, ProxyServer>,
    project_path: String,
) -> Result<ProxyStatus, String> {
    let proxy_path = format!("{}/proxy", project_path);
    
    let mut child = Command::new("node")
        .current_dir(&proxy_path)
        .arg("server.js")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start proxy: {}", e))?;

    let pid = child.id();
    
    let mut proxy_guard = proxy.0.lock().unwrap();
    *proxy_guard = Some(child);
    
    Ok(ProxyStatus {
        running: true,
        port: 8080,
        pid,
    })
}

#[tauri::command]
async fn stop_proxy_server(proxy: State<'_, ProxyServer>) -> Result<ProxyStatus, String> {
    let mut proxy_guard = proxy.0.lock().unwrap();
    
    if let Some(mut child) = proxy_guard.take() {
        child.kill().map_err(|e| format!("Failed to stop proxy: {}", e))?;
        let _ = child.wait();
    }
    
    Ok(ProxyStatus {
        running: false,
        port: 8080,
        pid: None,
    })
}

#[tauri::command]
async fn get_proxy_status(proxy: State<'_, ProxyServer>) -> Result<ProxyStatus, String> {
    let proxy_guard = proxy.0.lock().unwrap();
    let status = if let Some(ref child) = *proxy_guard {
        let pid = child.id();
        ProxyStatus {
            running: true,
            port: 8080,
            pid,
        }
    } else {
        ProxyStatus {
            running: false,
            port: 8080,
            pid: None,
        }
    };
    
    Ok(status)
}

#[tauri::command]
async fn open_certs_folder(project_path: String) -> Result<(), String> {
    let certs_path = format!("{}/certs", project_path);
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&certs_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&certs_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&certs_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err(format!("Unsupported operating system for opening folders"));
    }
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(ProxyServer(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_proxy_server,
            stop_proxy_server,
            get_proxy_status,
            open_certs_folder
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
