import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const marketingRoot = join(process.cwd(), 'src', 'marketing');
const ownedFiles = [
  'marketing.application.ts',
  'marketing.adapters.ts',
  'marketing.decimal.ts',
  'marketing.domain.ts',
  'marketing.errors.ts',
  'marketing.permissions.ts',
  'marketing.validation.ts',
];

describe('marketing Phase A architecture boundary', () => {
  it('does not import repositories, Prisma or module internals owned elsewhere', () => {
    const source = ownedFiles
      .map((file) => readFileSync(join(marketingRoot, file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/@rubi\/database|PrismaClient|\.repository/);
    expect(source).not.toMatch(
      /src\/(customers|customer-affairs|sales|finance|master-data|documents|integrations)/,
    );
    expect(source).not.toMatch(/@\/modules\/(customers|finance|documents)/);
  });

  it('contains no active controller, Nest module or fake repository', () => {
    const source = ownedFiles
      .map((file) => readFileSync(join(marketingRoot, file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /@Controller|@Module|class\s+MarketingRepository/,
    );
    expect(source).toContain('CustomerAudienceReadPort');
    expect(source).toContain('SalesOfferIntentPort');
    expect(source).toContain('FinanceMarketingCostPort');
  });
});
