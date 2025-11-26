import * as vscode from 'vscode';
import { TelepresenceService } from './telepresenceService';
import { InterceptsProvider } from './views/interceptsProvider';
import { StatusProvider } from './views/statusProvider';
import { DashboardPanel } from './views/dashboardPanel';
import { SettingsPanel } from './views/settingsPanel';
import { SettingsManager } from './settingsManager';
import { logger } from './logger';
import { COMMANDS, VIEWS, SETTINGS, DEFAULTS, MESSAGES, ICONS } from './constants';

let telepresenceService: TelepresenceService;
let statusBarItem: vscode.StatusBarItem;
let statusProvider: StatusProvider;
let interceptsProvider: InterceptsProvider;
let statusPollingInterval: NodeJS.Timeout | undefined;
let settingsManager: SettingsManager;

export function activate(context: vscode.ExtensionContext): void {
    logger.info('Telepresence extension activating...');

    initializeServices(context);
    initializeStatusBar(context);
    initializeTreeViews();
    registerCommands(context);
    registerEventListeners(context);
    startStatusPolling();

    logger.info('Telepresence extension activated');
}

function initializeServices(context: vscode.ExtensionContext): void {
    telepresenceService = new TelepresenceService();
    settingsManager = new SettingsManager(context);
}

function initializeStatusBar(context: vscode.ExtensionContext): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = COMMANDS.SHOW_STATUS;
    statusBarItem.text = `$(${ICONS.CLOUD}) Telepresence: ${MESSAGES.DISCONNECTED}`;
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

function initializeTreeViews(): void {
    interceptsProvider = new InterceptsProvider(telepresenceService);
    statusProvider = new StatusProvider(telepresenceService);

    vscode.window.registerTreeDataProvider(VIEWS.INTERCEPTS, interceptsProvider);
    vscode.window.registerTreeDataProvider(VIEWS.STATUS, statusProvider);
}

function registerCommands(context: vscode.ExtensionContext): void {
    const commands: Array<{ id: string; handler: (...args: any[]) => Promise<void> | void }> = [
        { id: COMMANDS.CONNECT, handler: handleConnect },
        { id: COMMANDS.DISCONNECT, handler: handleDisconnect },
        { id: COMMANDS.CREATE_INTERCEPT, handler: handleCreateIntercept },
        { id: COMMANDS.LIST_INTERCEPTS, handler: handleListIntercepts },
        { id: COMMANDS.REMOVE_INTERCEPT, handler: handleRemoveIntercept },
        { id: COMMANDS.SHOW_INTERCEPT_DETAILS, handler: handleShowInterceptDetails },
        { id: COMMANDS.SHOW_STATUS, handler: handleStatus },
        { id: COMMANDS.REFRESH_INTERCEPTS, handler: () => refreshViews() },
        { id: COMMANDS.REFRESH_STATUS, handler: () => statusProvider.refresh() },
        { id: COMMANDS.OPEN_DASHBOARD, handler: () => DashboardPanel.createOrShow(telepresenceService) },
        { id: COMMANDS.OPEN_SETTINGS, handler: () => SettingsPanel.createOrShow(settingsManager) },
        { id: COMMANDS.OPEN_SETTINGS_FILE, handler: () => settingsManager.openSettingsFile() },
        { id: COMMANDS.CONNECT_TO_NAMESPACE, handler: handleConnectToNamespace },
        { id: COMMANDS.DEBUG_STATUS, handler: handleDebugStatus },
    ];

    for (const cmd of commands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(cmd.id, async (...args: any[]) => {
                try {
                    await cmd.handler(...args);
                } catch (error: any) {
                    logger.error(`Command ${cmd.id} failed`, error);
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            })
        );
    }
}

function registerEventListeners(context: vscode.ExtensionContext): void {
    telepresenceService.onStatusChange(() => {
        updateStatusBar();
        refreshViews();
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(`${SETTINGS.CONFIG_SECTION}.${SETTINGS.POLLING_INTERVAL}`) || 
                e.affectsConfiguration(`${SETTINGS.CONFIG_SECTION}.${SETTINGS.AUTO_REFRESH}`)) {
                logger.debug('Configuration changed, restarting polling');
                startStatusPolling();
            }
        })
    );

    checkInitialStatus();
}

