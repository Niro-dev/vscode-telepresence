/**
 * Settings WebView Panel
 * Provides UI for managing extension settings
 */
import * as vscode from 'vscode';
import { SettingsManager } from '../settingsManager';
import { logger } from '../logger';
import { SETTINGS, MESSAGES } from '../constants';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly settingsManager: SettingsManager
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._update();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'updateSetting':
                        await this._updateSetting(message.key, message.value);
                        break;
                    case 'addOverride':
                        await this._addOverride(message.serviceName, message.headerValue);
                        break;
                    case 'removeOverride':
                        await this._removeOverride(message.serviceName);
                        break;
                    case 'openJsonFile':
                        await this.settingsManager.openSettingsFile();
                        break;
                    case 'refresh':
                        this._update();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(settingsManager: SettingsManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            SettingsPanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'telepresenceSettings',
            'Telepresence Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, settingsManager);
    }

    private async _updateSetting(key: string, value: any) {
        try {
            const config = vscode.workspace.getConfiguration('telepresence');
            await config.update(key, value, vscode.ConfigurationTarget.Global);
            this._update();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update setting: ${error}`);
        }
    }

    private async _addOverride(serviceName: string, headerValue: string) {
        try {
            const settings = await this.settingsManager.loadSettings();
            settings.serviceOverrides[serviceName] = { headerValue };
            await this.settingsManager.saveSettings(settings);
            vscode.window.showInformationMessage(`Override added for ${serviceName}`);
            this._update();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add override: ${error}`);
        }
    }

    private async _removeOverride(serviceName: string) {
        try {
            const settings = await this.settingsManager.loadSettings();
            delete settings.serviceOverrides[serviceName];
            await this.settingsManager.saveSettings(settings);
            vscode.window.showInformationMessage(`Override removed for ${serviceName}`);
            this._update();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to remove override: ${error}`);
        }
    }

    private async _update() {
        const config = vscode.workspace.getConfiguration('telepresence');
        const headerName = config.get<string>('httpHeaderName', 'x-telepresence-intercept');
        const defaultValue = config.get<string>('httpHeaderDefaultValue', '');
        const managerNamespace = config.get<string>('managerNamespace', '');
        const autoRefresh = config.get<boolean>('autoRefresh', true);
        const pollingInterval = config.get<number>('statusPollingInterval', 5);

        const settings = await this.settingsManager.loadSettings();

        this._panel.webview.html = this._getHtmlContent(
            headerName,
            defaultValue,
            managerNamespace,
            autoRefresh,
            pollingInterval,
            settings.serviceOverrides
        );
    }

    private _getHtmlContent(
        headerName: string,
        defaultValue: string,
        managerNamespace: string,
        autoRefresh: boolean,
        pollingInterval: number,
        serviceOverrides: { [key: string]: { headerValue: string } }
    ): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telepresence Settings</title>
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
            max-width: 800px;
        }

        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .subtitle {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 30px;
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

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        input[type="text"] {
            width: 100%;
            padding: 8px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            font-family: var(--vscode-font-family);
        }

        input[type="text"]:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
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

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 4px;
        }

        .info-box-title {
            font-weight: 600;
            margin-bottom: 5px;
        }

        .override-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        .toggle {
            display: inline-flex;
            align-items: center;
            cursor: pointer;
        }

        .toggle input {
            width: 40px;
            height: 20px;
            -webkit-appearance: none;
            appearance: none;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 10px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .toggle input:checked {
            background-color: var(--vscode-button-background);
        }

        .toggle input::before {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            top: 1px;
            left: 1px;
            background-color: var(--vscode-foreground);
            transition: left 0.2s;
        }

        .toggle input:checked::before {
            left: 21px;
        }

        .override-list {
            margin-top: 15px;
        }

        .override-item {
            display: flex;
            gap: 10px;
            align-items: center;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .override-item input {
            flex: 1;
        }

        .override-item button {
            padding: 6px 12px;
            min-width: 60px;
        }

        .add-override-section {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .add-override-section input {
            flex: 1;
        }

        input[type="number"] {
            width: 100px;
            padding: 8px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <h1>⚙️ Telepresence Settings</h1>
    <p class="subtitle">Configure your Telepresence extension preferences</p>

    <div class="section">
        <h2>General Settings</h2>
        
        <div class="form-group">
            <label for="managerNamespace">Traffic Manager Namespace</label>
            <input type="text" id="managerNamespace" value="${managerNamespace}" placeholder="telepresence" onchange="updateSetting('managerNamespace', this.value)">
            <div class="help-text">Namespace where the Traffic Manager is installed</div>
        </div>

        <div class="form-group">
            <label>Auto Refresh</label>
            <label class="toggle">
                <input type="checkbox" id="autoRefresh" ${autoRefresh ? 'checked' : ''} onchange="updateSetting('autoRefresh', this.checked)">
            </label>
            <div class="help-text">Automatically refresh connection status in the background</div>
        </div>

        <div class="form-group">
            <label for="pollingInterval">Status Polling Interval (seconds)</label>
            <input type="number" id="pollingInterval" value="${pollingInterval}" min="2" max="60" onchange="updateSetting('statusPollingInterval', parseInt(this.value))">
            <div class="help-text">How often to check Telepresence status (2-60 seconds)</div>
        </div>
    </div>

    <div class="section">
        <h2>Personal Intercept Configuration</h2>
        
        <div class="info-box">
            <div class="info-box-title">💡 What are Personal Intercepts?</div>
            <div>Personal intercepts use HTTP headers to route only specific requests to your local machine, allowing multiple developers to intercept the same service simultaneously.</div>
        </div>

        <div class="form-group">
            <label for="headerName">HTTP Header Name</label>
            <input type="text" id="headerName" value="${headerName}" placeholder="x-telepresence-intercept" onchange="updateSetting('httpHeaderName', this.value)">
            <div class="help-text">The HTTP header name used to identify personal intercepts</div>
        </div>

        <div class="form-group">
            <label for="defaultValue">Default Header Value</label>
            <input type="text" id="defaultValue" value="${defaultValue}" placeholder="your-username" onchange="updateSetting('httpHeaderDefaultValue', this.value)">
            <div class="help-text">Default value used for all intercepts (can be overridden per service)</div>
        </div>
    </div>

    <div class="section">
        <h2>Service-Specific Overrides</h2>
        
        <div class="override-info">
            <div>
                <strong>Custom Header Values</strong>
                <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                    Override the default header value for specific services
                </div>
            </div>
            <div>
                <span class="badge">${Object.keys(serviceOverrides).length} override${Object.keys(serviceOverrides).length !== 1 ? 's' : ''}</span>
            </div>
        </div>

        <div class="override-list" id="overrideList">
            ${Object.entries(serviceOverrides).map(([service, config]) => `
                <div class="override-item">
                    <input type="text" value="${service}" disabled style="flex: 0 0 200px;">
                    <input type="text" value="${config.headerValue}" onchange="updateOverride('${service}', this.value)">
                    <button class="danger" onclick="removeOverride('${service}')">🗑️ Remove</button>
                </div>
            `).join('')}
        </div>

        <div class="add-override-section">
            <input type="text" id="newServiceName" placeholder="Service name (e.g., auth-service)">
            <input type="text" id="newHeaderValue" placeholder="Header value (e.g., nir-auth)">
            <button onclick="addOverride()">➕ Add Override</button>
        </div>

        <button class="secondary" style="margin-top: 15px;" onclick="openJsonFile()">📝 Edit JSON File Manually</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function updateSetting(key, value) {
            vscode.postMessage({ 
                command: 'updateSetting',
                key,
                value
            });
        }

        function updateOverride(serviceName, headerValue) {
            vscode.postMessage({
                command: 'addOverride',
                serviceName,
                headerValue
            });
        }

        function addOverride() {
            const serviceName = document.getElementById('newServiceName').value.trim();
            const headerValue = document.getElementById('newHeaderValue').value.trim();
            
            if (!serviceName || !headerValue) {
                alert('Please enter both service name and header value');
                return;
            }
            
            vscode.postMessage({
                command: 'addOverride',
                serviceName,
                headerValue
            });

            // Clear inputs
            document.getElementById('newServiceName').value = '';
            document.getElementById('newHeaderValue').value = '';
        }

        function removeOverride(serviceName) {
            if (confirm(\`Remove override for "\${serviceName}"?\`)) {
                vscode.postMessage({
                    command: 'removeOverride',
                    serviceName
                });
            }
        }

        function openJsonFile() {
            vscode.postMessage({ command: 'openJsonFile' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

