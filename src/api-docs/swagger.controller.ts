import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { readFileSync } from 'fs';
import { resolve } from 'path';import { Response } from 'express';

import AppInstance from './app-instance.model';
//import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import Roles from '../infrastructure/decorators/roles.decorator';
//import RolesGuard from '../infrastructure/guards/roles.guard';

/** Controller for serving Swagger UI and JSON documentation.
 * @remark Prepared for future use with authentication and authorization guards, but open for now.
 * @remark The standard Swagger UI provided by NestJS is not used here, as it does not support authentication and authorization.
 * @remark Not documented using Swagger, merely used to serve the Swagger UI and JSON documentation.
 * @remark Instead, added note to Readme.md about the API documentation and how to access it.
 */
@Controller('api-docs')
@UseGuards(
	// todo: re-enable these guards when authentication and authorization are needed
	//JwtAuthGuard, // require authentication of Jwt token
	//RolesGuard, // require role-based access control
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
export class SwaggerController {
	@Get()
	@Roles('admin') // Only allow users with the 'admin' role to access the docs
	public async serveSwaggerUI(@Res() res: Response): Promise<void> {
		// Retrieve the app instance
		const app = AppInstance.getAppInstance();
		
		// Generate Swagger document
		const packageJson = require('../../package.json'); // Import package.json
		const config = new DocumentBuilder()
			.setTitle('FitnessApp Conditioning Service API')
			.setDescription('API documentation for FitnessApp Conditioning Service')
			.setVersion(packageJson.version)
			.build();
		const document = SwaggerModule.createDocument(app, config);

		// Get the path to the swagger-ui-dist package with the Swagger UI assets (HTML, CSS, JS)
		const swaggerUiPath = require('swagger-ui-dist').getAbsoluteFSPath(); // bug: returns undefined in test environment, but works in dev and prod environments

		// Load the swagger-initializer.js template and modify it to use the spec property instead of the url property
		const swaggerInitializerPath = resolve(swaggerUiPath, 'swagger-initializer.js');
		let swaggerInitializer = readFileSync(swaggerInitializerPath, 'utf8');
		swaggerInitializer = swaggerInitializer?.replace(
			/url: ".*?"/,
			`spec: ${JSON.stringify(document)}` //insert the Swagger document directly into the JS code
		);
		
		// Get the HTML template, inject the modified swagger-initializer.js and update resource paths
		const swaggerHtmlTemplate = readFileSync(resolve(swaggerUiPath, 'index.html'), 'utf8');
		const swaggerHtml = swaggerHtmlTemplate
			.replace(/<script src="\.\/swagger-initializer\.js".*?>[^<]*<\/script>/, `<script>${swaggerInitializer}</script>`)
			.replace(/href="([^"]+)"/g, 'href="/docs-assets/$1"') // Update CSS paths
			.replace(/src="([^"]+)"/g, 'src="/docs-assets/$1"'); // Update JS paths
		
		// Serve the Swagger UI HTML
		res.setHeader('Content-Type', 'text/html');
		res.send(swaggerHtml);
	}

	@Get('json')
	@Roles('admin') // Protect the Swagger JSON endpoint as well
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