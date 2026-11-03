import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  internalLetterContent,
  correspondenceRecipients,
  correspondenceUuid,
  InternalCorrespondenceController,
} from './internal-correspondence';
import { ACCESS_CONTROLS_KEY } from '../iam/iam.constants';

const letter = {
  company: 'نیایش سیر',
  recipient: 'گیرنده آزمون',
  sender: 'فرستنده آزمون',
  subject: 'درخواست',
  date: '۱۴۰۵/۰۷/۲۶',
  number: 'NS/1405/07/26/000001',
  signer: '',
  text: 'متن نامه',
  template: 'با سلام خدمت {{مخاطب}}\n{{متن}}',
};
describe('internal letter validation', () => {
  it('keeps explicit content and strips untrusted extra properties', () => {
    expect(internalLetterContent({ ...letter, authorId: 'forged' })).toEqual({
      ...letter,
      recipientTitle: '',
      attachment: '',
    });
  });
  it('rejects empty content, oversized bodies, invalid brands and unknown template variables', () => {
    for (const input of [
      null,
      [],
      { ...letter, subject: '' },
      { ...letter, text: 'x'.repeat(20001) },
      { ...letter, company: 'constructor' },
      { ...letter, template: '{{متن}} {{ناشناخته}}' },
    ])
      expect(() => internalLetterContent(input)).toThrow();
  });
  it('requires a real UUID rather than an arbitrary path or supplied actor', () => {
    expect(
      correspondenceUuid('a148ec40-a32e-4c98-8d1b-8cbbf4df5e4d'),
    ).toBeTruthy();
    for (const id of [
      'other',
      '../users',
      null,
      '00000000-0000-0000-0000-000000000000',
    ])
      expect(() => correspondenceUuid(id)).toThrow();
  });
  it('protects all internal routes with the existing correspondence access control', () => {
    expect(
      Reflect.getMetadata(
        ACCESS_CONTROLS_KEY,
        InternalCorrespondenceController,
      ),
    ).toEqual(['correspondence.home']);
  });
});

it('validates and normalizes bounded recipient sets and accepts legacy single recipients', () => {
  const a = 'a148ec40-a32e-4c98-8d1b-8cbbf4df5e4d';
  const b = 'b148ec40-a32e-4c98-8d1b-8cbbf4df5e4d';
  expect(
    correspondenceRecipients({ recipientIds: [b.toUpperCase(), b, a, a] }),
  ).toEqual([a, b]);
  expect(correspondenceRecipients({ recipientId: a })).toEqual([a]);
  for (const recipientIds of [[], [a, 'bad'], Array(101).fill(a), 'bad'])
    expect(() => correspondenceRecipients({ recipientIds })).toThrow();
});
