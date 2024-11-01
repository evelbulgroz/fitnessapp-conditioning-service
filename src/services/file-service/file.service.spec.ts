import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';

import { FileService } from './file.service';

describe('FileService', () => {
	let fsService: FileService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [FileService],
		}).compile();

		fsService = module.get<FileService>(FileService);
	});

	it('can be created', () => {
		expect(fsService).toBeDefined();
	});

	it(`supports createReadStream()`, async () => {
		// arrange
		const testPath = 'testPath';
		const streamSpy = jest.spyOn(fsService, 'createReadStream')
			.mockImplementation((filePath) => {
				expect(filePath).toBe(testPath);
				return true;
			}
		);

		// act
		await fsService.createReadStream(testPath);

		// assert
		expect(streamSpy).toHaveBeenCalledWith(testPath);
		
		// cleanup
		streamSpy.mockRestore();
	});

	it(`supports existsSync()`, async () => {
		// arrange
		const testPath = 'testPath';
		const statSpy = jest.spyOn(fsService, 'existsSync')
			.mockImplementation((filePath) => {
				expect(filePath).toBe(testPath);
				return true;
			}
		);

		// act
		await fsService.existsSync(testPath);

		// assert
		expect(statSpy).toHaveBeenCalledWith(testPath);
		
		// cleanup
		statSpy.mockRestore();
	});

	it(`supports mkdir()`, async () => {
		// arrange
		const testPath = 'testPath';
		const testOptions = { recursive: true };
		const mkdirSpy = jest.spyOn(fsService, 'mkdir')
			.mockImplementation((dirPath, options) => {
				expect(dirPath).toBe(testPath);
				expect(options).toEqual(testOptions);
				return Promise.resolve();
			}
		);

		// act
		await fsService.mkdir(testPath, testOptions);
		
		// assert
		expect(mkdirSpy).toHaveBeenCalledWith(testPath, testOptions);
		
		// cleanup
		mkdirSpy.mockRestore();
	});

	it(`supports readdir()`, async () => {
		// arrange
		const testPath = 'testPath';
		const readdirSpy = jest.spyOn(fsService, 'readdir')
			.mockImplementation((dirPath) => {
				expect(dirPath).toBe(testPath);
				return Promise.resolve(['testFile1', 'testFile2']);
			}
		);

		// act
		await fsService.readdir(testPath);
		
		// assert
		expect(readdirSpy).toHaveBeenCalledWith(testPath);
		
		// cleanup
		readdirSpy.mockRestore();
	});

	it(`supports readFile()`, async () => {
		// arrange
		const testPath = 'testPath';
		const testEncoding = 'utf-8';
		const readFileSpy = jest.spyOn(fsService, 'readFile')
			.mockImplementation((filePath, encoding) => {
				expect(filePath).toBe(testPath);
				expect(encoding).toBe(testEncoding);
				return Promise.resolve(Buffer.from('testData', encoding));
			}
		);

		// act
		await fsService.readFile(testPath, 'utf-8');
		
		// assert
		expect(readFileSpy).toHaveBeenCalledWith(testPath, testEncoding);
		
		// cleanup
		readFileSpy.mockRestore();
	});

	it(`supports rm()`, async () => {
		// arrange
		const testPath = 'testPath';
		const testOptions = { recursive: true };
		const rmSpy = jest.spyOn(fsService, 'rm')
			.mockImplementation((filePath, options) => {
				expect(filePath).toBe(testPath);
				expect(options).toEqual(testOptions);
				return Promise.resolve();
			}
		);

		// act
		await fsService.rm(testPath, testOptions);
		
		// assert
		expect(rmSpy).toHaveBeenCalledWith(testPath, testOptions);
		
		// cleanup
		rmSpy.mockRestore();
	});

	it(`supports stat()`, async () => {
		// arrange
		const testPath = 'testPath';
		const statSpy = jest.spyOn(fsService, 'stat')
			.mockImplementation((filePath) => {
				expect(filePath).toBe(testPath);
				return Promise.resolve({isFile: () => true});
			}
		);

		// act
		await fsService.stat(testPath);
		
		// assert
		expect(statSpy).toHaveBeenCalledWith(testPath);
		
		// cleanup
		statSpy.mockRestore();
	});
	
	it(`supports writeFile()`, async () => {
		// arrange
		const testData = 'testData';
		const testPath = 'testPath';
		const writeFileSpy = jest.spyOn(fsService, 'writeFile')
			.mockImplementation((filePath, data) => {
				expect(filePath).toBe(testPath);
				expect(data).toBe(testData);
				return Promise.resolve();
			}
		);

		// act
		await fsService.writeFile(testPath, testData);
		
		// assert
		expect(writeFileSpy).toHaveBeenCalledWith(testPath, testData);
		
		// cleanup
		writeFileSpy.mockRestore();
	});

	
});
