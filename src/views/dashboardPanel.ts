/**
 * Dashboard WebView Panel
 * Provides a rich UI for managing Telepresence
 */
import * as vscode from 'vscode';
import { TelepresenceService } from '../telepresenceService';
import { logger } from '../logger';
import { COMMANDS, MESSAGES } from '../constants';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly telepresenceService: TelepresenceService
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlContent();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getNamespaces':
                        // Show loading while fetching namespaces
                        this._panel.webview.postMessage({
                            command: 'setLoading',
                            loading: true,
                            message: 'Fetching namespaces from cluster...'
                        });
                        const namespaces = await this.telepresenceService.getNamespaces();
                        this._panel.webview.postMessage({
                            command: 'setLoading',
                            loading: false
                        });
                        this._panel.webview.postMessage({
                            command: 'namespacesList',
                            namespaces
                        });
                        break;
                    case 'connect':
                        await this._handleDashboardConnect(message.namespace);
                        break;
                    case 'disconnect':
                        await this._handleDashboardDisconnect();
                        break;
                    case 'createIntercept':
                        // For intercepts, we still use command palette since it needs multiple inputs
                        await vscode.commands.executeCommand(COMMANDS.CREATE_INTERCEPT);
                        this._update();
                        break;
                    case 'removeIntercept':
                        await this._handleDashboardRemoveIntercept(message.name);
                        break;
                    case 'refresh':
                        this._update();
                        break;
                }
            },
            null,
            this._disposables
        );

        // Update content periodically
        this._update();
    }

    public static createOrShow(telepresenceService: TelepresenceService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'telepresenceDashboard',
            'Telepresence Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, telepresenceService);
    }

    private async _handleDashboardConnect(namespace?: string) {
        // Show loading state
        this._panel.webview.postMessage({
            command: 'setLoading',
            loading: true,
            message: namespace 
                ? `Connecting to namespace "${namespace}"...`
                : 'Connecting to cluster...'
        });

        try {
            const result = await this.telepresenceService.connect(namespace);
            
            if (result.success) {
                await this.telepresenceService.checkStatus();
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'success',
                    message: namespace 
                        ? `Connected to Telepresence in namespace "${namespace}"!`
                        : 'Connected to Telepresence!'
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'error',
                    message: `Failed to connect: ${result.error}`
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'notification',
                type: 'error',
                message: `Error: ${error}`
            });
        } finally {
            // Hide loading state
            this._panel.webview.postMessage({
                command: 'setLoading',
                loading: false
            });
            this._update();
        }
    }

    private async _handleDashboardDisconnect() {
        // Show loading state
        this._panel.webview.postMessage({
            command: 'setLoading',
            loading: true,
            message: 'Disconnecting...'
        });

        try {
            const result = await this.telepresenceService.disconnect();
            
            if (result.success) {
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'success',
                    message: 'Disconnected from Telepresence'
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'error',
                    message: `Failed to disconnect: ${result.error}`
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'notification',
                type: 'error',
                message: `Error: ${error}`
            });
        } finally {
            // Hide loading state
            this._panel.webview.postMessage({
                command: 'setLoading',
                loading: false
            });
            this._update();
        }
    }

    private async _handleDashboardRemoveIntercept(name: string) {
        // Show loading state
        this._panel.webview.postMessage({
            command: 'setLoading',
            loading: true,
            message: `Removing intercept "${name}"...`
        });

        try {
            const result = await this.telepresenceService.removeIntercept(name);
            
            if (result.success) {
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'success',
                    message: `Intercept "${name}" removed`
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'notification',
                    type: 'error',
                    message: `Failed to remove intercept: ${result.error}`
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'notification',
                type: 'error',
                message: `Error: ${error}`
            });
        } finally {
            // Hide loading state
            this._panel.webview.postMessage({
                command: 'setLoading',
                loading: false
            });
            this._update();
        }
    }

    private async _update() {
        const status = this.telepresenceService.getConnectionStatus();
        const intercepts = await this.telepresenceService.listIntercepts();

        this._panel.webview.postMessage({
            command: 'update',
            status,
            intercepts
        });
    }

    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telepresence Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 24px;
            font-weight: 600;
        }

        .status-badge {
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
        }

        .status-connected {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-button-foreground);
        }

        .status-disconnected {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-button-foreground);
        }

        .section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .section h2 {
            font-size: 18px;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .info-item {
            background-color: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }

        .info-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }

        .info-value {
            font-size: 14px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:active {
            opacity: 0.8;
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        button.danger {
            background-color: var(--vscode-testing-iconFailed);
        }

        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .intercepts-list {
            list-style: none;
        }

        .intercept-item {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .intercept-info h3 {
            font-size: 16px;
            margin-bottom: 5px;
            color: var(--vscode-foreground);
        }

        .intercept-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .intercept-port {
            font-family: monospace;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 15px;
            opacity: 0.5;
        }

        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.2s;
        }

        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 70vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .modal-header h2 {
            font-size: 18px;
            margin: 0;
        }

        .close-button {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--vscode-foreground);
            padding: 0;
            width: 30px;
            height: 30px;
        }

        .namespace-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .namespace-item {
            padding: 12px;
            margin-bottom: 8px;
            background-color: var(--vscode-list-hoverBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .namespace-item:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
            border-color: var(--vscode-focusBorder);
        }

        .namespace-item.default {
            border: 2px solid var(--vscode-button-background);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            background-color: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-notifications-border);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 2000;
            animation: slideIn 0.3s;
            max-width: 400px;
        }

        .notification.success {
            border-left: 4px solid var(--vscode-testing-iconPassed);
        }

        .notification.error {
            border-left: 4px solid var(--vscode-testing-iconFailed);
        }

        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Loading overlay */
        .loading-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 3000;
            align-items: center;
            justify-content: center;
        }

        .loading-overlay.show {
            display: flex;
        }

        .loading-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 30px 40px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid var(--vscode-panel-border);
            border-top: 4px solid var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-message {
            font-size: 16px;
            color: var(--vscode-foreground);
            font-weight: 500;
        }
    </style>
