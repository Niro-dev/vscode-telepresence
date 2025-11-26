/**
 * Telepresence Extension Constants
 * All hardcoded strings, colors, and configuration values
 */

// =============================================================================
// COMMANDS
// =============================================================================
export const COMMANDS = {
    CONNECT: 'telepresence.connect',
    DISCONNECT: 'telepresence.disconnect',
    CREATE_INTERCEPT: 'telepresence.createIntercept',
    REMOVE_INTERCEPT: 'telepresence.removeIntercept',
    LIST_INTERCEPTS: 'telepresence.listIntercepts',
    SHOW_STATUS: 'telepresence.status',
    REFRESH_INTERCEPTS: 'telepresence.refreshIntercepts',
    REFRESH_STATUS: 'telepresence.refreshStatus',
    OPEN_DASHBOARD: 'telepresence.openDashboard',
    OPEN_SETTINGS: 'telepresence.openSettings',
    OPEN_SETTINGS_FILE: 'telepresence.openSettingsFile',
    CONNECT_TO_NAMESPACE: 'telepresence.connectToNamespace',
    SHOW_INTERCEPT_DETAILS: 'telepresence.showInterceptDetails',
    DEBUG_STATUS: 'telepresence.debugStatus',
} as const;

// =============================================================================
// VIEW IDS
// =============================================================================
export const VIEWS = {
    INTERCEPTS: 'telepresenceInterceptsView',
    STATUS: 'telepresenceStatusView',
} as const;

// =============================================================================
// CONTEXT VALUES (for tree items)
// =============================================================================
export const CONTEXT_VALUES = {
    INTERCEPT: 'intercept',
    DETAIL: 'detail',
    EMPTY: 'empty',
    CREATE_BUTTON: 'createButton',
    CONNECT_BUTTON: 'connectButton',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    NAMESPACE_OPTION: 'namespaceOption',
    REFRESH: 'refresh',
} as const;

// =============================================================================
// TELEPRESENCE CLI COMMANDS
// =============================================================================
export const CLI = {
    STATUS: 'telepresence status',
    CONNECT: 'telepresence connect',
    DISCONNECT: 'telepresence quit',
    LIST_INTERCEPTS: 'telepresence list --intercepts',
    LEAVE: 'telepresence leave',
    INTERCEPT: 'telepresence intercept',
} as const;

// =============================================================================
// KUBECTL COMMANDS
// =============================================================================
export const KUBECTL = {
    GET_NAMESPACES: 'kubectl get namespaces -o jsonpath="{.items[*].metadata.name}"',
    GET_DEPLOYMENTS: 'kubectl get deployments',
    GET_SERVICE: 'kubectl get service',
} as const;

// =============================================================================
// SETTINGS KEYS
// =============================================================================
export const SETTINGS = {
    CONFIG_SECTION: 'telepresence',
    HTTP_HEADER_NAME: 'httpHeaderName',
    HTTP_HEADER_DEFAULT_VALUE: 'httpHeaderDefaultValue',
    MANAGER_NAMESPACE: 'managerNamespace',
    AUTO_REFRESH: 'autoRefresh',
    POLLING_INTERVAL: 'statusPollingInterval',
} as const;

// =============================================================================
// DEFAULT VALUES
// =============================================================================
export const DEFAULTS = {
    HTTP_HEADER_NAME: 'x-telepresence-intercept',
    HTTP_HEADER_VALUE: '',
    MANAGER_NAMESPACE: 'telepresence',
    POLLING_INTERVAL: 5,
    AUTO_REFRESH: true,
    CONNECT_TIMEOUT: 60000,
} as const;

// =============================================================================
// THEME COLORS (VS Code theme color IDs)
// =============================================================================
export const COLORS = {
    SUCCESS: 'testing.iconPassed',
    ERROR: 'testing.iconFailed',
    WARNING: 'problemsWarningIcon.foreground',
    INFO: 'textLink.foreground',
    BLUE: 'charts.blue',
    GREEN: 'charts.green',
    PURPLE: 'charts.purple',
    YELLOW: 'charts.yellow',
    ORANGE: 'charts.orange',
} as const;

// =============================================================================
// ICONS (VS Code codicon names)
// =============================================================================
export const ICONS = {
    CONNECTED: 'debug-disconnect',
    DISCONNECTED: 'circle-slash',
    CHECK: 'check',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    LOADING: 'loading~spin',
    ADD: 'add',
    REMOVE: 'trash',
    REFRESH: 'refresh',
    SETTINGS: 'settings-gear',
    PLUG: 'plug',
    DASHBOARD: 'dashboard',
    FOLDER: 'folder',
    FOLDER_OPENED: 'folder-opened',
    SERVER: 'server-environment',
    NAMESPACE: 'symbol-namespace',
    CLOUD: 'cloud',
    DESKTOP: 'device-desktop',
    LAYERS: 'layers',
    ARROW_SWAP: 'arrow-swap',
    HOME: 'home',
} as const;

// =============================================================================
// MESSAGES
// =============================================================================
export const MESSAGES = {
    CONNECTED: 'Connected',
    DISCONNECTED: 'Disconnected',
    NOT_CONNECTED: 'Not connected',
    ACTIVE_CONNECTION: 'Active connection',
    CONNECTING: 'Connecting to Telepresence...',
    DISCONNECTING: 'Disconnecting from Telepresence...',
    CREATING_INTERCEPT: 'Creating intercept...',
    REMOVING_INTERCEPT: 'Removing intercept...',
    FETCHING_NAMESPACES: 'Fetching namespaces from cluster...',
    FETCHING_DEPLOYMENTS: 'Fetching deployments...',
    FETCHING_PORTS: 'Fetching service ports...',
    CONNECT_SUCCESS: 'Successfully connected to Telepresence',
    DISCONNECT_SUCCESS: 'Disconnected from Telepresence',
    INTERCEPT_CREATED: 'Personal intercept created',
    INTERCEPT_REMOVED: 'Intercept removed',
    SETTINGS_SAVED: 'Settings saved successfully',
    CONNECT_FAILED: 'Failed to connect',
    DISCONNECT_FAILED: 'Failed to disconnect',
    INTERCEPT_FAILED: 'Failed to create intercept',
    REMOVE_INTERCEPT_FAILED: 'Failed to remove intercept',
    NO_NAMESPACES: 'No namespaces found',
    NO_DEPLOYMENTS: 'No deployments found in the current namespace',
    NO_ACTIVE_INTERCEPTS: 'No active intercepts',
    PLEASE_CONNECT_FIRST: 'Please connect to Telepresence first',
    SELECT_NAMESPACE: 'Select a namespace to connect to',
    SELECT_DEPLOYMENT: 'Select a deployment to intercept',
    USE_DEFAULT_PORT: 'Use default local port?',
    ENTER_LOCAL_PORT: 'Enter the local port',
    ENTER_SERVICE_PORT: 'Enter the service port (remote port)',
    CREATE_NEW_INTERCEPT: 'Create New Intercept',
    CONNECT_TO_CLUSTER: 'Connect to Cluster',
    EXPAND_TO_SELECT: 'Expand to select namespace',
    CLICK_TO_ADD: 'Click to add a new intercept',
    DEFAULT_NAMESPACE: 'Default Namespace',
    USE_KUBECONFIG_DEFAULT: 'Use kubeconfig default',
} as const;

// =============================================================================
// REGEX PATTERNS
// =============================================================================
export const PATTERNS = {
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
} as const;

// =============================================================================
// FILE NAMES
// =============================================================================
export const FILES = {
    SETTINGS_JSON: 'telepresence-settings.json',
} as const;
