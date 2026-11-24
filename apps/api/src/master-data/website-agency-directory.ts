import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import {
  externalOrderId,
  siteBinding,
  stableFingerprint,
} from '../site-commerce/site-commerce.policy';
import { MasterDataRepository } from './master-data.repository';
import { normalizeOrganizationNationalId } from './organization-identity.policy';

const invalid = () =>
  new BadRequestException('درخواست قرارداد سایت معتبر نیست.');
const conflict = () =>
  new ConflictException(
    'اطلاعات تغییر کرده است. صفحه را دوباره بارگذاری کنید.',
  );
const sites = ['jahan-bastan', 'nss', 'ghestiroo'] as const;

function cleanName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[يك]/g, (c) => (c === 'ي' ? 'ی' : 'ک'))
    .replace(/\u200c|\u200d|\u200e|\u200f/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function nameKey(value: string) {
  return cleanName(value).replace(/\s/g, '').toLowerCase();
}
export function websiteAgencyInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  const body = raw as Record<string, unknown>;
  const limit = {
    legalName: 160,
    nationalId: 24,
    registrationNumber: 80,
    economicCode: 80,
    licenseNumber: 80,
    username: 254,
    email: 254,
    phone: 32,
    city: 100,
    province: 100,
    address: 1000,
    postalCode: 20,
    managerName: 160,
  } as const;
  if (
    Object.keys(body).some(
      (key) => key !== 'approved' && !Object.hasOwn(limit, key),
    )
  )
    throw invalid();
  function optional(key: keyof typeof limit) {
    const value = body[key];
    if (value === undefined || value === null || value === '') return null;
    if (
      typeof value !== 'string' ||
      value.length > limit[key] ||
      /\p{Cc}/u.test(value)
    )
      throw invalid();
    return (key === 'legalName' ? cleanName(value) : value.trim()) || null;
  }
  function identifier(
    key: 'registrationNumber' | 'economicCode' | 'licenseNumber',
  ) {
    return (
      optional(key)
        ?.replace(/[۰-۹٠-٩]/g, (digit) =>
          String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)),
        )
        .replace(/\s/g, '')
        .toUpperCase() ?? null
    );
  }
  const legalName = optional('legalName');
  const nationalId = normalizeOrganizationNationalId(optional('nationalId'));
  const registrationNumber = identifier('registrationNumber');
  const economicCode = identifier('economicCode');
  const tourismLicenseNumber = identifier('licenseNumber');
  const email = optional('email')?.toLowerCase() ?? null;
  const username = optional('username');
  const approved = body.approved;
  if (
    !legalName ||
    legalName.length < 2 ||
    (!nationalId && !economicCode) ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    typeof approved !== 'boolean' ||
    (approved && !username)
  )
    throw invalid();
  return {
    legalName,
    nationalId,
    registrationNumber,
    economicCode,
    tourismLicenseNumber,
    email,
    username,
    approved,
    profile: {
      phone: optional('phone'),
      city: optional('city'),
      province: optional('province'),
      address: optional('address'),
      postalCode: optional('postalCode'),
      managerName: optional('managerName'),
    },
  };
}
type Signup = ReturnType<typeof websiteAgencyInput>;
type Agency = Pick<
  Signup,
  | 'legalName'
  | 'nationalId'
  | 'registrationNumber'
  | 'economicCode'
  | 'tourismLicenseNumber'
>;
const identifiers = [
  'nationalId',
  'registrationNumber',
  'economicCode',
  'tourismLicenseNumber',
] as const;

/** Shared national/business identifiers are authoritative only if the records also agree on the legal name. */
export function matchWebsiteAgency(
  input: Agency,
  candidates: readonly (Agency & { id: string; eligible: boolean })[],
) {
  const identity = candidates.filter((row) =>
    identifiers.some((key) => input[key] && input[key] === row[key]),
  );
  const name = candidates.filter(
    (row) => nameKey(row.legalName) === nameKey(input.legalName),
  );
  if (identity.length === 0)
    return name.length
      ? { status: 'REVIEW' as const }
      : { status: 'NEW' as const };
  const first = identity[0]!;
  if (
    identity.length !== 1 ||
    !first.eligible ||
    !(['nationalId', 'economicCode'] as const).some(
      (key) => input[key] && input[key] === first[key],
    ) ||
    nameKey(first.legalName) !== nameKey(input.legalName) ||
    identifiers.some(
      (key) => input[key] && first[key] && input[key] !== first[key],
    )
  )
    return { status: 'REVIEW' as const };
  return { status: 'MATCHED' as const, organizationId: first.id };
}

