import * as vscode from 'vscode';
import { TelepresenceService } from '../telepresenceService';
import { logger } from '../logger';
import { CONTEXT_VALUES, COLORS, ICONS, MESSAGES, COMMANDS } from '../constants';

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private namespaces: string[] = [];
    private loadingNamespaces = false;

    constructor(private telepresenceService: TelepresenceService) {}

    refresh(): void {
        logger.debug('Refreshing status view');
        this._onDidChangeTreeData.fire();
    }

    clearNamespaceCache(): void {
        this.namespaces = [];
    }

    getTreeItem(element: StatusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: StatusItem): Promise<StatusItem[]> {
        if (element?.contextValue === CONTEXT_VALUES.CONNECT_BUTTON) {
            return await this.getNamespaceItems();
        }

        if (element) {
            return [];
        }

        const status = this.telepresenceService.getConnectionStatus();
        const items: StatusItem[] = [];

        if (status.connected) {
            const statusItem = new StatusItem(
                MESSAGES.CONNECTED,
                `✓ ${MESSAGES.ACTIVE_CONNECTION}`,
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.CONNECTED, new vscode.ThemeColor(COLORS.SUCCESS))
            );
            statusItem.contextValue = CONTEXT_VALUES.CONNECTED;
            statusItem.tooltip = 'Click to disconnect';
            statusItem.command = {
                command: COMMANDS.DISCONNECT,
                title: 'Disconnect'
            };
            items.push(statusItem);

            if (status.context) {
                const contextItem = new StatusItem(
                    'Cluster',
                    status.context,
                    vscode.TreeItemCollapsibleState.None,
                    new vscode.ThemeIcon(ICONS.SERVER)
                );
                contextItem.tooltip = `Context: ${status.context}`;
                items.push(contextItem);
            }

            if (status.namespace) {
                const nsItem = new StatusItem(
                    'Namespace',
                    status.namespace,
                    vscode.TreeItemCollapsibleState.None,
                    new vscode.ThemeIcon(ICONS.NAMESPACE, new vscode.ThemeColor(COLORS.PURPLE))
                );
                nsItem.tooltip = `Current namespace: ${status.namespace}`;
                items.push(nsItem);
            }

            const refreshItem = new StatusItem(
                'Refresh Status',
                'Update connection info',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.REFRESH)
            );
            refreshItem.contextValue = CONTEXT_VALUES.REFRESH;
            refreshItem.command = {
                command: COMMANDS.REFRESH_STATUS,
                title: 'Refresh'
            };
            items.push(refreshItem);

        } else {
            const statusItem = new StatusItem(
                MESSAGES.DISCONNECTED,
                MESSAGES.NOT_CONNECTED,
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.DISCONNECTED, new vscode.ThemeColor(COLORS.ERROR))
            );
            statusItem.contextValue = CONTEXT_VALUES.DISCONNECTED;
            items.push(statusItem);

            const connectButton = new StatusItem(
                MESSAGES.CONNECT_TO_CLUSTER,
                MESSAGES.EXPAND_TO_SELECT,
                vscode.TreeItemCollapsibleState.Collapsed,
                new vscode.ThemeIcon(ICONS.PLUG, new vscode.ThemeColor(COLORS.GREEN))
            );
            connectButton.contextValue = CONTEXT_VALUES.CONNECT_BUTTON;
            connectButton.tooltip = 'Expand to see available namespaces';
            items.push(connectButton);
        }

        return items;
    }

    private async getNamespaceItems(): Promise<StatusItem[]> {
        const items: StatusItem[] = [];

        if (this.loadingNamespaces) {
            const loadingItem = new StatusItem(
                'Loading namespaces...',
                'Please wait',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.LOADING)
            );
            return [loadingItem];
        }

        if (this.namespaces.length === 0) {
            this.loadingNamespaces = true;
            this._onDidChangeTreeData.fire();
            
            try {
                this.namespaces = await this.telepresenceService.getNamespaces();
            } catch (error) {
                logger.error('Failed to fetch namespaces', error);
                this.loadingNamespaces = false;
                
                const errorItem = new StatusItem(
                    'Failed to fetch namespaces',
                    'Click to retry',
                    vscode.TreeItemCollapsibleState.None,
                    new vscode.ThemeIcon(ICONS.ERROR)
                );
                errorItem.command = {
                    command: COMMANDS.CONNECT,
                    title: 'Retry'
                };
                return [errorItem];
            }
            
            this.loadingNamespaces = false;
            this._onDidChangeTreeData.fire();
        }

        const defaultItem = new StatusItem(
            MESSAGES.DEFAULT_NAMESPACE,
            MESSAGES.USE_KUBECONFIG_DEFAULT,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon(ICONS.HOME, new vscode.ThemeColor(COLORS.BLUE))
        );
        defaultItem.contextValue = CONTEXT_VALUES.NAMESPACE_OPTION;
        defaultItem.command = {
            command: COMMANDS.CONNECT_TO_NAMESPACE,
            title: 'Connect',
            arguments: [undefined]
        };
        defaultItem.tooltip = 'Connect with default namespace from kubeconfig';
        items.push(defaultItem);

        if (this.namespaces.length > 0) {
            for (const ns of this.namespaces) {
                const nsItem = new StatusItem(
                    ns,
                    'Click to connect',
                    vscode.TreeItemCollapsibleState.None,
                    new vscode.ThemeIcon(ICONS.NAMESPACE, new vscode.ThemeColor(COLORS.PURPLE))
                );
                nsItem.contextValue = CONTEXT_VALUES.NAMESPACE_OPTION;
                nsItem.command = {
                    command: COMMANDS.CONNECT_TO_NAMESPACE,
                    title: 'Connect',
                    arguments: [ns]
                };
                nsItem.tooltip = `Connect to namespace: ${ns}`;
                items.push(nsItem);
            }
        } else {
            const noNsItem = new StatusItem(
                MESSAGES.NO_NAMESPACES,
                'Use default or check cluster access',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.WARNING)
            );
            items.push(noNsItem);
        }

        return items;
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
    }
}