function startStatusPolling(): void {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
    }

    const config = vscode.workspace.getConfiguration(SETTINGS.CONFIG_SECTION);
    const autoRefresh = config.get<boolean>(SETTINGS.AUTO_REFRESH, DEFAULTS.AUTO_REFRESH);
    
    if (!autoRefresh) {
        logger.debug('Auto-refresh is disabled');
        return;
    }

    const intervalSeconds = config.get<number>(SETTINGS.POLLING_INTERVAL, DEFAULTS.POLLING_INTERVAL);
    const intervalMs = intervalSeconds * 1000;

    logger.debug(`Starting status polling every ${intervalSeconds} seconds`);

    statusPollingInterval = setInterval(async () => {
        try {
            const previousStatus = telepresenceService.getConnectionStatus();
            await telepresenceService.checkStatus();
            const currentStatus = telepresenceService.getConnectionStatus();

            if (previousStatus.connected !== currentStatus.connected ||
                previousStatus.namespace !== currentStatus.namespace ||
                previousStatus.context !== currentStatus.context) {
                logger.debug('Status changed, updating UI');
                updateStatusBar();
                refreshViews();
            }
        } catch (error) {
            logger.error('Status polling error', error);
        }
    }, intervalMs);
}

async function checkInitialStatus(): Promise<void> {
    try {
        await telepresenceService.checkStatus();
        updateStatusBar();
        refreshViews();
    } catch (error) {
        logger.error('Failed to check initial status', error);
    }
}

function updateStatusBar(): void {
    const status = telepresenceService.getConnectionStatus();
    const icon = status.connected ? ICONS.CONNECTED : ICONS.CLOUD;
    const text = status.connected ? MESSAGES.CONNECTED : MESSAGES.DISCONNECTED;
    statusBarItem.text = `$(${icon}) Telepresence: ${text}`;
}

function refreshViews(): void {
    interceptsProvider.refresh();
    statusProvider.refresh();
}

async function handleConnect(): Promise<void> {
    const currentStatus = telepresenceService.getConnectionStatus();
    
    if (currentStatus.connected) {
        const response = await vscode.window.showWarningMessage(
            'Already connected. Disconnect first?',
            'Disconnect', 'Cancel'
        );
        if (response === 'Disconnect') {
            await handleDisconnect();
        }
        return;
    }

    const namespaces = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: MESSAGES.FETCHING_NAMESPACES,
        cancellable: false
    }, () => telepresenceService.getNamespaces());

    let selectedNamespace: string | undefined;

    if (namespaces.length === 0) {
        const response = await vscode.window.showWarningMessage(
            'Could not fetch namespaces. Connect with default?',
            'Connect', 'Cancel'
        );
        if (response !== 'Connect') return;
    } else {
        const items = [
            { label: `$(${ICONS.HOME}) Default`, description: MESSAGES.USE_KUBECONFIG_DEFAULT, namespace: undefined },
            ...namespaces.map(ns => ({ label: `$(${ICONS.NAMESPACE}) ${ns}`, description: '', namespace: ns }))
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: MESSAGES.SELECT_NAMESPACE,
            title: 'Telepresence: Choose Namespace',
            ignoreFocusOut: true
        });

        if (!selected) return;
        selectedNamespace = selected.namespace;
    }

    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: selectedNamespace ? `${MESSAGES.CONNECTING} (${selectedNamespace})` : MESSAGES.CONNECTING,
        cancellable: false
    }, () => telepresenceService.connect(selectedNamespace));

    if (result.success) {
        await telepresenceService.checkStatus();
        vscode.window.showInformationMessage(`✓ ${MESSAGES.CONNECT_SUCCESS}!`);
    } else {
        vscode.window.showErrorMessage(`${MESSAGES.CONNECT_FAILED}: ${result.error}`);
    }
}

async function handleDisconnect(): Promise<void> {
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: MESSAGES.DISCONNECTING,
        cancellable: false
    }, () => telepresenceService.disconnect());

    if (result.success) {
        vscode.window.showInformationMessage(MESSAGES.DISCONNECT_SUCCESS);
    } else {
        vscode.window.showErrorMessage(`${MESSAGES.DISCONNECT_FAILED}: ${result.error}`);
    }
}

