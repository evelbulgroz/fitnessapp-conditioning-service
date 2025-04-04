import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerController } from './swagger.controller';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/guards/roles.guard';
import { AppInstance } from './app-instance.model';
import { Response } from 'express';
import { readFileSync } from 'fs';

jest.mock('fs');
jest.mock('path');
jest.mock('./app-instance.model');

describe('SwaggerController', () => {
	let controller: SwaggerController;
	let mockResponse: Partial<Response>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SwaggerController],
			providers: [
				{
					provide: JwtAuthGuard,
					useValue: jest.fn(),
				},
				{
					provide: RolesGuard,
					useValue: jest.fn(),
				},
			],
		}).compile();

		controller = module.get<SwaggerController>(SwaggerController);

		mockResponse = {
			setHeader: jest.fn(),
			send: jest.fn(),
		};
	});

	describe('serveSwaggerUI', () => {
		it('generates and serves Swagger UI HTML', async () => {
			// Mock dependencies
			const mockAppInstance = {
				getAppInstance: jest.fn().mockReturnValue({}),
			};
			(AppInstance.getAppInstance as jest.Mock).mockReturnValue(mockAppInstance);

			const mockSwaggerHtml = '<html>Mock Swagger UI</html>';
			const mockSwaggerInitializer = 'window.onload = function() { spec: {} };';
			const mockSwaggerUiPath = '/mock/path/to/swagger-ui-dist';

			jest.spyOn(require('swagger-ui-dist'), 'getAbsoluteFSPath').mockReturnValue(mockSwaggerUiPath);
			(readFileSync as jest.Mock)
				.mockImplementationOnce(() => mockSwaggerInitializer) // Mock swagger-initializer.js
				.mockImplementationOnce(() => mockSwaggerHtml); // Mock index.html

			// Call the method
			await controller.serveSwaggerUI(mockResponse as Response);

			// Assertions
			expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
			expect(mockResponse.send).toHaveBeenCalledWith(expect.stringContaining('<html>Mock Swagger UI</html>'));
		});
	});

	describe('serveSwaggerJson', () => {
		it('generates and serves Swagger JSON', async () => {
			// Mock dependencies
			const mockAppInstance = {
				getAppInstance: jest.fn().mockReturnValue({}),
			};
			(AppInstance.getAppInstance as jest.Mock).mockReturnValue(mockAppInstance);

			const mockSwaggerDocument = { openapi: '3.0.0', info: { title: 'Mock API', version: '1.0.0' } };

			jest.spyOn(require('@nestjs/swagger'), 'SwaggerModule').mockImplementation(() => ({
				createDocument: jest.fn().mockReturnValue(mockSwaggerDocument),
			}));

			// Call the method
			await controller.serveSwaggerJson(mockResponse as Response);

			// Assertions
			expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
			expect(mockResponse.send).toHaveBeenCalledWith(mockSwaggerDocument);
		});
	});
});