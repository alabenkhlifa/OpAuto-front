import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApprovalService } from './approval.service';

/**
 * Sweeps stale `PENDING_APPROVAL` rows once a minute. Without this, an
 * unattended approval card would stay pending forever and the owner could
 * accidentally approve a stale action hours later. `expireOverdue` is
 * idempotent — it only flips rows whose `expiresAt` is already in the past.
 */
@Injectable()
export class ApprovalSchedulerService {
  private readonly logger = new Logger(ApprovalSchedulerService.name);

  constructor(private readonly approvals: ApprovalService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runExpiry(): Promise<void> {
    try {
      const count = await this.approvals.expireOverdue();
      if (count > 0) {
        this.logger.log(`approval expiry sweep: expired ${count} rows`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`approval expiry sweep failed: ${message}`);
    }
  }
}