async function handleCreateIntercept(): Promise<void> {
    const status = telepresenceService.getConnectionStatus();
    
    if (!status.connected) {
        vscode.window.showWarningMessage(MESSAGES.PLEASE_CONNECT_FIRST);
        return;
    }

    const deployments = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: MESSAGES.FETCHING_DEPLOYMENTS,
        cancellable: false
    }, () => telepresenceService.getDeployments(status.namespace));

    if (deployments.length === 0) {
        vscode.window.showErrorMessage(MESSAGES.NO_DEPLOYMENTS);
        return;
    }

    const selectedDeployment = await vscode.window.showQuickPick(
        deployments.map(d => ({ label: d, description: 'Deployment' })),
        { placeHolder: MESSAGES.SELECT_DEPLOYMENT, title: 'Telepresence: Choose Deployment' }
    );

    if (!selectedDeployment) return;
    const serviceName = selectedDeployment.label;

    const ports = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: MESSAGES.FETCHING_PORTS,
        cancellable: false
    }, () => telepresenceService.getServicePorts(serviceName, status.namespace));

    let servicePort: number;
    let defaultLocalPort: number | undefined;

    if (ports) {
        servicePort = ports.servicePort;
        defaultLocalPort = ports.targetPort;
    } else {
        const portStr = await vscode.window.showInputBox({
            prompt: MESSAGES.ENTER_SERVICE_PORT,
            placeHolder: '443',
            validateInput: validatePort
        });
        if (!portStr) return;
        servicePort = parseInt(portStr);
    }

    const useDefault = await vscode.window.showQuickPick([
        { label: 'Yes', description: defaultLocalPort ? `Use port ${defaultLocalPort}` : 'Use service port', value: true },
        { label: 'No', description: 'Specify manually', value: false }
    ], { placeHolder: MESSAGES.USE_DEFAULT_PORT, title: 'Telepresence: Local Port' });

    if (!useDefault) return;

    let localPort: number;
    if (useDefault.value) {
        localPort = defaultLocalPort || servicePort;
    } else {
        const portStr = await vscode.window.showInputBox({
            prompt: MESSAGES.ENTER_LOCAL_PORT,
            placeHolder: (defaultLocalPort || servicePort).toString(),
            value: (defaultLocalPort || servicePort).toString(),
            validateInput: validatePort
        });
        if (!portStr) return;
        localPort = parseInt(portStr);
    }

    const httpHeader = await settingsManager.getHeaderForService(serviceName);

    if (!httpHeader.value) {
        const response = await vscode.window.showWarningMessage(
            'No HTTP header value configured. Personal intercepts require a header value.',
            'Set Value', 'Cancel'
        );

        if (response === 'Set Value') {
            const headerValue = await vscode.window.showInputBox({
                prompt: `Enter value for header "${httpHeader.name}"`,
                placeHolder: 'your-username',
                validateInput: v => (!v?.trim() ? 'Value required' : null)
            });
            if (!headerValue) return;

            httpHeader.value = headerValue;
            const config = vscode.workspace.getConfiguration(SETTINGS.CONFIG_SECTION);
            await config.update(SETTINGS.HTTP_HEADER_DEFAULT_VALUE, headerValue, vscode.ConfigurationTarget.Global);
        } else {
            return;
        }
    }

    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${MESSAGES.CREATING_INTERCEPT} ${serviceName}...`,
        cancellable: false
    }, () => telepresenceService.createIntercept(serviceName, localPort, servicePort, httpHeader));

    if (result.success) {
        vscode.window.showInformationMessage(
            `✓ ${MESSAGES.INTERCEPT_CREATED} for ${serviceName}!\n` +
            `Port: ${servicePort} → localhost:${localPort}\n` +
            `Header: ${httpHeader.name}=${httpHeader.value}`
        );
    } else {
        vscode.window.showErrorMessage(`${MESSAGES.INTERCEPT_FAILED}: ${result.error}`);
    }
}

async function handleRemoveIntercept(item?: any): Promise<void> {
    let interceptName: string | undefined;
    
    if (typeof item === 'string') {
        interceptName = item;
    } else if (item?.intercept?.name) {
        interceptName = item.intercept.name;
    } else if (item?.label) {
        interceptName = item.label;
    }

    if (!interceptName) {
        const intercepts = await telepresenceService.listIntercepts();
        if (intercepts.length === 0) {
            vscode.window.showInformationMessage(MESSAGES.NO_ACTIVE_INTERCEPTS);
            return;
        }

        const selected = await vscode.window.showQuickPick(
            intercepts.map(i => ({ label: i.name, description: i.serviceName })),
            { placeHolder: 'Select intercept to remove' }
        );
        if (!selected) return;
        interceptName = selected.label;
    }

    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${MESSAGES.REMOVING_INTERCEPT} ${interceptName}...`,
        cancellable: false
    }, () => telepresenceService.removeIntercept(interceptName!));

    if (result.success) {
        vscode.window.showInformationMessage(`${MESSAGES.INTERCEPT_REMOVED}: ${interceptName}`);
    } else {
        vscode.window.showErrorMessage(`${MESSAGES.REMOVE_INTERCEPT_FAILED}: ${result.error}`);
    }
}

