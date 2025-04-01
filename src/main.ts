import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { Logger } from '@evelbulgroz/ddd-base';

import { AppConfig } from 'src/shared/domain/config-options.model';
import { AppInstance } from 'src/api-docs/app-instance.model';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const logger = app.get(Logger);

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
	logger.log(`Application is running on: ${await app.getUrl()}/${prefix}`);//, 'Bootstrap');

	// Handle SIGINT signal, i.e. Ctrl+C in terminal
	process.on('SIGINT', async () => {
		logger.log('SIGINT signal received: closing the application...');//, 'Bootstrap');
		await app.close();
		process.exit(0); // exit process immediately
	});
}
bootstrap();