import * as vscode from 'vscode';
import { TelepresenceService, Intercept } from '../telepresenceService';
import { logger } from '../logger';
import { CONTEXT_VALUES, COLORS, ICONS, MESSAGES, COMMANDS } from '../constants';

export class InterceptsProvider implements vscode.TreeDataProvider<InterceptItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<InterceptItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private telepresenceService: TelepresenceService) {}

    refresh(): void {
        logger.debug('Refreshing intercepts view');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: InterceptItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: InterceptItem): Promise<InterceptItem[]> {
        if (element?.contextValue === CONTEXT_VALUES.INTERCEPT && element.intercept) {
            return this.getInterceptDetails(element.intercept);
        }
        
        if (element) {
            return [];
        }

        const intercepts = await this.telepresenceService.listIntercepts();
        const items: InterceptItem[] = [];

        const createButton = new InterceptItem(
            MESSAGES.CREATE_NEW_INTERCEPT,
            MESSAGES.CLICK_TO_ADD,
            vscode.TreeItemCollapsibleState.None
        );
        createButton.contextValue = CONTEXT_VALUES.CREATE_BUTTON;
        createButton.iconPath = new vscode.ThemeIcon(ICONS.ADD, new vscode.ThemeColor(COLORS.GREEN));
        createButton.command = {
            command: COMMANDS.CREATE_INTERCEPT,
            title: 'Create Intercept'
        };
        items.push(createButton);

        if (intercepts.length === 0) {
            const emptyItem = new InterceptItem(
                MESSAGES.NO_ACTIVE_INTERCEPTS,
                'Create one to get started',
                vscode.TreeItemCollapsibleState.None
            );
            emptyItem.contextValue = CONTEXT_VALUES.EMPTY;
            emptyItem.iconPath = new vscode.ThemeIcon(ICONS.INFO);
            items.push(emptyItem);
        } else {
            for (const intercept of intercepts) {
                const portMapping = `${intercept.servicePort} → :${intercept.localPort}`;
                const item = new InterceptItem(
                    intercept.name,
                    portMapping,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                item.contextValue = CONTEXT_VALUES.INTERCEPT;
                item.iconPath = new vscode.ThemeIcon(ICONS.ARROW_SWAP, new vscode.ThemeColor(COLORS.BLUE));
                item.intercept = intercept;
                item.tooltip = new vscode.MarkdownString(
                    `**${intercept.name}**\n\n` +
                    `Service: \`${intercept.serviceName}\`\n\n` +
                    `Port: \`${intercept.servicePort}\` → \`localhost:${intercept.localPort}\`\n\n` +
                    `Expand for details • Use 🗑️ to remove`
                );
                items.push(item);
            }
        }

        return items;
    }

    private getInterceptDetails(intercept: Intercept): InterceptItem[] {
        const details: InterceptItem[] = [];

        if (intercept.workloadKind) {
            const item = new InterceptItem('Workload', intercept.workloadKind, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon(ICONS.LAYERS);
            item.contextValue = CONTEXT_VALUES.DETAIL;
            details.push(item);
        }

        if (intercept.state) {
            const isActive = intercept.state === 'ACTIVE';
            const item = new InterceptItem('State', intercept.state, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon(
                isActive ? ICONS.CHECK : 'circle-outline',
                isActive ? new vscode.ThemeColor(COLORS.SUCCESS) : undefined
            );
            item.contextValue = CONTEXT_VALUES.DETAIL;
            details.push(item);
        }

        const remoteItem = new InterceptItem('Remote Port', intercept.servicePort.toString(), vscode.TreeItemCollapsibleState.None);
        remoteItem.iconPath = new vscode.ThemeIcon(ICONS.CLOUD);
        remoteItem.contextValue = CONTEXT_VALUES.DETAIL;
        details.push(remoteItem);

        const localItem = new InterceptItem('Local Port', `localhost:${intercept.localPort}`, vscode.TreeItemCollapsibleState.None);
        localItem.iconPath = new vscode.ThemeIcon(ICONS.DESKTOP);
        localItem.contextValue = CONTEXT_VALUES.DETAIL;
        details.push(localItem);

        if (intercept.volumeMount) {
            const item = new InterceptItem('Volume Mount', intercept.volumeMount, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon(ICONS.FOLDER_OPENED, new vscode.ThemeColor(COLORS.YELLOW));
            item.contextValue = CONTEXT_VALUES.DETAIL;
            details.push(item);
        }

        return details;
    }
}

class InterceptItem extends vscode.TreeItem {
    public intercept?: Intercept;
    
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}
