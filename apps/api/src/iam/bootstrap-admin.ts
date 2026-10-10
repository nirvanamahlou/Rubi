import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { IamService } from './iam.service';

async function bootstrap(): Promise<void> {
  const username = process.env.IAM_BOOTSTRAP_ADMIN_USERNAME?.trim();
  const email = process.env.IAM_BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.IAM_BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.IAM_BOOTSTRAP_ADMIN_NAME?.trim();
  if (!username || !password || !displayName) {
    throw new Error(
      'IAM_BOOTSTRAP_ADMIN_USERNAME, IAM_BOOTSTRAP_ADMIN_PASSWORD and IAM_BOOTSTRAP_ADMIN_NAME are required.',
    );
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const userId = await app
      .get(IamService)
      .bootstrapAdministrator(username, email, password, displayName);
    console.log(
      `Administrator is ready (userId=${userId}). Remove bootstrap values from the environment now.`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Administrator bootstrap failed.',
  );
  process.exitCode = 1;
});
