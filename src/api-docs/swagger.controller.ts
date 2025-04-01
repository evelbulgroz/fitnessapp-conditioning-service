import { Controller, Get, UseGuards, Res, INestApplication, Inject } from '@nestjs/common';

import { AppInstance } from './app-instance.model';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/guards/roles.guard';
import { Roles } from '../infrastructure/decorators/roles.decorator';
import { Response } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

@Controller('docs')
//@UseGuards(JwtAuthGuard, RolesGuard) // Protect the Swagger documentation with guards
export class SwaggerController {
	@Get()
	@Roles('admin') // Only allow users with the 'admin' role to access the docs
	public async getSwaggerDocs(@Res() res: Response): Promise<void> {
		const app = AppInstance.getAppInstance(); // Retrieve the app instance
		const packageJson = (await import('../../package.json') as any).default as any
		const config = new DocumentBuilder()
			.setTitle('FitnessApp Conditioning Service API')
			.setDescription('API documentation for FitnessApp Conditioning Service')
			.setVersion(packageJson.version)
			.build();
		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('api-docs', app, document);
		res.redirect('/api-docs'); // Redirect to the Swagger UI
	}
}

export default SwaggerController;