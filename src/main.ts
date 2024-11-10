import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@evelbulgroz/ddd-base';

import { AppConfig } from 'src/domain/config-options.model';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const logger = app.get(Logger);

	// Set global prefix for all routes (from the configuration)
	const prefix = configService.get('app.globalprefix');
	app.setGlobalPrefix(prefix);

	// Get the port from the configuration
	const appConfig = configService.get('app') as AppConfig;
	const port = appConfig.baseURL?.port;

	// Publish API documentation
	/*
	const config = new DocumentBuilder()
		.setTitle('FitnessApp API')
		.setDescription('API documentation for FitnessApp')
		.setVersion('1.0')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api-docs', app, document); // e.g. http://localhost:3000/api-docs
	*/

	// Start the application
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