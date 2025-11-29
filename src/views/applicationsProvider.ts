import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Application, ApplicationService } from '../applicationService';
import { CONTEXT_VALUES, ICONS, VIEWS, COLORS, COMMANDS } from '../constants';
import { logger } from '../logger';

export class ApplicationsProvider implements vscode.TreeDataProvider<ApplicationItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ApplicationItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private applicationService: ApplicationService) {
        this.applicationService.onDidChangeApplications(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ApplicationItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ApplicationItem): Promise<ApplicationItem[]> {
        if (element) {
            return []; // No nested items for now, flat list
        }

        const apps = this.applicationService.getApplications();
        
        if (apps.length === 0) {
            const emptyItem = new ApplicationItem(
                'No pinned applications',
                'Add an application to get started',
                vscode.TreeItemCollapsibleState.None,
                new vscode.ThemeIcon(ICONS.INFO)
            );
            emptyItem.contextValue = CONTEXT_VALUES.EMPTY;
            return [emptyItem];
        }

        return apps.map(app => new ApplicationItem(
            app.name,
            `${app.namespace} • ${app.language || 'other'}`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon(ICONS.LAYERS),
            app
        ));
    }

    async detectRunCommands(app: Application): Promise<string[]> {
        const commands: string[] = [];
        const dir = app.workingDirectory;

        try {
            if (app.language === 'node') {
                const pkgPath = path.join(dir, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    if (pkg.scripts) {
                        commands.push(...Object.keys(pkg.scripts).map(s => `npm run ${s}`));
                        commands.push(...Object.keys(pkg.scripts).map(s => `yarn ${s}`));
                    }
                }
            } else if (app.language === 'csharp') {
                const launchSettingsPath = path.join(dir, 'Properties', 'launchSettings.json');
                if (fs.existsSync(launchSettingsPath)) {
                    // This is a complex JSON, usually profiles are keys under "profiles"
                    // Parsing simply for now
                    try {
                        const settings = JSON.parse(fs.readFileSync(launchSettingsPath, 'utf8'));
                        if (settings.profiles) {
                            commands.push(...Object.keys(settings.profiles).map(p => `dotnet run --launch-profile "${p}"`));
                        }
                    } catch (e) {
                        logger.warn('Failed to parse launchSettings.json', e);
                    }
                }
                commands.push('dotnet run');
            } else if (app.language === 'java') {
                if (fs.existsSync(path.join(dir, 'pom.xml'))) {
                    commands.push('mvn spring-boot:run');
                    commands.push('mvn jetty:run');
                    commands.push('mvn clean install');
                }
                if (fs.existsSync(path.join(dir, 'build.gradle'))) {
                    commands.push('gradle bootRun');
                    commands.push('gradle run');
                }
            }
        } catch (error) {
            logger.error(`Error detecting run commands for ${app.name}`, error);
        }

        return commands;
    }
}

export class ApplicationItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly app?: Application
    ) {
        super(label, collapsibleState);
        
        if (app) {
            this.contextValue = 'application'; // Custom context value for menu contribution
            this.tooltip = `Deployment: ${app.deploymentName}\nNamespace: ${app.namespace}\nPath: ${app.workingDirectory}`;
            
            // If run command is configured, make click action run it? Or just select?
            // Usually click selects, we rely on context menu buttons.
        }
    }
}

