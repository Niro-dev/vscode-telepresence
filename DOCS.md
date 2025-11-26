# Telepresence VS Code Extension - Documentation

> Complete technical documentation for the Telepresence VS Code/Cursor extension.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Architecture](#architecture)
4. [Core Components](#core-components)
5. [Features](#features)
6. [Configuration](#configuration)
7. [Commands](#commands)
8. [UI Components](#ui-components)
9. [Data Flow](#data-flow)
10. [Constants Reference](#constants-reference)
11. [Development Guide](#development-guide)

---

## Overview

### What is this extension?

A VS Code/Cursor extension for managing [Telepresence](https://www.telepresence.io/) - a tool for local Kubernetes development. It provides a graphical interface to:

- Connect/disconnect to Kubernetes clusters
- Create and manage personal intercepts
- View connection status
- Configure HTTP headers for traffic routing

### Key Features

- 🔌 **Connection Management** - Connect to clusters with namespace selection
- 🔀 **Personal Intercepts** - Route specific traffic to localhost using HTTP headers
- 📊 **Real-time Status** - Automatic polling and status updates
- 🎨 **Multiple UIs** - Sidebar tree views, WebView dashboard, command palette
- ⚙️ **Configurable** - Settings UI for all preferences

### Technology Stack

- **Language:** TypeScript
- **Framework:** VS Code Extension API
- **CLI Integration:** Telepresence CLI, kubectl
- **UI:** VS Code TreeDataProvider, WebView API

---

## Project Structure

```
telepresence-ext/
├── src/
│   ├── constants.ts          # All hardcoded values (strings, colors, icons)
│   ├── logger.ts             # Logging utility
│   ├── extension.ts          # Main entry point
│   ├── telepresenceService.ts # Core Telepresence CLI wrapper
│   ├── settingsManager.ts    # Settings and configuration
│   └── views/
│       ├── interceptsProvider.ts  # Intercepts tree view
│       ├── statusProvider.ts      # Connection status tree view
│       ├── dashboardPanel.ts      # WebView dashboard
│       └── settingsPanel.ts       # Settings WebView
├── resources/
│   └── icon.svg              # Extension icon
├── .vscode/
│   ├── launch.json           # Debug configuration
│   └── tasks.json            # Build tasks
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── README.md                 # User documentation
└── DOCS.md                   # Technical documentation (this file)
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code / Cursor                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Sidebar    │  │   Status     │  │      Dashboard       │  │
│  │  Tree Views  │  │     Bar      │  │      (WebView)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                      │
│                    ┌──────▼───────┐                             │
│                    │  extension.ts │  ◄── Command Handlers      │
│                    │  (Entry Point)│                             │
│                    └──────┬───────┘                             │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                    │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌─────▼──────┐            │
│  │ Telepresence │  │   Settings   │  │   Logger   │            │
│  │   Service    │  │   Manager    │  │            │            │
│  └──────┬───────┘  └──────────────┘  └────────────┘            │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Telepresence CLI  │     │      kubectl        │
│  (connect, quit,    │     │  (namespaces,       │
│   intercept, list)  │     │   deployments,      │
└─────────────────────┘     │   services)         │
                            └─────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `extension.ts` | Entry point, command registration, lifecycle management |
| `telepresenceService.ts` | All Telepresence CLI interactions |
| `settingsManager.ts` | Configuration persistence and retrieval |
| `interceptsProvider.ts` | Intercepts sidebar tree view |
| `statusProvider.ts` | Connection status sidebar tree view |
| `dashboardPanel.ts` | Full-featured WebView dashboard |
| `settingsPanel.ts` | Settings WebView panel |
| `constants.ts` | Centralized constants and strings |
| `logger.ts` | Structured logging utility |

---

## Core Components

### 1. Extension Entry Point (`extension.ts`)

The main entry point that VS Code calls when the extension activates.

#### Functions

| Function | Description |
|----------|-------------|
| `activate(context)` | Called when extension activates. Initializes all services and registers commands. |
| `deactivate()` | Called when extension deactivates. Cleans up resources. |
| `initializeServices()` | Creates TelepresenceService and SettingsManager instances |
| `initializeStatusBar()` | Sets up the status bar item |
| `initializeTreeViews()` | Registers tree data providers |
| `registerCommands()` | Registers all extension commands |
| `registerEventListeners()` | Sets up event listeners for status changes |
| `startStatusPolling()` | Starts automatic status polling |
| `updateStatusBar()` | Updates status bar text based on connection state |
| `refreshViews()` | Refreshes all tree views |

#### Command Handlers

| Handler | Command | Description |
|---------|---------|-------------|
| `handleConnect()` | `telepresence.connect` | Connects to cluster with namespace picker |
| `handleDisconnect()` | `telepresence.disconnect` | Disconnects from cluster |
| `handleCreateIntercept()` | `telepresence.createIntercept` | Creates a new personal intercept |
| `handleRemoveIntercept()` | `telepresence.removeIntercept` | Removes an existing intercept |
| `handleListIntercepts()` | `telepresence.listIntercepts` | Shows list of active intercepts |
| `handleShowInterceptDetails()` | `telepresence.showInterceptDetails` | Shows intercept details |
| `handleStatus()` | `telepresence.status` | Shows current status in modal |
| `handleConnectToNamespace()` | `telepresence.connectToNamespace` | Connects to specific namespace |
| `handleDebugStatus()` | `telepresence.debugStatus` | Outputs debug info to console |

---

### 2. Telepresence Service (`telepresenceService.ts`)

Core service that wraps all Telepresence CLI and kubectl interactions.

#### Interfaces

```typescript
interface Intercept {
    name: string;           // Intercept name
    serviceName: string;    // Target service
    localPort: number;      // Local port
    servicePort: number;    // Remote service port
    state?: string;         // ACTIVE, etc.
    volumeMount?: string;   // Volume mount path (e.g., T:)
    workloadKind?: string;  // Deployment, StatefulSet, etc.
}

interface ConnectionStatus {
    connected: boolean;     // Is connected to cluster
    context?: string;       // Kubernetes context
    namespace?: string;     // Current namespace
}

interface OperationResult {
    success: boolean;       // Operation succeeded
    error?: string;         // Error message if failed
    output?: string;        // CLI output
}
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `checkStatus()` | - | `Promise<ConnectionStatus>` | Checks current connection status |
| `getConnectionStatus()` | - | `ConnectionStatus` | Returns cached status |
| `getNamespaces()` | - | `Promise<string[]>` | Gets list of cluster namespaces |
| `getDeployments(namespace?)` | namespace | `Promise<string[]>` | Gets deployments in namespace |
| `getServicePorts(serviceName, namespace?)` | service, ns | `Promise<{servicePort, targetPort}>` | Gets service port mapping |
| `connect(namespace?)` | namespace | `Promise<OperationResult>` | Connects to cluster |
| `disconnect()` | - | `Promise<OperationResult>` | Disconnects from cluster |
| `createIntercept(...)` | service, ports, header | `Promise<OperationResult>` | Creates intercept |
| `removeIntercept(name)` | interceptName | `Promise<OperationResult>` | Removes intercept |
| `listIntercepts()` | - | `Promise<Intercept[]>` | Returns cached intercepts |
| `debugStatus()` | - | `Promise<string>` | Returns debug info |
| `dispose()` | - | `void` | Cleans up resources |

#### Events

| Event | Description |
|-------|-------------|
| `onStatusChange` | Fired when connection status changes |

---

### 3. Settings Manager (`settingsManager.ts`)

Manages extension settings including the JSON file for service-specific overrides.

#### Settings Storage

**VS Code Settings** (User-editable in Settings UI):
- `telepresence.httpHeaderName` - HTTP header name
- `telepresence.httpHeaderDefaultValue` - Default header value
- `telepresence.managerNamespace` - Traffic Manager namespace
- `telepresence.autoRefresh` - Enable auto-refresh
- `telepresence.statusPollingInterval` - Polling interval

**JSON File** (Global storage):
```json
{
  "httpHeader": {
    "name": "x-telepresence-intercept",
    "defaultValue": "username"
  },
  "serviceOverrides": {
    "auth-service": { "headerValue": "auth-user" },
    "api-service": { "headerValue": "api-user" }
  }
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `loadSettings()` | Loads settings from JSON file |
| `saveSettings(settings)` | Saves settings to JSON file |
| `getHeaderForService(serviceName)` | Gets HTTP header config for service |
| `openSettingsFile()` | Opens JSON file in editor |
| `getSettingsFilePath()` | Returns JSON file path |

---

### 4. Logger (`logger.ts`)

Structured logging utility with multiple levels.

#### Log Levels

| Level | Method | Use Case |
|-------|--------|----------|
| DEBUG | `logger.debug()` | Development, troubleshooting |
| INFO | `logger.info()` | General information |
| WARN | `logger.warn()` | Potential issues |
| ERROR | `logger.error()` | Errors with stack traces |

#### Performance Timing

```typescript
logger.time('operation');
// ... do work ...
logger.timeEnd('operation');
// Output: [Telepresence] [TIMER] operation: 123ms
```

---

### 5. Constants (`constants.ts`)

Centralized location for all hardcoded values.

#### Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `COMMANDS` | Command IDs | `telepresence.connect` |
| `VIEWS` | View IDs | `telepresenceInterceptsView` |
| `CONTEXT_VALUES` | Tree item contexts | `intercept`, `detail` |
| `CLI` | CLI commands | `telepresence connect` |
| `KUBECTL` | kubectl commands | `kubectl get namespaces` |
| `SETTINGS` | Setting keys | `httpHeaderName` |
| `DEFAULTS` | Default values | `5` (polling interval) |
| `COLORS` | Theme colors | `testing.iconPassed` |
| `ICONS` | Codicons | `arrow-swap`, `plug` |
| `MESSAGES` | User messages | `Connected`, `Failed to connect` |
| `PATTERNS` | Regex patterns | Status parsing patterns |

---

## Features

### 1. Connection Management

**Flow:**
```
User clicks "Connect to Cluster"
    │
    ▼
Expand to show namespace list (fetched from kubectl)
    │
    ▼
User selects namespace
    │
    ▼
Execute: telepresence connect --manager-namespace X --namespace Y
    │
    ▼
Update UI (status bar, tree views, dashboard)
```

**Key Points:**
- Namespace list is cached until disconnect
- Shows loading indicator while fetching
- Supports default namespace option
- Auto-detects already connected state

### 2. Personal Intercepts

**What are Personal Intercepts?**
Personal intercepts use HTTP headers to route only specific requests to your local machine. This allows multiple developers to intercept the same service simultaneously.

**Flow:**
```
User clicks "Create Intercept"
    │
    ▼
Show deployment list (from kubectl)
    │
    ▼
User selects deployment
    │
    ▼
Fetch service ports (kubectl get service -o json)
    │
    ▼
Ask: Use default local port? (targetPort from service)
    │
    ├─ Yes: Use targetPort
    └─ No: Manual input
    │
    ▼
Get HTTP header configuration
    │
    ├─ Check service-specific override in JSON
    └─ Fall back to default value
    │
    ▼
Execute: telepresence intercept SERVICE --port LOCAL:REMOTE --http-header NAME=VALUE
```

**CLI Example:**
```bash
telepresence intercept auth-service --port 8080:443 --http-header x-telepresence-intercept=your-username
```

### 3. Automatic Status Polling

**How it works:**
- Polls `telepresence status` every N seconds (configurable)
- Compares previous and current status
- Only updates UI if status actually changed
- Can be disabled in settings

**Configuration:**
```json
{
  "telepresence.autoRefresh": true,
  "telepresence.statusPollingInterval": 5
}
```

### 4. Intercept Details View

**Expandable tree showing:**
- Workload type (Deployment, StatefulSet, etc.)
- State (ACTIVE)
- Remote port
- Local port
- Volume mount point

---

## Configuration

### VS Code Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `telepresence.httpHeaderName` | string | `x-telepresence-intercept` | HTTP header name for personal intercepts |
| `telepresence.httpHeaderDefaultValue` | string | `""` | Default value for HTTP header |
| `telepresence.managerNamespace` | string | `telepresence` | Traffic Manager namespace |
| `telepresence.autoRefresh` | boolean | `true` | Enable automatic status refresh |
| `telepresence.statusPollingInterval` | number | `5` | Polling interval in seconds (2-60) |

### JSON Settings File

**Location:** VS Code global storage (`~/.vscode/globalStorage/telepresence-settings.json`)

**Structure:**
```json
{
  "httpHeader": {
    "name": "x-telepresence-intercept",
    "defaultValue": "default-user"
  },
  "serviceOverrides": {
    "service-name": {
      "headerValue": "custom-value"
    }
  }
}
```

---

## Commands

| Command ID | Title | Description |
|------------|-------|-------------|
| `telepresence.connect` | Connect | Connect to cluster |
| `telepresence.disconnect` | Disconnect | Disconnect from cluster |
| `telepresence.createIntercept` | Create Intercept | Create personal intercept |
| `telepresence.removeIntercept` | Remove Intercept | Remove intercept |
| `telepresence.listIntercepts` | List Intercepts | Show all intercepts |
| `telepresence.status` | Show Status | Show connection status |
| `telepresence.refreshIntercepts` | Refresh Intercepts | Refresh intercepts list |
| `telepresence.refreshStatus` | Refresh Status | Refresh status view |
| `telepresence.openDashboard` | Open Dashboard | Open WebView dashboard |
| `telepresence.openSettings` | Open Settings | Open settings panel |
| `telepresence.openSettingsFile` | Open Settings File | Open JSON config file |
| `telepresence.connectToNamespace` | Connect to Namespace | Connect to specific namespace |
| `telepresence.debugStatus` | Debug Status | Output debug info |

---

## UI Components

### 1. Sidebar Tree Views

**Connection View (`telepresenceStatusView`):**
```
CONNECTION
├── Connected ✓ (or Disconnected ✗)
├── Cluster: context-name
├── Namespace: namespace-name
└── Refresh Status
```

**When Disconnected:**
```
CONNECTION
├── Disconnected ✗
└── ▶ Connect to Cluster
    ├── 🏠 Default Namespace
    ├── 📦 namespace-1
    ├── 📦 namespace-2
    └── ...
```

**Intercepts View (`telepresenceInterceptsView`):**
```
INTERCEPTS
├── ➕ Create New Intercept
└── ▶ service-name (8080→:8080) [🗑️]
    ├── Workload: Deployment
    ├── State: ACTIVE ✓
    ├── Remote Port: 8080
    ├── Local Port: localhost:8080
    └── Volume Mount: T:
```

### 2. Status Bar

```
$(cloud) Telepresence: Connected
```
or
```
$(cloud-download) Telepresence: Disconnected
```

### 3. Dashboard (WebView)

Full-featured dashboard with:
- Status cards (connection info)
- Namespace selection modal
- Intercepts list with remove buttons
- Loading overlay during operations
- Toast notifications
- Real-time updates

### 4. Settings Panel (WebView)

Editable settings:
- Traffic Manager Namespace
- Auto Refresh toggle
- Polling Interval
- HTTP Header Name
- Default Header Value
- Service-specific overrides (add/edit/remove)

---

## Data Flow

### Connect Flow

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│   UI    │────▶│  extension  │────▶│ telepresence │
│ (click) │     │  .ts        │     │  Service     │
└─────────┘     └─────────────┘     └──────┬───────┘
                                           │
                ┌──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ 1. getNamespaces() ──▶ kubectl get namespaces       │
│ 2. Show namespace picker                            │
│ 3. connect(namespace) ──▶ telepresence connect ...  │
│ 4. checkStatus() ──▶ telepresence status            │
│ 5. Fire onStatusChange event                        │
│ 6. Update UI (status bar, tree views)               │
└─────────────────────────────────────────────────────┘
```

### Intercept Creation Flow

```
┌─────────┐
│   UI    │
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Check if connected                                   │
│ 2. getDeployments() ──▶ kubectl get deployments         │
│ 3. User selects deployment                              │
│ 4. getServicePorts() ──▶ kubectl get service -o json    │
│ 5. User confirms ports                                  │
│ 6. getHeaderForService() ──▶ Check settings/overrides   │
│ 7. createIntercept() ──▶ telepresence intercept ...     │
│ 8. refreshIntercepts() ──▶ telepresence list --intercepts│
│ 9. Update UI                                            │
└─────────────────────────────────────────────────────────┘
```

---

## Constants Reference

### CLI Commands

```typescript
CLI = {
    STATUS: 'telepresence status',
    CONNECT: 'telepresence connect',
    DISCONNECT: 'telepresence quit',
    LIST_INTERCEPTS: 'telepresence list --intercepts',
    LEAVE: 'telepresence leave',
    INTERCEPT: 'telepresence intercept',
}
```

### Regex Patterns

```typescript
PATTERNS = {
    STATUS_LINE: /Status\s*:\s*(.+)/i,
    TRAFFIC_MANAGER: /Traffic Manager:\s*(.+)/i,
    KUBERNETES_CONTEXT: /Kubernetes context:\s*(.+)/i,
    NAMESPACE: /Namespace\s*:\s*(.+)/i,
    DEPLOYMENT_INTERCEPT: /deployment\s+(\S+):\s*intercepted/,
    INTERCEPT_NAME: /Intercept name\s*:\s*(\S+)/,
    STATE: /State\s*:\s*(\S+)/,
    WORKLOAD_KIND: /Workload kind\s*:\s*(\S+)/,
    VOLUME_MOUNT: /Volume Mount Point:\s*(\S+)/,
    PORT_MAPPING: /(\d+)\s*->\s*(\d+)\s+TCP/,
}
```

---

## Development Guide

### Prerequisites

- Node.js 18+
- npm
- VS Code or Cursor
- Telepresence CLI installed
- kubectl configured with cluster access

### Setup

```bash
# Clone repository
git clone <repo-url>
cd telepresence-ext

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile)
npm run watch
```

### Running

1. Press **F5** in VS Code/Cursor
2. A new Extension Development Host window opens
3. Test the extension in that window

### Building for Production

```bash
# Install vsce if not installed
npm install -g @vscode/vsce

# Package extension
vsce package

# Output: telepresence-ext-0.0.1.vsix
```

### Debugging

1. Set breakpoints in TypeScript files
2. Press F5 to start debugging
3. Use Debug Console for logs
4. Run `Telepresence: Debug Status` command for CLI output

### Adding New Features

1. Add constants to `constants.ts`
2. Add logging with `logger.ts`
3. Implement service methods in `telepresenceService.ts`
4. Add command handler in `extension.ts`
5. Register command in `package.json`
6. Update tree views if needed
7. Update this documentation

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Not connected" shown when connected | Check `telepresence status` output format |
| Namespaces not loading | Verify kubectl access: `kubectl get namespaces` |
| Intercept fails | Check Traffic Manager: `telepresence helm install` |
| Settings not saving | Check global storage permissions |

### Debug Commands

```bash
# Check telepresence status
telepresence status

# List intercepts
telepresence list --intercepts

# Check kubectl access
kubectl get namespaces
kubectl get deployments -n <namespace>
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.0.1 | 2024 | Initial release |

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Update documentation
5. Submit pull request

---

*Last updated: November 2024*


