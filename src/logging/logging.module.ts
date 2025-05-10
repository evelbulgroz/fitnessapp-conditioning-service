import { Global, Module } from '@nestjs/common';

import { ConsoleLogger } from '@evelbulgroz/logger';
import { Logger, LogLevel, MergedStreamLogger } from '../libraries/stream-loggable';

import ComponentStateMapper from './mappers/component-state.mapper';
import LogMapper from './mappers/log.mapper';
import RepoLogMapper from './mappers/repo-log.mapper';

/** This module centrally manages the logging configuration for the application.
 * 
 * It provides {@link MergedStreamLogger} globally to all modules, allowing them to 
 * register components that use {@link StreamLoggableMixin} for logging so that
 * their logs can be aggregated into a single stream and sent to the concrete logger.
 * 
 * @see {@link MergedStreamLogger} for more details on how to use this logger.
 * 
 * Consuming modules can inject the logger using the `@Inject(MergedStreamLogger)` decorator.
 * 
 * They should register their components with the logger using the `registerComponent` method
 * in the `onModuleInit` lifecycle hook.
 * 
 * They should also unregister their components using the `unregisterComponent` method
 * in the `onModuleDestroy` lifecycle hook.
 */
@Global()
@Module({
	providers: [
		// Register mappers
		ComponentStateMapper,
		LogMapper,
		RepoLogMapper,
		{ // Group mappers into an injectable token
			provide: 'STREAM_MAPPERS',
			useFactory: (logMapper: LogMapper, repoMapper: RepoLogMapper, stateMapper: ComponentStateMapper) => [
				logMapper,	
				repoMapper, 
				stateMapper
			],
			inject: [LogMapper, RepoLogMapper, ComponentStateMapper, ]
		},
		
		{ // Register ConsoleLogger as a provider
			provide: Logger,
			useFactory: () => {
				// todo: get app name from config
				return new ConsoleLogger(LogLevel.DEBUG, 'fitnessapp-conditioning-service');
			}
		},		
		{ // Configure MergedStreamLogger with ConsoleLogger
			provide: MergedStreamLogger,
			useFactory: (logger: Logger, mappers: any[]) => {
				return new MergedStreamLogger(logger, mappers);
			},
			inject: [Logger, 'STREAM_MAPPERS']
		}
	],
	exports: [Logger, MergedStreamLogger]
})
export class LoggingModule {}
export default LoggingModule;