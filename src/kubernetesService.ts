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

    async getDeploymentEnvironment(deploymentName: string, namespace: string): Promise<Record<string, string>> {
        logger.debug(`Fetching environment for deployment ${deploymentName} in ${namespace}...`);
        
        try {
            const response = await this.appsApi.readNamespacedDeployment({ name: deploymentName, namespace });
            const deployment: any = response;
            
            // Assuming the first container is the main one
            const container = deployment.spec?.template?.spec?.containers?.[0];
            
            if (!container) {
                logger.warn('No containers found in deployment spec');
                return {};
            }
            
            const envVars: Record<string, string> = {};

            // 1. Process envFrom (ConfigMaps and Secrets)
            if (container.envFrom) {
                for (const source of container.envFrom) {
                    if (source.configMapRef) {
                        const cmName = source.configMapRef.name;
                        try {
                            const cm: any = await this.k8sApi.readNamespacedConfigMap({ name: cmName, namespace });
                            if (cm.data) {
                                Object.assign(envVars, cm.data);
                            }
                        } catch (err) {
                            logger.warn(`Failed to fetch ConfigMap ${cmName}`, err);
                        }
                    } else if (source.secretRef) {
                        const secretName = source.secretRef.name;
                        try {
                            const secret: any = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });
                            if (secret.data) {
                                for (const [key, value] of Object.entries(secret.data)) {
                                    // Secrets are base64 encoded
                                    envVars[key] = Buffer.from(value as string, 'base64').toString('utf-8');
                                }
                            }
                        } catch (err) {
                            logger.warn(`Failed to fetch Secret ${secretName}`, err);
                        }
                    }
                }
            }

            // 2. Process env (Direct variables and references)
            if (container.env) {
                for (const envVar of container.env) {
                    if (envVar.value !== undefined) {
                        envVars[envVar.name] = envVar.value;
                    } else if (envVar.valueFrom) {
                        // Handle valueFrom (ConfigMapKeyRef, SecretKeyRef)
                         if (envVar.valueFrom.configMapKeyRef) {
                             const cmName = envVar.valueFrom.configMapKeyRef.name;
                             const key = envVar.valueFrom.configMapKeyRef.key;
                             try {
                                 const cm: any = await this.k8sApi.readNamespacedConfigMap({ name: cmName, namespace });
                                 if (cm.data && cm.data[key]) {
                                     envVars[envVar.name] = cm.data[key];
                                 }
                             } catch (err) {
                                logger.warn(`Failed to fetch ConfigMap key ${key} from ${cmName}`, err);
                             }
                         } else if (envVar.valueFrom.secretKeyRef) {
                             const secretName = envVar.valueFrom.secretKeyRef.name;
                             const key = envVar.valueFrom.secretKeyRef.key;
                             try {
                                 const secret: any = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });
                                 if (secret.data && secret.data[key]) {
                                     envVars[envVar.name] = Buffer.from(secret.data[key], 'base64').toString('utf-8');
                                 }
                             } catch (err) {
                                logger.warn(`Failed to fetch Secret key ${key} from ${secretName}`, err);
                             }
                         }
                    }
                }
            }

            logger.debug(`Resolved ${Object.keys(envVars).length} environment variables`);
            return envVars;

        } catch (error: any) {
            logger.error('Failed to get deployment environment', error);
            return {};
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

