import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { CLI, DEFAULTS, PATTERNS, SETTINGS } from './constants';
import { KubernetesService } from './kubernetesService';

const execAsync = promisify(exec);

export interface Intercept {
    name: string;
    serviceName: string;
    localPort: number;
    servicePort: number;
    state?: string;
    volumeMount?: string;
    workloadKind?: string;
}

export interface ConnectionStatus {
    connected: boolean;
    context?: string;
    namespace?: string;
}

export interface OperationResult {
    success: boolean;
    error?: string;
    output?: string;
}

export class TelepresenceService {
    private connectionStatus: ConnectionStatus = { connected: false };
    private intercepts: Intercept[] = [];
    private statusChangeEmitter = new vscode.EventEmitter<void>();
    private k8sService: KubernetesService;

    public readonly onStatusChange = this.statusChangeEmitter.event;

    constructor() {
        this.k8sService = new KubernetesService();
    }

    async checkStatus(): Promise<ConnectionStatus> {
        logger.debug('Checking telepresence status...');
        logger.time('checkStatus');

        try {
            const { stdout } = await execAsync(CLI.STATUS);
            
            const statusMatch = stdout.match(PATTERNS.STATUS_LINE);
            const trafficManagerMatch = stdout.match(PATTERNS.TRAFFIC_MANAGER);
            
            let isConnected = false;
            
            if (statusMatch) {
                const statusValue = statusMatch[1].trim();
                isConnected = statusValue === 'Connected' || statusValue.includes('Connected');
            }
            
            if (trafficManagerMatch) {
                const tmValue = trafficManagerMatch[1].trim();
                if (tmValue === 'Not connected' || tmValue.includes('Not connected')) {
                    isConnected = false;
                }
            }
            
            let context: string | undefined;
            let namespace: string | undefined;

            if (isConnected) {
                const contextMatch = stdout.match(PATTERNS.KUBERNETES_CONTEXT);
                if (contextMatch) {
                    const ctx = contextMatch[1].trim();
                    if (ctx) context = ctx;
                }

                const namespaceMatch = stdout.match(PATTERNS.NAMESPACE);
                if (namespaceMatch) {
                    const ns = namespaceMatch[1].trim();
                    if (ns) namespace = ns;
                }
            }

            this.connectionStatus = { connected: isConnected, context, namespace };
            
            if (isConnected) {
                await this.refreshIntercepts();
            } else {
                this.intercepts = [];
            }

            logger.debug('Status check complete:', this.connectionStatus);
            logger.timeEnd('checkStatus');
            return this.connectionStatus;

        } catch (error: any) {
            logger.error('Failed to check telepresence status', error);
            this.connectionStatus = { connected: false };
            this.intercepts = [];
            logger.timeEnd('checkStatus');
            return this.connectionStatus;
        }
    }

    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    async getNamespaces(): Promise<string[]> {
        return await this.k8sService.getNamespaces();
    }

    async getDeployments(namespace?: string): Promise<string[]> {
        const ns = namespace || this.k8sService.getCurrentNamespace() || 'default';
        return await this.k8sService.getDeployments(ns);
    }

    async getServicePorts(serviceName: string, namespace?: string): Promise<{ servicePort: number; targetPort: number } | undefined> {
        const ns = namespace || this.k8sService.getCurrentNamespace() || 'default';
        return await this.k8sService.getServicePorts(serviceName, ns);
    }

    async connect(namespace?: string): Promise<OperationResult> {
        logger.info(`Connecting to telepresence${namespace ? ` (namespace: ${namespace})` : ''}...`);
        
        try {
            const config = vscode.workspace.getConfiguration(SETTINGS.CONFIG_SECTION);
            const managerNs = config.get<string>(SETTINGS.MANAGER_NAMESPACE) || DEFAULTS.MANAGER_NAMESPACE;
            
            let command = `${CLI.CONNECT} --manager-namespace ${managerNs}`;
            if (namespace) {
                command += ` --namespace ${namespace}`;
            }
            
            logger.debug('Executing:', command);
            
            const { stdout, stderr } = await execAsync(command, {
                timeout: DEFAULTS.CONNECT_TIMEOUT
            });
            
            await this.checkStatus();
            this.statusChangeEmitter.fire();
            
            if (this.connectionStatus.connected) {
                logger.info('Successfully connected to telepresence');
            } else {
                logger.warn('Connection command completed but status shows disconnected');
            }
            
            return { 
                success: this.connectionStatus.connected, 
                output: stdout,
                error: this.connectionStatus.connected ? undefined : stderr
            };

        } catch (error: any) {
            let errorMsg = error.message || String(error);
            
            if (errorMsg.includes('no such host') || errorMsg.includes('dial tcp: lookup')) {
                errorMsg = 'DNS resolution failed. Please check:\n' +
                           '1. Your VPN connection is active\n' +
                           '2. Your /etc/hosts or DNS settings are correct\n' +
                           '3. You can ping the cluster hostname\n\n' +
                           'Original error: ' + errorMsg;
            }
            
            if (errorMsg.includes('traffic manager not found')) {
                errorMsg = 'Traffic Manager not found. Please:\n' +
                           '1. Install Traffic Manager: telepresence helm install\n' +
                           '2. OR set Manager Namespace in settings\n\n' +
                           'Original error: ' + errorMsg;
            }
            
            logger.error('Failed to connect', error);
            return { success: false, error: errorMsg };
        }
    }

