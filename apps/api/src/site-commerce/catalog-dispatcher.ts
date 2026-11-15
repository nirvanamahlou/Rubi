import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { SiteCommerceService } from './site-commerce.service';

@Injectable()
export class WebsiteCatalogDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly logger = new Logger(WebsiteCatalogDispatcher.name);
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SiteCommerceService) private readonly commerce: SiteCommerceService,
  ) {}

  onModuleInit() {
    this.schedule(1000);
  }
  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  private schedule(delay: number) {
    if (!this.stopped)
      this.timer = setTimeout(() => {
        void this.tick();
      }, delay);
  }
  private async tick() {
    let delay = 3000;
    try {
      const secret = process.env.NSS_CATALOG_WEBHOOK_SECRET;
      if (!secret || secret.length < 32) return;
      const binding = JSON.parse(
        process.env.SITE_COMMERCE_BINDINGS ?? '{}',
      ).nss;
      if (!binding?.branchId || !binding.userId) return;
      await this.db.client.websiteCatalogDelivery.upsert({
        where: { siteCode: 'nss' },
        create: { siteCode: 'nss', branchId: binding.branchId },
        update: {},
      });
      let state = await this.db.client.websiteCatalogDelivery.findUniqueOrThrow(
        { where: { siteCode: 'nss' } },
      );
      if (
        state.revision <= state.deliveredRevision &&
        state.nextRefreshAt &&
        state.nextRefreshAt <= new Date()
      ) {
        await this.db.client.websiteCatalogDelivery.updateMany({
          where: { siteCode: 'nss', revision: state.revision },
          data: { revision: { increment: 1 }, nextRefreshAt: null },
        });
        state = await this.db.client.websiteCatalogDelivery.findUniqueOrThrow({
          where: { siteCode: 'nss' },
        });
      }
      if (state.revision <= state.deliveredRevision) return;
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
      const catalog = await this.commerce.catalog('nss', actor);
      const body = JSON.stringify({
        ...catalog,
        site: 'nss',
        revision: Number(state.revision),
      });
      if (Buffer.byteLength(body) > 4 * 1024 * 1024)
        throw Error('Catalog size exceeded');
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', secret)
        .update(timestamp + '.' + body)
        .digest('hex');
      const response = await fetch(
        'https://niyayeshseir.ir/api/v1/erp/catalog-delivery',
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
        where: { siteCode: 'nss', deliveredRevision: { lt: state.revision } },
        data: {
          deliveredRevision: state.revision,
          deliveredAt: new Date(),
          nextRefreshAt,
        },
      });
    } catch {
      // Keep the durable revision pending. Never log payloads, credentials or private upstream errors.
      this.logger.warn('Website catalog delivery pending; retry scheduled');
      delay = 20000;
    } finally {
      this.schedule(delay);
    }
  }
}
