import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";
import { HttpService } from '@nestjs/axios';

import EventSource from 'eventsource';
import { firstValueFrom } from 'rxjs';

import path from 'path';

//import { EventSourceBuilder } from '../../utils/event-source-builder';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from "../../dtos/domain/conditioning-log.dto";
import { ConditioningLogRepository } from '../conditioning-log.repo';
import { EntityId,  Logger, Result } from "@evelbulgroz/ddd-base";
import { FileService } from '../../services/file-service/file.service';
import { EndPointConfig } from '../../domain/config-options.model';


/**@classdesc Concrete implementation of ConditioningLogRepo that uses the local file system to for persistence.
 * @todo Move all logic re. collaboration with import service to data service, making repo oblivious to import service
*/
@Injectable()
export class FsConditioningLogRepo extends ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO> {
	
	//--------------------------------- INSTANCE PROPERTIES ---------------------------------

	private dataDir: string; // path to data directory
	private importUpdateSource: EventSource;
	private serviceRegistryEndpoint: string; // location of service registry
	private serviceLocations: Record<string, string> = {}; // locations of microservice used by repo
		
	//------------------------------------ CONSTRUCTOR ------------------------------------

	constructor(
		logger: Logger,
		@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
		protected readonly config: ConfigService, // make config available before super() call; will override base class config, but DI uses singleton so minimal impact
		private readonly fs: FileService,
		private readonly http: HttpService
		)
	{
		//const throttleTime = config.get<number>('modules.conditioning.repos.fs.throttleTime');
		super(logger, throttleTime);
		this.dataDir = this.config.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
	}

	//----------------------------------- LIFECYCLE EVENTS --------------------------------------------

	async onModuleDestroy(): Promise<void> {
		this.importUpdateSource.close();
		this.logger.log(`${this.constructor.name}: SSE subscription closed.`);
		this.logger.log(`${this.constructor.name}: Destroyed.`);
	}

	//----------------------------------- PROTECTED METHODS --------------------------------------------

	protected async initializePersistence(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Initializing persistence...`);
		// create and populate data directory if it doesn't exist, or is empty
		// likely to be slow, but once run should only be called rarely
		try { // create data directory if it doesn't exist
			await this.fs.mkdir(this.dataDir, { recursive: true });
		}
		catch (err) {
			// directory already exists -> do nothing (ignore error)
		}

		try {
			let files: string[] = await this.fs.readdir(this.dataDir);
			if (files.length === 0) { // data directory is empty -> populate with logs from import service
				// get overviews first (to avoid choking runtime)
				let dtos: ConditioningLogDTO[];
				const overviewsResult = await this.#importOverViews();
				if (overviewsResult.isFailure) {
					return Promise.resolve(Result.fail<void>(overviewsResult.error));
				}
				dtos = overviewsResult.value as ConditioningLogDTO[];

				// get details (if any)
				const detailsResult = await this.#importDetails(dtos);
				if (detailsResult.isFailure) {
					return Promise.resolve(Result.fail<void>(detailsResult.error));
				}
				// else: continue (fall through to default return)
			}
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}

		return Promise.resolve(Result.ok<void>());
	}
	
	// populate cache from data directory (cache is populated with overviews only, load details on demand)
	protected async populateEntityCache(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Populating cache...`);
		let dtos: ConditioningLogDTO[];
		this.cache.next([]); // clear cache
		try {
			// recursively read each .json file, parse to log, and add to cache
			dtos = await this.#readJson(this.dataDir);
			for (const dto of dtos) { // process sequentially to avoid choking runtime
				const createdOn = dto.createdOn ? new Date(dto.createdOn) : undefined;
				const updatedOn = dto.updatedOn ? new Date(dto.updatedOn) : undefined;
				const result = ConditioningLog.create(dto, dto.entityId, createdOn, updatedOn, true);
				if (result.isSuccess) {
					const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
					this.cache.value.push(log);	// idCache is auto-updated when main cache emits new value
				}
				else {
					Promise.resolve(Result.fail<void>(result.error));
				}
			};
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}

		this.logger.log(`${this.cache.value.length} logs cached.`);

