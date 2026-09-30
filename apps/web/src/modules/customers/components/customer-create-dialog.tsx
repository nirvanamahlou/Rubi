'use client';

import type { CustomerDetail } from '@nora/contracts';
import { useState, type RefObject } from 'react';

import { CustomerDrawer } from './customer-workspace';
import type { CustomerCalendarMode } from './customer-date-field';

/** Public presentation entry for creating a record with the canonical Customers form. */
export function CustomerCreateDialog({
  onClose,
  onCreated,
  returnFocusRef,
}: {
  onClose: () => void;
  onCreated: (customer: CustomerDetail) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [calendarMode, setCalendarMode] =
    useState<CustomerCalendarMode>('persian');

  return (
    <CustomerDrawer
      activeTab="overview"
      calendarMode={calendarMode}
      mode="create"
      onCalendarModeChange={setCalendarMode}
      onClose={onClose}
      onPartiallyCreated={onCreated}
      onSaved={async (_message, detail) => onCreated(detail)}
      onTabChange={() => {}}
      returnFocusRef={returnFocusRef}
    />
  );
}
