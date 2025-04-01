import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/guards/roles.guard';
import { Roles } from '../infrastructure/decorators/roles.decorator';
import { Response } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppInstance } from './app-instance.model';
import { readFileSync } from 'fs';
import { resolve } from 'path';

@Controller('docs')
//@UseGuards(JwtAuthGuard, RolesGuard) // Protect the Swagger documentation with guards
export class SwaggerController {
	@Get()
	//@Roles('admin') // Only allow users with the 'admin' role to access the docs
	public async serveSwaggerUI(@Res() res: Response): Promise<void> {
		const app = AppInstance.getAppInstance(); // Retrieve the app instance
		const packageJson = require('../../package.json'); // Import package.json

		// Generate Swagger document
		const config = new DocumentBuilder()
			.setTitle('FitnessApp Conditioning Service API')
			.setDescription('API documentation for FitnessApp Conditioning Service')
			.setVersion(packageJson.version)
			.build();
		const document = SwaggerModule.createDocument(app, config);

		// Load Swagger UI HTML template
		const swaggerUiPath = require('swagger-ui-dist').getAbsoluteFSPath();
		const swaggerHtmlTemplate = readFileSync(resolve(swaggerUiPath, 'index.html'), 'utf8');

		// Inject the Swagger JSON URL into the HTML template
		const swaggerHtml = swaggerHtmlTemplate.replace(
			'https://petstore.swagger.io/v2/swagger.json',
			'/json', // Serve the Swagger JSON at this endpoint
		);

		// Serve the Swagger UI HTML
		res.setHeader('Content-Type', 'text/html');
		res.send(swaggerHtml);
	}

	@Get('json')
	//@Roles('admin') // Protect the Swagger JSON endpoint as well
	public async serveSwaggerJson(@Res() res: Response): Promise<void> {
		const app = AppInstance.getAppInstance(); // Retrieve the app instance
		const packageJson = require('../../package.json'); // Import package.json

		// Generate Swagger document
		const config = new DocumentBuilder()
			.setTitle('FitnessApp Conditioning Service API')
			.setDescription('API documentation for FitnessApp Conditioning Service')
			.setVersion(packageJson.version)
			.build();
			const document = SwaggerModule.createDocument(app, config);

		// Serve the Swagger JSON
		res.setHeader('Content-Type', 'application/json');
		res.send(document);
	}
}

export default SwaggerController;