		return Promise.resolve(Result.ok<void>())
	}

	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		this.logger.log(`${this.constructor.name}: Initialization complete.`);
		return Promise.resolve(Result.ok<void>());
	}
	
	protected async createEntity(data: ConditioningLogDTO, id: EntityId, overview: boolean = false): Promise<Result<ConditioningLog<any, ConditioningLogDTO>>> {
		const createResult = ConditioningLog.create(data,id, undefined, undefined, overview); // by default, persisted logs should always be fully detailed
		if (createResult.isFailure) {
			return Promise.resolve(Result.fail<ConditioningLog<any, ConditioningLogDTO>>(createResult.error));
		}

		const storeResult = await this.updateEntity(createResult.value as ConditioningLog<any, ConditioningLogDTO>);
		if (storeResult.isFailure) {
			return Promise.resolve(Result.fail<ConditioningLog<any, ConditioningLogDTO>>(storeResult.error));
		}

		return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(createResult.value as ConditioningLog<any, ConditioningLogDTO>));
	}

	protected async retrieveEntity(entityId: EntityId, overview: boolean = true): Promise<Result<ConditioningLog<any, ConditioningLogDTO>>> {
		// persisted logs are assumed to always be detailed, so just pass overview flag through to factory method
		let result: any;
		try {
			const data = await this.fs.readFile(`${this.dataDir}/${entityId}.json`);
			const dto = JSON.parse(data.toString());
			result = ConditioningLog.create(dto, dto.entityId, undefined, undefined, overview);
		}
		catch (err) {
			return Promise.resolve(Result.fail<ConditioningLog<any, ConditioningLogDTO>>(err));
		}

		return Promise.resolve(result);
	}

	protected async updateEntity(entity: ConditioningLog<any, ConditioningLogDTO> | Partial<ConditioningLogDTO>): Promise<Result<void>> {
		try {
			const dto = entity instanceof ConditioningLog ? entity.toJSON() : entity;
			const data = JSON.stringify(dto);
			await this.fs.mkdir(this.dataDir, { recursive: true }); // create directory if it doesn't exist, else leave as is
			await this.fs.writeFile(`${this.dataDir}/${dto.entityId}.json`, data);
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}

		return Promise.resolve(Result.ok<void>());
	}

	protected async deleteEntity(entityId: EntityId): Promise<Result<void>> {
		try {
			await this.fs.rm(`${this.dataDir}/${entityId}.json`);
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}

		return Promise.resolve(Result.ok<void>());
	}

	protected getEntityFromDTO(dto: ConditioningLogDTO): ConditioningLog<any, ConditioningLogDTO> | undefined {
		return this.cache.value.find(e => { 
			if (typeof dto.entityId === 'string' || typeof dto.entityId === 'number') { // try to match by id, when possible and valid
				return e.entityId === dto.entityId;
			}
			else { // try to match by source id
				return (e.meta?.sourceId?.id === dto.meta?.sourceId?.id && e.meta?.sourceId?.source === dto.meta?.sourceId?.source);
			}
		}) as ConditioningLog<any, ConditioningLogDTO> | undefined;
	}

	protected getClassFromDTO(dto: ConditioningLogDTO): Result<any> {
		return ConditioningLogRepository.getClassFromName(dto.className);
	}

	//----------------------------------- PRIVATE METHODS --------------------------------------------

	async #getServiceLocation(name: string): Promise<string> {
		if (this.serviceLocations[name] !== undefined) { // location is already cached;
			return Promise.resolve(this.serviceLocations[name]);
		}

		this.serviceRegistryEndpoint = this.serviceRegistryEndpoint ?? this.config.get<EndPointConfig>('endpoints.fitnessapp-registry-service');
		try { // get service location from registry
			const url = `${this.serviceRegistryEndpoint}/${name}`;
			const response$ = this.http.get(url);
			const response = await firstValueFrom(response$);
			const serviceInfo = response.data;
			const location = serviceInfo.location;
			this.serviceLocations[name] = location;
			return Promise.resolve(location);
		}
		catch (error) {
			this.logger.error(`Error getting ${name} endpoint: ${error}`);
			return Promise.reject(error);
		}
	}	

	async #importOverViews(): Promise<Result<ConditioningLogDTO[]>> {
		//http://localhost:3050/api/v1/import/conditioning/logs
		const dtos: ConditioningLogDTO[] = [];
		try {
			//this.logger.log(`${this.constructor.name} empty: populating with logs from import microservice...`);
			const serviceLocation = await this.#getServiceLocation('fitnessapp-import-service');
			//const url = 'http://localhost:3050/api/v1/import/conditioning/logs'; // debug
			const url = `${serviceLocation}/conditioning/logs`;
			const response$ = this.http.get(url);
			const response = await firstValueFrom(response$);  // get overview logs from import service
			const importedDTOs = response.data as ConditioningLogDTO[];			
			this.logger.log(`${importedDTOs.length} overview logs received from import microservice`)
			
			for (const dto of importedDTOs) { // add each log to file system (process sequentially to avoid choking runtime)
				//const startDate = new Date(dto.start!); // debug
				//if (startDate <= new Date('2024-01-14T09:50:23.000Z')) continue; // debug

				dto.entityId = this.getNextId(); // assign id
				dto.isOverview = true; // set overview flag
				dtos.push(dto); // add to dto array
				await this.fs.writeFile(`${this.dataDir}/${dto.entityId}.json`, JSON.stringify(dto), { encoding: 'utf-8' });		
			};
			
			// do some basic consistency checks
			const files = await this.fs.readdir(this.dataDir);
			if (importedDTOs.length === 0) { // no logs to import
				console.warn('Zero logs to import, is this correct?');
				return Promise.resolve(Result.ok<ConditioningLogDTO[]>());
			}
			else if (files.length < importedDTOs.length) { // not all logs imported successfully
				return Promise.resolve(Result.fail<ConditioningLogDTO[]>(`${files.length} logs persisted, expected ${importedDTOs.length}.`));
			}
			else if (files.length > importedDTOs.length) { // more logs imported than expected
				return Promise.resolve(Result.fail<ConditioningLogDTO[]>(`${files.length} logs persisted, expected ${importedDTOs.length}.`));
			}
			// else: continue
			this.logger.log(`${files.length} overview logs imported and stored in repo`);
		}
		catch (err) {
			return Promise.resolve(Result.fail<ConditioningLogDTO[]>(err));
		}

		return Promise.resolve(Result.ok<ConditioningLogDTO[]>(dtos));
	}

	async #importDetails(dtos: ConditioningLogDTO[]): Promise<Result<void>> {
		this.logger.log(`Getting details from import microservice for ${dtos.length} logs...`);
		const exclusions: string[] = []; // known bad files to exclude, if any
		let url: string;
		
		try {
			const serviceLocation = await this.#getServiceLocation('fitnessapp-import-service');
			url = `${serviceLocation}/conditioning/log`;
			//url = 'http://localhost:3050/api/v1/import/conditioning/log'; // debug
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}
		
		for (const dto of dtos) { // process sequentially to avoid choking runtime (map runs in parallel)
			if (dto.meta?.sourceId === undefined) { // no source id, so skip
				this.logger.warn(`No source id for ${dto.entityId}.json, cannot get details, skipping...`);
				continue;
			}

			if (exclusions.includes(dto.meta?.sourceId?.id as string)) { // file is excluded, so skip
				this.logger.warn(`${dto.meta?.sourceId?.id as string}.json is excluded, skipping...`);
				continue;
			}

			try {
				const data =  {source: dto.meta?.sourceId?.source, id: dto.meta?.sourceId?.id};
				const response$ = this.http.post(url, data);
				const response = await firstValueFrom(response$); // get detailed log from import service
				
				const detailedDto = response.data as ConditioningLogDTO;
				detailedDto.entityId = dto.entityId; // retain id
				detailedDto.isOverview = false; // set overview flag
				
				await this.fs.writeFile(`${this.dataDir}/${dto.entityId}.json`, JSON.stringify(detailedDto), { encoding: 'utf-8' });
			}
			catch (err) {
				const data = JSON.stringify({source: dto.meta?.sourceId?.source, id: dto.meta?.sourceId?.id});
				this.logger.error(`Error getting details for ${data}: ${err}`);
			}
		};

		this.logger.log(`${dtos.length} logs detailed and updated in repo`);

		return Promise.resolve(Result.ok<void>());
	}

	// recursively read each .json file, parse to log, and add to cache (helper method for initialize)
	// NOTE: Consider refactoring to use retreiveEntity() to avoid code duplication	
	// NOTE: Consider refactoring to use streams to avoid choking runtime
	// NOTE: Make run sequentially to avoid choking runtime and make initialization deterministic
	async #readJson(jsonDirOrFile: string, acc: ConditioningLogDTO[] = []): Promise<ConditioningLogDTO[]> {
		let json: ConditioningLogDTO;
		let result: any;
		const stats = await this.fs.stat(jsonDirOrFile);
		
		if (stats.isDirectory()) {
			let filePath: string, files = await this.fs.readdir(jsonDirOrFile);
			for (const file of files) {
				filePath = path.join(jsonDirOrFile, file);
				result = await this.#readJson(filePath, acc);
			}
		}
		else if (jsonDirOrFile.endsWith('.json')) { // json file -> process
			result = await this.fs.readFile(jsonDirOrFile);
			json = JSON.parse(result.toString());
			acc.push(json);
		}		
		// else: skip non-json files

		return Promise.resolve(acc);
	}

	// subscribe to updates from import microservice and update repo accordingly (SSE approach, in development)
	/*
	async #subscribeToImportUpdates(): Promise<void> {
		const serviceLocation = await this.#getServiceLocation('fitnessapp-import-service');
		const endpoint = `${serviceLocation}/conditioning/updates`;	
		
		this.importUpdateSource = EventSourceBuilder.EventSource(endpoint);
		this.importUpdateSource.onmessage = (event) => {
			const domainEvents = JSON.parse(event.data);
			this.logger.log(`${this.constructor.name}: Received ${domainEvents.length} updates via SSE from import service.`);
			for (const domainEvent of domainEvents) {
				this.logger.log(`${this.constructor.name}: Processing update from import microservice: ${domainEvent.payload.start}.`);
				this.processEvent(domainEvent).then(result => {
					if (result.isFailure) {
						this.logger.error(`Error processing update from import microservice: ${result.error}.`);
					}
				});
			}
		};

		this.importUpdateSource.onerror = (error) => {
			this.logger.error(`Error occurred: ${error}`);
		};
		
		this.logger.log(`${this.constructor.name}: Subscribed to updates from import microservice.`);

		return Promise.resolve();
	}
		*/
}

export default FsConditioningLogRepo;