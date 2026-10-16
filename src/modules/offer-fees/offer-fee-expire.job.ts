import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OfferFeesService } from './offer-fees.service.js';

function isTransientDbError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no authentication method is found|ECONNRESET|Connection terminated|timeout|SSL|Connection refused|sorry, too many clients/i.test(
    message,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      const summary = await this.runWithRetry();
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

  private async runWithRetry(maxAttempts = 3) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.offerFees.expireUnpaidForScheduler({
          promoteWaitlist: true,
        });
      } catch (err) {
        lastError = err;
        if (!isTransientDbError(err) || attempt === maxAttempts) {
          throw err;
        }
        const delayMs = attempt * 1500;
        this.logger.warn(
          `Offer fee expire job DB blip (attempt ${attempt}/${maxAttempts}): ${
            err instanceof Error ? err.message : String(err)
          }; retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }
    throw lastError;
  }
}
