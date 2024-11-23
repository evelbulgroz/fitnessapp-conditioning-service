import { Injectable, Logger } from '@nestjs/common';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserRepository } from '../repositories/user.repository';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';

@Injectable()
export class UserUpdatedHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly logRepo: ConditioningLogRepo,
    private readonly logger: Logger
  ) {}

  async handle(event: UserUpdatedEvent): Promise<void> {
    const userDTO = event.payload;
    const cacheEntry = this.userRepo.getUserLogsCacheEntry(userDTO.userId);
    if (cacheEntry) {
      const cachedLogs = cacheEntry.logs;
      const includedLogs = cachedLogs.filter((log) => userDTO.logs.includes(log.entityId));
      const cachedLogIds = cachedLogs.map((log) => log.entityId);
      const addedLogIds = userDTO.logs.filter((logId) => !cachedLogIds.includes(logId));
      const addedLogs = [];

      for (const logId of addedLogIds) {
        const result = await this.logRepo.fetchById(logId);
        if (result.isFailure) {
          this.logger.error(`Error fetching log ${logId} for user ${userDTO.userId}: ${result.error}`);
        } else {
          const log = await firstValueFrom(result.value);
          if (log) {
            addedLogs.push(log);
          }
        }
      }

      cacheEntry.logs = includedLogs.concat(addedLogs);
      cacheEntry.lastAccessed = new Date();
      this.userRepo.updateUserLogsCacheEntry(cacheEntry);
      this.logger.log(`User ${userDTO.userId} logs updated in cache.`);
    }
  }
}