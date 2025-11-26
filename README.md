# Telepresence for VS Code / Cursor

> 🔌 Manage Telepresence connections and intercepts directly from VS Code or Cursor.

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey)

---

## ✨ Features

### 🔌 **Connection Management**
- Connect to Kubernetes clusters with namespace selection
- Visual indicator in status bar
- Auto-detection of existing connections

### 🔀 **Personal Intercepts**
- Create intercepts for specific services
- HTTP header-based routing (personal intercepts)
- View intercept details (ports, volume mounts)
- One-click intercept removal

### 📊 **Real-time Status**
- Automatic status polling
- Instant UI updates on status changes
- Expandable intercept details

### 🎨 **Multiple Interfaces**
- **Sidebar** - Tree views for quick actions
- **Dashboard** - Full-featured WebView
- **Command Palette** - All commands accessible
- **Settings Panel** - Configure all options

---

## 📸 Screenshots

### Sidebar Views
```
CONNECTION                    INTERCEPTS
├── Connected ✓              ├── ➕ Create New Intercept
├── Cluster: my-context      └── ▶ auth-service (443→:8080)
├── Namespace: develop           ├── State: ACTIVE ✓
└── 🔄 Refresh                   ├── Remote: 443
                                 ├── Local: localhost:8080
                                 └── Volume: T:
```

---

## 🚀 Getting Started

### Prerequisites

1. **Telepresence CLI** installed and working
   ```bash
   telepresence version
   ```

2. **kubectl** configured with cluster access
   ```bash
   kubectl get namespaces
   ```

3. **Traffic Manager** installed in cluster
   ```bash
   telepresence helm install
   ```

### Installation

1. Download the `.vsix` file
2. In VS Code/Cursor: `Ctrl+Shift+P` → "Install from VSIX"
3. Select the downloaded file
4. Reload window

### Quick Start

1. Click the **Telepresence icon** in the Activity Bar
2. Expand **"Connect to Cluster"** to see namespaces
3. Click a namespace to connect
4. Click **"Create New Intercept"** to start intercepting

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Telepresence: Connect` | Connect to cluster with namespace picker |
| `Telepresence: Disconnect` | Disconnect from cluster |
| `Telepresence: Create Intercept` | Create a personal intercept |
| `Telepresence: Remove Intercept` | Remove an intercept |
| `Telepresence: Show Status` | Show current status |
| `Telepresence: Open Dashboard` | Open full dashboard |
| `Telepresence: Open Settings` | Open settings panel |

Access via `Ctrl+Shift+P` (Command Palette)

---

## ⚙️ Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `telepresence.httpHeaderName` | `x-telepresence-intercept` | HTTP header name |
| `telepresence.httpHeaderDefaultValue` | `""` | Default header value |
| `telepresence.managerNamespace` | `telepresence` | Traffic Manager namespace |
| `telepresence.autoRefresh` | `true` | Auto-refresh status |
| `telepresence.statusPollingInterval` | `5` | Refresh interval (seconds) |

### Personal Intercepts

Personal intercepts route traffic based on HTTP headers. Configure your username:

1. Open Settings (`Ctrl+,`)
2. Search for "telepresence"
3. Set **HTTP Header Default Value** to your username

Or use the Settings Panel:
1. Click ⚙️ in the sidebar header
2. Edit "Default Header Value"

### Service-Specific Overrides

Different services can have different header values:

1. Open Settings Panel → "Open JSON File Manually"
2. Add service overrides:
   ```json
   {
     "serviceOverrides": {
       "auth-service": { "headerValue": "auth-team" },
       "api-service": { "headerValue": "api-team" }
     }
   }
   ```

---

## 🔄 Workflow

### Typical Development Flow

```
1. Start your local service
   └─ npm run dev (localhost:8080)

2. Connect to cluster
   └─ Click namespace in sidebar

3. Create intercept
   └─ Select deployment
   └─ Confirm ports (remote:443 → local:8080)
   └─ Header set automatically

4. Test your changes
   └─ Requests with your header route to localhost

5. When done
   └─ Click 🗑️ to remove intercept
   └─ Disconnect from cluster
```

### Port Mapping

```
Cluster                          Your Machine
┌─────────────────┐              ┌─────────────────┐
│  Service        │              │  Local Server   │
│  Port: 443      │ ◄──────────► │  Port: 8080     │
└─────────────────┘              └─────────────────┘
     Remote                           Local
```

---

## 🐛 Troubleshooting

### "Not connected" but should be

```bash
# Check telepresence status manually
telepresence status

# If stuck, quit and reconnect
telepresence quit
```

### Namespace list is empty

```bash
# Verify kubectl access
kubectl get namespaces
```

### "Traffic Manager not found"

```bash
# Install Traffic Manager
telepresence helm install

# Or specify existing namespace in settings
```

### Intercept already exists

```bash
# Remove existing intercept
telepresence leave <service-name>
```

---

## 📚 Documentation

For detailed technical documentation, see [DOCS.md](./DOCS.md)

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run extension (F5 in VS Code)
```

---

## 📝 License

MIT

---

## 🙏 Acknowledgments

- [Telepresence](https://www.telepresence.io/) by Ambassador Labs
- VS Code Extension API team

---

*Made with ❤️ for Kubernetes developers*
