import { Global, Module } from '@nestjs/common';

import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

import { MergedStreamLogger } from '../libraries/stream-loggable/utils/merged-stream-logger/merged-stream-logger.class';
import { LogEntryMapper } from '../libraries/stream-loggable/utils/merged-stream-logger/mappers/log-entry.mapper';
import { ComponentStateMapper } from '../libraries/stream-loggable/utils/merged-stream-logger/mappers/component-state.mapper';
import { LogLevel } from 'src/libraries/stream-loggable';

@Global()
@Module({
	providers: [
		// Register mappers
		LogEntryMapper,
		ComponentStateMapper,		
		{ // Group mappers into an injectable token
			provide: 'STREAM_MAPPERS',
			useFactory: (logMapper: LogEntryMapper, stateMapper: ComponentStateMapper) => [
				logMapper, 
				stateMapper
			],
			inject: [LogEntryMapper, ComponentStateMapper]
		},
		
		{ // Register NestJS Logger as a provider
			provide: Logger,
			useFactory: () => {
				return new ConsoleLogger(LogLevel.DEBUG, 'fitnessapp-conditioning-service', undefined, true);
			}
		},
		// Configure MergedStreamLogger with the NestJS Logger
		{
			provide: MergedStreamLogger,
			useFactory: (logger: Logger, mappers: any[]) => {
				return new MergedStreamLogger(logger, mappers);
			},
			inject: [Logger, 'STREAM_MAPPERS']
		}
	],
	exports: [MergedStreamLogger]
})
export class LoggingModule {}