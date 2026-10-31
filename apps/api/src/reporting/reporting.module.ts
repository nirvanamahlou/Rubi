import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { IamModule } from '../iam/iam.module';
import { DocumentsModule } from '../documents/documents.module';
import { SettingsModule } from '../settings/settings.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { ReportingExportService } from './reporting-export.service';
import { SalesDashboardPublicModule } from '../sales/sales-dashboard.public';
import { CustomerDashboardPublicModule } from '../customers/customer-dashboard.public';
import { LeadDashboardPublicModule } from '../customer-affairs/lead-dashboard.public';
import { ReportingNativeDashboard } from './reporting-native-dashboard';
import { SalesDashboardPaymentsModule } from '../sales/sales-dashboard-payments.public';
import { SalesDashboardCustomersModule } from '../sales/sales-dashboard-customers.public';

@Module({
  imports: [
    IamModule,
    DocumentsModule,
    SettingsModule,
    SalesDashboardPublicModule,
    CustomerDashboardPublicModule,
    LeadDashboardPublicModule,
    SalesDashboardPaymentsModule,
    SalesDashboardCustomersModule,
  ],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    ReportingNativeDashboard,
    ReportingRepository,
    ReportingExportService,
    AuthGuard,
    PermissionGuard,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
