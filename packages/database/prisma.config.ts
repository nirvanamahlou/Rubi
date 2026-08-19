import { resolve } from 'node:path';

import { config as loadEnvironment } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadEnvironment({
  path: resolve(process.cwd(), '../../.env'),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
