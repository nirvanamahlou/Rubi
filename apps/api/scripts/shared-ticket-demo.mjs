import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { assertLocalTarget, runTicketDemo } from './ticket-demo-core.mjs';

const args = process.argv.slice(2);
const allowed = new Set(['--config', '--apply', '--clear', '--adopt-source']);
const configIndex = args.indexOf('--config');
if (
  configIndex < 0 ||
  !args[configIndex + 1] ||
  args.some((arg, index) => index !== configIndex + 1 && !allowed.has(arg))
)
  throw new Error(
    'Usage: node --env-file=.env apps/api/scripts/shared-ticket-demo.mjs --config private-config.json [--apply] [--clear] [--adopt-source]',
  );
if (!process.env.DATABASE_URL)
  loadEnvFile(
    process.env.NORA_API_ENV_FILE ?? new URL('../.env', import.meta.url),
  );
assertLocalTarget(process.env.DATABASE_URL ?? '', process.env.NODE_ENV ?? '');
const config = JSON.parse(await readFile(args[configIndex + 1], 'utf8'));
const fixture = JSON.parse(
  (
    await readFile(
      new URL(
        '../src/ticket-catalog/demo/pc-a-tickets-20260929.json',
        import.meta.url,
      ),
      'utf8',
    )
  ).replace(/^\uFEFF/, ''),
);
const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { DatabaseService } = require('../dist/database/database.service.js');
const {
  MasterTravelDirectory,
} = require('../dist/master-data/master-travel-directory.js');
const { IamService } = require('../dist/iam/iam.service.js');
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  await app.get(IamService).personalProfile(config.actorUserId);
  for (const city of fixture.cities) {
    const reference = await app
      .get(MasterTravelDirectory)
      .cityReference(config.cities?.[city.key]);
    if (
      reference.name !== city.name &&
      reference.englishName.toLowerCase() !== city.englishName.toLowerCase()
    )
      throw new Error(`City mapping does not match ${city.englishName}.`);
  }
  console.log(
    JSON.stringify(
      await runTicketDemo(app.get(DatabaseService).client, fixture, config, {
        apply: args.includes('--apply'),
        clear: args.includes('--clear'),
        adoptSource: args.includes('--adopt-source'),
      }),
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
