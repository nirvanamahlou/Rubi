import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const B2B_PHONE_DELIVERY_PORT = Symbol('B2B_PHONE_DELIVERY_PORT');

export interface B2bPhoneDeliveryPort {
  send(input: { canonicalPhone: string; code: string }): Promise<void>;
}

@Injectable()
export class DevelopmentB2bPhoneDelivery implements B2bPhoneDeliveryPort {
  async send(input: { canonicalPhone: string; code: string }) {
    void input;
    if (process.env.NODE_ENV !== 'development')
      throw new ServiceUnavailableException(
        'ارسال کد تأیید در این محیط غیرفعال است.',
      );
    // Development displays the one-time code in the direct response; never log it.
  }
}
