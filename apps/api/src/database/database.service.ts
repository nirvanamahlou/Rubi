import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: DatabaseClient = createDatabaseClient();

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
