'use client';

import {
  purchaseGuideLink,
  readPurchaseGuide,
  renderPurchaseGuide,
  resolvePurchaseQuestion,
} from './purchase-guides';
import {
  customerGuideLink,
  readCustomerGuide,
  renderCustomerGuide,
  resolveCustomerQuestion,
} from './customer-guides';
import {
  resolveDocumentQuestion,
  renderDocumentGuide,
  readDocumentGuide,
} from './document-guides';

import { canViewScreen } from '@nora/contracts';
import {
  readTourGuideStatus,
  renderTourGuide,
  resolveTourGuideQuestion,
  tourGuideDestination,
  tourGuideHref,
  tourGuideUnavailable,
  type TourGuideTopic,
} from './tour-guide';
import { normalizeQuestion } from './question-text';
import { AssistantResponseContent } from './response-content';
import { formatAssistantSources } from './response-presentation';
import { useChatScroll } from './use-chat-scroll';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveWorkbenchGuide, loadWorkbenchGuide } from './workbench-guides';
import {
  asksWorkbenchRequestStatus,
  describeWorkbenchRequest,
} from './workbench-request-guide';
import {
  callCenterIntent,
  callCenterQueueHref,
  readCallCenterMetric,
  readCallCenterRequestStatus,
} from './call-center-request-guide';
import { CallCenterHttpError } from '@/modules/call-center/client';
import {
  customerAffairsApi,
  CustomerAffairsApiError,
} from '@/modules/customer-affairs/api/customer-affairs-client';
import {
  assistantConversationScopeKey,
  appendChatExchange,
} from './chat-session';
import { isContractReportQuestion, portfolioKind } from './contract-reports';
import { contractAdvice } from './contract-advice';
import {
  readContractFormHelp,
  formCorrectionTargets,
} from './contract-form-help';
import {
  inspectContractQuestion,
  type ContractLink,
} from './contract-inspection';
import {
  normalizeContractQuestion,
  resolveContractGuide,
} from './contract-guides';
import { currencySymbol } from '@/lib/currency-symbol';

import { explainPersonal } from './recommendation-policy';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Activity,
  ArrowUpLeft,
  ArrowUp,
  ArrowDown,
  LoaderCircle,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  Database,
  FileText,
  Flag,
  GitCompareArrows,
  Info,
  Lightbulb,
  ListChecks,
  MapPin,
  Mic,
  Newspaper,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from '@/components/access-link';
import { Button } from '@/components/ui/button';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { assistantDashboardHref } from './dashboard-location';
import { assistantCopy as c, type AssistantText } from '@/i18n/assistant-copy';
import {
  assistantViews,
  loadExecutiveSnapshot,
  loadAssistantAction,
  type AssistantAction,
  type AssistantActionResult,
  type AssistantLoadState,
  type AssistantView,
  type ExecutiveSnapshot,
} from './model';
import styles from './executive-workspace.module.css';
import { conversationResponseSchema } from './conversation';
import { agentResponseSchema, conversationHistory } from './agent-response';
import { routeAssistantQuestion, type AnswerContext } from './question-routing';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { useAccessActor } from '@/modules/iam/access-context';

type Translate = (text: AssistantText) => string;
function SourceUpdated({
  value,
  english,
  t,
}: {
  value: string | null;
  english: boolean;
  t: Translate;
}) {
  return (
    <p className={styles.composerHint}>
      {value ? (
        <>
          {t(c.sourceUpdated)}:{' '}
          <time dateTime={value}>
            {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'Asia/Tehran',
            }).format(new Date(value))}
          </time>
        </>
      ) : (
        t(c.noSourceUpdate)
      )}
    </p>
  );
}
const viewIcons: Record<AssistantView, LucideIcon> = {
  overview: Activity,
  sales: TrendingUp,
  finance: Wallet,
  news: Newspaper,
  scenarios: GitCompareArrows,
  advisor: Sparkles,
};
const metricIcons: Record<AssistantView, readonly LucideIcon[]> = {
  overview: [TrendingUp, ChartNoAxesCombined, Wallet, ShieldCheck],
  sales: [BarChart3, ListChecks, Target, MapPin],
  finance: [CircleDollarSign, ChartNoAxesCombined, Wallet, BellRing],
  news: [Newspaper, ShieldCheck, Lightbulb, MapPin],
  scenarios: [BarChart3, CircleDollarSign, Wallet, ShieldCheck],
  advisor: [TrendingUp, ShieldCheck, BellRing, Lightbulb],
};

