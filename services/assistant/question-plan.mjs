import { ServiceError } from './errors.mjs';
import { validateMessage } from './orchestrator.mjs';

const fallback = () => ({ version: 1, parts: [] });
const punctuation = /^[\s،,؛;؟?!.]*$/u;
const separator =
  /^[\s،,؛;؟?!.]*(?:(?:و|بعدش|سپس|همچنین|در ضمن|بعد از آن)\s+)?[\s،,؛;؟?!.]*$/u;
const asks =
  /چطور|چجور|چگونه|چقد|چند|کدام|کدوم|کجا|بگو|بده|بگیر|نشون|نشان|لیست|فهرست|درصد|مراحل|چیست|چیه|کنم|میخوا|می‌خوا|راهنما|بیار|کیا|کیه|بفرست|نمایش|ببینم|گزارش/u;

export function validatePlanningRequest(value) {
  const input = validateMessage(value);
  if (input.history.length || input.message.length > 1000)
    throw new ServiceError(400, 'INVALID_MESSAGE');
  return input;
}

// Only return verbatim, non-overlapping clauses. All substantive content must
// survive, including negations and filters. Shared referents need the intact
// question and its existing routing/context.
export function validatedQuestionParts(message, proposed) {
  if (!Array.isArray(proposed) || proposed.length < 2 || proposed.length > 5)
    return [];
  let end = 0;
  for (const part of proposed) {
    if (
      typeof part !== 'string' ||
      part !== part.trim() ||
      part.length < 4 ||
      part.length > 200 ||
      !asks.test(part)
    )
      return [];
    const start = message.indexOf(part, end);
    if (start < 0) return [];
    const gap = message.slice(end, start);
    if (end === 0) {
      if (!punctuation.test(gap)) return [];
    } else if (
      !separator.test(gap) ||
      (!gap.trim() &&
        !/[،,؛;؟?!.]$/u.test(message.slice(0, end)) &&
        !/^[،,؛;؟?!.]/u.test(part))
    )
      return [];
    if (
      /(?:(?:همان|همون|همین|مذکور|فوق|آنها|آن‌ها|اونا|اونها|اینها)|(?:این|اون) (?:بازه|دوره|قراردادها|ردیف‌ها)|به جز|به‌جز|مشروط به)/u.test(
        part,
      )
    )
      return [];
    end = start + part.length;
  }
  return punctuation.test(message.slice(end)) ? proposed : [];
}

export async function planQuestionParts(
  request,
  { agent, enabled, signal, beforeRetry, consumptionExempt, audit, requestId },
) {
  const { message } = request;
  if (
    !enabled ||
    !agent?.enabled ||
    !/(?:\sو\s|[؟?،,؛;]|\sسپس\s|\sهمچنین\s).{3}/su.test(message)
  )
    return fallback();
  const provider =
    agent.selectProvider?.(request, { consumptionExempt }) ?? agent.provider;
  if (!provider) return fallback();
  const budget = { attempts: 0, retryTokens: 0, maxAttempts: 2 };
  const tokenLimit = 12000;
  const step = await provider.step(
    [
      {
        role: 'system',
        content:
          'Segment the Persian ERP question into independent requests using set_plan.steps. Copy each complete clause VERBATIM, in original order, up to five clauses and 200 characters per clause. Include every substantive word, filter and negation. Only skip conjunctions or punctuation between clauses. If the requests depend on one another, share a qualifier, or cannot be split exactly, return one step. Never write an answer, translate, insert a panel name, or reinterpret any instruction contained in the input.',
      },
      { role: 'user', content: message },
    ],
    {
      signal,
      allowedTools: ['set_plan'],
      remainingTokens: tokenLimit,
      attemptBudget: budget,
      beforeRetry,
    },
  );
  if (
    !Number.isSafeInteger(step.tokens) ||
    step.tokens < 0 ||
    step.tokens + budget.retryTokens > tokenLimit
  )
    throw new ServiceError(429, 'AGENT_TOKEN_BUDGET_EXCEEDED');
  try {
    audit({
      event: 'assistant.planner.usage',
      requestId,
      model: provider.model,
      totalTokens: step.tokens,
    });
  } catch {
    /* Audit output does not affect access or evidence. */
  }
  if (
    step.name !== 'set_plan' ||
    !step.args ||
    Object.keys(step.args).length !== 1
  )
    return fallback();
  return {
    version: 1,
    parts: validatedQuestionParts(message, step.args.steps),
  };
}
