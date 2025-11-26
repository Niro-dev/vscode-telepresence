import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { SETTINGS, DEFAULTS, FILES } from './constants';

export interface ServiceOverride {
    headerValue: string;
}

export interface TelepresenceSettings {
    httpHeader: {
        name: string;
        defaultValue: string;
    };
    serviceOverrides: { [serviceName: string]: ServiceOverride };
}

export class SettingsManager {
    private readonly settingsFilePath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.settingsFilePath = path.join(context.globalStorageUri.fsPath, FILES.SETTINGS_JSON);
        logger.debug('Settings file path:', this.settingsFilePath);
    }

    private ensureDirectory(): void {
        const dir = path.dirname(this.settingsFilePath);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.debug('Created settings directory:', dir);
        }
    }

    private ensureSettingsFile(): void {
        this.ensureDirectory();

        if (!fs.existsSync(this.settingsFilePath)) {
            const defaultSettings: TelepresenceSettings = {
                httpHeader: {
                    name: DEFAULTS.HTTP_HEADER_NAME,
                    defaultValue: DEFAULTS.HTTP_HEADER_VALUE
                },
                serviceOverrides: {}
            };
            fs.writeFileSync(this.settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf8');
            logger.info('Created default settings file');
        }
    }

    async loadSettings(): Promise<TelepresenceSettings> {
        this.ensureSettingsFile();
        
        try {
            const content = fs.readFileSync(this.settingsFilePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            logger.error('Failed to load settings', error);
            return {
                httpHeader: {
                    name: DEFAULTS.HTTP_HEADER_NAME,
                    defaultValue: DEFAULTS.HTTP_HEADER_VALUE
                },
                serviceOverrides: {}
            };
        }
    }

    async saveSettings(settings: TelepresenceSettings): Promise<void> {
        this.ensureDirectory();
        
        try {
            fs.writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
            logger.debug('Settings saved');
        } catch (error) {
            logger.error('Failed to save settings', error);
            throw error;
        }
    }

    async getHeaderForService(serviceName: string): Promise<{ name: string; value: string }> {
        const config = vscode.workspace.getConfiguration(SETTINGS.CONFIG_SECTION);
        let headerName = config.get<string>(SETTINGS.HTTP_HEADER_NAME, DEFAULTS.HTTP_HEADER_NAME);
        let headerValue = config.get<string>(SETTINGS.HTTP_HEADER_DEFAULT_VALUE, DEFAULTS.HTTP_HEADER_VALUE);

        logger.debug(`VS Code settings - headerName: ${headerName}, headerValue: ${headerValue}`);

        const settings = await this.loadSettings();
        
        if (settings.serviceOverrides[serviceName]) {
            headerValue = settings.serviceOverrides[serviceName].headerValue;
            logger.debug(`Using service override for ${serviceName}: ${headerValue}`);
        } else if (!headerValue && settings.httpHeader.defaultValue) {
            headerValue = settings.httpHeader.defaultValue;
            logger.debug(`Using JSON default value: ${headerValue}`);
        }

        logger.debug(`Final header: ${headerName}=${headerValue}`);
        return { name: headerName, value: headerValue };
    }

    async openSettingsFile(): Promise<void> {
        this.ensureSettingsFile();
        
        try {
            const doc = await vscode.workspace.openTextDocument(this.settingsFilePath);
            await vscode.window.showTextDocument(doc);
            logger.debug('Opened settings file');
        } catch (error) {
            logger.error('Failed to open settings file', error);
            throw error;
        }
    }

    getSettingsFilePath(): string {
        return this.settingsFilePath;
    }
}
