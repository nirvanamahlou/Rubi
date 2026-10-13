import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WorkerHealthService } from './worker-health.service';

@Injectable()
export class WorkerHealthServer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WorkerHealthServer.name);
  private server: Server | undefined;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(WorkerHealthService) private readonly health: WorkerHealthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const port = this.config.getOrThrow<number>('WORKER_HEALTH_PORT');
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server)
        return reject(new Error('Worker health server is unavailable.'));
      const onError = (error: Error) => reject(error);
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
        resolve();
      });
    });
    this.logger.log(
      `Worker health endpoint is listening on 127.0.0.1:${port}.`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://worker.local');
    if (request.method !== 'GET' || url.pathname !== '/health') {
      response.statusCode = 404;
      response.end();
      return;
    }
    try {
      const payload = await this.health.probe();
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(payload));
    } catch {
      response.writeHead(503, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(
        JSON.stringify({
          message: 'سلامت Worker در این لحظه قابل بررسی نیست.',
        }),
      );
    }
  }
}
