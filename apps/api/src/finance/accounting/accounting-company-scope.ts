import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AccountingLedgerCompanyV1,
  AuthenticatedActor,
} from '@nora/contracts';
import { LegalEntitiesService } from '../../legal-entities/legal-entities.service';

/** Accounting shares the academy's ledger with its parent without changing issuer context. */
@Injectable()
export class AccountingCompanyScope {
  constructor(
    @Inject(LegalEntitiesService)
    private readonly entities: LegalEntitiesService,
  ) {}

  /** Reused by report and diagnostic endpoints as well as financial commands. */
  async assertBook(
    book: { legalEntityId?: string | null },
    actor: AuthenticatedActor,
    allowUnassigned = false,
  ) {
    const scope = await this.current(actor);
    if (
      !scope.isAggregate &&
      book.legalEntityId !== scope.company?.id &&
      !(allowUnassigned && !book.legalEntityId)
    )
      throw new NotFoundException('دفتر حسابداری در شرکت فعال در دسترس نیست.');
    return scope;
  }

  async current(actor: AuthenticatedActor, requireSingle = false) {
    const [{ data: context }, { data: entities }] = await Promise.all([
      this.entities.current(actor),
      this.entities.selectable(actor),
    ]);
    const companies: AccountingLedgerCompanyV1[] = entities
      .filter((entity) => entity.code !== 'JAHAN_ACADEMIA')
      .map((entity) => ({
        id: entity.id,
        code: entity.code,
        title: entity.persianName,
      }));
    if (context.isAggregate) {
      if (!actor.permissions.includes('legal-entity.aggregate.read'))
        throw new ForbiddenException();
      if (requireSingle)
        throw new BadRequestException(
          'برای ثبت دفتر کل، یک شرکت را از بالای صفحه انتخاب کنید.',
        );
      return { company: null, companies, isAggregate: true };
    }
    const code =
      context.selection === 'JAHAN_ACADEMIA'
        ? 'JAHAN_BASTAN'
        : context.selection;
    const company = companies.find((entity) => entity.code === code);
    if (!company)
      throw new BadRequestException('شرکت فعال برای دفتر کل در دسترس نیست.');
    return { company, companies, isAggregate: false };
  }
}
