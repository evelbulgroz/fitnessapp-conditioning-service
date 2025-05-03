import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

import { ConsoleLogger } from '@evelbulgroz/logger';

import { AppConfig } from 'src/shared/domain/config-options.model';
import { AppInstance } from 'src/api-docs/app-instance.model';
import { AppModule } from './app.module';
import { Logger, LogLevel } from './libraries/stream-loggable';
import RequestLoggingInterceptor from './infrastructure/interceptors/request-logging.interceptor';

async function bootstrap() {
	// Set custom logger for NestJS before the app is created to get consistent logging
	void await setDefaultLogger();

	// Create the Nest application and load the configuration
	const app = await NestFactory.create(AppModule);
	
	// Get the logger provider from the app context
	const logger = app.get(Logger);
	logger.info('Nest application initialized', 'Bootstrap');
	
	// Get the ConfigService from the app context
	const configService = app.get(ConfigService);
		
	// Set global prefix for all routes (from the configuration)
	const prefix = configService.get('app.globalprefix');
	app.setGlobalPrefix(prefix);

	// Register global interceptor
	app.useGlobalInterceptors(app.get(RequestLoggingInterceptor));

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
	logger.info(`Application is running on: ${await app.getUrl()}/${prefix}`, 'Bootstrap');

	// Handle SIGINT signal, i.e. Ctrl+C in terminal
	process.on('SIGINT', async () => {
		logger.info('SIGINT signal received: closing the application...', 'Bootstrap');
		await app.close();
		process.exit(0); // exit process immediately
	});
}

// Set a default logger for early initialization logs, before ConfigService is available
async function setDefaultLogger(): Promise<Logger> {
	// Set a default logger for early initialization logs
	const logger = new ConsoleLogger(LogLevel.DEBUG, 'fitnessapp-conditioning-service');
	const { Logger: DefaultLogger } = await import('@nestjs/common');
	DefaultLogger.overrideLogger(logger);
	return logger;
}
bootstrap();