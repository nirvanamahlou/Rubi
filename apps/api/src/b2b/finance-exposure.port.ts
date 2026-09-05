import { Injectable } from '@nestjs/common';
import type {
  B2bFinanceExposureV1,
  FinancePartyExposurePortV1,
  FinancePartyExposureQueryV1,
} from '@rubi/contracts';

export const FINANCE_PARTY_EXPOSURE_PORT = Symbol(
  'FINANCE_PARTY_EXPOSURE_PORT_V1',
);

@Injectable()
export class UnavailableFinanceExposureAdapter implements FinancePartyExposurePortV1 {
  async getPartyExposure(
    query: FinancePartyExposureQueryV1,
  ): Promise<B2bFinanceExposureV1> {
    void query;
    return {
      status: 'UNAVAILABLE',
      reason: 'FINANCE_PORT_UNAVAILABLE',
    };
  }
}
