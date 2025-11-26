import * as k8s from '@kubernetes/client-node';
import { logger } from './logger';

export interface ServicePortInfo {
    servicePort: number;
    targetPort: number;
}

export class KubernetesService {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private appsApi: k8s.AppsV1Api;

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    }

    async getNamespaces(): Promise<string[]> {
        logger.debug('Fetching namespaces from Kubernetes API...');
        
        try {
            const response = await this.k8sApi.listNamespace();
            const namespaces = response.items
                .map((ns: any) => ns.metadata?.name)
                .filter((name: any): name is string => !!name);
            
            logger.debug(`Found ${namespaces.length} namespaces`);
            return namespaces;
        } catch (error: any) {
            logger.error('Failed to get namespaces from Kubernetes API', error);
            return [];
        }
    }

    async getDeployments(namespace: string): Promise<string[]> {
        logger.debug(`Fetching deployments in namespace ${namespace}...`);
        
        try {
            const response = await this.appsApi.listNamespacedDeployment({ namespace });
            const deployments = response.items
                .map((dep: any) => dep.metadata?.name)
                .filter((name: any): name is string => !!name);
            
            logger.debug(`Found ${deployments.length} deployments`);
            return deployments;
        } catch (error: any) {
            logger.error('Failed to get deployments from Kubernetes API', error);
            return [];
        }
    }

    async getServicePorts(serviceName: string, namespace: string): Promise<ServicePortInfo | undefined> {
        logger.debug(`Fetching service ports for ${serviceName} in ${namespace}...`);
        
        try {
            const response = await this.k8sApi.readNamespacedService({ name: serviceName, namespace });
            const service: any = response;
            
            if (!service.spec?.ports || service.spec.ports.length === 0) {
                logger.warn('No ports found in service spec');
                return undefined;
            }
            
            const portSpec = service.spec.ports[0];
            const servicePort = portSpec.port;
            const targetPort = portSpec.targetPort;
            
            // targetPort can be a number or string (named port)
            if (typeof targetPort === 'string') {
                logger.warn('Target port is a named port, cannot resolve automatically');
                return undefined;
            }
            
            if (!servicePort || !targetPort) {
                logger.error('Invalid port configuration');
                return undefined;
            }
            
            logger.debug(`Service ports: ${servicePort} -> ${targetPort}`);
            return { 
                servicePort: servicePort, 
                targetPort: typeof targetPort === 'number' ? targetPort : servicePort 
            };
        } catch (error: any) {
            logger.error('Failed to get service ports from Kubernetes API', error);
            return undefined;
        }
    }

    getCurrentContext(): string | null {
        return this.kc.getCurrentContext();
    }

    getCurrentNamespace(): string | null {
        const context = this.kc.getCurrentContext();
        if (!context) {
            return null;
        }
        
        const contextObj = this.kc.getContextObject(context);
        return contextObj?.namespace || 'default';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.k8sApi.listNamespace();
            return true;
        } catch (error) {
            logger.error('Kubernetes API connection test failed', error);
            return false;
        }
    }
}