</head>
<body>
    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-content">
            <div class="spinner"></div>
            <div id="loadingMessage" class="loading-message">Loading...</div>
        </div>
    </div>

    <div class="header">
        <h1>🚀 Telepresence Dashboard</h1>
        <div id="statusBadge" class="status-badge">Loading...</div>
    </div>

    <div class="section">
        <h2>Connection</h2>
        <div id="connectionInfo"></div>
        <div class="button-group">
            <button id="connectBtn">Connect to Cluster</button>
            <button id="disconnectBtn" class="danger">Disconnect</button>
            <button class="secondary" onclick="refresh()">🔄 Refresh</button>
        </div>
    </div>

    <div class="section">
        <h2>Intercepts</h2>
        <button style="margin-bottom: 15px;" onclick="createIntercept()">+ Create New Intercept</button>
        <ul id="interceptsList" class="intercepts-list"></ul>
    </div>

    <!-- Namespace Selection Modal -->
    <div id="namespaceModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Select Namespace</h2>
                <button class="close-button" onclick="closeModal()">&times;</button>
            </div>
            <div id="namespaceModalContent">
                <div class="loading">Loading namespaces...</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let currentStatus = null;
        let currentIntercepts = [];

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'update':
                    currentStatus = message.status;
                    currentIntercepts = message.intercepts;
                    updateUI();
                    break;
                case 'namespacesList':
                    showNamespaceModal(message.namespaces);
                    break;
                case 'notification':
                    showNotification(message.type, message.message);
                    break;
                case 'setLoading':
                    setLoading(message.loading, message.message);
                    break;
            }
        });

        document.getElementById('connectBtn').addEventListener('click', () => {
            // Request namespaces from backend
            vscode.postMessage({ command: 'getNamespaces' });
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'disconnect' });
        });

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        function createIntercept() {
            vscode.postMessage({ command: 'createIntercept' });
        }

        function removeIntercept(name) {
            vscode.postMessage({ command: 'removeIntercept', name });
        }

        function showNamespaceModal(namespaces) {
            const modal = document.getElementById('namespaceModal');
            const content = document.getElementById('namespaceModalContent');

            if (!namespaces || namespaces.length === 0) {
                content.innerHTML = \`
                    <p style="margin-bottom: 15px; color: var(--vscode-descriptionForeground);">
                        Could not fetch namespaces. Connect with default namespace?
                    </p>
                    <div class="button-group">
                        <button onclick="connectWithNamespace()">Connect with Default</button>
                        <button class="secondary" onclick="closeModal()">Cancel</button>
                    </div>
                \`;
            } else {
                const namespaceItems = [
                    \`<li class="namespace-item default" onclick="connectWithNamespace()">
                        <strong>🏠 Default</strong>
                        <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                            Use default namespace from kubeconfig
                        </div>
                    </li>\`,
                    ...namespaces.map(ns => \`
                        <li class="namespace-item" onclick="connectWithNamespace('\${ns}')">
                            <strong>📦 \${ns}</strong>
                        </li>
                    \`)
                ].join('');

                content.innerHTML = \`
                    <ul class="namespace-list">
                        \${namespaceItems}
                    </ul>
                \`;
            }

            modal.classList.add('show');
        }

        function closeModal() {
            const modal = document.getElementById('namespaceModal');
            modal.classList.remove('show');
        }

        function connectWithNamespace(namespace) {
            closeModal();
            vscode.postMessage({ 
                command: 'connect',
                namespace: namespace
            });
        }

        function showNotification(type, message) {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideIn 0.3s reverse';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        function setLoading(loading, message) {
            const overlay = document.getElementById('loadingOverlay');
            const messageEl = document.getElementById('loadingMessage');
            
            if (loading) {
                messageEl.textContent = message || 'Loading...';
                overlay.classList.add('show');
            } else {
                overlay.classList.remove('show');
            }
        }

        function updateUI() {
            // Update status badge
            const badge = document.getElementById('statusBadge');
            if (currentStatus && currentStatus.connected) {
                badge.textContent = 'Connected';
                badge.className = 'status-badge status-connected';
            } else {
                badge.textContent = 'Disconnected';
                badge.className = 'status-badge status-disconnected';
            }

            // Update connection info
            const connectionInfo = document.getElementById('connectionInfo');
            if (currentStatus && currentStatus.connected) {
                connectionInfo.innerHTML = \`
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">✓ Connected</div>
                        </div>
                        \${currentStatus.context ? \`
                            <div class="info-item">
                                <div class="info-label">Context</div>
                                <div class="info-value">\${currentStatus.context}</div>
                            </div>
                        \` : ''}
                        \${currentStatus.namespace ? \`
                            <div class="info-item">
                                <div class="info-label">Namespace</div>
                                <div class="info-value">\${currentStatus.namespace}</div>
                            </div>
                        \` : ''}
                    </div>
                \`;
                document.getElementById('connectBtn').style.display = 'none';
                document.getElementById('disconnectBtn').style.display = 'inline-block';
            } else {
                connectionInfo.innerHTML = \`
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">Not connected</div>
                        </div>
                    </div>
                \`;
                document.getElementById('connectBtn').style.display = 'inline-block';
                document.getElementById('disconnectBtn').style.display = 'none';
            }

            // Update intercepts list
            const interceptsList = document.getElementById('interceptsList');
            if (currentIntercepts.length === 0) {
                interceptsList.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <p>No active intercepts</p>
                        <p style="font-size: 12px; margin-top: 5px;">Create one to redirect service traffic to your local machine</p>
                    </div>
                \`;
            } else {
                interceptsList.innerHTML = currentIntercepts.map(intercept => \`
                    <li class="intercept-item">
                        <div class="intercept-info">
                            <h3>\${intercept.name}</h3>
                            <div class="intercept-details">
                                Service: <strong>\${intercept.serviceName}</strong> • 
                                Port: <span class="intercept-port">\${intercept.servicePort} → localhost:\${intercept.localPort}</span>
                            </div>
                        </div>
                        <button class="danger" onclick="removeIntercept('\${intercept.name}')">Remove</button>
                    </li>
                \`).join('');
            }
        }

        // Request initial update
        refresh();
    </script>
</body>
</html>`;
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

