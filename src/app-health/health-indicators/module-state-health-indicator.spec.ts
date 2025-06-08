import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';

import { ComponentState, ComponentStateInfo, DomainStateManager } from '../../libraries/managed-stateful-component';

import { ModuleStateHealthIndicator } from './module-state-health-indicator';

describe('ModuleStateHealthIndicator', () => {
	let healthIndicator: ModuleStateHealthIndicator;
	let healthIndicatorService: HealthIndicatorService;

	// Mock state manager that returns predefined state when getState is called
	class MockStateManager implements Partial<DomainStateManager> {
		private stateToReturn: ComponentStateInfo;

		constructor(stateToReturn: ComponentStateInfo) {
			this.stateToReturn = stateToReturn;
		}

		async getState(): Promise<ComponentStateInfo> {
			return this.stateToReturn;
		}
	}

	// Mock health indicator service
	const mockHealthIndicatorService = {
		check: jest.fn().mockReturnValue({
			up: jest.fn().mockImplementation((result) => ({
				'module-state': { status: 'up', ...result }
			})),
			down: jest.fn().mockImplementation((result) => ({
				'module-state': { status: 'down', ...result }
			}))
		})
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ModuleStateHealthIndicator,
				{
					provide: HealthIndicatorService,
					useValue: mockHealthIndicatorService
				}
			],
		}).compile();

		healthIndicator = module.get<ModuleStateHealthIndicator>(ModuleStateHealthIndicator);
		healthIndicatorService = module.get<HealthIndicatorService>(HealthIndicatorService);
	});

	it('can be created', () => {
		expect(healthIndicator).toBeDefined();
	});

	describe('isHealthy', () => {
		it(`returns 'up' status when component is in OK state`, async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.OK,
				reason: 'Everything is fine',
				updatedOn: new Date()
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);

			// Assert
			expect(result['module-state'].status).toBe('up');
			expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('module-state');
			expect(mockHealthIndicatorService.check().up).toHaveBeenCalled();
		});

		it(`returns 'up' status when component is in DEGRADED state`, async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.DEGRADED,
				reason: 'Running with limited functionality',
				updatedOn: new Date()
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);

			// Assert
			expect(result['module-state'].status).toBe('up');
			expect(mockHealthIndicatorService.check().up).toHaveBeenCalled();
		});

		it(`returns 'down' status when component is in FAILED state`, async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.FAILED,
				reason: 'Critical error occurred',
				updatedOn: new Date()
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);

			// Assert
			expect(result['module-state'].status).toBe('down');
			expect(mockHealthIndicatorService.check().down).toHaveBeenCalled();
		});
	});

	describe('mapStateToHealthIndicatorResult', () => {
		it('maps a simple component state correctly', async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.OK,
				reason: 'Everything is fine',
				updatedOn: new Date()
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);
			const details = result['module-state'].details;

			// Assert
			expect(details).toBeDefined();
			expect(details['RootComponent']).toBeDefined();
			expect(details['RootComponent'].status).toBe('up');
			expect(details['RootComponent'].state).toBe(ComponentState.OK);
			expect(details['RootComponent'].reason).toBe('Everything is fine');
		});

		it('categorizes components as info or error based on state', async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.OK,
				reason: 'Parent OK',
				updatedOn: new Date(),
				components: [
					{
						name: 'HealthyChild',
						state: ComponentState.OK,
						reason: 'Child OK',
						updatedOn: new Date()
					},
					{
						name: 'UnhealthyChild',
						state: ComponentState.FAILED,
						reason: 'Child failed',
						updatedOn: new Date()
					}
				]
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);
			
			// Assert
			expect(result['module-state'].info['RootComponent']).toBeDefined();
			expect(result['module-state'].info['RootComponent.HealthyChild']).toBeDefined();
			expect(result['module-state'].error['RootComponent.UnhealthyChild']).toBeDefined();
			
			// Shouldn't be in the wrong category
			expect(result['module-state'].error['RootComponent']).toBeUndefined();
			expect(result['module-state'].error['RootComponent.HealthyChild']).toBeUndefined();
			expect(result['module-state'].info['RootComponent.UnhealthyChild']).toBeUndefined();
		});

		it('handles three levels of component hierarchy', async () => {
			// Arrange - Create a 3-level deep component hierarchy
			const now = new Date();
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.OK,
				reason: 'Root OK',
				updatedOn: now,
				components: [
					{
						name: 'Level1Child',
						state: ComponentState.OK,
						reason: 'Level 1 OK',
						updatedOn: now,
						components: [
							{
								name: 'Level2HealthyChild',
								state: ComponentState.OK,
								reason: 'Level 2 OK',
								updatedOn: now,
								components: [
									{
										name: 'Level3Child',
										state: ComponentState.DEGRADED,
										reason: 'Level 3 Degraded',
										updatedOn: now
									}
								]
							},
							{
								name: 'Level2UnhealthyChild',
								state: ComponentState.FAILED,
								reason: 'Level 2 Failed',
								updatedOn: now
							}
						]
					}
				]
			});

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);
			
			// Assert - Check all levels are present in the details
			const details = result['module-state'].details;
			expect(details['RootComponent']).toBeDefined();
			expect(details['RootComponent.Level1Child']).toBeDefined();
			expect(details['RootComponent.Level1Child.Level2HealthyChild']).toBeDefined();
			expect(details['RootComponent.Level1Child.Level2HealthyChild.Level3Child']).toBeDefined();
			expect(details['RootComponent.Level1Child.Level2UnhealthyChild']).toBeDefined();
			
			// Check states at each level
			expect(details['RootComponent'].state).toBe(ComponentState.OK);
			expect(details['RootComponent.Level1Child'].state).toBe(ComponentState.OK);
			expect(details['RootComponent.Level1Child.Level2HealthyChild'].state).toBe(ComponentState.OK);
			expect(details['RootComponent.Level1Child.Level2HealthyChild.Level3Child'].state).toBe(ComponentState.DEGRADED);
			expect(details['RootComponent.Level1Child.Level2UnhealthyChild'].state).toBe(ComponentState.FAILED);
			
			// Check info/error categorization
			expect(result['module-state'].info['RootComponent']).toBeDefined();
			expect(result['module-state'].info['RootComponent.Level1Child']).toBeDefined();
			expect(result['module-state'].info['RootComponent.Level1Child.Level2HealthyChild']).toBeDefined();
			expect(result['module-state'].info['RootComponent.Level1Child.Level2HealthyChild.Level3Child']).toBeDefined();
			expect(result['module-state'].error['RootComponent.Level1Child.Level2UnhealthyChild']).toBeDefined();
		});

		it('respects the maximum depth parameter', async () => {
			// We'll need to access the private flattenComponents method using type assertion
			// This is a bit of a hack, but it's necessary to test private methods
			const healthIndicatorAny = healthIndicator as any;
			
			// Create a deep component hierarchy
			const deepComponent = {
				name: 'Root',
				state: ComponentState.OK,
				timestamp: new Date(),
				components: [{
					name: 'Level1',
					state: ComponentState.OK,
					timestamp: new Date(),
					components: [{
						name: 'Level2',
						state: ComponentState.OK,
						timestamp: new Date(),
						components: [{
							name: 'Level3',
							state: ComponentState.OK,
							timestamp: new Date(),
							components: [{
								name: 'Level4',
								state: ComponentState.OK,
								timestamp: new Date()
							}]
						}]
					}]
				}]
			};

			// Test with maxDepth = 2
			const result1 = healthIndicatorAny.flattenComponents(deepComponent, '', 2);
			
			// Should include Root, Level1, Level2, but not Level3 or Level4
			expect(result1.length).toBe(3);
			expect(result1.find((c: any) => c.path === 'Root')).toBeDefined();
			expect(result1.find((c: any) => c.path === 'Root.Level1')).toBeDefined();
			expect(result1.find((c: any) => c.path === 'Root.Level1.Level2')).toBeDefined();
			expect(result1.find((c: any) => c.path === 'Root.Level1.Level2.Level3')).toBeUndefined();
			expect(result1.find((c: any) => c.path === 'Root.Level1.Level2.Level3.Level4')).toBeUndefined();
			
			// Test with default maxDepth = 10
			const result2 = healthIndicatorAny.flattenComponents(deepComponent);
			
			// Should include all levels
			expect(result2.length).toBe(5);
			expect(result2.find((c: any) => c.path === 'Root')).toBeDefined();
			expect(result2.find((c: any) => c.path === 'Root.Level1')).toBeDefined();
			expect(result2.find((c: any) => c.path === 'Root.Level1.Level2')).toBeDefined();
			expect(result2.find((c: any) => c.path === 'Root.Level1.Level2.Level3')).toBeDefined();
			expect(result2.find((c: any) => c.path === 'Root.Level1.Level2.Level3.Level4')).toBeDefined();
		});
	});

	describe('component state evaluation', () => {
		it('considers OK and DEGRADED as healthy states', () => {
			// Access private method using type assertion
			const healthIndicatorAny = healthIndicator as any;
			
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.OK)).toBe(true);
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.DEGRADED)).toBe(true);
			
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.FAILED)).toBe(false);
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.INITIALIZING)).toBe(false);
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.SHUTTING_DOWN)).toBe(false);
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.SHUT_DOWN)).toBe(false);
			expect(healthIndicatorAny.isComponentHealthy(ComponentState.UNINITIALIZED)).toBe(false);
		});
	});

	describe('result structure', () => {
		it('maintains proper result structure with status, info, error, and details', async () => {
			// Arrange
			const stateManager = new MockStateManager({
				name: 'RootComponent',
				state: ComponentState.FAILED,
				reason: 'Subcomponent failed',
				updatedOn: new Date(),
				components: [
					{
						name: 'FailedComponent',
						state: ComponentState.FAILED,
						reason: 'Something went wrong',
						updatedOn: new Date(),
						components: [
							{
								name: 'NestedFailedComponent',
								state: ComponentState.FAILED,
								reason: 'Nested failure',
								updatedOn: new Date()
							},
							{
								name: 'NestedOKComponent',
								state: ComponentState.OK,
								reason: 'Nested component is fine',
								updatedOn: new Date()
							}
						]
					},
					{
						name: 'OKComponent',
						state: ComponentState.OK,
						reason: 'All good',
						updatedOn: new Date(),
						components: [
							{
								name: 'NestedFailedComponent',
								state: ComponentState.FAILED,
								reason: 'Nested failure',
								updatedOn: new Date()
							},
							{
								name: 'NestedOKComponent',
								state: ComponentState.OK,
								reason: 'Nested component is fine',
								updatedOn: new Date()
							}
						]
					}
				]
			});

			const now = new Date().toISOString();
			const expectedResult = {
				'module-state': {
					status: 'down',
					// Info section simplified to just status indicators
					info: {
						'RootComponent.FailedComponent.NestedOKComponent': { status: 'up' },
						'RootComponent.OKComponent': { status: 'up' },
						'RootComponent.OKComponent.NestedOKComponent': { status: 'up' }
					},
					// Error section includes status and reason (for troubleshooting)
					error: {
						'RootComponent': { 
							status: 'down', 
							reason: 'Subcomponent failed'
						},
						'RootComponent.FailedComponent': { 
							status: 'down', 
							reason: 'Something went wrong'
						},
						'RootComponent.FailedComponent.NestedFailedComponent': { 
							status: 'down', 
							reason: 'Nested failure'
						},
						'RootComponent.OKComponent.NestedFailedComponent': { 
							status: 'down', 
							reason: 'Nested failure'
						}
					},
					// Details section preserves all component information
					details: {
						'RootComponent': {
							status: 'down',
							state: 'FAILED',
							reason: 'Subcomponent failed',
							timestamp: now
						},
						'RootComponent.FailedComponent': {
							status: 'down',
							state: 'FAILED',
							reason: 'Something went wrong',
							timestamp: now
						},
						'RootComponent.FailedComponent.NestedFailedComponent': {
							status: 'down',
							state: 'FAILED',
							reason: 'Nested failure',
							timestamp: now
						},
						'RootComponent.FailedComponent.NestedOKComponent': {
							status: 'up',
							state: 'OK',
							reason: 'Nested component is fine',
							timestamp: now
						},
						'RootComponent.OKComponent': {
							status: 'up',
							state: 'OK',
							reason: 'All good',
							timestamp: now
						},
						'RootComponent.OKComponent.NestedFailedComponent': {
							status: 'down',
							state: 'FAILED',
							reason: 'Nested failure',
							timestamp: now
						},
						'RootComponent.OKComponent.NestedOKComponent': {
							status: 'up',
							state: 'OK',
							reason: 'Nested component is fine',
							timestamp: now
						}
					}
				}
			};

			// Act
			const result = await healthIndicator.isHealthy(stateManager as any);
			
			// Assert
			expect(result).toEqual(expectedResult);
			
			// The root result structure should have status, info, error, details
			expect(result['module-state'].status).toBeDefined(); // Down because there's a failed component
			expect(result['module-state'].info).toBeDefined();
			expect(result['module-state'].error).toBeDefined();
			expect(result['module-state'].details).toBeDefined();
			
			// Info should contain only healthy components, and only their status
			expect(Object.keys(result['module-state'].info).length).toBe(3);
			for (const key of Object.keys(result['module-state'].info)) {
				const stateInfo = result['module-state'].info[key];
				expect(stateInfo).toBeDefined();
				expect(stateInfo.status).toBe('up'); // All should be healthy
				expect(Object.keys(stateInfo).length).toBe(1); // Should only contain status				
			}			
			
			// Error should contain only unhealthy components, and their status and reason
			expect(Object.keys(result['module-state'].error).length).toBe(4);
			for (const key of Object.keys(result['module-state'].error)) {
				const errorInfo = result['module-state'].error[key];
				expect(errorInfo).toBeDefined();
				expect(errorInfo.status).toBe('down'); // All should be unhealthy
				expect(errorInfo.reason).toBeDefined(); // Should have a reason
				expect(Object.keys(errorInfo).length).toBe(2); // Should only contain status and reason				
			}
			
			// Details should contain all components, with their full state information
			expect(Object.keys(result['module-state'].details).length).toBe(7); // 7 components in total
			for (const key of Object.keys(result['module-state'].details)) {
				const detailInfo = result['module-state'].details[key];
				expect(detailInfo).toBeDefined();
				expect(detailInfo.status).toBeDefined();
				expect(detailInfo.state).toBeDefined();
				expect(detailInfo.reason).toBeDefined();
				expect(detailInfo.timestamp).toBeDefined();
				expect(Object.keys(detailInfo).length).toBe(4); // Should contain status, state, reason, timestamp
			}
		});
	});
});