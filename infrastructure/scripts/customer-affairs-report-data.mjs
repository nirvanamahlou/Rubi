// Explicit local-only synthetic dataset. Never contacts customers or overwrites rows.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const requireDatabase = createRequire(
  new URL('../../packages/database/package.json', import.meta.url),
);
const { createDatabaseClient } = requireDatabase('./dist/index.js');
const [mode = 'preview', anchorId] = process.argv.slice(2);
if (
  !['preview', 'apply'].includes(mode) ||
  !/^[a-f0-9-]{36}$/.test(anchorId ?? '')
)
  throw new Error('Use preview|apply and an existing CA ticket UUID.');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432')
  throw new Error('Local Rubi database only.');
url.pathname = '/rubi_hr_current_20260908';
const db = createDatabaseClient(url.toString());
const dataset = 'ca-report-synthetic-20260913-v1';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const uuid = (key) => {
  const h = hash(`${dataset}:${key}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const hour = 3600000;
const rollback = new Error('PREVIEW_ROLLBACK');
const result = {
  mode,
  dataset,
  requests: 0,
  tickets: 0,
  surveys: 0,
  correctiveActions: 0,
};
try {
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(20260913, 1301)::text`;
      const anchor = await tx.customerAffairsTicket.findUniqueOrThrow({
        where: { id: anchorId },
      });
      const branchId = anchor.branchId,
        userId = anchor.createdByUserId;
      const audit = (entityType, entityId) =>
        tx.customerAffairsAuditEvent.create({
          data: {
            branchId,
            actorUserId: null,
            entityType,
            entityId,
            action: 'SYNTHETIC_DATASET_CREATED',
            reason:
              'User-requested local generated report data; not real customer activity.',
            traceId: dataset,
            version: 1,
            afterSnapshot: { synthetic: true, dataset },
          },
        });
      const places = [
        'شیراز',
        'کیش',
        'استانبول',
        'مشهد',
        'قشم',
        'دبی',
        'اصفهان',
        'تبریز',
      ];
      const stages = [
        'NEW',
        'CONTACTED',
        'QUALIFYING',
        'NURTURE',
        'QUALIFIED',
        'HANDOFF_PROPOSED',
        'LOST',
      ];
      for (let i = 0; i < 24; i++) {
        const id = uuid(`request:${i}`);
        if (
          await tx.customerAffairsLead.findUnique({
            where: { id },
            select: { id: true },
          })
        )
          continue;
        const createdAt = new Date(Date.UTC(2026, 7, 5 + i, 9));
        const stage = stages[i % stages.length];
        const title = `برنامه سفر ${places[i % 8]} برای ${2 + (i % 5)} نفر`;
        await tx.customerAffairsLead.create({
          data: {
            id,
            trackingNumber: `CA-R-260913-${String(i + 1).padStart(3, '0')}`,
            branchId,
            title,
            sourceReference: `تماس مستقیم · R${String(i + 1).padStart(3, '0')}`,
            inboundChannel: ['PHONE', 'WEBSITE', 'REFERRAL'][i % 3],
            contactOccurredAt: createdAt,
            travelNeed:
              'بررسی پرواز رفت‌وبرگشت، اقامت و ترانسفر با زمان‌بندی منعطف',
            originReference: 'تهران',
            destinationReference: places[i % 8],
            passengerCount: 2 + (i % 5),
            passengerComposition: {
              adults: 2 + (i % 5),
              children: 0,
              infants: 0,
            },
            requestedServices: ['FLIGHT', 'HOTEL'],
            budgetUnknownReason: 'بودجه پس از بررسی گزینه‌ها مشخص می‌شود',
            priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'][i % 4],
            queueCode: 'CUSTOMER_AFFAIRS',
            nextAction: 'بررسی گزینه‌های سفر و تکمیل درخواست',
            nextActionAt: new Date(Date.UTC(2026, 8, 12 + (i % 7), 10)),
            stage,
            qualification: {
              score:
                stage === 'QUALIFIED' || stage === 'HANDOFF_PROPOSED'
                  ? 100
                  : 40,
              conversionProbability: 20 + (i % 7) * 10,
            },
            ...(stage === 'LOST'
              ? {
                  lostReason: 'BUDGET',
                  lostNote: 'بودجه پیشنهادی با گزینه‌های موجود هماهنگ نبود',
                }
              : {}),
            createdByUserId: userId,
            updatedByUserId: userId,
            createdAt,
            updatedAt: createdAt,
          },
        });
        await tx.customerAffairsTimeline.create({
          data: {
            leadId: id,
            type: 'NOTE',
            summary: 'نیاز سفر و زمان پیگیری بعدی ثبت شد.',
            outcome: dataset,
            actorUserId: userId,
            documentVersionIds: [],
            occurredAt: createdAt,
          },
        });
        if (stage === 'HANDOFF_PROPOSED')
          await tx.customerAffairsHandoff.create({
            data: {
              leadId: id,
              packageVersion: 1,
              idempotencyKey: `${dataset}:${i}`,
              requestFingerprint: hash(id),
              payloadSnapshot: { title, synthetic: true, dataset },
              createdByUserId: userId,
              dispatchedAt: createdAt,
              createdAt,
              updatedAt: createdAt,
            },
          });
        await audit('LEAD', id);
        result.requests++;
      }
      const subjects = [
        'پیگیری صدور واچر هتل',
        'اصلاح تاریخ پرواز برگشت',
        'ارسال مجدد مدارک سفر',
        'بررسی تأخیر در پاسخ‌گویی',
        'پیگیری استرداد رزرو',
        'هماهنگی ترانسفر فرودگاه',
      ];
      const categories = [
        'ISSUANCE',
        'CHANGE',
        'DOCUMENT_RESEND',
        'COMPLAINT',
        'REFUND',
        'QUESTION',
      ];
      const statuses = [
        'NEW',
        'TRIAGED',
        'IN_PROGRESS',
        'WAITING_CUSTOMER',
        'WAITING_EXTERNAL',
        'REOPENED',
        'CANCELLED',
      ];
      for (let i = 0; i < 36; i++) {
        const id = uuid(`ticket:${i}`);
        if (
          await tx.customerAffairsTicket.findUnique({
            where: { id },
            select: { id: true },
          })
        )
          continue;
        const createdAt = new Date(Date.UTC(2026, 7, 1 + i, 10));
        const status =
          i < 12 ? 'CLOSED' : i < 20 ? 'RESOLVED' : statuses[(i - 20) % 7];
        const complete = i < 20;
        const resolvedAt = complete ? new Date(+createdAt + 12 * hour) : null;
        await tx.customerAffairsTicket.create({
          data: {
            id,
            trackingNumber: `CA-T-260913-${String(i + 1).padStart(3, '0')}`,
            branchId,
            subject: `${subjects[i % 6]} · ${places[i % 8]}`,
            description:
              'درخواست بررسی جزئیات خدمت و اعلام نتیجه نهایی در پرونده ثبت شده است.',
            channel: ['PHONE', 'EMAIL', 'WEBSITE'][i % 3],
            contactOccurredAt: createdAt,
            category: categories[i % 6],
            serviceType: i % 2 ? 'FLIGHT' : 'HOTEL',
            impact: 'NORMAL',
            urgency: 'NORMAL',
            priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'][i % 5],
            status,
            customerOwnerUserId: userId,
            references: [],
            slaPolicyVersion: anchor.slaPolicyVersion,
            firstResponseDueAt: new Date(+createdAt + 4 * hour),
            resolutionDueAt: new Date(+createdAt + 48 * hour),
            firstRespondedAt:
              status === 'NEW' ? null : new Date(+createdAt + hour),
            resolvedAt,
            pausedAt:
              status === 'WAITING_CUSTOMER'
                ? new Date(+createdAt + 2 * hour)
                : null,
            nextAction: complete
              ? 'بررسی نتیجه رضایت و کیفیت رسیدگی'
              : 'بررسی درخواست و اعلام نتیجه',
            nextActionAt: new Date(Date.UTC(2026, 8, 12 + (i % 8), 11)),
            resolutionOutcome: complete
              ? 'درخواست بررسی و نتیجه ثبت شد.'
              : null,
            closedAt:
              status === 'CLOSED' ? new Date(+createdAt + 24 * hour) : null,
            closeReason: status === 'CLOSED' ? 'رسیدگی پایان یافت.' : null,
            reopenCount: status === 'REOPENED' ? 1 : 0,
            createdByUserId: userId,
            updatedByUserId: userId,
            createdAt,
            updatedAt: createdAt,
          },
        });
        await tx.customerAffairsTimeline.create({
          data: {
            ticketId: id,
            type: 'NOTE',
            summary: complete
              ? 'رسیدگی انجام و نتیجه نهایی ثبت شد.'
              : 'درخواست دریافت و برای رسیدگی ثبت شد.',
            outcome: dataset,
            actorUserId: userId,
            documentVersionIds: [],
            occurredAt: createdAt,
          },
        });
        if (complete) {
          const score = [5, 4, 3, 2, 1][i % 5];
          const satisfaction = await tx.customerAffairsSatisfaction.create({
            data: {
              ticketId: id,
              invitationReference: hash(`${dataset}:survey:${i}`),
              score,
              comment:
                score > 3
                  ? 'پیگیری منظم و پاسخ روشن بود.'
                  : 'زمان پاسخ‌گویی و اطلاع‌رسانی نیاز به بهبود دارد.',
              submittedByCustomer: true,
              submittedAt: new Date(+createdAt + 30 * hour),
              expiresAt: new Date(+createdAt + 168 * hour),
              createdAt: new Date(+createdAt + 24 * hour),
            },
          });
          result.surveys++;
          if (score <= 2) {
            const actionStatus = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'][
              Math.floor(i / 5) % 4
            ];
            await tx.customerAffairsCorrectiveAction.create({
              data: {
                ticketId: id,
                satisfactionId: satisfaction.id,
                title: 'بهبود زمان پاسخ و اطلاع‌رسانی به مشتری',
                ownerUserId: userId,
                dueAt: new Date(+createdAt + 168 * hour),
                status: actionStatus,
                ...(actionStatus === 'DONE'
                  ? {
                      result: 'برنامه پاسخ‌گویی بازبینی شد.',
                      effectivenessReview:
                        'زمان اطلاع‌رسانی در پیگیری بعدی کاهش یافت.',
                    }
                  : {}),
                createdAt: new Date(+createdAt + 31 * hour),
                updatedAt: new Date(+createdAt + 32 * hour),
              },
            });
            result.correctiveActions++;
          }
        }
        await audit('TICKET', id);
        result.tickets++;
      }
      if (mode === 'preview') throw rollback;
    },
    { timeout: 120000 },
  );
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await db.$disconnect();
}
console.log(JSON.stringify(result));
