import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { ConsoleLogger, LogLevel } from '@evelbulgroz/logger';

import { AppConfig } from 'src/shared/domain/config-options.model';
import { AppInstance } from 'src/api-docs/app-instance.model';
import { AppModule } from './app.module';

async function bootstrap() {
	// Set custom logger for NestJS before the app is created
	void await setDefaultLogger();

	// Create the Nest application and load the configuration
	// Note: ConfigService is not available until after the app is created
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);

	// Set the logger for the application using the configuration service
	const logger = await setCustomLogger(app, configService);
	logger.log('Nest application initialized', 'Bootstrap');
	
	// Set global prefix for all routes (from the configuration)
	const prefix = configService.get('app.globalprefix');
	app.setGlobalPrefix(prefix);

	// Provide the app instance globally
	AppInstance.setAppInstance(app);

	// Serve Swagger UI static assets so they are available at /docs-assets
	// when the Swagger UI is served from the SwaggerController
	const swaggerUiPath = require('swagger-ui-dist').getAbsoluteFSPath();
	app.use('/docs-assets', express.static(swaggerUiPath));

	// Start the application
	const appConfig = configService.get('app') as AppConfig;
	const port = appConfig.baseURL?.port;
	await app.listen(port);
	logger.log(`Application is running on: ${await app.getUrl()}/${prefix}`, 'Bootstrap');

	// Handle SIGINT signal, i.e. Ctrl+C in terminal
	process.on('SIGINT', async () => {
		logger.log('SIGINT signal received: closing the application...', 'Bootstrap');
		await app.close();
		process.exit(0); // exit process immediately
	});
}

// Set a default logger for early initialization logs, before ConfigService is available
async function setDefaultLogger() {
	// Set a default logger for early initialization logs
	const defaultLogger = new ConsoleLogger('debug', 'App', undefined, true);
	const { Logger: NestLogger } = await import('@nestjs/common');
	NestLogger.overrideLogger(defaultLogger);
	return defaultLogger;
}

// Set a custom logger for the application using the configuration service
// This logger is used for all logs after the application is created
async function setCustomLogger(app: any, config: ConfigService) {
	const logLevel = config.get<string>('log.level') ?? 'debug';
	const appName = config.get<string>('log.appName') ?? 'conditioning-service';
	const useColors = config.get<boolean>('log.useColors') ?? true;

	const customLogger = new ConsoleLogger(logLevel as LogLevel, appName, undefined, useColors);
	app.useLogger(customLogger);
	return customLogger;
}
bootstrap();