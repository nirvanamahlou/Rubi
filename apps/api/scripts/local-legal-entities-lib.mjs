export const localCompanies = [
  { code: 'NIYAYESH_SEIR_SAHAR', persianName: 'شرکت نیایش سیر سحر' },
  { code: 'JAHAN_BASTAN', persianName: 'شرکت جهان باستان' },
  { code: 'GHESATI_RO', persianName: 'شرکت قسطی رو' },
  { code: 'JAHAN_ACADEMIA', persianName: 'شرکت جهان آکادمیا' },
];

export function assertLocalDatabase(databaseUrl, environment) {
  const url = new URL(databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    environment === 'production'
  ) {
    throw new Error(
      'This operation is restricted to a local development database.',
    );
  }
}

export async function inspectCompanies(database) {
  const existing = await database.legalEntity.findMany({
    where: { code: { in: localCompanies.map(({ code }) => code) } },
    select: { code: true, isActive: true },
  });
  return localCompanies.map(({ code, persianName }) => ({
    code,
    name: persianName,
    status: existing.some((row) => row.code === code)
      ? existing.find((row) => row.code === code).isActive
        ? 'active'
        : 'inactive-preserved'
      : 'missing',
  }));
}

export async function createMissingCompanies(database, actorId) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      actorId ?? '',
    )
  )
    throw new Error('An existing local operator UUID is required.');
  return database.$transaction(
    async (transaction) => {
      const actor = await transaction.user.findFirst({
        where: { id: actorId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!actor)
        throw new Error('The local operator must already exist and be active.');
      let created = 0;
      for (const company of localCompanies) {
        const existing = await transaction.legalEntity.findUnique({
          where: { code: company.code },
          select: { id: true },
        });
        if (existing) continue;
        const entity = await transaction.legalEntity.create({
          data: { ...company, updatedByUserId: actorId },
        });
        const snapshot = {
          legalEntityId: entity.id,
          ...company,
          version: 1,
        };
        for (const key of [
          'latinName',
          'tradeName',
          'logoFileId',
          'letterheadFileId',
          'footerFileId',
          'address',
          'phone',
          'email',
          'website',
          'nationalId',
          'registrationNumber',
          'economicCode',
          'paymentText',
          'sealFileId',
          'authorizedSignatureId',
          'primaryColor',
          'secondaryColor',
          'legalFooterText',
        ])
          snapshot[key] = null;
        await transaction.legalEntityBrandingVersion.create({
          data: {
            legalEntityId: entity.id,
            version: 1,
            snapshot,
            createdByUserId: actorId,
          },
        });
        created += 1;
      }
      return { created, preserved: localCompanies.length - created };
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
}
