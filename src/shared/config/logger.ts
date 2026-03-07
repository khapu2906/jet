import type { LogConfig } from 'meo-meo-logger';

export const loggerConfig: LogConfig = {
	level: (process.env.LOG_LEVEL as LogConfig['level']) || 'info',
	mode: (process.env.LOG_MODE as LogConfig['mode']) || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
	serviceName: process.env.SERVICE_NAME || 'app',
	transports: [],
};
