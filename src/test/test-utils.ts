import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { ConfigModule } from '@nestjs/config';
import '../../config/test.config';

/** Wrapper for Test.createTestingModule() that initializes ConfigModule with test config */
export async function createTestingModule(metadata: ModuleMetadata): Promise<TestingModuleBuilder> {
	const testConfigFn = (await import('../../config/test.config') as any).default as any;
	void await testConfigFn(); // bug: config doesn't load without this line
	const builder: TestingModuleBuilder = Test.createTestingModule({
		imports: [
			ConfigModule.forRoot({
				load: [testConfigFn],
			}),
			...(metadata.imports || []),
		],
		controllers: metadata.controllers,
		providers: metadata.providers,
		exports: metadata.exports,
	});

	return builder;
}

export default createTestingModule;