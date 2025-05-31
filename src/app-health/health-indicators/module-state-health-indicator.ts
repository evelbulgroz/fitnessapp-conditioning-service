import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService, HealthIndicatorStatus } from '@nestjs/terminus';

import { ComponentState, ComponentStateInfo, DomainStateManager } from '../../libraries/managed-stateful-component';

/**
 * Health indicator for checking the state of a module using Terminus.
 * 
 * @remark This class implements the HealthIndicator interface and provides a method to check the health of a component.
 * @remark It maps the component state to a HealthIndicatorResult object, including the state of any subcomponents.
 * @remark It flattens the component hierarchy into the expected info and error lists for health reporting.
 * @remark The health check result includes the status, info, error, and details of the module state.
 * 
 * @example
 * // Usage in a NestJS health controller
 * import { Controller, Get } from '@nestjs/common';
 * import { HealthCheckService, HttpHealthIndicator, HealthCheck } from '@nestjs/terminus';
 * import { ModuleStateHealthIndicator } from './module-state-health-indicator';
 * import { AppDomainStateManager } from '../../app-domain-state-manager';

 * @Controller('health')
 * export class HealthController {
 *   constructor(
 *     private health: HealthCheckService,
 *       private moduleStateHealthIndicator: ModuleStateHealthIndicator,
 *        private appDomainStateManager: AppDomainStateManager,
 *      ) {}

 *      @Get()
 *      @HealthCheck()
 *      check() {
 *        return this.health.check([
 *          () => this.moduleStateHealthIndicator.isHealthy(this.appDomainStateManager),
 *          // Add other health indicators here
 *        ]);
 *      }
 * }
 * 
 */
@Injectable()
export class ModuleStateHealthIndicator {
	constructor(
		private readonly healthIndicatorService: HealthIndicatorService,
	) {}

	/**
	 * Checks the health of the module state.
	 * 
	 * @param moduleStateManager The module state to check.
	 * @returns A promise that resolves to a HealthIndicatorResult.
	 * 
	 * @example output:
	 * {
      "module-state": {
        "status": "down",
        "info": {
          "RootComponent.OKComponent": {
            "status": "up",
            "state": "OK",
            "reason": "All good",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          }
        },
        "error": {
          "RootComponent": {
            "status": "down",
            "state": "FAILED",
            "reason": "Subcomponent failed",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          },
          "RootComponent.FailedComponent": {
            "status": "down",
            "state": "FAILED",
            "reason": "Something went wrong",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          }
        },
        "details": {
          "RootComponent": {
            "status": "down",
            "state": "FAILED",
            "reason": "Subcomponent failed",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          },
          "RootComponent.FailedComponent": {
            "status": "down",
            "state": "FAILED",
            "reason": "Something went wrong",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          },
          "RootComponent.OKComponent": {
            "status": "up",
            "state": "OK",
            "reason": "All good",
            "updatedOn": "2025-05-17T06:11:10.074Z"
          }
        }
      }
    }
	 */
	public async isHealthy(moduleStateManager: DomainStateManager): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check('module-state');
		const stateInfo: ComponentStateInfo = await moduleStateManager.getState();
		const isHealthy = stateInfo.state === ComponentState.OK || stateInfo.state === ComponentState.DEGRADED;
		const result: HealthIndicatorResult = this.mapStateToHealthIndicatorResult(stateInfo);
		return isHealthy ? indicator.up(result) : indicator.down(result);
	}

	/*
	 * Maps component state to a HealthIndicatorResult.
	 * 
	 * @param stateInfo The component state to map.
	 * @returns A HealthIndicatorResult.
	 * 
	 */
	private mapStateToHealthIndicatorResult(stateInfo: ComponentStateInfo): HealthIndicatorResult {
		// Map top level state to status property
		const status: HealthIndicatorStatus = this.isComponentHealthy(stateInfo.state) ? 'up' : 'down';
		
		// Initialize result structure with required sections
		const result: any = {
			status,
			info: {},
			error: {},
			details: {}
		};
		
		// Get flattened list of all components (including main component)
		const allComponents = this.flattenComponents(stateInfo);
		
		// Process each component and add to appropriate sections
		allComponents.forEach(component => {
			const compIsHealthy = this.isComponentHealthy(component.state);
			const compStatus: HealthIndicatorStatus = compIsHealthy ? 'up' : 'down';
			
			// Create component data object with standardized format
			const componentData = {
				status: compStatus,
				state: component.state,
				reason: component.reason || '',
				timestamp: component.updatedOn.toISOString() // timestamp is the expected name in health indicators
			};
			
			// Add to info or error based on health status
			if (compIsHealthy) {
				result.info[component.path] = {status: componentData.status};
			} else {
				result.error[component.path] = {status: componentData.status, reason: componentData.reason};
			}
			
			// Always add to details
			result.details[component.path] = componentData;
		});
		
		return result;
	}

	/*
	 * Helper method to determine if a component state is considered healthy
	 */
	private isComponentHealthy(state: ComponentState): boolean {
		return state === ComponentState.OK || state === ComponentState.DEGRADED;
	}

	/*
	 * Recursively flattens the component hierarchy into a list for health reporting
	 * 
	 * @param component The root component whose hierarchy will be flattened
	 * @param parentPath Path string of parent components for building a fully qualified path
	 * @param maxDepth Maximum depth to traverse to prevent excessive recursion (default: 10)
	 * @param currentDepth Current recursion depth (used internally, start with 0)
	 * @returns Array of component state objects with added path property
	 * 
	 * @example
	 * // Result example for a component with children:
	 * // [
	 * //   { name: "Root", path: "Root", state: "OK", ... },
	 * //   { name: "Child", path: "Root.Child", state: "FAILED", ... }
	 * // ]
	 * 
	 * @todo Get maxpDepth from config, to make it configurable (or use a stack instead of recursion)
	 */
	private flattenComponents(
		component: ComponentStateInfo, 
		parentPath: string = '', 
		maxDepth: number = 10,
		currentDepth: number = 0
	): Array<ComponentStateInfo & {path: string}> {
		if (currentDepth > maxDepth) {
			return []; // Prevent excessive recursion
		}
		
		// Create path for this component
		const path = parentPath ? `${parentPath}.${component.name}` : component.name;
		
		// Add current component with its path
		const result: Array<ComponentStateInfo & {path: string}> = [{
			...component,
			path
		}];
		
		// Process subcomponents if any
		if (component.components && component.components.length > 0 && currentDepth < maxDepth) {
			component.components.forEach(subComp => {
			const subComponents = this.flattenComponents(
				subComp, 
				path, 
				maxDepth,
				currentDepth + 1
			);
			result.push(...subComponents);
			});
		}
		
		return result;
	}
}
export default ModuleStateHealthIndicator;