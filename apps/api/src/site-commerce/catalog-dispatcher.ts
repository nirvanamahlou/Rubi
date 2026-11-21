import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { SiteCommerceService } from './site-commerce.service';

import {
  commerceSites,
  deliverySites,
  type CommerceSite,
} from './commerce-sites';

@Injectable()
export class WebsiteCatalogDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly timers = new Map<
    CommerceSite,
    ReturnType<typeof setTimeout>
  >();
  private stopped = false;
  private readonly logger = new Logger(WebsiteCatalogDispatcher.name);
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SiteCommerceService) private readonly commerce: SiteCommerceService,
  ) {}

  onModuleInit() {
    for (const site of deliverySites) this.schedule(site, 1000);
  }
  onModuleDestroy() {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
  }
  private schedule(site: CommerceSite, delay: number) {
    if (!this.stopped)
      this.timers.set(
        site,
        setTimeout(() => {
          void this.tick(site);
        }, delay),
      );
  }
  private async tick(site: CommerceSite = 'nss') {
    let delay = 3000;
    let pending: bigint | undefined;
    let errorCode = 'catalog_preparation_failed';
    try {
      const config = commerceSites[site];
      const secret = process.env[config.signingKey];
      if (!secret) return;
      const bindings = JSON.parse(
        process.env.SITE_COMMERCE_BINDINGS ?? '{}',
      ) as Record<string, { branchId?: string; userId?: string }>;
      const binding = bindings[site];
      if (!binding?.branchId || !binding.userId) return;
      if (
        site === 'ghestiroo' &&
        Object.entries(bindings).some(
          ([other, value]) =>
            other !== site && value?.userId === binding.userId,
        )
      ) {
        this.logger.warn('Ghestiroo requires a dedicated site user');
        delay = 20000;
        return;
      }
      await this.db.client.websiteCatalogDelivery.upsert({
        where: { siteCode: site },
        create: { siteCode: site, branchId: binding.branchId },
        update: {},
      });
      let state = await this.db.client.websiteCatalogDelivery.findUniqueOrThrow(
        { where: { siteCode: site } },
      );
      if (
        state.revision <= state.deliveredRevision &&
        state.nextRefreshAt &&
        state.nextRefreshAt <= new Date()
      ) {
        await this.db.client.websiteCatalogDelivery.updateMany({
          where: { siteCode: site, revision: state.revision },
          data: { revision: { increment: 1 }, nextRefreshAt: null },
        });
        state = await this.db.client.websiteCatalogDelivery.findUniqueOrThrow({
          where: { siteCode: site },
        });
      }
      if (state.revision <= state.deliveredRevision) return;
      pending = state.revision;
      if (
        secret.length < 32 ||
        (site === 'jahan-bastan' &&
          secret === process.env.NSS_CATALOG_WEBHOOK_SECRET) ||
        (site === 'ghestiroo' &&
          (secret === process.env.NSS_CATALOG_WEBHOOK_SECRET ||
            secret === process.env.JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET))
      ) {
        errorCode = 'invalid_site_key';
        throw Error(errorCode);
      }
      if (state.branchId !== binding.branchId)
        throw Error('Catalog branch binding changed');
      // Trusted in-process read adapter: no end-user impersonation, writes or financial permissions.
      const actor: AuthenticatedActor = {
        userId: binding.userId,
        sessionId: '',
        branchIds: [binding.branchId],
        permissions: [
          'sales.contracts.create',
          'package_pricing.read',
          'ticket_catalog.read',
        ],
      };
      const nextRefreshAt = await this.commerce.nextCatalogCapacityChange(
        binding.branchId,
      );
      const catalog = await this.commerce.catalog(site, actor);
      const body = JSON.stringify({
        ...catalog,
        site,
        revision: Number(state.revision),
      });
      if (Buffer.byteLength(body) > 4 * 1024 * 1024)
        throw Error('Catalog size exceeded');
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', secret)
        .update(timestamp + '.' + body)
        .digest('hex');
      await this.db.client.websiteCatalogDelivery.updateMany({
        where: { siteCode: site, attemptedRevision: { lte: state.revision } },
        data: { attemptedRevision: state.revision },
      });
      errorCode = 'delivery_failed';
      const response = await fetch(
        config.origin + '/api/v1/erp/catalog-delivery',
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            'content-type': 'application/json',
            'x-erp-timestamp': timestamp,
            'x-erp-signature': signature,
          },
          body,
        },
      );
      if (!response.ok) throw Error('Catalog delivery rejected');
      errorCode = 'invalid_receipt';
      const receipt = (await response.json()) as {
        accepted?: boolean;
        revision?: number;
      };
      if (
        receipt.accepted !== true ||
        receipt.revision !== Number(state.revision)
      )
        throw Error('Invalid catalog receipt');
      await this.db.client.websiteCatalogDelivery.updateMany({
        where: { siteCode: site, deliveredRevision: { lt: state.revision } },
        data: {
          deliveredRevision: state.revision,
          deliveredAt: new Date(),
          lastError: null,
          nextRefreshAt,
        },
      });
    } catch {
      // Keep the durable revision pending. Never log payloads, credentials or private upstream errors.
      if (pending !== undefined) {
        await this.db.client.websiteCatalogDelivery
          .updateMany({
            where: {
              siteCode: site,
              deliveredRevision: { lt: pending },
              attemptedRevision: { lte: pending },
            },
            data: { lastError: errorCode },
          })
          .catch(() =>
            this.logger.warn(`Could not persist delivery error for ${site}`),
          );
      }
      this.logger.warn(`Catalog delivery pending for ${site}`);
      delay = 20000;
    } finally {
      this.schedule(site, delay);
    }
  }
}
