# Network Inspector

A lightweight MITM proxy with a native desktop UI for intercepting and analyzing HTTP/HTTPS traffic. Think Charles Proxy meets Postman Interceptor, but open source and built with modern web tech.

## What It Does

Sits between your browser and the internet, captures every request/response, and displays them in a clean interface. Perfect for debugging APIs, reverse engineering, or just being nosy about what your apps are doing.

## Tech Stack

- **Proxy**: Node.js + http-mitm-proxy (the actual interception magic)
- **Desktop App**: Tauri (Rust) + React + Vite
- **State**: Zustand (because Redux is overkill)
- **Styling**: TailwindCSS
- **Real-time**: WebSocket for live updates

## Installation

### Prerequisites

```bash
# You need these
node >= 20.0.0
rust (latest stable)
```

### Install Rust

**Windows:**
```powershell
winget install Rustlang.Rustup
```

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify:
```bash
rustc --version
```

### Clone and Install

```bash
git clone https://github.com/Maamar2/network-inspector.git
cd network-inspector
npm install
```

This installs dependencies for both the proxy and desktop app.

## Running the App

### Start the Desktop App

```bash
npm run dev:desktop
```

This launches the Tauri window with the React dashboard. The proxy server is controlled from within the app.

### Using the App

1. **Start the Proxy**
   - Click "Start Proxy" button in the app
   - Wait for status to show "Running"
   - Proxy is now listening on `localhost:8080`

2. **Configure Your Browser**
   - Open browser settings
   - Navigate to Network/Proxy settings
   - Set HTTP proxy to `localhost:8080`
   - Leave HTTPS proxy empty (the proxy handles both)

3. **Trust the CA Certificate**
   - Click "Open Certs Folder" in the app
   - Import `ca.pem` into your system trust store:
     - **Windows**: Double-click `ca.pem` → Install Certificate → Place in "Trusted Root Certification Authorities"
     - **macOS**: Open Keychain Access → File → Import Items → Select `ca.pem` → Set to "Always Trust"
     - **Linux**: `sudo cp ca.pem /usr/local/share/ca-certificates/ && sudo update-ca-certificates`
   - Restart your browser

4. **Start Capturing**
   - Browse any website
   - All requests appear in the dashboard in real-time
   - Click any request to see details (headers, body, timing)

5. **Filter and Search**
   - Use the search bar to filter by URL
   - Filter by method (GET, POST, etc.)
   - Filter by status code (200, 404, etc.)

6. **Export Data**
   - Click "Export HAR" to save captured traffic
   - HAR files can be imported into other tools

7. **Stop Proxy**
   - Click "Stop Proxy" when done
   - Remove proxy settings from your browser

## How It Works

### Architecture

```
Browser → Proxy (port 8080) → Internet
                ↓
         WebSocket (port 3001)
                ↓
         Desktop App (displays everything)
```

### The Flow

1. **Browser makes request** → Goes to proxy instead of internet
2. **Proxy intercepts** → Captures request details
3. **SSL/TLS handling** → Generates fake cert on-the-fly for HTTPS
4. **Forward to server** → Sends request to actual destination
5. **Capture response** → Stores response details
6. **Send to UI** → Streams data via WebSocket to desktop app
7. **Display** → React app renders request/response in real-time

### Why It Works

The proxy acts as a man-in-the-middle by:
- Generating a CA certificate that your browser trusts
- Creating fake SSL certificates for each HTTPS site
- Decrypting HTTPS traffic, inspecting it, then re-encrypting
- This is why you need to trust the CA cert

## Project Structure

```
network-inspector/
├── proxy/              # Node.js MITM proxy server
│   ├── server.js      # Main entry point, starts proxy
│   ├── interceptor.js # Request/response handling logic
│   ├── websocket-server.js # Real-time updates to UI
│   ├── request-store.js # In-memory request storage
│   └── ssl/           # Certificate generation
├── dashboard/          # Tauri desktop app
│   ├── src/           # React frontend
│   │   ├── components/ # UI components
│   │   ├── services/  # WebSocket & Tauri API
│   │   └── store/     # Zustand state management
│   └── src-tauri/     # Rust backend
│       └── src/main.rs # Proxy process management
└── shared/            # Shared constants
```

## Configuration

Edit `proxy/config.js`:

```javascript
{
  PROXY_PORT: 8080,      // Proxy listens here
  WS_PORT: 3001,         // WebSocket for UI updates
  MAX_REQUESTS: 10000    // Request history limit
}
```

## Development

```bash
# Start desktop app with hot reload
npm run dev:desktop

# Start proxy only (for testing)
npm run dev:proxy

# Start dashboard only (browser mode)
npm run dev:dashboard

# Lint code
npm run lint

# Format code
npm run format
```

## Building for Production

```bash
# Build desktop app for your platform
npm run build:desktop

# Output in dashboard/src-tauri/target/release/bundle/
# - Windows: .msi or .exe installer
# - macOS: .dmg or .app bundle
# - Linux: .AppImage or .deb package
```

## Troubleshooting

### HTTPS not working?

Import the CA cert. The proxy generates a self-signed cert for HTTPS interception. Your browser needs to trust it.

### Proxy won't start?

Check if port 8080 is already in use:
```bash
# Windows
netstat -ano | findstr :8080

# macOS/Linux
lsof -i :8080
```

Kill whatever's on it or change the port in `proxy/config.js`.

### Dashboard not connecting?

- Make sure the proxy is running (check status in app)
- Verify WebSocket port 3001 isn't blocked by firewall
- Check browser console for errors

### Certificate errors?

- Make sure you imported `ca.pem` correctly
- Restart your browser after importing
- Check that the cert is in the right trust store

### Build fails?

```bash
# Update Rust
rustup update

# Clear Tauri cache
cd dashboard
rm -rf src-tauri/target

# Reinstall dependencies
cd ..
npm install
```

## Security Note

This tool generates a CA certificate to decrypt HTTPS traffic. That's literally a man-in-the-middle attack. Only use it on traffic you own. Don't be evil.

The CA certificate is stored locally in `certs/` and never transmitted. Keep it safe.

## Use Cases

- **API Debugging**: See exactly what your app is sending/receiving
- **Reverse Engineering**: Analyze how apps communicate with servers
- **Performance Testing**: Check request timing and payload sizes
- **Security Testing**: Inspect headers and authentication flows
- **Learning**: Understand how HTTP/HTTPS works under the hood

## License

MIT - Do whatever you want with it.

## Author

Built by Maamar Hafsaoui

## Contributing

PRs welcome. Keep it simple, keep it clean.
