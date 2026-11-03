import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor, TelephonyEventV1 } from '@nora/contracts';
import { describe, it, expect, vi } from 'vitest';
import { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';
import { IamWorkbenchRequestDirectory } from '../../iam/iam-workbench-request-directory';
import { HrWorkbenchRequestUnits } from '../../hr/hr-workbench-request-units';
import { HrCallAnswerDirectory } from '../../hr/hr-call-answer-directory';
import { hrCallPermissions, HR_OFFER_VERSION } from '../../iam/hr-call-routing';
import { CallCenterCrypto } from '../../customer-affairs/call-center.crypto';
import { CallCenterAccessService } from '../../customer-affairs/call-center-access.service';
import { CallCenterService } from '../../customer-affairs/call-center.service';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { TelephonyIntegrationService } from '../telephony.service';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'HR-driven routing lifecycle (isolated PostgreSQL)',
  () => {
    it('routes all shared accounts and aliases, follows edits/unlink/delete, and preserves old answer evidence', async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw Error('Disposable nora_ci only');
      vi.stubEnv('CALL_CENTER_HR_ROUTING_ENABLED', 'true');
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
      const db = createDatabaseClient(url.toString()),
        database = { client: db } as never;
      try {
        const branch = randomUUID(),
          foreign = randomUUID(),
          a = randomUUID(),
          b = randomUUID(),
          outsider = randomUUID(),
          connectionId = randomUUID();
        for (const id of [branch, foreign])
          await db.branch.create({
            data: { id, code: id, name: 'Synthetic HR branch' },
          });
        for (const id of [a, b, outsider])
          await db.user.create({
            data: {
              id,
              username: id,
              displayName: 'Synthetic linked staff',
              passwordHash: 'not-login',
              status: 'ACTIVE',
              branches: {
                create: { branchId: id === outsider ? foreign : branch },
              },
            },
          });
        const employees = [];
        for (const id of [a, b, outsider]) {
          const employee = await db.hrEmployee.create({
            data: {
              branchId: branch,
              userId: id,
              personnelCode: randomUUID(),
              name: 'Synthetic staff',
              kind: 'staff',
              unit: 'test',
              position: 'test',
              grade: 'test',
              startedAt: new Date(),
              status: 'فعال',
            },
          });
          const record = await db.hrRecord.create({
            data: {
              code: randomUUID(),
              branchId: branch,
              employeeId: employee.id,
              section: 'employee',
              tab: 'internalContact',
              values: id === a ? ['301', '۳۰۲'] : ['301'],
              status: 'فعال',
            },
          });
          employees.push({ employee, record });
        }
        const directory = new IamCallCenterDirectory(database),
          teams = new IamWorkbenchRequestDirectory(
            database,
            new HrWorkbenchRequestUnits(database),
            directory,
          );
        const crypto = new CallCenterCrypto(
          new ConfigService({
            CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
            CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(
              32,
              7,
            ).toString('base64'),
            CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(
              32,
              9,
            ).toString('base64'),
          }),
        );
        const access = new CallCenterAccessService(database, teams, directory),
          calls = new CallCenterService(database, crypto, access),
          domain = new CallCenterTelephonyService(
            database,
            crypto,
            calls,
            directory,
            new HrCallAnswerDirectory(database),
          );
        await db.integrationTelephonyConnection.create({
          data: {
            id: connectionId,
            branchId: branch,
            createdByUserId: a,
            name: 'Synthetic HR adapter',
            active: true,
            synthetic: false,
          },
        });
        const config = new ConfigService({
          ISSABEL_ENABLED: 'true',
          ISSABEL_CONNECTION_ID: connectionId,
          ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
          ISSABEL_USER_NOTIFICATIONS_ENABLED: 'true',
          ISSABEL_OUTBOUND_NOTIFICATIONS_ENABLED: 'true',
          TELEPHONY_EVENTS_PER_MINUTE: '6000',
        });
        const events = new TelephonyIntegrationService(
          database,
          config,
          domain,
          {} as never,
          directory,
          teams,
        );
        const actor = async (id: string): Promise<AuthenticatedActor> => ({
          userId: id,
          sessionId: randomUUID(),
          branchIds: [branch],
          permissions: await hrCallPermissions(database, id, [branch], []),
        });
        const routes = await directory.employeeCallRoutes(branch);
        expect(
          routes.find((r) => r.extension === '301')?.userIds.sort(),
        ).toEqual([a, b].sort());
        expect(routes.find((r) => r.extension === '302')?.userIds).toEqual([a]);
        expect((await actor(a)).permissions).toContain(
          'customer_affairs.call_center.contacts.read.own',
        );
        expect((await actor(a)).permissions).not.toContain(
          'customer_affairs.call_center.contacts.read.team',
        );
        expect(
          await hrCallPermissions(database, outsider, [foreign], []),
        ).toEqual([]);
        let counter = 0;
        const receive = async (
          extension: string,
          kind: TelephonyEventV1['kind'] = 'RINGING',
          root = randomUUID(),
          direction: 'IN' | 'OUT' = 'IN',
        ) => {
          const event: TelephonyEventV1 = {
            schemaVersion: 1,
            connectionId,
            externalEventId: randomUUID(),
            externalCallId: root,
            rootCallId: root,
            legId: extension,
            kind,
            direction,
            caller: {
              kind: 'KNOWN',
              value: direction === 'IN' ? '+12025550123' : extension,
            },
            destination: {
              kind: 'KNOWN',
              value: direction === 'OUT' ? '+12025550123' : extension,
            },
            extension,
            companyLine: null,
            queue: null,
            occurredAt: new Date(Date.now() + counter++).toISOString(),
            sequence: null,
            terminalForCall: kind === 'ENDED',
            endReason: kind === 'ENDED' ? 'COMPLETED' : null,
            recordingReference: null,
          };
          const receipt = await events.receive(event, 'ISSABEL');
          await events.process(receipt.id);
          return root;
        };
        const root = await receive('301');
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { mappingVersion: HR_OFFER_VERSION, active: true },
          }),
        ).toBe(2);
        expect(
          await db.integrationTelephonyMapping.count({
            where: { connectionId },
          }),
        ).toBe(0);
        expect((await domain.snapshot(await actor(a))).incoming).toHaveLength(
          1,
        );
        expect((await domain.snapshot(await actor(b))).incoming).toHaveLength(
          1,
        );
        await receive('301', 'ANSWERED', root);
        expect(
          await db.callCenterAnswerResponsibility.count({
            where: { call: { contact: { branchId: branch } } },
          }),
        ).toBe(2);
        await db.hrRecord.update({
          where: { id: employees[0]!.record.id },
          data: { values: ['303'] },
        });
        await domain.snapshot(await actor(a));
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { userId: a, active: true },
          }),
        ).toBe(0);
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { userId: b, active: true },
          }),
        ).toBe(1);
        await receive('303', 'RINGING', undefined, 'OUT');
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { userId: a, active: true },
          }),
        ).toBe(1);
        const staleActor = await actor(a);
        const replacement = randomUUID();
        await db.user.create({
          data: {
            id: replacement,
            username: replacement,
            displayName: 'Synthetic replacement',
            passwordHash: 'not-login',
            status: 'ACTIVE',
            branches: { create: { branchId: branch } },
          },
        });
        await db.hrEmployee.update({
          where: { id: employees[0]!.employee.id },
          data: {
            userId: replacement,
            name: 'Synthetic renamed staff',
            position: 'Synthetic new title',
          },
        });
        expect((await actor(a)).permissions).toEqual([]);
        expect(
          (await directory.employeeCallRoutes(branch)).find(
            (r) => r.extension === '303',
          )?.userIds,
        ).toEqual([replacement]);
        await domain.snapshot(staleActor);
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { userId: a, active: true },
          }),
        ).toBe(0);
        await receive('303');
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { userId: replacement, active: true },
          }),
        ).toBe(1);
        await db.user.update({
          where: { id: replacement },
          data: { status: 'INACTIVE' },
        });
        expect(
          (await directory.employeeCallRoutes(branch)).some(
            (r) => r.extension === '303',
          ),
        ).toBe(false);
        await db.user.update({
          where: { id: replacement },
          data: { status: 'ACTIVE', username: 'renamed-' + replacement },
        });
        expect(
          (await directory.employeeCallRoutes(branch)).find(
            (r) => r.extension === '303',
          )?.userIds,
        ).toEqual([replacement]);
        await db.hrEmployee.update({
          where: { id: employees[0]!.employee.id },
          data: { userId: null },
        });
        expect(
          (await directory.employeeCallRoutes(branch)).some(
            (r) => r.extension === '303',
          ),
        ).toBe(false);
        expect((await actor(a)).permissions).toEqual([]);
        await db.hrEmployee.update({
          where: { id: employees[1]!.employee.id },
          data: { deletedAt: new Date() },
        });
        expect(await directory.employeeCallRoutes(branch)).toEqual([]);
        expect(
          await db.callCenterAnswerResponsibility.count({
            where: { call: { contact: { branchId: branch } } },
          }),
        ).toBe(2);
        expect(
          await db.userRole.count({ where: { userId: { in: [a, b] } } }),
        ).toBe(0);
      } finally {
        await db.$disconnect();
        vi.unstubAllEnvs();
      }
    });
  },
);