function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelHeading}>
        <span className={styles.headingIcon}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Empty({
  text,
  icon: Icon = Database,
  compact = false,
}: {
  text: string;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compactEmpty : ''}`}>
      <Icon size={25} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
function Rows({
  items,
  t,
  note,
  bars = false,
}: {
  items: readonly AssistantText[];
  t: Translate;
  note?: string;
  bars?: boolean;
}) {
  return (
    <>
      <div className={styles.rows}>
        {items.map((item) => (
          <div key={item[1]} className={styles.row}>
            <span>{t(item)}</span>
            {bars && <span className={styles.emptyBar} aria-hidden="true" />}
            <span className={styles.noValue} aria-label={t(c.unknown)}>
              —
            </span>
          </div>
        ))}
      </div>
      {note && <p className={styles.footnote}>{note}</p>}
    </>
  );
}
function Trend({
  title,
  t,
  finance = false,
}: {
  title: string;
  t: Translate;
  finance?: boolean;
}) {
  return (
    <Panel title={title} icon={ChartNoAxesCombined}>
      <div className={styles.legend}>
        <span>
          <i />
          {t(c.actual)}
        </span>
        <span>
          <i className={styles.dotted} />
          {t(c.forecast)}
        </span>
      </div>
      <div className={styles.chartEmpty}>
        <div className={styles.chartGrid} aria-hidden="true" />
        <div className={styles.chartMessage}>
          <ChartNoAxesCombined size={30} aria-hidden="true" />
          <strong>{t(c.noData)}</strong>
          <p>{t(finance ? c.financeGate : c.estimateGate)}</p>
        </div>
      </div>
      <div className={styles.chartFooter}>
        <span>{t(c.prior)}</span>
        <span>{t(c.upcoming)}</span>
      </div>
    </Panel>
  );
}
function selectedSalesContract() {
  return document.querySelector<HTMLElement>('[data-nora-contract-id]')?.dataset
    .noraContractId;
}

type ComposerProps = {
  t: Translate;
  denied: boolean;
  english?: boolean;
  floating?: boolean;
};
export function AssistantComposer(props: ComposerProps) {
  return (
    <CompanyScopedAgentComposer
      {...props}
      agentMode={process.env.NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED === 'true'}
    />
  );
}
function CompanyScopedAgentComposer({
  agentMode,
  ...props
}: ComposerProps & { agentMode: boolean }) {
  const { context } = useLegalEntityContext();
  const actor = useAccessActor();
  const key = assistantConversationScopeKey(context, actor);
  return (
    <AssistantComposerContent key={key} {...props} agentMode={agentMode} />
  );
}
function AssistantComposerContent({
  t,
  denied,
  english = false,
  floating = false,
  agentMode = false,
}: {
  t: Translate;
  denied: boolean;
  english?: boolean;
  floating?: boolean;
  agentMode?: boolean;
}) {
  const actor = useAccessActor();
  const inputId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 132)}px`;
  }, [draft]);

  const [filterError, setFilterError] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      local?: boolean;
      agent?: boolean;
      links?: ContractLink[];
      targets?: { id: string; label: string }[];
      guideLink?: { href: string; label: string };
      submissionId?: number;
    }>
  >([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionResult, setActionResult] =
    useState<AssistantActionResult | null>(null);
  const [actionState, setActionState] = useState<AssistantLoadState | null>(
    null,
  );
  const submissionSequence = useRef(0);
  const submitting = useRef(false);
  const {
    viewport: chatViewportRef,
    content: chatContentRef,
    showLatest,
    updatePosition,
    scrollToLatest,
  } = useChatScroll(messages, actionState, actionResult, chatError);
  const pending = useRef<AbortController | null>(null);
  const inspecting = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workbenchTab =
    pathname === '/workbench'
      ? (searchParams.get('tab') ?? 'today')
      : pathname === '/customer-affairs/call-center'
        ? 'call-center'
        : undefined;
  const tourTopic = useRef<{ topic: TourGuideTopic; href: string } | undefined>(
    undefined,
  );
  const purchaseTopic = useRef<
    | Extract<
        ReturnType<typeof resolvePurchaseQuestion>,
        { kind: 'guide' }
      >['topic']['id']
    | 'status'
    | undefined
  >(undefined);
  const customerTopic = useRef<string | undefined>(undefined);
  const customerLookup = useRef<AbortController | null>(null);
  const customerLocation = pathname + '?' + searchParams.toString();
  useEffect(() => () => customerLookup.current?.abort(), [customerLocation]);
  const documentTopic = useRef<string | undefined>(undefined);
  const workbenchTopic = useRef<string | undefined>(undefined);
  const lastVersion = useRef<number | undefined>(undefined);
  const contractId = useRef<string | undefined>(undefined);
  const guideTopic = useRef<string | undefined>(undefined);
  const previousAnswer = useRef<AnswerContext | undefined>(undefined);
  useEffect(() => {
    if (denied) previousAnswer.current = undefined;
  }, [denied]);
  useEffect(() => {
    const resetRecord = () => {
      inspecting.current?.abort();
      pending.current?.abort();
      setActionState(null);
      lastVersion.current = undefined;
      contractId.current = undefined;
    };
    resetRecord();
    let selection = selectedSalesContract();
    const observer = new MutationObserver(() => {
      const current = selectedSalesContract();
      if (current !== selection) {
        if (
          current &&
          previousAnswer.current?.contractId &&
          previousAnswer.current.contractId !== current
        )
          previousAnswer.current = undefined;
        selection = current;
        resetRecord();
      }
    });
    if (pathname?.startsWith('/sales')) {
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-nora-contract-id'],
      });
    }
    return () => {
      observer.disconnect();
      inspecting.current?.abort();
    };
  }, [pathname, workbenchTab, agentMode]);

  const prompts: readonly [AssistantText, AssistantAction][] = [
    [c.quickDaily, 'daily-summary'],
    [c.quickSales, 'sales-analysis'],
    [c.quickReceivables, 'receivables-follow-up'],
  ];
  const run = async (action: AssistantAction) => {
    if (denied) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setActionResult(null);
    setChatError(null);
    setActionState('loading');
    setFilterError(false);
    try {
      const result = await loadAssistantAction(action, controller.signal);
      if (!controller.signal.aborted) {
        setActionResult(result);
        setActionState(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'HTTP_400') {
          setFilterError(true);
          setActionState(null);
          return;
        }
        setActionState(
          message === 'HTTP_401'
            ? 'unauthenticated'
            : message === 'HTTP_403'
              ? 'forbidden'
              : message === 'HTTP_429'
                ? 'rate-limited'
                : 'unavailable',
        );
      }
    }
  };
  const submit = async () => {
    if (
      denied ||
      !draft.trim() ||
      actionState === 'loading' ||
      submitting.current
    )
      return;
    submitting.current = true;
    try {
      await sendMessage();
    } finally {
      submitting.current = false;
    }
  };
  const sendMessage = async () => {
    const message = draft.trim();
    const submissionId = ++submissionSequence.current;
    scrollToLatest();
    // Visible immediately; not provider history until a response succeeds.
    setMessages((previous) =>
      appendChatExchange(previous, [
        {
          role: 'user' as const,
          content: message,
          local: true,
          submissionId,
        },
      ]),
    );
    setDraft('');
    setChatError(null);
    setActionResult(null);
    const decision = routeAssistantQuestion(
      message,
      previousAnswer.current,
      Boolean(pathname?.startsWith('/sales')),
      workbenchTab === 'call-center',
    );
    const guideQuestion = decision.guideQuestion ?? message;
    const guidanceAllowed = decision.kind === 'guide';
    const replyLocally = (
      content: string,
      links?: ContractLink[],
      targets?: { id: string; label: string }[],
      guideLink?: { href: string; label: string },
      answerContext?: AnswerContext,
    ) => {
      if (answerContext)
        previousAnswer.current = {
          ...answerContext,
          question: answerContext.question.slice(0, 1000),
        };
      setMessages((previous) =>
        appendChatExchange(previous, [
          {
            role: 'assistant' as const,
            content,
            local: true,
            ...(links?.length ? { links } : {}),
            ...(targets?.length ? { targets } : {}),
            ...(guideLink ? { guideLink } : {}),
          },
        ]),
      );
      setChatError(null);
      setActionResult(null);
      setActionState(null);
    };
    const previousTour = tourTopic.current;
    const tourQuestion = resolveTourGuideQuestion(
      message,
      pathname === tourGuideHref,
      previousTour?.topic,
    );
    tourTopic.current = undefined;
    if (tourQuestion) {
      pending.current?.abort();
      previousAnswer.current = undefined;
      workbenchTopic.current = undefined;
      documentTopic.current = undefined;
      guideTopic.current = undefined;
      const label = 'تعریف تور و خدمات';
      if (tourQuestion.kind === 'guide') {
        const href =
          tourQuestion.followUp && previousTour
            ? previousTour.href
            : tourGuideDestination(
                tourQuestion.topic,
                tourQuestion.floatingPrice,
              );
        tourTopic.current = { topic: tourQuestion.topic, href };
        replyLocally(
          renderTourGuide(tourQuestion.topic, tourQuestion.followUp),
          undefined,
          undefined,
          {
            href,
            label,
          },
        );
      } else if (tourQuestion.kind === 'clarify') {
        replyLocally(tourQuestion.text, undefined, undefined, {
          href: tourGuideHref,
          label,
        });
      } else if (
        !actor ||
        !canViewScreen(actor.permissions, 'ticket-catalog.tab.tours')
      ) {
        replyLocally(tourGuideUnavailable, undefined, undefined, {
          href: tourGuideHref,
          label,
        });
      } else {
        const controller = new AbortController();
        pending.current = controller;
        setActionState('loading');
        try {
          const answer = await readTourGuideStatus(
            tourQuestion,
            actor,
            controller.signal,
          );
          if (!controller.signal.aborted)
            replyLocally(answer.text, undefined, undefined, {
              href: answer.href,
              label,
            });
        } catch (error) {
          if (!controller.signal.aborted) throw error;
        }
      }
      return;
    }
    const purchaseQuestion = resolvePurchaseQuestion(
      message,
      pathname === '/ticket-purchases',
      purchaseTopic.current,
    );
    purchaseTopic.current = undefined;
    if (purchaseQuestion) {
      pending.current?.abort();
      previousAnswer.current = undefined;
      documentTopic.current = undefined;
      workbenchTopic.current = undefined;
      guideTopic.current = undefined;
      if (purchaseQuestion.kind === 'guide') {
        purchaseTopic.current = purchaseQuestion.topic.id;
        replyLocally(
          renderPurchaseGuide(purchaseQuestion.topic),
          undefined,
          undefined,
          purchaseGuideLink,
        );
      } else {
        if (!purchaseQuestion.code) purchaseTopic.current = 'status';
        const controller = new AbortController();
        pending.current = controller;
        setActionState('loading');
        try {
          const answer = await readPurchaseGuide(
            purchaseQuestion.code,
            controller.signal,
          );
          if (!controller.signal.aborted)
            replyLocally(answer.text, undefined, undefined, answer.link);
        } catch {
          if (!controller.signal.aborted)
            replyLocally(
              'دریافت خریدهای رزرواسیون ناموفق بود.',
              undefined,
              undefined,
              purchaseGuideLink,
            );
        }
      }
      return;
    }
    customerLookup.current?.abort();
    const customerQuestion = resolveCustomerQuestion(
      message,
      pathname === '/customers',
      customerTopic.current,
    );
    customerTopic.current = undefined;
    if (customerQuestion) {
      pending.current?.abort();
      previousAnswer.current = undefined;
      documentTopic.current = undefined;
      workbenchTopic.current = undefined;
      guideTopic.current = undefined;
      if (customerQuestion.kind === 'guide') {
        customerTopic.current = customerQuestion.topic.id;
        replyLocally(
          renderCustomerGuide(customerQuestion.topic),
          undefined,
          undefined,
          customerGuideLink,
        );
      } else {
        const controller = new AbortController();
        pending.current = controller;
        customerLookup.current = controller;
        setActionState('loading');
        const filters = new URLSearchParams(
          pathname === '/customers' ? searchParams.toString() : '',
        );
        const currentSearch = () =>
          pathname === '/customers'
            ? ((
                document.getElementById(
                  'customer-search-live',
                ) as HTMLInputElement | null
              )?.value ?? '')
            : '';
        const selectedSearch = currentSearch();
        filters.set('search', selectedSearch);
        try {
          const answer = await readCustomerGuide(
            customerQuestion,
            filters,
            controller.signal,
          );
          if (!controller.signal.aborted && currentSearch() === selectedSearch)
            replyLocally(answer.text, undefined, undefined, {
              ...customerGuideLink,
              href: answer.href,
            });
        } catch (error) {
          if (!controller.signal.aborted) throw error;
        } finally {
          if (pending.current === controller) setActionState(null);
        }
      }
      return;
    }
    const documentQuestion = resolveDocumentQuestion(
      message,
      pathname === '/documents',
      documentTopic.current,
      pathname === '/documents' ? searchParams.get('document') : undefined,
    );
    documentTopic.current = undefined;
    if (documentQuestion) {
      pending.current?.abort();
      previousAnswer.current = undefined;
      workbenchTopic.current = undefined;
      guideTopic.current = undefined;
      if (documentQuestion.kind === 'guide') {
        documentTopic.current = documentQuestion.topic.title;
        replyLocally(
          renderDocumentGuide(
            documentQuestion.topic,
            documentQuestion.continuation,
          ),
          undefined,
          undefined,
          {
            href: '/documents',
            label: 'اسناد و فایل‌ها',
          },
        );
      } else if (documentQuestion.kind === 'clarify') {
        replyLocally(documentQuestion.text);
      } else {
        const controller = new AbortController();
        pending.current = controller;
        setActionState('loading');
        try {
          const answer = await readDocumentGuide(documentQuestion);
          if (!controller.signal.aborted)
            replyLocally(answer.text, undefined, undefined, {
              href: answer.href,
              label: 'اسناد و فایل‌ها',
            });
        } catch {
          if (!controller.signal.aborted)
            replyLocally(
              'وضعیت سند در دسترس نیست. نشست و دسترسی خود را در پنل اسناد بررسی کنید یا دوباره تلاش کنید.',
              undefined,
              undefined,
              {
                href: '/documents',
                label: 'اسناد و فایل‌ها',
              },
            );
        }
      }
      return;
    }
    const callCenterStatus = callCenterIntent(
      message,
      workbenchTab === 'call-center',
    );
    if (callCenterStatus === 'report') {
      replyLocally(
        'این شمارش به بازه، کارشناس یا فیلتر تماس بستگی دارد. فیلترهای تماس امروز یا گزارش عملکرد کارشناسان را در کال‌سنتر بررسی کنید.',
        undefined,
        undefined,
        {
          href: '/customer-affairs/call-center',
          label: 'کال‌سنتر',
        },
      );
      return;
    }
    const workbenchStatus = asksWorkbenchRequestStatus(
      message,
      pathname === '/workbench',
    );
    if (
      !callCenterStatus &&
      workbenchStatus &&
      pathname !== '/workbench' &&
      /^(?:درخواستم|درخواست من)\s+(?:الان )?(?:دست|کجا|به کجا)/.test(
        normalizeQuestion(message),
      )
    ) {
      replyLocally('درخواست مربوط به «میزکار من» است یا «کال‌سنتر»؟');
      return;
    }
    if (callCenterStatus || workbenchStatus) {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setActionState('loading');
      try {
        if (callCenterStatus) {
          const answer = actor
            ? callCenterStatus === 'request'
              ? await readCallCenterRequestStatus(
                  message,
                  actor,
                  controller.signal,
                )
              : await readCallCenterMetric(
                  callCenterStatus,
                  actor,
                  controller.signal,
                )
            : 'اطلاعات دسترسی حساب برای خواندن کال‌سنتر آماده نیست.';
          if (!controller.signal.aborted) {
            previousAnswer.current = undefined;
            workbenchTopic.current = undefined;
            replyLocally(answer, undefined, undefined, {
              href:
                callCenterStatus === 'request'
                  ? callCenterQueueHref
                  : '/customer-affairs/call-center',
              label: 'کال‌سنتر',
            });
          }
          return;
        }
        const { data } = await customerAffairsApi.workbenchRequests(
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const answer = describeWorkbenchRequest(
          message,
          data,
          pathname === '/workbench' ? searchParams.get('request') : undefined,
        );
        previousAnswer.current = undefined;
        workbenchTopic.current = undefined;
        replyLocally(answer.text, undefined, undefined, {
          href: answer.href,
          label: 'کارتابل درخواست‌ها',
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (
          (error instanceof CustomerAffairsApiError ||
            error instanceof CallCenterHttpError) &&
          [401, 403].includes(error.status)
        ) {
          setMessages([]);
          previousAnswer.current = undefined;
          setActionState(
            error.status === 403 ? 'forbidden' : 'unauthenticated',
          );
        } else {
          replyLocally(
            callCenterStatus
              ? 'دریافت وضعیت صف کال‌سنتر انجام نشد. دوباره تلاش کنید یا صف را باز کنید.'
              : 'دریافت وضعیت از کارتابل انجام نشد. دوباره تلاش کنید یا کارتابل درخواست‌ها را باز کنید.',
          );
        }
      }
      return;
    }
    if (decision.kind === 'clarify') {
      replyLocally(decision.clarification!);
      return;
    }
    const workbenchHelp =
      guidanceAllowed &&
      decision.domain !== 'sales' &&
      resolveWorkbenchGuide(
        guideQuestion,
        workbenchTab,
        workbenchTopic.current,
      );
    if (workbenchHelp) {
      if ('clarification' in workbenchHelp) {
        replyLocally(workbenchHelp.clarification);
        return;
      }
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setActionState('loading');
      setChatError(null);
      try {
        const answer = await loadWorkbenchGuide(
          workbenchHelp.topic,
          workbenchHelp.goal,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          workbenchTopic.current = workbenchHelp.topic.id;
          replyLocally(
            answer,
            undefined,
            undefined,
            {
              label: workbenchHelp.topic.title,
              href: workbenchHelp.topic.href,
            },
            {
              kind: 'guide',
              domain: 'workbench',
              question: guideQuestion,
              topicId: workbenchHelp.topic.id,
            },
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessages([]);
          previousAnswer.current = undefined;
          setActionState(
            error instanceof Error && error.message === 'HTTP_403'
              ? 'forbidden'
              : 'unauthenticated',
          );
        }
      }
      return;
    }
    if (guidanceAllowed && decision.domain === 'workbench') {
      replyLocally(
        'راهنمای کدام بخش میزکار من را می‌خواهید: درخواست‌ها و مرخصی، پیام‌ها، فایل‌ها، یادداشت‌ها، تقویم، عملکرد یا حساب و تنظیمات؟',
      );
      return;
    }
    const formHelp = guidanceAllowed && readContractFormHelp(guideQuestion);
    if (formHelp) {
      replyLocally(formHelp, undefined, formCorrectionTargets(), undefined, {
        kind: 'guide',
        domain: 'sales',
        question: guideQuestion,
      });
      return;
    }
    const selectionAtSubmit = selectedSalesContract();
    const selectedContract =
      selectionAtSubmit ??
      contractId.current ??
      (decision.kind === 'follow-up'
        ? previousAnswer.current?.contractId
        : undefined);
    const guide =
      guidanceAllowed || decision.kind === 'data-with-guide'
        ? resolveContractGuide(
            guideQuestion,
            pathname === '/sales' ||
              Boolean(pathname?.startsWith('/sales/contracts/')),
            guideTopic.current,
            guidanceAllowed && Boolean(selectedContract),
            agentMode,
          )
        : undefined;
    const recordFollowup =
      !guidanceAllowed &&
      selectedContract &&
      /حالا|همین|این قرارداد|اصلاحش|وضعیتش|بعدش/.test(
        normalizeContractQuestion(message),
      );
    const liveReport =
      !guidanceAllowed &&
      (/قرارداد\s*(?:شماره\s*)?[a-z0-9]/i.test(
        normalizeContractQuestion(message),
      ) ||
        portfolioKind(message) ||
        /قرارداد(?:\s*های)?\s+(?:مشتری|به نام)/.test(
          normalizeContractQuestion(message),
        ) ||
        (selectedContract && isContractReportQuestion(message)));
    const advice =
      guidanceAllowed &&
      !liveReport &&
      !recordFollowup &&
      contractAdvice(
        guideQuestion,
        Boolean(pathname?.startsWith('/sales')),
        agentMode,
      );
    if (advice) {
      replyLocally(advice, undefined, undefined, undefined, {
        kind: 'guide',
        domain: 'sales',
        question: guideQuestion,
        topicId: guide?.topicId,
      });
      return;
    }
    if (guidanceAllowed && guide && !recordFollowup && !liveReport) {
      guideTopic.current = guide.topicId;
      if (guide.topicId === 'create') contractId.current = undefined;
      replyLocally(guide.text, undefined, undefined, undefined, {
        kind: 'guide',
        domain: 'sales',
        question: guideQuestion,
        topicId: guide.topicId,
      });
      return;
    }
    pending.current?.abort();
    const inspectionController = new AbortController();
    pending.current = inspectionController;
    inspecting.current = inspectionController;
    setActionState('loading');
    const inspection = agentMode
      ? undefined
      : await inspectContractQuestion(
          decision.dataMessage,
          selectedContract,
          contractId.current === selectedContract
            ? lastVersion.current
            : undefined,
          inspectionController.signal,
        );
    if (inspecting.current === inspectionController) inspecting.current = null;
    if (
      inspectionController.signal.aborted ||
      selectionAtSubmit !== selectedSalesContract()
    ) {
      if (pending.current === inspectionController) setActionState(null);
      return;
    }
    setActionState(null);
    if (inspection) {
      lastVersion.current = inspection.version;
      contractId.current = inspection.contractId;
      guideTopic.current = undefined;
      replyLocally(
        inspection.text +
          (decision.kind === 'data-with-guide' && guide && inspection.contractId
            ? '\n\n' + guide.text
            : ''),
        inspection.links,
        undefined,
        undefined,
        inspection.contractId
          ? {
              kind: 'data',
              domain: 'sales',
              question: message,
              contractId: inspection.contractId,
            }
          : undefined,
      );
      return;
    }
    if (guidanceAllowed && guide && !agentMode) {
      guideTopic.current = guide.topicId;
      replyLocally(guide.text, undefined, undefined, undefined, {
        kind: 'guide',
        domain: 'sales',
        question: guideQuestion,
        topicId: guide.topicId,
      });
      return;
    }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setActionResult(null);
    setActionState('loading');
    setChatError(null);
    try {
      const response = await fetch(
        agentMode
          ? '/api/assistant/v3/conversation'
          : '/api/assistant/v2/conversation',
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            version: 1,
            message: decision.dataMessage,
            ...(agentMode &&
            selectedContract &&
            /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(
              selectedContract,
            )
              ? { context: { selectedContractId: selectedContract } }
              : {}),
            history: conversationHistory(messages),
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setMessages([]);
          previousAnswer.current = undefined;
          setActionResult(null);
        }
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        throw new Error(
          ['CONVERSATION_DISABLED', 'AGENT_DISABLED'].includes(
            body?.error?.code ?? '',
          )
            ? 'disabled'
            : response.status === 429
              ? 'rate'
              : 'unavailable',
        );
      }
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (agentMode) {
        const result = agentResponseSchema.parse(body);
        const sourceText = formatAssistantSources(result.sources, english);
        const answer = [
          result.text,
          result.status === 'ANSWER' &&
          decision.kind === 'data-with-guide' &&
          guide
            ? guide.text
            : '',
          sourceText ? `${t(c.agentSources)}:\n${sourceText}` : '',
          result.limitations.length
            ? `${t(c.agentLimitations)}:\n${result.limitations.join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        if (result.status === 'ANSWER')
          previousAnswer.current = {
            kind: 'data',
            domain: 'sales',
            question:
              decision.kind === 'follow-up'
                ? (previousAnswer.current?.question ?? message)
                : message,
            contractId: selectedContract,
            resultIds: result.sources.map((source) => source.resultId),
          };
        setMessages((previous) =>
          appendChatExchange(
            previous.map((item) =>
              item.submissionId === submissionId
                ? { ...item, local: false, agent: true }
                : item,
            ),
            [{ role: 'assistant' as const, content: answer, agent: true }],
          ),
        );
        setActionState(null);
        return;
      }
      const result = conversationResponseSchema.parse(body);
      const answer =
        (result.status === 'REPLY'
          ? result.text
          : result.status === 'CLARIFY'
            ? t(c.conversationClarification[result.field])
            : t(c.conversationEvidence)) +
        (result.status === 'ANSWER' &&
        decision.kind === 'data-with-guide' &&
        guide
          ? '\n\n' + guide.text
          : '');
      // ERP evidence is rendered separately and never enters model history.
      setMessages((previous) =>
        appendChatExchange(
          previous.map((item) =>
            item.submissionId === submissionId
              ? { ...item, local: false }
              : item,
          ),
          [{ role: 'assistant' as const, content: answer }],
        ),
      );
      if (result.status === 'ANSWER') {
        setActionResult(result.evidence);
        previousAnswer.current = {
          kind: 'data',
          domain: 'sales',
          question: message,
          contractId: selectedContract,
        };
      }
      setActionState(null);
    } catch (error) {
      if (!controller.signal.aborted) {
        setChatError(error instanceof Error ? error.message : 'unavailable');
        setActionState(null);
      }
    }
  };
  return (
    <section
      className={`${styles.composer} ${floating ? styles.floatingComposer : ''}`}
      aria-label={floating ? t(c.composerTitle) : undefined}
      aria-labelledby={floating ? undefined : inputId + '-title'}
    >
      {!floating && <h1 id={inputId + '-title'}>{t(c.composerTitle)}</h1>}
      <form
        className={styles.composerForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          id={inputId}
          ref={input}
          aria-label={t(c.composerTitle)}
          placeholder={t(c.composerPlaceholder)}
          className={styles.composerInput}
          rows={1}
          maxLength={4000}
          value={draft}
          disabled={denied}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className={styles.composerTools}>
          <button
            type="button"
            disabled
            aria-label={t(c.attach)}
            title={t(c.attachUnavailable)}
          >
            <Paperclip size={21} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled
            aria-label={t(c.voice)}
            title={t(c.voiceUnavailable)}
          >
            <Mic size={21} aria-hidden="true" />
          </button>
          <button
            type="submit"
            className={styles.composerSend}
            disabled={denied || !draft.trim() || actionState === 'loading'}
            aria-label={t(c.send)}
            title={t(c.send)}
          >
            <ArrowUp size={24} aria-hidden="true" />
          </button>
        </div>
      </form>
      <div className={styles.composerPrompts}>
        {prompts.map(([prompt, action]) => (
          <button
            key={prompt[1]}
            type="button"
            disabled={denied || actionState === 'loading'}
            onClick={() => {
              setDraft(t(prompt));
              setChatError(null);
              input.current?.focus();
              void run(action);
            }}
          >
            {t(prompt)}
          </button>
        ))}
      </div>
      <div className={styles.composerTranscript}>
        <div
          ref={chatViewportRef}
          onScroll={updatePosition}
          className={styles.composerResponse}
          role="region"
          aria-label={t(c.widgetResponse)}
          tabIndex={0}
        >
          <div ref={chatContentRef}>
            {!denied && (
              <div
                className={styles.chatMessages}
                role="log"
                aria-label={t(c.conversationLabel)}
              >
                {messages.map((item, index) => (
                  <div
                    key={index}
                    data-role={item.role}
                    dir="auto"
                    className="whitespace-pre-wrap"
                  >
                    {item.role === 'assistant' ? (
                      <AssistantResponseContent
                        text={item.content}
                        english={english}
                      />
                    ) : (
                      item.content
                    )}
                    {item.guideLink && (
                      <Link
                        className="block underline"
                        href={item.guideLink.href}
                      >
                        {item.guideLink.label}
                      </Link>
                    )}
                    {item.local &&
                      item.targets?.map((target) => (
                        <button
                          type="button"
                          className="block underline"
                          key={target.id}
                          onClick={() => {
                            const section = document.getElementById(target.id);
                            section?.focus();
                            section?.scrollIntoView({ block: 'center' });
                          }}
                        >
                          {target.label}
                        </button>
                      ))}
                    {item.local &&
                      item.links?.map((link) => (
                        <a
                          className="block underline"
                          key={link.id}
                          href={
                            '/sales?' +
                            new URLSearchParams({
                              contract: link.contractNumber,
                              record: link.id,
                            })
                          }
                        >
                          {link.contractNumber}
                        </a>
                      ))}
                  </div>
                ))}
              </div>
            )}
            {!denied && chatError && (
              <p role="alert">
                {t(
                  chatError === 'disabled'
                    ? c.chatDisabled
                    : chatError === 'rate'
                      ? c.states['rate-limited']
                      : c.conversationUnavailable,
                )}
              </p>
            )}
            {filterError && <p role="alert">{t(c.filterInvalid)}</p>}
            {!denied && actionResult && 'filters' in actionResult && (
              <div className={styles.composerHint}>
                <p>
                  {t(c.filteredPeriod)}:{' '}
                  {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                    timeZone: 'Asia/Tehran',
                    dateStyle: 'medium',
                  }).format(new Date(actionResult.filters.startDate))}{' '}
                  —{' '}
                  {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                    timeZone: 'Asia/Tehran',
                    dateStyle: 'medium',
                  }).format(new Date(actionResult.filters.endDate))}
                </p>
                {actionResult.action !== 'sales-analysis' && (
                  <p>{t(c.balanceAsOf)}</p>
                )}
                {actionResult.action === 'sales-analysis' &&
                  (actionResult.filters.originId ||
                    actionResult.filters.destinationId) && (
                    <p>{t(c.routeConversionUnavailable)}</p>
                  )}
              </div>
            )}
            {!denied && actionState && (
              <p role="status" className={styles.composerHint}>
                {actionState === 'loading' && (
                  <LoaderCircle
                    className={styles.chatSpinner}
                    size={18}
                    aria-hidden="true"
                  />
                )}
                {t(c.states[actionState])}
              </p>
            )}
            {!denied && actionResult?.status === 'BLOCKED' && (
              <p role="status" className={styles.composerHint}>
                {t(
                  actionResult.reason === 'SALES_SOURCE_UNAVAILABLE'
                    ? c.salesDefinitionGate
                    : c.receivablesSourceGate,
                )}
              </p>
            )}
            {!denied &&
              actionResult?.status === 'BLOCKED' &&
              (actionResult.action === 'sales-analysis' ||
                actionResult.action === 'receivables-follow-up') &&
              actionResult.failure && (
                <p role="status" className={styles.composerHint}>
                  {t(c.sourceFailure[actionResult.failure])}
                </p>
              )}
            {!denied && actionResult?.action === 'daily-summary' && (
              <div className={styles.actionResult}>
                <h2>{t(c.dailyTitle)}</h2>
                <p className={styles.composerHint}>
                  <time dateTime={actionResult.snapshot.generatedAt}>
                    {t(c.asOf)}:{' '}
                    {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Asia/Tehran',
                    }).format(new Date(actionResult.snapshot.generatedAt))}
                  </time>
                </p>
                <p className={styles.composerHint}>{t(c.dailyCoverage)}</p>
                {actionResult.snapshot.sources.some(
                  (source) => source.status === 'READY',
                ) && (
                  <dl className={styles.actionCounts}>
                    {[
                      [c.visibleCount, actionResult.counts.visible],
                      [c.overdueCount, actionResult.counts.overdue],
                      [c.dueSoonCount, actionResult.counts.dueSoon],
                      [c.assignedCount, actionResult.counts.assigned],
                    ].map(([label, count]) => (
                      <div key={(label as AssistantText)[1]}>
                        <dt>{t(label as AssistantText)}</dt>
                        <dd>
                          {new Intl.NumberFormat(
                            english ? 'en-GB' : 'fa-IR',
                          ).format(count as number)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <PersonalFollowUps
                  t={t}
                  snapshot={actionResult.snapshot}
                  english={english}
                />
                {actionResult.corporate && (
                  <section>
                    <h3>
                      {t(
                        actionResult.version === 2
                          ? c.salesAnalysis
                          : c.weeklySales,
                      )}
                    </h3>
                    <p className={styles.composerHint}>{t(c.salesCoverage)}</p>
                    {actionResult.corporate.sales.status === 'READY' ? (
                      <>
                        <p className={styles.composerHint}>
                          {t(
                            actionResult.version === 2
                              ? c.filteredPeriod
                              : c.currentPeriod,
                          )}
                          :{' '}
                          {
                            actionResult.corporate.sales.report.current
                              .contractCount
                          }{' '}
                          /{' '}
                          {t(
                            actionResult.version === 2
                              ? c.filteredPrevious
                              : c.previousPeriod,
                          )}
                          :{' '}
                          {
                            actionResult.corporate.sales.report.previous
                              .contractCount
                          }
                        </p>
                        {[
                          [
                            'current',
                            actionResult.version === 2
                              ? c.filteredPeriod
                              : c.currentPeriod,
                          ],
                          [
                            'previous',
                            actionResult.version === 2
                              ? c.filteredPrevious
                              : c.previousPeriod,
                          ],
                        ].map(([key, label]) => {
                          const sales = actionResult.corporate!.sales;
                          if (sales.status !== 'READY') return null;
                          const period =
                            sales.report[key as 'current' | 'previous'];
                          const format = new Intl.DateTimeFormat(
                            english ? 'en-GB' : 'fa-IR',
                            { timeZone: 'Asia/Tehran', dateStyle: 'short' },
                          );
                          return (
                            <p
                              className={styles.composerHint}
                              key={key as string}
                            >
                              {t(label as AssistantText)}:{' '}
                              <time dateTime={period.startUtc}>
                                {format.format(new Date(period.startUtc))}
                              </time>{' '}
                              —{' '}
                              <time dateTime={period.endUtc}>
                                {format.format(
                                  new Date(Date.parse(period.endUtc) - 1),
                                )}
                              </time>
                            </p>
                          );
                        })}
                        <SourceUpdated
                          value={
                            actionResult.corporate.sales.report.sourceUpdatedAt
                          }
                          english={english}
                          t={t}
                        />
                        {[
                          ...new Set([
                            ...(
                              actionResult.corporate.sales.report.current
                                .contractAmountsBeforeRefunds ?? []
                            ).map((row) => row.currencyCode),
                            ...(
                              actionResult.corporate.sales.report.previous
                                .contractAmountsBeforeRefunds ?? []
                            ).map((row) => row.currencyCode),
                          ]),
                        ]
                          .sort()
                          .map((currency) => {
                            const report = actionResult.corporate!.sales;
                            if (report.status !== 'READY') return null;
                            const current =
                              report.report.current
                                .contractAmountsBeforeRefunds;
                            const previous =
                              report.report.previous
                                .contractAmountsBeforeRefunds;
                            return (
                              <p className={styles.composerHint} key={currency}>
                                {t(c.contractAmount)} —{' '}
                                {t(
                                  actionResult.version === 2
                                    ? c.filteredPeriod
                                    : c.currentPeriod,
                                )}
                                :{' '}
                                <bdi>
                                  {current
                                    ? (current.find(
                                        (row) => row.currencyCode === currency,
                                      )?.amount ?? '0')
                                    : '—'}{' '}
                                  {currency}
                                </bdi>
                                {' / '}
                                {t(
                                  actionResult.version === 2
                                    ? c.filteredPrevious
                                    : c.previousPeriod,
                                )}
                                :{' '}
                                <bdi>
                                  {previous
                                    ? (previous.find(
                                        (row) => row.currencyCode === currency,
                                      )?.amount ?? '0')
                                    : '—'}{' '}
                                  {currency}
                                </bdi>
                              </p>
                            );
                          })}
                      </>
                    ) : (
                      <p className={styles.composerHint}>
                        {t(
                          actionResult.corporate.sales.status === 'DENIED'
                            ? c.states.forbidden
                            : c.salesDefinitionGate,
                        )}
                      </p>
                    )}
                    <h3>{t(c.contractBalances)}</h3>
                    <p className={styles.composerHint}>
                      {t(c.balanceRecommendationsDeferred)}
                    </p>
                    <p className={styles.composerHint}>
                      {t(c.balanceLimitations)}
                    </p>
                    {actionResult.corporate.balances.status === 'READY' && (
                      <SourceUpdated
                        value={
                          actionResult.corporate.balances.report.sourceUpdatedAt
                        }
                        english={english}
                        t={t}
                      />
                    )}
                    {actionResult.corporate.balances.status === 'READY' ? (
                      actionResult.corporate.balances.report.totals.map(
                        (balance) => (
                          <p
                            className={styles.composerHint}
                            key={balance.currencyCode}
                          >
                            {t(c.outstandingBalance)}:{' '}
                            <bdi>
                              {balance.outstanding}{' '}
                              {currencySymbol(balance.currencyCode ?? '')}
                            </bdi>
                          </p>
                        ),
                      )
                    ) : (
                      <p className={styles.composerHint}>
                        {t(
                          actionResult.corporate.balances.status === 'DENIED'
                            ? c.states.forbidden
                            : c.receivablesSourceGate,
                        )}
                      </p>
                    )}
                  </section>
                )}
              </div>
            )}
            {!denied &&
              actionResult?.action === 'receivables-follow-up' &&
              actionResult.status === 'PARTIAL' && (
                <div className={styles.actionResult}>
                  <h2>{t(c.contractBalances)}</h2>
                  <SourceUpdated
                    value={actionResult.report.sourceUpdatedAt}
                    english={english}
                    t={t}
                  />
                  <p className={styles.composerHint}>
                    {t(c.balanceLimitations)}
                  </p>
                  <p className={styles.composerHint}>
                    {t(c.asOf)}:{' '}
                    <time dateTime={actionResult.report.observedAt}>
                      {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Asia/Tehran',
                      }).format(new Date(actionResult.report.observedAt))}
                    </time>
                  </p>
                  {actionResult.report.totals.map((balance) => (
                    <dl
                      className={styles.actionCounts}
                      key={balance.currencyCode}
                    >
                      {[
                        [c.contractAmount, balance.amount],
                        [c.confirmedReceipts, balance.confirmedPaid],
                        [c.pendingReceipts, balance.pendingFinance],
                        [c.outstandingBalance, balance.outstanding],
                      ].map(([label, amount]) => (
                        <div key={(label as AssistantText)[1]}>
                          <dt>{t(label as AssistantText)}</dt>
                          <dd>
                            <bdi>
                              {amount as string}{' '}
                              {currencySymbol(balance.currencyCode ?? '')}
                            </bdi>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ))}
                  {actionResult.report.coverage.itemsTruncated && (
                    <p className={styles.composerHint}>
                      {t(c.partialBalanceList)}
                    </p>
                  )}
                  {actionResult.report.items.map((item) => (
                    <p className={styles.composerHint} key={item.contractId}>
                      <bdi>{item.contractNumber}</bdi>:{' '}
                      {item.balances.map((balance) => (
                        <bdi key={balance.currencyCode}>
                          {' '}
                          {balance.outstanding}{' '}
                          {currencySymbol(balance.currencyCode ?? '')}{' '}
                        </bdi>
                      ))}{' '}
                      <Link href={item.href}>{t(c.reviewContract)}</Link>
                    </p>
                  ))}
                </div>
              )}
            {!denied &&
              actionResult?.action === 'sales-analysis' &&
              actionResult.status === 'PARTIAL' && (
                <div className={styles.actionResult}>
                  <h2>
                    {t(
                      actionResult.version === 2
                        ? c.salesAnalysis
                        : c.weeklySales,
                    )}
                  </h2>
                  <p className={styles.composerHint}>{t(c.salesCoverage)}</p>
                  <p className={styles.composerHint}>
                    {t(c.asOf)}:{' '}
                    <time dateTime={actionResult.report.observedAt}>
                      {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Asia/Tehran',
                      }).format(new Date(actionResult.report.observedAt))}
                    </time>
                  </p>
                  <p className={styles.composerHint}>{t(c.salesMissing)}</p>
                  <SourceUpdated
                    value={actionResult.report.sourceUpdatedAt}
                    english={english}
                    t={t}
                  />
                  {actionResult.conversion?.status === 'READY' ? (
                    <section>
                      <h3>{t(c.callConversion)}</h3>
                      <p className={styles.composerHint}>{t(c.callCoverage)}</p>
                      <SourceUpdated
                        value={actionResult.conversion.report.sourceUpdatedAt}
                        english={english}
                        t={t}
                      />
                      {[
                        actionResult.conversion.report.current,
                        actionResult.conversion.report.previous,
                      ].map((period, index) => (
                        <p
                          className={styles.composerHint}
                          key={period.startUtc}
                        >
                          {t(
                            index === 0
                              ? actionResult.version === 2
                                ? c.filteredPeriod
                                : c.currentPeriod
                              : actionResult.version === 2
                                ? c.filteredPrevious
                                : c.previousPeriod,
                          )}
                          : {t(c.contactedLeads)} {period.contactedLeads} /{' '}
                          {t(c.convertedLeads)} {period.convertedLeads} —{' '}
                          <bdi>
                            {period.conversionBasisPoints === null
                              ? '—'
                              : `${period.conversionBasisPoints / 100}%`}
                          </bdi>
                        </p>
                      ))}
                    </section>
                  ) : (
                    <p className={styles.composerHint}>
                      {t(c.noConversionEvidence)}
                    </p>
                  )}
                  {!actionResult.report.routeNamesComplete && (
                    <p className={styles.composerHint}>
                      {t(c.missingCityNames)}
                    </p>
                  )}
                  {[
                    [
                      actionResult.version === 2
                        ? c.filteredPeriod
                        : c.currentPeriod,
                      actionResult.report.current,
                    ],
                    [
                      actionResult.version === 2
                        ? c.filteredPrevious
                        : c.previousPeriod,
                      actionResult.report.previous,
                    ],
                  ].map(([label, period]) => {
                    const value = period as typeof actionResult.report.current;
                    return (
                      <div key={(label as AssistantText)[1]}>
                        <h3>{t(label as AssistantText)}</h3>
                        <p className={styles.composerHint}>
                          {new Intl.DateTimeFormat(
                            english ? 'en-GB' : 'fa-IR',
                            {
                              timeZone: 'Asia/Tehran',
                            },
                          ).format(new Date(value.startUtc))}{' '}
                          —{' '}
                          {new Intl.DateTimeFormat(
                            english ? 'en-GB' : 'fa-IR',
                            {
                              timeZone: 'Asia/Tehran',
                            },
                          ).format(
                            new Date(new Date(value.endUtc).getTime() - 1),
                          )}
                        </p>
                        <dl className={styles.actionCounts}>
                          <div>
                            <dt>{t(c.contractsCount)}</dt>
                            <dd>
                              {new Intl.NumberFormat(
                                english ? 'en-GB' : 'fa-IR',
                              ).format(value.contractCount)}
                            </dd>
                          </div>
                          <div>
                            <dt>{t(c.passengersCount)}</dt>
                            <dd>
                              {new Intl.NumberFormat(
                                english ? 'en-GB' : 'fa-IR',
                              ).format(value.passengerCount)}
                            </dd>
                          </div>
                        </dl>
                        {value.contractAmountsBeforeRefunds?.map((amount) => (
                          <p
                            className={styles.composerHint}
                            key={amount.currencyCode}
                          >
                            {t(c.contractAmount)}:{' '}
                            <bdi>
                              {amount.amount}{' '}
                              {currencySymbol(amount.currencyCode ?? '')}
                            </bdi>
                          </p>
                        ))}
                        {value.routes.map((route) => (
                          <p
                            className={styles.composerHint}
                            key={`${route.originId}:${route.destinationId}`}
                          >
                            {t(c.primaryRoute)}:{' '}
                            <bdi>
                              {route.originName ?? t(c.unknown)} →{' '}
                              {route.destinationName ?? t(c.unknown)}
                            </bdi>{' '}
                            — {t(c.contractsCount)}: {route.contractCount} —{' '}
                            {t(c.passengersCount)}: {route.passengerCount}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
        {!denied && showLatest && (
          <button
            type="button"
            className={styles.chatLatest}
            onClick={() => scrollToLatest(true)}
            aria-label={t(c.chatLatest)}
            title={t(c.chatLatest)}
          >
            <ArrowDown size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
export function PersonalFollowUps({
  t,
  snapshot,
  english,
}: {
  t: Translate;
  snapshot: ExecutiveSnapshot | null;
  english: boolean;
}) {
  const partial = snapshot?.sources.some((source) => source.status !== 'READY');
  const renderItem = (item: ExecutiveSnapshot['followUps'][number]) => {
    const rule = explainPersonal(item, snapshot!.generatedAt);
    const observedAt = snapshot!.sources.find(
      (source) => source.id === item.source && source.status === 'READY',
    )?.asOf;
    if (!observedAt) return null;
    return (
      <article key={item.id} className={styles.followUp}>
        <span
          className={rule.priority === 'HIGH' ? styles.overdue : styles.due}
        >
          {t(c.priorities[rule.priority])} · {t(c.reasons[item.reason])}
        </span>
        <strong>{item.title}</strong>
        <p className={styles.footnote}>{t(c.ruleReasons[rule.reason])}</p>
        {item.sourcePriority && (
          <p className={styles.footnote}>
            {t(c.recordedPriority)}:{' '}
            {t(c.sourcePriorities[item.sourcePriority])}
          </p>
        )}
        <div className={styles.followMeta}>
          <span>{t(c.sourceNames[item.source])}</span>
          {item.dueAt && (
            <time dateTime={item.dueAt}>
              {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                timeZone: 'Asia/Tehran',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(item.dueAt))}
            </time>
          )}
        </div>
        <p className={styles.footnote}>
          {t(c.asOf)}:{' '}
          <time dateTime={observedAt}>
            {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
              timeZone: 'Asia/Tehran',
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(observedAt))}
          </time>
        </p>
        <p className={styles.footnote}>
          {t(c.ruleLabel)}: <bdi>PERSONAL_DUE_V2</bdi>
        </p>
        <Link href={item.href} className={styles.sourceLink}>
          {t(c.openSource)}
          <ArrowUpLeft size={14} aria-hidden="true" />
        </Link>
      </article>
    );
  };
  const eligible =
    snapshot?.followUps.filter((item) =>
      snapshot.sources.some(
        (source) =>
          source.id === item.source && source.status === 'READY' && source.asOf,
      ),
    ) ?? [];
  return (
    <Panel title={t(c.recommendationTitle)} icon={CalendarClock}>
      <p className={styles.footnote}>{t(c.personalScope)}</p>
      {partial && (
        <p className={styles.inlineNotice} role="status">
          {t(c.partial)}
        </p>
      )}
      {snapshot?.truncated && (
        <p className={styles.inlineNotice}>{t(c.limited)}</p>
      )}
      {eligible.length ? (
        <>
          <div className={styles.followUps}>
            {eligible.slice(0, 5).map(renderItem)}
          </div>
          {eligible.length > 5 && (
            <details className={styles.recommendationDetails}>
              <summary>
                {t(c.allRecommendations)} ({eligible.length})
              </summary>
              <div className={styles.followUps}>
                {eligible.slice(5).map(renderItem)}
              </div>
            </details>
          )}
        </>
      ) : (
        <Empty
          compact
          text={t(
            !snapshot
              ? c.pendingPersonal
              : partial
                ? c.partial
                : c.emptyPersonal,
          )}
          icon={ListChecks}
        />
      )}
    </Panel>
  );
}
function Scenarios({ t }: { t: Translate }) {
  const [values, setValues] = useState([0, 0, 0, 0]);
  return (
    <>
      <div className={styles.scenarioGrid}>
        <Panel title={t(c.blocks.variables)} icon={SlidersHorizontal}>
          <p className={styles.footnote}>{t(c.assumptionsHint)}</p>
          <div className={styles.sliders}>
            {[c.fx, c.ads, c.demand, c.cost].map((label, index) => (
              <label key={label[1]}>
                <span>
                  {t(label)}
                  <output dir="ltr">
                    {values[index]! > 0 ? '+' : ''}
                    {values[index]}%
                  </output>
                </span>
                <input
                  type="range"
                  aria-label={t(label)}
                  aria-valuetext={`${values[index]}%`}
                  min={-50}
                  max={50}
                  step={1}
                  value={values[index]}
                  onChange={(event) =>
                    setValues((current) =>
                      current.map((value, position) =>
                        position === index ? Number(event.target.value) : value,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setValues([0, 0, 0, 0])}
          >
            {t(c.reset)}
          </Button>
        </Panel>
        <Panel title={t(c.blocks.comparison)} icon={BarChart3}>
          <div className={styles.scenarioColumns}>
            {[c.pessimistic, c.baseline, c.optimistic].map((label) => (
              <div key={label[1]}>
                <span className={styles.scenarioGhost} aria-hidden="true">
                  —
                </span>
                <strong>{t(label)}</strong>
                <small>{t(c.noEstimate)}</small>
              </div>
            ))}
          </div>
          <p className={styles.footnote}>{t(c.scenarioGate)}</p>
          <div className={styles.actionRow}>
            <Button disabled title={t(c.scenarioGate)}>
              {t(c.calculate)}
            </Button>
            <Button variant="outline" disabled title={t(c.scenarioGate)}>
              {t(c.save)}
            </Button>
          </div>
        </Panel>
        <Panel title={t(c.blocks.result)} icon={FileText}>
          <Rows items={c.rows.result} t={t} note={t(c.estimateGate)} />
        </Panel>
      </div>
      <div className={styles.threeColumns}>
        <Panel title={t(c.blocks.companies)} icon={BarChart3}>
          <Rows items={c.rows.companies} t={t} bars note={t(c.companyGate)} />
        </Panel>
        <Panel title={t(c.blocks.sensitivity)} icon={SlidersHorizontal}>
          <Empty text={t(c.scenarioGate)} />
        </Panel>
        <Panel title={t(c.blocks.history)} icon={Clock3}>
          <Empty text={t(c.noDecision)} />
        </Panel>
      </div>
    </>
  );
}
function ViewContent({
  view,
  t,
  snapshot,
  english,
}: {
  view: AssistantView;
  t: Translate;
  snapshot: ExecutiveSnapshot | null;
  english: boolean;
}) {
  if (view === 'scenarios') return <Scenarios t={t} />;
  if (view === 'advisor')
    return (
      <>
        <div className={styles.twoColumns}>
          <Panel title={t(c.blocks.daily)} icon={Sparkles}>
            <div className={styles.briefRows}>
              {c.rows.daily.map((row, index) => {
                const Icon = [TrendingUp, FileText, BellRing, Lightbulb][
                  index
                ]!;
                return (
                  <div key={row[1]}>
                    <Icon size={21} aria-hidden="true" />
                    <div>
                      <strong>{t(row)}</strong>
                      <p>{t(c.noData)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title={t(c.blocks.actions)} icon={ListChecks}>
            <Empty text={t(c.noAdvice)} icon={Lightbulb} />
          </Panel>
        </div>
        <div className={styles.threeColumns}>
          <Panel title={t(c.blocks.priorities)} icon={Flag}>
            <Rows items={c.rows.priorities} t={t} />
          </Panel>
          <Panel title={t(c.blocks.decisions)} icon={Clock3}>
            <Empty compact text={t(c.noDecision)} />
          </Panel>
          <Panel title={t(c.blocks.reasons)} icon={BarChart3}>
            <Rows items={c.rows.reasons} t={t} bars note={t(c.modelGate)} />
          </Panel>
        </div>
        <PersonalFollowUps t={t} snapshot={snapshot} english={english} />
      </>
    );
  if (view === 'news')
    return (
      <>
        <div className={styles.newsGrid}>
          <Panel title={t(c.blocks.news)} icon={Newspaper}>
            <Empty text={t(c.noNews)} icon={Newspaper} />
            <p className={styles.footnote}>{t(c.newsGate)}</p>
          </Panel>
          <Panel title={t(c.blocks.impact)} icon={BarChart3}>
            <Rows items={c.rows.impact} t={t} note={t(c.estimateGate)} />
          </Panel>
          <Panel title={t(c.blocks.risks)} icon={ShieldCheck}>
            <Rows items={c.rows.risks} t={t} />
          </Panel>
        </div>
        <div className={styles.twoColumns}>
          <Panel title={t(c.blocks.actions)} icon={Lightbulb}>
            <Empty compact text={t(c.noAdvice)} />
          </Panel>
          <Panel title={t(c.blocks.riskMap)} icon={Target}>
            <div className={styles.riskMap}>
              <div aria-hidden="true" />
              <p>{t(c.noEstimate)}</p>
            </div>
            <p className={styles.footnote}>{t(c.estimateGate)}</p>
          </Panel>
        </div>
      </>
    );
  if (view === 'finance')
    return (
      <>
        <div className={styles.wideGrid}>
          <Trend title={t(c.blocks.cashTrend)} t={t} finance />
          <Panel title={t(c.blocks.obligations)} icon={CircleDollarSign}>
            <div className={styles.emptyRing} aria-label={t(c.unknown)}>
              <span>—</span>
            </div>
            <Rows items={c.rows.obligations} t={t} />
          </Panel>
        </div>
        <div className={styles.threeColumns}>
          <Panel title={t(c.blocks.balances)} icon={BarChart3}>
            <Rows items={c.rows.balances} t={t} bars note={t(c.financeGate)} />
          </Panel>
          <Panel title={t(c.blocks.alerts)} icon={BellRing}>
            <Rows items={c.rows.financeAlerts} t={t} note={t(c.estimateGate)} />
          </Panel>
          <Panel title={t(c.blocks.actions)} icon={Lightbulb}>
            <Rows items={c.rows.financeActions} t={t} note={t(c.noAdvice)} />
          </Panel>
        </div>
      </>
    );
  if (view === 'sales')
    return (
      <>
        <div className={styles.wideGrid}>
          <Trend title={t(c.blocks.salesTrend)} t={t} />
          <Panel title={t(c.blocks.destinations)} icon={MapPin}>
            <Empty text={t(c.noData)} icon={MapPin} />
          </Panel>
        </div>
        <div className={styles.threeColumns}>
          <Panel title={t(c.blocks.funnel)} icon={Target}>
            <Rows items={c.rows.funnel} t={t} bars note={t(c.notZero)} />
          </Panel>
          <Panel title={t(c.blocks.products)} icon={BookOpen}>
            <Empty text={t(c.noAdvice)} icon={BookOpen} />
          </Panel>
          <Panel title={t(c.blocks.salesSummary)} icon={FileText}>
            <Rows items={c.rows.salesSummary} t={t} note={t(c.estimateGate)} />
          </Panel>
        </div>
      </>
    );
  return (
    <>
      <div className={styles.wideGrid}>
        <Trend title={t(c.blocks.trend)} t={t} />
        <Panel title={t(c.blocks.summary)} icon={Sparkles}>
          <div className={styles.summaryVisual}>
            <Sparkles size={28} aria-hidden="true" />
            <h3>{t(c.noData)}</h3>
            <p>{t(c.estimateGate)}</p>
          </div>
        </Panel>
      </div>
      <div className={styles.threeColumns}>
        <Panel title={t(c.blocks.news)} icon={Newspaper}>
          <Empty compact text={t(c.noNews)} icon={Newspaper} />
        </Panel>
        <Panel title={t(c.blocks.factors)} icon={BarChart3}>
          <Rows items={c.rows.factors} t={t} bars note={t(c.modelGate)} />
        </Panel>
        <Panel title={t(c.blocks.immediate)} icon={Lightbulb}>
          <Empty compact text={t(c.noAdvice)} icon={Lightbulb} />
        </Panel>
      </div>
    </>
  );
}

export function ExecutivePanels({
  view,
  english = false,
  state = 'not-configured',
  snapshot = null,
  onRefresh,
  embedded = false,
}: {
  embedded?: boolean;
  view: AssistantView;
  english?: boolean;
  state?: AssistantLoadState;
  snapshot?: ExecutiveSnapshot | null;
  onRefresh?: () => void;
}) {
  const t: Translate = (text) => text[english ? 1 : 0];
  const screen = c.views[view];
  const Icon = viewIcons[view];
  const denied = state === 'forbidden' || state === 'unauthenticated';
  return (
    <div className={styles.workspace} dir={english ? 'ltr' : 'rtl'}>
      {!embedded && (
        <nav className={styles.tabs} aria-label={t(c.title)}>
          {assistantViews.map((id) => {
            const TabIcon = viewIcons[id];
            return (
              <Link
                key={id}
                href={assistantDashboardHref(id)}
                aria-current={id === view ? 'page' : undefined}
                className={id === view ? styles.activeTab : ''}
              >
                <TabIcon size={17} aria-hidden="true" />
                <span>{t(c.views[id].label)}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <div className={styles.serviceStatus} role="status">
        <span
          className={
            state === 'ready' &&
            snapshot?.sources.every((source) => source.status === 'READY')
              ? styles.readyDot
              : styles.pendingDot
          }
        />
        <span>
          {t(
            state === 'ready' &&
              snapshot?.sources.some((source) => source.status !== 'READY')
              ? c.partial
              : c.states[state],
          )}
        </span>
        {snapshot && !denied && (
          <time dateTime={snapshot.generatedAt}>
            {t(c.asOf)}:{' '}
            {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
              timeZone: 'Asia/Tehran',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(snapshot.generatedAt))}
          </time>
        )}
      </div>
      {denied ? (
        <div className={styles.panel}>
          <Empty text={t(c.noPersonalAccess)} icon={ShieldCheck} />
          {state === 'unauthenticated' && (
            <Link href="/login" className={styles.sourceLink}>
              {t(c.returnLogin)}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionIcon}>
                <Icon size={23} aria-hidden="true" />
              </span>
              <div>
                <h2>{t(screen.title)}</h2>
                <p>{t(screen.description)}</p>
              </div>
            </div>
            <div className={styles.sectionActions}>
              <Button
                variant="outline"
                size="sm"
                disabled
                title={t(c.reportUnavailable)}
              >
                <FileText size={15} aria-hidden="true" />
                {t(c.report)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={state === 'loading'}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {t(c.refresh)}
              </Button>
            </div>
          </div>
          <div className={styles.metrics}>
            {screen.metrics.map((metric, index) => {
              const MetricIcon = metricIcons[view][index]!;
              return (
                <article
                  key={metric[1]}
                  className={styles.metric}
                  data-tone={index}
                >
                  <div>
                    <p>{t(metric)}</p>
                    <strong aria-label={t(c.unknown)}>—</strong>
                    <small>{t(c.noEstimate)}</small>
                  </div>
                  <span className={styles.metricIcon}>
                    <MetricIcon size={23} aria-hidden="true" />
                  </span>
                </article>
              );
            })}
          </div>
          <ViewContent
            view={view}
            t={t}
            snapshot={snapshot}
            english={english}
          />
          <footer className={styles.integrityNote}>
            <Info size={17} aria-hidden="true" />
            <p>{t(c.liveGate)}</p>
          </footer>
        </>
      )}
    </div>
  );
}

export function ExecutiveWorkspace({
  view,
  embedded = false,
}: {
  view: AssistantView;
  embedded?: boolean;
}) {
  const { language } = useSystemPreferences();
  const permissions = useAccessPermissions();
  const allowed = Array.isArray(permissions);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    state: AssistantLoadState;
    snapshot: ExecutiveSnapshot | null;
  }>({ state: 'loading', snapshot: null });
  useEffect(() => {
    const controller = new AbortController();
    if (!allowed) return () => controller.abort();
    let active = true;
    void loadExecutiveSnapshot(controller.signal)
      .then((next) => {
        if (active) setResult(next);
      })
      .catch(() => {
        if (active && !controller.signal.aborted)
          setResult({ state: 'unavailable', snapshot: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [allowed, reload]);
  const refresh = useCallback(() => {
    setResult({ state: 'loading', snapshot: null });
    setReload((value) => value + 1);
  }, []);
  return (
    <ExecutivePanels
      embedded={embedded}
      view={view}
      english={language === 'en'}
      state={allowed ? result.state : 'forbidden'}
      snapshot={allowed ? result.snapshot : null}
      onRefresh={refresh}
    />
  );
}
