import { BadRequestException } from '@nestjs/common';
import type {
  CreateDirectConversationInputV1,
  CreateGroupConversationInputV1,
  ForwardMessagingMessageInputV1,
  SendMessagingMessageInputV1,
} from '@rubi/contracts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{16,80}$/;

function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('بدنه درخواست معتبر نیست.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new BadRequestException('فیلد ناشناخته در درخواست وجود دارد.');
  return input;
}

export function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value;
}

function requestId(value: unknown): string {
  if (typeof value !== 'string' || !REQUEST_ID.test(value))
    throw new BadRequestException('شناسه درخواست معتبر نیست.');
  return value;
}

export function direct(value: unknown): CreateDirectConversationInputV1 {
  const input = record(value, ['recipientId', 'clientRequestId']);
  return {
    recipientId: uuid(input.recipientId, 'مخاطب'),
    clientRequestId: requestId(input.clientRequestId),
  };
}

export function group(value: unknown): CreateGroupConversationInputV1 {
  const input = record(value, ['title', 'memberIds', 'clientRequestId']);
  if (
    typeof input.title !== 'string' ||
    input.title.trim().length < 2 ||
    input.title.trim().length > 160
  )
    throw new BadRequestException('عنوان گروه باید بین ۲ تا ۱۶۰ نویسه باشد.');
  if (!Array.isArray(input.memberIds))
    throw new BadRequestException('اعضای گروه معتبر نیستند.');
  const memberIds = [
    ...new Set(input.memberIds.map((id) => uuid(id, 'عضو گروه'))),
  ];
  if (memberIds.length < 1 || memberIds.length > 50)
    throw new BadRequestException(
      'گروه باید بین ۱ تا ۵۰ عضو انتخابی داشته باشد.',
    );
  return {
    title: input.title.trim(),
    memberIds,
    clientRequestId: requestId(input.clientRequestId),
  };
}

export function message(value: unknown): SendMessagingMessageInputV1 {
  const input = record(value, ['body', 'clientRequestId']);
  if (
    typeof input.body !== 'string' ||
    !input.body.trim() ||
    input.body.trim().length > 4000
  )
    throw new BadRequestException('متن پیام باید بین ۱ تا ۴۰۰۰ نویسه باشد.');
  return {
    body: input.body.trim(),
    clientRequestId: requestId(input.clientRequestId),
  };
}

export function forward(value: unknown): ForwardMessagingMessageInputV1 {
  const input = record(value, ['sourceMessageId', 'clientRequestId']);
  return {
    sourceMessageId: uuid(input.sourceMessageId, 'پیام مبدأ'),
    clientRequestId: requestId(input.clientRequestId),
  };
}

export function limit(value: unknown): number {
  if (value === undefined) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50)
    throw new BadRequestException('تعداد نتایج باید بین ۱ تا ۵۰ باشد.');
  return parsed;
}

export function search(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.trim().length > 100)
    throw new BadRequestException('عبارت جست‌وجو معتبر نیست.');
  return value.trim();
}
