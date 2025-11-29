import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { KubernetesService } from './kubernetesService';
import { MESSAGES } from './constants';

export interface Application {
    id: string;
    name: string;
    deploymentName: string;
    namespace: string;
    workingDirectory: string;
    language?: 'node' | 'python' | 'csharp' | 'java' | 'other';
    startFile?: string;
    runCommand?: string;
}

export class ApplicationService {
    private static readonly STORAGE_KEY = 'telepresence.applications';
    private _onDidChangeApplications = new vscode.EventEmitter<void>();
    readonly onDidChangeApplications = this._onDidChangeApplications.event;

    constructor(
        private context: vscode.ExtensionContext,
        private k8sService: KubernetesService
    ) {}

    getApplications(): Application[] {
        return this.context.globalState.get<Application[]>(ApplicationService.STORAGE_KEY) || [];
    }

    async addApplication(
        deploymentName: string, 
        namespace: string, 
        workingDirectory: string
    ): Promise<void> {
        const apps = this.getApplications();
        
        // Check if already exists
        const exists = apps.find(a => 
            a.deploymentName === deploymentName && 
            a.namespace === namespace && 
            a.workingDirectory === workingDirectory
        );
        
        if (exists) {
            throw new Error('Application already pinned');
        }

        const app: Application = {
            id: Date.now().toString(), // Simple ID generation
            name: deploymentName,
            deploymentName,
            namespace,
            workingDirectory,
            language: this.detectLanguage(workingDirectory)
        };

        apps.push(app);
        await this.saveApplications(apps);
        logger.info(`Added application: ${app.name}`);
    }

    async removeApplication(id: string): Promise<void> {
        const apps = this.getApplications();
        const newApps = apps.filter(a => a.id !== id);
        
        if (apps.length === newApps.length) {
            return;
        }

        await this.saveApplications(newApps);
        logger.info(`Removed application: ${id}`);
    }

    async updateApplication(id: string, updates: Partial<Application>): Promise<void> {
        const apps = this.getApplications();
        const index = apps.findIndex(a => a.id === id);
        
        if (index === -1) {
            throw new Error('Application not found');
        }

        apps[index] = { ...apps[index], ...updates };
        await this.saveApplications(apps);
        logger.info(`Updated application: ${id}`);
    }

    async extractEnvironment(app: Application): Promise<void> {
        const envVars = await this.k8sService.getDeploymentEnvironment(app.deploymentName, app.namespace);
        
        if (Object.keys(envVars).length === 0) {
            throw new Error('No environment variables found');
        }

        // Determine format based on language or user choice?
        // Plan says "extract the env... into a file for the specific technology"
        // User survey said: dotenv
        
        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const filePath = path.join(app.workingDirectory, '.env');
        
        try {
            fs.writeFileSync(filePath, envContent, 'utf8');
            logger.info(`Extracted environment to ${filePath}`);
            vscode.window.showInformationMessage(`Environment saved to ${filePath}`);
        } catch (error: any) {
            logger.error(`Failed to write .env file`, error);
            throw new Error(`Failed to write .env file: ${error.message}`);
        }
    }

    private detectLanguage(dir: string): Application['language'] {
        try {
            const files = fs.readdirSync(dir);
            
            const scores: Record<NonNullable<Application['language']>, number> = {
                node: 0,
                python: 0,
                csharp: 0,
                java: 0,
                other: 0
            };

            const rules: { lang: NonNullable<Application['language']>, pattern: RegExp, weight: number }[] = [
                // High confidence configuration files
                { lang: 'node', pattern: /^package\.json$/, weight: 10 },
                { lang: 'python', pattern: /^(requirements\.txt|Pipfile|pyproject\.toml)$/, weight: 10 },
                { lang: 'java', pattern: /^(pom\.xml|build\.gradle)$/, weight: 10 },
                { lang: 'csharp', pattern: /\.csproj$/, weight: 10 },
                
                // Source files
                { lang: 'node', pattern: /\.(js|ts|jsx|tsx)$/i, weight: 2 },
                { lang: 'python', pattern: /\.py$/i, weight: 2 },
                { lang: 'java', pattern: /\.java$/i, weight: 2 },
                { lang: 'csharp', pattern: /\.cs$/i, weight: 2 },
            ];

            for (const file of files) {
                for (const rule of rules) {
                    if (rule.pattern.test(file)) {
                        scores[rule.lang] += rule.weight;
                    }
                }
            }

            let bestLang: NonNullable<Application['language']> = 'other';
            let maxScore = 0;

            for (const [lang, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    bestLang = lang as NonNullable<Application['language']>;
                }
            }
            
            return bestLang;

        } catch (error) {
            logger.warn(`Error detecting language in ${dir}:`, error);
            return 'other';
        }
    }

    private async saveApplications(apps: Application[]): Promise<void> {
        await this.context.globalState.update(ApplicationService.STORAGE_KEY, apps);
        this._onDidChangeApplications.fire();
    }
}

