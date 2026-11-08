import { readCustomerBehaviorDashboard } from '../customers/customer-behavior-dashboard.public';
import { readHrDashboard } from '../hr/hr-dashboard.public';
import { readReservationDashboard } from '../reservations/reservation-dashboard.public';
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CallCenterDashboardSource } from '../customer-affairs/call-center-dashboard.public';
import { DatabaseService } from '../database/database.service';
import { readTicketDashboard } from '../ticket-catalog/ticket-dashboard.public';
import { readSalesDashboardActivity } from '../sales/sales-dashboard-activity.public';
import { readDocumentDashboard } from '../documents/document-dashboard.public';
import { readSupportDashboard } from '../customer-affairs/support-dashboard.public';
import type { DashboardSourceQuery } from '../common/dashboard-source';

/** Composition only; every operational query stays in its owning public module. */
@Injectable()
export class DashboardOperationalSources {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ModuleRef) private readonly modules: ModuleRef,
  ) {}
  get readers() {
    return [
      {
        source: 'customers.dashboard.canonical-behavior.v1',
        read: (q: DashboardSourceQuery) =>
          readCustomerBehaviorDashboard(this.db.client, q),
      },
      {
        source: 'hr.dashboard.accepted-attendance.v1',
        read: (q: DashboardSourceQuery) => readHrDashboard(this.db.client, q),
      },
      {
        source: 'reservations.dashboard.issued-documents.v1',
        read: (q: DashboardSourceQuery) =>
          readReservationDashboard(this.db.client, q),
      },
      {
        source: 'customer-affairs.dashboard.attributed-calls.v1',
        // The application owns the public provider. Resolve it only after boot;
        // importing its full command module here creates a Sales/Reservations cycle.
        read: (q: DashboardSourceQuery) =>
          this.modules
            .get(CallCenterDashboardSource, { strict: false })
            .read(q),
      },
      {
        source: 'tickets.dashboard.current-capacity.v1',
        read: (q: DashboardSourceQuery) =>
          readTicketDashboard(this.db.client, q),
      },
      {
        source: 'sales.dashboard.activity-stays.v1',
        read: (q: DashboardSourceQuery) =>
          readSalesDashboardActivity(this.db.client, q),
      },
      {
        source: 'documents.dashboard.compliance.v1',
        read: (q: DashboardSourceQuery) =>
          readDocumentDashboard(this.db.client, q),
      },
      {
        source: 'customer-affairs.dashboard.support.v1',
        read: (q: DashboardSourceQuery) =>
          readSupportDashboard(this.db.client, q),
      },
    ];
  }
}