async function handleListIntercepts(): Promise<void> {
    const intercepts = await telepresenceService.listIntercepts();
    
    if (intercepts.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.NO_ACTIVE_INTERCEPTS);
        return;
    }

    const info = intercepts.map(i => 
        `${i.name}: ${i.serviceName}:${i.servicePort} → localhost:${i.localPort}`
    ).join('\n');

    vscode.window.showInformationMessage(`Active Intercepts:\n${info}`, { modal: true });
}

async function handleShowInterceptDetails(intercept: any): Promise<void> {
    if (!intercept) return;

    const message = `Intercept: ${intercept.name}\n` +
                   `Service: ${intercept.serviceName}\n` +
                   `Port: ${intercept.servicePort} → localhost:${intercept.localPort}`;

    const action = await vscode.window.showInformationMessage(
        message,
        { modal: false },
        'Remove Intercept'
    );

    if (action === 'Remove Intercept') {
        await handleRemoveIntercept(intercept.name);
    }
}

async function handleStatus(): Promise<void> {
    const status = telepresenceService.getConnectionStatus();
    const intercepts = await telepresenceService.listIntercepts();

    let message = `Connection: ${status.connected ? MESSAGES.CONNECTED : MESSAGES.DISCONNECTED}\n`;
    
    if (status.connected) {
        if (status.context) message += `Context: ${status.context}\n`;
        if (status.namespace) message += `Namespace: ${status.namespace}\n`;
    }

    message += `\nActive Intercepts: ${intercepts.length}`;

    if (intercepts.length > 0) {
        message += '\n\n' + intercepts.map(i => 
            `• ${i.name} (${i.servicePort} → localhost:${i.localPort})`
        ).join('\n');
    }

    vscode.window.showInformationMessage(message, { modal: true });
}

async function handleConnectToNamespace(namespace?: string): Promise<void> {
    const currentStatus = telepresenceService.getConnectionStatus();
    
    if (currentStatus.connected) {
        const response = await vscode.window.showWarningMessage(
            'Already connected. Disconnect first?',
            'Disconnect', 'Cancel'
        );
        if (response === 'Disconnect') {
            await handleDisconnect();
            statusProvider.clearNamespaceCache();
        }
        return;
    }

    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: namespace ? `Connecting to namespace "${namespace}"...` : 'Connecting to default namespace...',
        cancellable: false
    }, () => telepresenceService.connect(namespace));

    if (result.success) {
        await telepresenceService.checkStatus();
        vscode.window.showInformationMessage(`✓ ${MESSAGES.CONNECT_SUCCESS}!`);
        statusProvider.clearNamespaceCache();
    } else {
        vscode.window.showErrorMessage(`${MESSAGES.CONNECT_FAILED}: ${result.error}`);
    }
}

async function handleDebugStatus(): Promise<void> {
    await telepresenceService.debugStatus();
    vscode.window.showInformationMessage('Debug info logged to console', 'Open Output').then(selection => {
        if (selection === 'Open Output') {
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }
    });
}

function validatePort(value: string): string | null {
    const port = parseInt(value);
    if (isNaN(port) || port < 1 || port > 65535) {
        return 'Enter a valid port number (1-65535)';
    }
    return null;
}

export function deactivate(): void {
    logger.info('Telepresence extension deactivating...');
    
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = undefined;
    }

    telepresenceService?.dispose();
    logger.info('Telepresence extension deactivated');
}
