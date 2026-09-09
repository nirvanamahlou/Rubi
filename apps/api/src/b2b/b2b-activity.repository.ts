import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import {
  activityEvent,
  activityPredicate,
  type ActivityRow,
  type ActivityWindow,
} from '../common/organization-activity';

@Injectable()
export class B2bActivityRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async activity(
    org: string,
    branch: string,
    actor: AuthenticatedActor,
    window: ActivityWindow,
  ) {
    const categories = ['PROFILE', 'ACCESS'];
    if (actor.permissions.includes('b2b.agreement.read'))
      categories.push('CONTRACT');
    if (actor.permissions.includes('b2b.credit.read'))
      categories.push('CREDIT');
    if (actor.permissions.includes('b2b.rate.read')) categories.push('RATE');
    const rows = await this.database.client.$queryRaw<ActivityRow[]>(Prisma.sql`
      WITH profiles AS (
        SELECT id::text AS id FROM b2b_agency_profiles WHERE "organizationId" = ${org}::uuid AND "branchId" = ${branch}::uuid
        UNION SELECT "entityId"::text FROM b2b_audit_events WHERE "branchId" = ${branch}::uuid AND "entityType" = 'AgencyOperationalProfile'
          AND ("beforeSnapshot"->>'organizationId' = ${org} OR "afterSnapshot"->>'organizationId' = ${org})
      ), agreements AS (
        SELECT id::text AS id FROM b2b_agency_agreements WHERE "profileId"::text IN (SELECT id FROM profiles)
        UNION SELECT "entityId"::text FROM b2b_audit_events WHERE "branchId" = ${branch}::uuid AND "entityType" = 'B2bAgencyAgreement'
          AND ("beforeSnapshot"->>'profileId' IN (SELECT id FROM profiles) OR "afterSnapshot"->>'profileId' IN (SELECT id FROM profiles))
      ), e AS (
        SELECT a.*, 'SUCCESS'::text AS outcome,
          CASE WHEN "entityType" IN ('B2bAgencyAgreement','B2bAgreementRevision') THEN 'CONTRACT'
            WHEN "entityType" = 'B2bAgencyCreditPolicy' THEN 'CREDIT'
            WHEN "entityType" = 'B2bAgencyAgreedRate' THEN 'RATE'
            WHEN "entityType" = 'B2bOrganizationUser' THEN 'ACCESS' ELSE 'PROFILE' END AS category
        FROM b2b_audit_events a WHERE "branchId" = ${branch}::uuid AND (
          "beforeSnapshot"->>'organizationId' = ${org} OR "afterSnapshot"->>'organizationId' = ${org}
          OR "afterSnapshot"#>>'{record,organizationId}' = ${org}
          OR ("entityType" = 'AgencyOperationalProfile' AND "entityId"::text IN (SELECT id FROM profiles))
          OR "beforeSnapshot"->>'profileId' IN (SELECT id FROM profiles) OR "afterSnapshot"->>'profileId' IN (SELECT id FROM profiles)
          OR "beforeSnapshot"->>'agreementId' IN (SELECT id FROM agreements) OR "afterSnapshot"->>'agreementId' IN (SELECT id FROM agreements)
        )
      ) SELECT * FROM e WHERE category IN (${Prisma.join(categories)}) AND ${activityPredicate(window, 'B2B')}
      ORDER BY "occurredAt" DESC, id DESC LIMIT 51`);
    return rows.map((row) => {
      const event = activityEvent(row, 'B2B');
      if (!actor.permissions.includes('b2b.credit.read'))
        event.changedFields = event.changedFields.filter(
          (f) => !['تضمین‌ها', 'سقف‌های اعتبار'].includes(f),
        );
      return event;
    });
  }
}
