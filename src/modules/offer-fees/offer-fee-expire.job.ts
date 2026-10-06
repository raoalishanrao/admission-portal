import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OfferFeesService } from './offer-fees.service.js';

/**
 * Periodically expires unpaid published offers past deadline (+ grace)
 * and promotes waitlisted applicants into freed seats.
 */
@Injectable()
export class OfferFeeExpireJob {
  private readonly logger = new Logger(OfferFeeExpireJob.name);
  private running = false;

  constructor(private readonly offerFees: OfferFeesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourly(): Promise<void> {
    if (this.running) {
      this.logger.warn('Offer fee expire job already running; skipping tick');
      return;
    }
    this.running = true;
    try {
      const summary = await this.offerFees.expireUnpaidForScheduler({
        promoteWaitlist: true,
      });
      const expired = summary.reduce((s, r) => s + (r.expiredCount ?? 0), 0);
      const promoted = summary.reduce((s, r) => s + (r.promotedCount ?? 0), 0);
      if (expired || promoted) {
        this.logger.log(
          `Offer fee expire job: expired=${expired} promoted=${promoted} tenants=${summary.length}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Offer fee expire job failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
