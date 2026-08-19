import { Injectable } from '@nestjs/common';
import { createHealthData, type HealthData } from '@rubi/contracts';

@Injectable()
export class HealthService {
  getHealth(now: Date = new Date()): HealthData {
    return createHealthData('api', now);
  }
}
