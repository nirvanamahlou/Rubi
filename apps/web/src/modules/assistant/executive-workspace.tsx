'use client';

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

type Translate = (text: AssistantText) => string;
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
export function AssistantComposer({
  t,
  denied,
  english = false,
}: {
  t: Translate;
  denied: boolean;
  english?: boolean;
}) {
  const inputId = useId();
  const helpId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [actionResult, setActionResult] =
    useState<AssistantActionResult | null>(null);
  const [actionState, setActionState] = useState<AssistantLoadState | null>(
    null,
  );
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
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
    setNotSubmitted(false);
    setActionState('loading');
    try {
      const result = await loadAssistantAction(action, controller.signal);
      if (!controller.signal.aborted) {
        setActionResult(result);
        setActionState(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : '';
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
  const submit = () => {
    if (denied || !draft.trim()) return;
    const match = prompts.find(([label]) =>
      label.some((text) => text === draft.trim()),
    );
    // User text is never transmitted; dispatch only an exact fixed capability.
    if (match) void run(match[1]);
    else {
      pending.current?.abort();
      setActionResult(null);
      setActionState(null);
      setNotSubmitted(true);
    }
  };
  return (
    <section className={styles.composer} aria-labelledby={inputId + '-title'}>
      <h1 id={inputId + '-title'}>{t(c.composerTitle)}</h1>
      <form
        className={styles.composerForm}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          id={inputId}
          ref={input}
          aria-label={t(c.composerTitle)}
          aria-describedby={helpId}
          placeholder={t(c.composerPlaceholder)}
          className={styles.composerInput}
          rows={2}
          maxLength={4000}
          value={draft}
          disabled={denied}
          onChange={(event) => {
            pending.current?.abort();
            setActionResult(null);
            setActionState(null);
            setDraft(event.target.value);
            setNotSubmitted(false);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
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
            disabled={denied || !draft.trim()}
            aria-label={t(c.send)}
            title={t(c.fixedActions)}
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
            disabled={denied}
            onClick={() => {
              setDraft(t(prompt));
              setNotSubmitted(false);
              input.current?.focus();
              void run(action);
            }}
          >
            {t(prompt)}
          </button>
        ))}
      </div>
      <div className={styles.composerFooter}>
        <p id={helpId} className={styles.composerHint} role="status">
          {t(notSubmitted ? c.messageNotSubmitted : c.fixedActions)}
        </p>
      </div>
      {!denied && actionState && (
        <p role="status" className={styles.composerHint}>
          {t(c.states[actionState])}
        </p>
      )}
      {!denied && actionResult?.status === 'BLOCKED' && (
        <p role="status" className={styles.composerHint}>
          {t(
            actionResult.reason === 'SALES_DEFINITION_REQUIRED'
              ? c.salesDefinitionGate
              : c.receivablesSourceGate,
          )}
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
                    {new Intl.NumberFormat(english ? 'en-GB' : 'fa-IR').format(
                      count as number,
                    )}
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
        </div>
      )}
    </section>
  );
}
function PersonalFollowUps({
  t,
  snapshot,
  english,
}: {
  t: Translate;
  snapshot: ExecutiveSnapshot | null;
  english: boolean;
}) {
  const partial = snapshot?.sources.some((source) => source.status !== 'READY');
  return (
    <Panel title={t(c.personal)} icon={CalendarClock}>
      <p className={styles.footnote}>{t(c.personalScope)}</p>
      {partial && (
        <p className={styles.inlineNotice} role="status">
          {t(c.partial)}
        </p>
      )}
      {snapshot?.truncated && (
        <p className={styles.inlineNotice}>{t(c.limited)}</p>
      )}
      {snapshot?.followUps.length ? (
        <div className={styles.followUps}>
          {snapshot.followUps.map((item) => (
            <article key={item.id} className={styles.followUp}>
              <span
                className={
                  item.reason === 'OVERDUE' ? styles.overdue : styles.due
                }
              >
                {t(c.reasons[item.reason])}
              </span>
              <strong>{item.title}</strong>
              <div className={styles.followMeta}>
                <span>{t(c.sourceNames[item.source])}</span>
                {item.dueAt && (
                  <time dateTime={item.dueAt}>
                    {new Intl.DateTimeFormat(english ? 'en-GB' : 'fa-IR', {
                      timeZone: 'Asia/Tehran',
                      month: 'short',
                      day: 'numeric',
                    }).format(new Date(item.dueAt))}
                  </time>
                )}
              </div>
              <Link href={item.href} className={styles.sourceLink}>
                {t(c.openSource)}
                <ArrowUpLeft size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
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
}: {
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
      <AssistantComposer
        key={denied ? 'denied' : 'active'}
        t={t}
        denied={denied}
        english={english}
      />
      <nav className={styles.tabs} aria-label={t(c.title)}>
        {assistantViews.map((id) => {
          const TabIcon = viewIcons[id];
          return (
            <Link
              key={id}
              href={`/assistant?view=${id}`}
              aria-current={id === view ? 'page' : undefined}
              className={id === view ? styles.activeTab : ''}
            >
              <TabIcon size={17} aria-hidden="true" />
              <span>{t(c.views[id].label)}</span>
            </Link>
          );
        })}
      </nav>
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

export function ExecutiveWorkspace({ view }: { view: AssistantView }) {
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
      view={view}
      english={language === 'en'}
      state={allowed ? result.state : 'forbidden'}
      snapshot={allowed ? result.snapshot : null}
      onRefresh={refresh}
    />
  );
}
