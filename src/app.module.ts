import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryMapper } from './mappers/query.mapper';

@Module({
	imports: [],
	controllers: [AppController],
	providers: [
		AppService,
		QueryMapper
	],
})
export class AppModule {}
