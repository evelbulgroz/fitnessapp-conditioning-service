import { Injectable } from '@nestjs/common';

import * as fs from "fs/promises";
import * as fsSync from "fs";

/**@classdesc Mockable wrapper for the Node.js file system module.
 * @remarks Prevents introducing a new dependency on e.g. mock-fs or fs-extra-mock.
 * @remarks (Node.js file system (fs) module is not mockable by default). 
 */
@Injectable()
export class FileService {
	public createReadStream(filePath: string, options?: any): any {
		return fsSync.createReadStream(filePath, options);
	}

	public existsSync(filePath: string): boolean {
		return fsSync.existsSync(filePath);
	}

	public async mkdir(dirPath: string, options?: {}): Promise<void> {
		return fs.mkdir(dirPath, options);
	}

	public async readdir(dirPath: string): Promise<string[]> {
		return fs.readdir(dirPath);
	}

	public async readFile(filePath: string, encoding?: BufferEncoding): Promise<any> {
		return fs.readFile(filePath, encoding);
	}
	
	public async rm(filePath: string, options?: {}): Promise<void> {
		return fs.rm(filePath, options);
	}

	public async stat(filePath: string): Promise<any> {
		return fs.stat(filePath);
	}
	
	public async writeFile(filePath: string, data: any, options?: any): Promise<void> {
		return fs.writeFile(filePath, data);
	}	
}