    async disconnect(): Promise<OperationResult> {
        logger.info('Disconnecting from telepresence...');
        
        try {
            const { stdout } = await execAsync(CLI.DISCONNECT);
            await this.checkStatus();
            this.statusChangeEmitter.fire();
            
            logger.info('Successfully disconnected');
            return { success: true, output: stdout };

        } catch (error: any) {
            logger.error('Failed to disconnect', error);
            return { 
                success: false, 
                error: error.message || String(error)
            };
        }
    }

    async createIntercept(
        serviceName: string, 
        localPort: number, 
        servicePort: number, 
        httpHeader?: { name: string; value: string }
    ): Promise<OperationResult> {
        logger.info(`Creating intercept for ${serviceName}...`);
        
        try {
            let command = `${CLI.INTERCEPT} ${serviceName} --port ${localPort}:${servicePort}`;
            
            if (httpHeader?.value) {
                command += ` --http-header ${httpHeader.name}=${httpHeader.value}`;
                logger.debug(`Personal intercept with header: ${httpHeader.name}=${httpHeader.value}`);
            }
            
            logger.debug('Executing:', command);
            const { stdout } = await execAsync(command);
            
            await this.refreshIntercepts();
            this.statusChangeEmitter.fire();
            
            logger.info(`Intercept created for ${serviceName}`);
            return { success: true, output: stdout };

        } catch (error: any) {
            logger.error('Failed to create intercept', error);
            return { 
                success: false, 
                error: error.message || String(error)
            };
        }
    }

    async removeIntercept(interceptName: string): Promise<OperationResult> {
        logger.info(`Removing intercept ${interceptName}...`);
        
        try {
            const { stdout } = await execAsync(`${CLI.LEAVE} ${interceptName}`);
            await this.refreshIntercepts();
            this.statusChangeEmitter.fire();
            
            logger.info(`Intercept ${interceptName} removed`);
            return { success: true, output: stdout };

        } catch (error: any) {
            logger.error('Failed to remove intercept', error);
            return { 
                success: false, 
                error: error.message || String(error)
            };
        }
    }

    async listIntercepts(): Promise<Intercept[]> {
        return this.intercepts;
    }

    private async refreshIntercepts(): Promise<void> {
        logger.debug('Refreshing intercepts list...');
        
        try {
            const { stdout } = await execAsync(CLI.LIST_INTERCEPTS);
            this.intercepts = this.parseIntercepts(stdout);
            logger.debug(`Parsed ${this.intercepts.length} intercept(s)`);
        } catch (error: any) {
            logger.error('Failed to refresh intercepts', error);
            this.intercepts = [];
        }
    }

    private parseIntercepts(output: string): Intercept[] {
        const intercepts: Intercept[] = [];
        const deploymentSections = output.split(PATTERNS.DEPLOYMENT_INTERCEPT);
        
        for (let i = 1; i < deploymentSections.length; i += 2) {
            const serviceName = deploymentSections[i];
            const details = deploymentSections[i + 1];
            
            if (!details) continue;
            
            const nameMatch = details.match(PATTERNS.INTERCEPT_NAME);
            const interceptName = nameMatch ? nameMatch[1] : serviceName;
            
            const stateMatch = details.match(PATTERNS.STATE);
            const state = stateMatch ? stateMatch[1] : undefined;
            
            const workloadMatch = details.match(PATTERNS.WORKLOAD_KIND);
            const workloadKind = workloadMatch ? workloadMatch[1] : undefined;
            
            const volumeMatch = details.match(PATTERNS.VOLUME_MOUNT);
            const volumeMount = volumeMatch ? volumeMatch[1] : undefined;
            
            const portMatch = details.match(PATTERNS.PORT_MAPPING);
            
            if (portMatch) {
                intercepts.push({
                    name: interceptName,
                    serviceName,
                    servicePort: parseInt(portMatch[1]),
                    localPort: parseInt(portMatch[2]),
                    state,
                    volumeMount,
                    workloadKind
                });
            }
        }

        return intercepts;
    }

    async debugStatus(): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(CLI.STATUS);
            const output = `=== TELEPRESENCE STATUS DEBUG ===\n\n` +
                          `STDOUT:\n${stdout}\n\n` +
                          `STDERR:\n${stderr}\n\n` +
                          `Status: ${JSON.stringify(this.connectionStatus, null, 2)}`;
            
            logger.debug(output);
            return output;
        } catch (error: any) {
            const output = `=== TELEPRESENCE STATUS DEBUG ===\n\nERROR: ${error.message}`;
            logger.error(output);
            return output;
        }
    }

    dispose(): void {
        logger.debug('Disposing TelepresenceService');
        this.statusChangeEmitter.dispose();
    }
}
