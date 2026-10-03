'use client';

import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers3,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import * as SelectPrimitive from '@radix-ui/react-select';
import Image from 'next/image';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  LegalEntityContext,
  LegalEntitySelection,
  LegalEntitySummary,
} from '@nora/contracts';

import { Button } from '@/components/ui/button';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import { Badge } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { legalEntitiesApi } from '../api/client';
import {
  legalEntityChoices,
  legalEntitySelectionLabel,
} from '../model/context';

interface ContextValue {
  entities: LegalEntitySummary[];
  context: LegalEntityContext | null;
  canAggregate: boolean;
  loading: boolean;
  switching: boolean;
  error: string | null;
  feedback: string | null;
  reload(): Promise<void>;
  switchTo(selection: LegalEntitySelection): Promise<void>;
}

const LegalEntityContextState = createContext<ContextValue | null>(null);
const channelName = 'nora:legal-entity-context:v1';

export function LegalEntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<LegalEntitySummary[]>([]);
  const [context, setContext] = useState<LegalEntityContext | null>(null);
  const [canAggregate, setCanAggregate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [options, current] = await Promise.all([
        legalEntitiesApi.selectable(),
        legalEntitiesApi.current(),
      ]);
      setEntities(options.data);
      setCanAggregate(options.meta.canAggregate);
      setContext(current.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت شرکت فعال ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(channelName);
    const sync = () => void reload();
    channel?.addEventListener('message', sync);
    const storage = (event: StorageEvent) => {
      if (event.key === channelName) sync();
    };
    window.addEventListener('storage', storage);
    return () => {
      channel?.removeEventListener('message', sync);
      channel?.close();
      window.removeEventListener('storage', storage);
    };
  }, [reload]);

  const switchTo = useCallback(
    async (selection: LegalEntitySelection) => {
      setSwitching(true);
      setError(null);
      setFeedback(null);
      try {
        if (!context) throw new Error('Context شرکت هنوز بارگذاری نشده است.');
        const response = await legalEntitiesApi.switch(
          selection,
          context.version,
        );
        setContext(response.data);
        setFeedback('شرکت فعال با موفقیت تغییر کرد.');
        const channel =
          typeof BroadcastChannel === 'undefined'
            ? null
            : new BroadcastChannel(channelName);
        channel?.postMessage({ changedAt: Date.now() });
        channel?.close();
        localStorage.setItem(channelName, String(Date.now()));
        window.setTimeout(() => setFeedback(null), 2500);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'تغییر شرکت فعال ناموفق بود.',
        );
      } finally {
        setSwitching(false);
      }
    },
    [context],
  );

  const value = useMemo(
    () => ({
      entities,
      context,
      canAggregate,
      loading,
      switching,
      error,
      feedback,
      reload,
      switchTo,
    }),
    [
      entities,
      context,
      canAggregate,
      loading,
      switching,
      error,
      feedback,
      reload,
      switchTo,
    ],
  );
  return (
    <LegalEntityContextState.Provider value={value}>
      {children}
    </LegalEntityContextState.Provider>
  );
}

export function useLegalEntityContext() {
  const value = useContext(LegalEntityContextState);
  if (!value) throw new Error('LegalEntityProvider is required.');
  return value;
}

function IssuerMark({
  selection,
}: {
  selection: LegalEntitySelection | undefined;
}) {
  if (selection === 'NIYAYESH_SEIR_SAHAR')
    return (
      <Image
        alt=""
        aria-hidden="true"
        className="size-6 rounded-md bg-white object-contain p-0.5"
        height={24}
        src="/brand/niyayesh.png"
        width={24}
      />
    );
  if (selection === 'ALL')
    return <Layers3 aria-hidden="true" className="size-4 text-violet-600" />;
  return <Building2 aria-hidden="true" className="size-4 text-primary" />;
}

