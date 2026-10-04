import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { HrService } from './hr.service';
import * as validate from './hr.validation';

/** HR owns approval and private payroll data. Finance receives only this projection. */
@Injectable()
export class HrPayrollFinancePublicService {
  constructor(
    @Inject(HrService) private readonly hr: HrService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async submit(
    body: unknown,
    key: string | undefined,
    actor: AuthenticatedActor,
  ) {
    if (
      !(['hr.manage', 'hr.approve', 'hr.sensitive'] as const).every((p) =>
        actor.permissions.includes(p),
      )
    )
      throw new ForbiddenException(
        'مجوز ثبت و تأیید حقوق منابع انسانی لازم است.',
      );
    const input = validate.object(body, [
      'employeeId',
      'period',
      'amount',
      'currencyCode',
      'dueAt',
    ]);
    const employeeId = validate.uuid(input.employeeId);
    const period = validate.text(input.period, 'دوره حقوق', 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
      throw new BadRequestException('دوره باید سال و ماه میلادی معتبر باشد.');
    const amount = validate.text(input.amount, 'مبلغ حقوق', 30);
    if (!/^\d{1,20}(\.\d{1,4})?$/.test(amount) || !/[1-9]/.test(amount))
      throw new BadRequestException('مبلغ حقوق باید مثبت باشد.');
    const currencyCode = validate.text(input.currencyCode, 'ارز', 3);
    if (!/^[A-Z]{3}$/.test(currencyCode))
      throw new BadRequestException('ارز معتبر نیست.');
    const dueAt = validate.text(input.dueAt, 'تاریخ پرداخت', 10);
    validate.isoDate(dueAt, 'تاریخ پرداخت');
    const employee = await this.database.client.hrEmployee.findFirst({
      where: {
        id: employeeId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
      },
      select: { name: true },
    });
    if (!employee) throw new NotFoundException('کارمند مجاز یافت نشد.');
    const record = await this.hr.createRecord(
      {
        section: 'payroll',
        tab: 'paymentRequests',
        employeeId,
        values: [employeeId, period, amount, dueAt],
        status: 'تأییدشده',
        data: { currency: currencyCode },
      },
      key,
      actor,
    );
    return this.approvedSource(record.id, actor.branchIds);
  }

  async approvedSource(id: string, branchIds: readonly string[]) {
    const row = await this.database.client.hrRecord.findFirst({
      where: {
        id,
        branchId: { in: [...branchIds] },
        section: 'payroll',
        tab: 'paymentRequests',
        deletedAt: null,
      },
      include: {
        employee: { select: { id: true, name: true } },
        amounts: { where: { field: 'field2' } },
      },
    });
    if (!row) throw new NotFoundException('درخواست حقوق تأییدشده یافت نشد.');
    const amount = row.amounts[0];
    const values = row.values as string[];
    if (
      !['تأییدشده', 'تاییدشده'].includes(row.status) ||
      !row.employee ||
      !amount ||
      !amount.amount.isPositive()
    )
      throw new ConflictException('حقوق معتبر و تأییدشده لازم است.');
    return {
      id: row.id,
      version: row.version,
      branchId: row.branchId,
      employeeId: row.employee.id,
      employeeName: values[0]!,
      period: values[1]!,
      amount: amount.amount.toString(),
      currencyCode: amount.currency,
      dueAt: new Date(`${values[3]}T20:29:59.999Z`).toISOString(),
    };
  }
}
