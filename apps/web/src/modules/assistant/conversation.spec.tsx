import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AssistantConversation,
  conversationResponseSchema,
} from './conversation';
describe('gated conversation UI', () => {
  it('accepts bounded plain text separately from exact ERP evidence', () => {
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'REPLY',
        text: 'Hello',
      }).success,
    ).toBe(true);
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'REPLY',
        text: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'REPLY',
        text: 'Hello',
        evidence: { amount: 500 },
      }).success,
    ).toBe(false);
  });
  it('does not mount or expose message inputs before model policy approval', () => {
    expect(
      renderToStaticMarkup(
        <AssistantConversation
          enabled={false}
          sessionKey="synthetic"
          onEvidence={() => undefined}
        />,
      ),
    ).toBe('');
  });
  it('uses localized fixed clarification codes and rejects invented answers', () => {
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'CLARIFY',
        field: 'DATE_RANGE',
      }).success,
    ).toBe(true);
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'CLARIFY',
        field: 'DATE_RANGE',
        text: '500 USD',
      }).success,
    ).toBe(false);
    expect(
      conversationResponseSchema.safeParse({
        version: 1,
        status: 'ANSWER',
        action: 'sales-analysis',
        evidence: { amount: 500 },
      }).success,
    ).toBe(false);
    const html = renderToStaticMarkup(
      <AssistantConversation
        enabled
        sessionKey="synthetic"
        english
        onEvidence={() => undefined}
      />,
    );
    expect(html).not.toMatch(/[\u0600-\u06ff]/);
    expect(html).toContain('Clear conversation');
  });
});