export function LegalEntityContextSelector() {
  const { language } = useSystemPreferences();
  const english = language === 'en';
  const state = useLegalEntityContext();
  const choices = legalEntityChoices(state.entities, state.canAggregate);
  const selection = state.context?.selection;
  const headerAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerAnchor.current?.closest('header');
    if (!header) return;
    if (selection) header.dataset.noraActiveCompany = selection;
    else delete header.dataset.noraActiveCompany;
    return () => {
      if (header.dataset.noraActiveCompany === selection)
        delete header.dataset.noraActiveCompany;
    };
  }, [selection]);

  let selector: ReactNode;
  if (state.loading) {
    selector = (
      <div
        aria-label={
          english ? 'Loading active company' : 'در حال دریافت شرکت فعال'
        }
        className="flex h-11 min-w-36 items-center gap-2 rounded-xl bg-muted/70 px-3 text-xs text-muted-foreground"
      >
        <LoaderCircle className="size-4 animate-spin" />
        {english ? 'Active company' : 'شرکت فعال'}
      </div>
    );
  } else if (state.error && !state.context) {
    selector = (
      <Button
        aria-label={
          english
            ? 'Retry loading the active company'
            : 'تلاش دوباره برای دریافت شرکت فعال'
        }
        onClick={() => void state.reload()}
        size="sm"
        variant="outline"
      >
        <AlertCircle className="size-4 text-destructive" />
        {english ? 'Active company' : 'شرکت فعال'}
        <RefreshCw className="size-3" />
      </Button>
    );
  } else {
    selector = (
      <div
        className="relative min-w-0 max-w-[210px] sm:min-w-52"
        data-legal-entity-selector
      >
        <SelectPrimitive.Root
          disabled={state.switching}
          onValueChange={(value) =>
            void state.switchTo(value as LegalEntitySelection)
          }
          value={selection ?? ''}
        >
          <SelectPrimitive.Trigger
            aria-label={english ? 'Select active company' : 'انتخاب شرکت فعال'}
            className={cn(
              'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-surface px-2.5 text-sm text-foreground shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
              'border-0 bg-muted/70',
              state.error && 'ring-1 ring-destructive',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <IssuerMark selection={selection} />
              <span className="min-w-0 text-start">
                <span className="block text-[10px] text-muted-foreground">
                  {english ? 'Active company' : 'شرکت فعال'}
                </span>
                <span className="block truncate text-xs font-bold sm:text-sm">
                  {selection
                    ? english
                      ? selection === 'ALL'
                        ? 'All companies'
                        : (state.entities.find(({ code }) => code === selection)
                            ?.latinName ?? selection.replaceAll('_', ' '))
                      : legalEntitySelectionLabel(selection, state.entities)
                    : english
                      ? 'Select company'
                      : 'انتخاب شرکت'}
                </span>
              </span>
              {selection === 'ALL' ? (
                <Badge className="hidden bg-violet-100 text-[10px] text-violet-700 sm:inline-flex">
                  {english ? 'Combined' : 'تجمیعی'}
                </Badge>
              ) : null}
            </span>
            <SelectPrimitive.Icon>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              align="end"
              className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
              position="popper"
              sideOffset={4}
            >
              <SelectPrimitive.Viewport>
                {choices.map((choice) => (
                  <SelectPrimitive.Item
                    className="relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pe-8 ps-3 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
                    key={choice.value}
                    value={choice.value}
                  >
                    <SelectPrimitive.ItemText>
                      <span className="flex items-center gap-2">
                        {choice.aggregate ? (
                          <Layers3 className="size-4 text-violet-600" />
                        ) : (
                          <Building2 className="size-4 text-primary" />
                        )}
                        {english
                          ? choice.aggregate
                            ? 'All companies — administrators'
                            : (choice.entity?.latinName ??
                              choice.value.replaceAll('_', ' '))
                          : choice.label}
                      </span>
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute end-2">
                      <Check aria-hidden="true" className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        <span aria-live="polite" className="sr-only">
          {state.switching
            ? english
              ? 'Changing active company'
              : 'در حال تغییر شرکت فعال'
            : (state.feedback ?? state.error)}
        </span>
        {state.feedback ? (
          <CheckCircle2
            aria-hidden="true"
            className="absolute -start-1 -top-1 size-4 rounded-full bg-surface text-emerald-600"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center"
      data-legal-entity-header-controls
      ref={headerAnchor}
    >
      {selector}
    </div>
  );
}
