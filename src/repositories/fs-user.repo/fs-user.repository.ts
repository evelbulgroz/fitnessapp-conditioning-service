import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";
import { HttpService } from '@nestjs/axios';

import EventSource from 'eventsource';
import { firstValueFrom } from 'rxjs';
import path from 'path';

import { EntityId, Logger, Result } from "@evelbulgroz/ddd-base";

import { EndPointConfig } from '../../domain/config-options.model';
import { FileService } from '../../services/file-service/file.service';
import { User } from '../../domain/user.entity';
import { UserDTO } from "../../dtos/user.dto";
import { UserRepository } from '../user-repo.model';

/**@classdesc Concrete implementation of UserRepo that uses the local file system to for persistence.
 * @todo Complete refactoring of deserialization to fit User props
 */
@Injectable()
export class FsUserRepo extends UserRepository<User, UserDTO> {
	
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
		this.dataDir = this.config.get<string>('modules.user.repos.fs.dataDir') ?? 'no-such-dir';
	}

	//----------------------------------- LIFECYCLE EVENTS --------------------------------------------

	async onModuleDestroy(): Promise<void> {
		this.importUpdateSource.close();
		this.logger.log(`${this.constructor.name}: SSE subscription closed.`);
		this.logger.log(`${this.constructor.name}: Destroyed.`);
	}

	//----------------------------- PROTECTED (TEMPLATE) METHODS --------------------------------------

	protected async initializePersistence(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Initializing persistence...`);
		// create data directory if it doesn't exist
		try { // create data directory if it doesn't exist
			await this.fs.mkdir(this.dataDir, { recursive: true });
		}
		catch (err) {
			// directory already exists -> do nothing (ignore error)
		}
		
		return Promise.resolve(Result.ok<void>());
	}
	
	// populate cache from data directory
	protected async populateEntityCache(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Populating cache...`);
		let dtos: UserDTO[];
		this.cache.next([]); // clear cache
		try {
			// recursively read each .json file, parse to user, and add to cache
			dtos = await this.#readJson(this.dataDir);
			for (const dto of dtos) { // process sequentially to avoid choking runtime
				const createdOn = dto.createdOn ? new Date(dto.createdOn) : undefined;
				const updatedOn = dto.updatedOn ? new Date(dto.updatedOn) : undefined;
				const result = User.create(dto, dto.entityId, createdOn, updatedOn);
				if (result.isSuccess) {
					const user = result.value as User;
					this.cache.value.push(user); // idCache is auto-updated when main cache emits new value
				}
				else {
					Promise.resolve(Result.fail<void>(result.error));
				}
			};
		}
		catch (err) {
			return Promise.resolve(Result.fail<void>(err));
		}
		
		return Promise.resolve(Result.ok<void>())
	}

	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates(); // todo: deal with updates later
		//this.logger.log(`${this.constructor.name}: Initialization complete.`);
		return Promise.resolve(Result.ok<void>());
	}
	
	protected async createEntity(data: UserDTO, id: EntityId,): Promise<Result<User>> {
		const createResult = User.create(data, id, undefined, undefined);
		if (createResult.isFailure) {
			return Promise.resolve(Result.fail<User>(createResult.error));
		}

		const storeResult = await this.updateEntity(createResult.value as User);
		if (storeResult.isFailure) {
			return Promise.resolve(Result.fail<User>(storeResult.error));
		}

		return Promise.resolve(Result.ok<User>(createResult.value as User));
	}

	protected async retrieveEntity(entityId: EntityId): Promise<Result<User>> {
		let result: any;
		try {
			const data = await this.fs.readFile(`${this.dataDir}/${entityId}.json`);
			const dto = JSON.parse(data.toString());
			result = User.create(dto, dto.entityId, undefined, undefined);
		}
		catch (err) {
			return Promise.resolve(Result.fail<User>(err));
		}

		return Promise.resolve(result);
	}

	protected async updateEntity(entity: User | Partial<UserDTO>): Promise<Result<void>> {
		try {
			const dto = entity instanceof User ? entity.toJSON() : entity;
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

	protected getEntityFromDTO(dto: UserDTO): User | undefined {
		return this.cache.value.find(e => { 
			if (typeof dto.entityId === 'string' || typeof dto.entityId === 'number') { // try to match by id, when possible and valid
				return e.entityId === dto.entityId;
			}
			else { // try to match by user id
				return e.userId === dto.userId;
			}
		}) as User | undefined;
	}

	protected getClassFromDTO(dto: UserDTO): Result<any> {
		return UserRepository.getClassFromName(dto.className);
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

	// recursively read each .json file, parse to user, and add to cache (helper method for initialize)
	// NOTE: Consider refactoring to use retreiveEntity() to avoid code duplication	
	// NOTE: Consider refactoring to use streams to avoid choking runtime
	// NOTE: Make run sequentially to avoid choking runtime and make initialization deterministic
	async #readJson(jsonDirOrFile: string, acc: UserDTO[] = []): Promise<UserDTO[]> {
		let json: UserDTO;
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
}

export default FsUserRepo;