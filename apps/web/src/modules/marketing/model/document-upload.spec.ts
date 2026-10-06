import { describe, expect, it } from 'vitest';
import {
  appendMarketingConfidentialCode,
  marketingDocumentCodeError,
} from './document-upload';

describe('Marketing document owner policy handoff', () => {
  it('requires and submits a six-digit code for a protected type without overriding classification', () => {
    expect(marketingDocumentCodeError('CONFIDENTIAL', '')).not.toBe('');
    expect(marketingDocumentCodeError('CONFIDENTIAL', '123456')).toBe('');
    const form = new FormData();
    appendMarketingConfidentialCode(form, '123456');
    expect(form.get('confidentialAccessCode')).toBe('123456');
    expect(form.has('confidentiality')).toBe(false);
  });
});