@Injectable()
export class WebsiteAgencyDirectory {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterDataRepository)
    private readonly organizations: MasterDataRepository,
  ) {}
  private async resolve(tx: Prisma.TransactionClient, input: Agency) {
    const rows = await tx.masterOrganization.findMany({
      select: {
        id: true,
        legalName: true,
        nationalId: true,
        registrationNumber: true,
        economicCode: true,
        tourismLicenseNumber: true,
        isActive: true,
        roles: { select: { roleCode: true } },
      },
    });
    return matchWebsiteAgency(
      input,
      rows.map((row) => ({
        ...row,
        eligible:
          row.isActive && row.roles.some((role) => role.roleCode === 'AGENCY'),
      })),
    );
  }
  private async create(
    tx: Prisma.TransactionClient,
    input: Agency,
    actor: string,
    branchId: string,
  ) {
    const {
      legalName,
      nationalId,
      registrationNumber,
      economicCode,
      tourismLicenseNumber,
    } = input;
    const code =
      'WA-' + stableFingerprint(nationalId ?? economicCode).slice(0, 26);
    const row = await this.organizations.create(
      'organizations',
      {
        code,
        legalName,
        displayName: legalName,
        personType: 'LEGAL',
        nationalId,
        registrationNumber,
        economicCode,
        tourismLicenseNumber,
        roles: { create: { roleCode: 'AGENCY', assignedByUserId: actor } },
      },
      actor,
      branchId,
      tx,
    );
    return String(row.id);
  }
  async register(
    site: string,
    id: string,
    raw: unknown,
    actor: AuthenticatedActor,
  ) {
    if (!sites.some((value) => value === site)) throw new ForbiddenException();
    const { branchId } = siteBinding(site, actor);
    const externalId = externalOrderId(id);
    const input = websiteAgencyInput(raw);
    const {
      legalName,
      nationalId,
      registrationNumber,
      economicCode,
      tourismLicenseNumber,
    } = input;
    const identity = {
      legalName,
      nationalId,
      registrationNumber,
      economicCode,
      tourismLicenseNumber,
    };
    const fingerprint = stableFingerprint({
      ...identity,
      legalName: nameKey(legalName),
    });
    const key = { site, externalId };
    return this.db.client
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('website-agency-onboarding', 0))::text`;
        const previous = await tx.websiteAgencyAccount.findUnique({
          where: { site_externalId: key },
        });
        if (previous && previous.branchId !== branchId) throw conflict();
        if (previous?.status === 'LINKED') {
          if (previous.fingerprint !== fingerprint) throw conflict();
          return { data: { status: previous.status } };
        }
        const match = await this.resolve(tx, identity);
        const approved = input.approved && site !== 'ghestiroo';
        const organizationId =
          match.status === 'MATCHED'
            ? match.organizationId
            : approved && match.status === 'NEW'
              ? await this.create(tx, identity, actor.userId, branchId)
              : null;
        const fields = {
          organizationId,
          branchId,
          fingerprint,
          ...identity,
          email: input.email,
          username: input.username,
          profile: input.profile,
          siteApproved:
            approved ||
            (previous?.fingerprint === fingerprint && previous.siteApproved),
          status: approved && organizationId ? 'LINKED' : 'REVIEW',
        };
        const row = await tx.websiteAgencyAccount.upsert({
          where: { site_externalId: key },
          create: { ...key, ...fields },
          update: fields,
        });
        return { data: { status: row.status } };
      })
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        )
          throw conflict();
        throw error;
      });
  }
  async list(actor: AuthenticatedActor, organizationId?: string) {
    await this.assertStaff(actor, false);
    const data = await this.db.client.websiteAgencyAccount.findMany({
      where: {
        branchId: { in: [...actor.branchIds] },
        ...(organizationId ? { organizationId } : { status: 'REVIEW' }),
      },
      select: {
        id: true,
        site: true,
        legalName: true,
        email: true,
        username: true,
        status: true,
        nationalId: true,
        registrationNumber: true,
        economicCode: true,
        tourismLicenseNumber: true,
        profile: true,
        siteApproved: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return { data };
  }
  async activeWebsiteAccount(
    site: string,
    account: string,
    actor: AuthenticatedActor,
  ) {
    const { branchId } = siteBinding(site, actor);
    const handle =
      site === 'nss' && /^[a-zA-Z0-9_.-]{3,120}$/.test(account)
        ? account
        : externalOrderId(account);
    const rows = await this.db.client.websiteAgencyAccount.findMany({
      where: {
        site,
        branchId,
        status: 'LINKED',
        organizationId: { not: null },
        ...(site === 'nss' ? { username: handle } : { externalId: handle }),
      },
      select: { organizationId: true },
      take: 2,
    });
    return rows.length === 1 && rows[0]?.organizationId
      ? { branchId, organizationId: rows[0].organizationId }
      : null;
  }
  async approve(id: string, actor: AuthenticatedActor) {
    await this.assertStaff(actor, true);
    return this.db.client
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('website-agency-onboarding', 0))::text`;
        const row = await tx.websiteAgencyAccount.findFirst({
          where: { id, branchId: { in: [...actor.branchIds] } },
        });
        if (!row) throw new NotFoundException();
        if (row.status === 'LINKED') return { data: { status: row.status } };
        if (!row.username || (row.site !== 'ghestiroo' && !row.siteApproved))
          throw conflict();
        const match = await this.resolve(tx, row);
        if (match.status === 'REVIEW') throw conflict();
        if (
          match.status === 'NEW' &&
          !actor.permissions.includes('master_data.create')
        )
          throw new ForbiddenException();
        const organizationId =
          match.status === 'MATCHED'
            ? match.organizationId
            : await this.create(tx, row, actor.userId, row.branchId);
        await tx.websiteAgencyAccount.update({
          where: { id },
          data: { organizationId, status: 'LINKED' },
        });
        return { data: { status: 'LINKED' } };
      })
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        )
          throw conflict();
        throw error;
      });
  }
  private async assertStaff(actor: AuthenticatedActor, write: boolean) {
    if (
      !actor.permissions.includes(
        write ? 'b2b.agency.manage' : 'b2b.agency.read',
      ) ||
      (await this.db.client.b2bOrganizationUser.findFirst({
        where: { userId: actor.userId },
        select: { userId: true },
      }))
    )
      throw new ForbiddenException();
  }
}
