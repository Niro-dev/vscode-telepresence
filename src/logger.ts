export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}

class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;
    private readonly prefix = '[Telepresence]';

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    debug(message: string, ...args: any[]): void {
        if (this.level <= LogLevel.DEBUG) {
            console.log(`${this.prefix} [DEBUG] ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.level <= LogLevel.INFO) {
            console.log(`${this.prefix} [INFO] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(`${this.prefix} [WARN] ${message}`, ...args);
        }
    }

    error(message: string, error?: any): void {
        if (this.level <= LogLevel.ERROR) {
            console.error(`${this.prefix} [ERROR] ${message}`);
            if (error) {
                if (error instanceof Error) {
                    console.error(`${this.prefix} [ERROR] Stack:`, error.stack);
                } else {
                    console.error(`${this.prefix} [ERROR] Details:`, error);
                }
            }
        }
    }

    time(label: string): void {
        if (this.level <= LogLevel.DEBUG) {
            console.time(`${this.prefix} [TIMER] ${label}`);
        }
    }

    timeEnd(label: string): void {
        if (this.level <= LogLevel.DEBUG) {
            console.timeEnd(`${this.prefix} [TIMER] ${label}`);
        }
    }
}

export const logger = Logger.getInstance();

if (process.env.NODE_ENV === 'development') {
    logger.setLevel(LogLevel.DEBUG);
}
