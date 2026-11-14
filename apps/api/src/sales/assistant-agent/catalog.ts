/** Sales-owned public reporting contract. No raw metadata/contact/document columns. */
export const AGENT_CATALOG_VERSION = 1;
export const AGENT_SOURCES = {
  contracts: {
    description:
      'Visible Sales contracts, one row per contract. Includes drafts and cancellations. Standard contractual SALES means status IN (CONFIRMED,SENT_TO_RESERVATIONS,IN_PROGRESS,COMPLETED), confirmed_at IS NOT NULL and <= observation time, with the requested window on created_at unless the user specifies another date basis. CANCELLED/DRAFT/PENDING_CONFIRMATION are excluded from this sales metric, not from raw contract inspection. Names are snapshots. Times are UTC; departure_date is date-only. User/branch/city IDs are references, not a name directory: do not invent their names.',
    columns: [
      'id',
      'contract_number',
      'branch_id',
      'owner_user_id',
      'legal_entity_id',
      'customer_name',
      'trip_type',
      'origin_id',
      'destination_id',
      'departure_date',
      'status',
      'reservation_status',
      'created_at',
      'confirmed_at',
      'cancelled_at',
      'updated_at',
    ],
    grain: 'contract',
    payment: false,
  },
  passengers: {
    description:
      'Contract passenger names and age category only: ADT=adult, CHD=child, INF=infant. Join contract_id to contracts.id. Never sum contract amounts after joining passenger rows.',
    columns: ['id', 'contract_id', 'display_name', 'age_category'],
    grain: 'passenger',
    payment: false,
  },
  services: {
    description:
      'Services selected in Sales, not proof of reservation issuance or customer delivery. Join contract_id to contracts.id.',
    columns: ['id', 'contract_id', 'kind', 'status'],
    grain: 'selected service',
    payment: false,
  },
  amounts: {
    description:
      'Discounted contractual amount BEFORE refunds, one row per contract/currency. DISCOUNT is subtracted; all other price components added. This is not accounting revenue, net sales, or a paid balance. Group by currency_code; never add different currencies.',
    columns: ['contract_id', 'currency_code', 'amount'],
    grain: 'contract and currency',
    payment: false,
  },
  payments: {
    description:
      'Recorded payment entries, not receipt documents. FINANCE_CONFIRMED alone means approved funds; pending/rejected/voided entries are not approved funds. Due date is the payment schedule. Cross-contract receipt allocations are not included: do not derive outstanding balance from these rows.',
    columns: [
      'id',
      'contract_id',
      'currency_code',
      'amount',
      'status',
      'due_at',
      'finance_confirmed_at',
      'created_at',
    ],
    grain: 'payment entry',
    payment: true,
  },
} as const;
export type AgentSource = keyof typeof AGENT_SOURCES;
export function allowedSources(payments: boolean): AgentSource[] {
  return (Object.keys(AGENT_SOURCES) as AgentSource[]).filter(
    (id) => payments || !AGENT_SOURCES[id].payment,
  );
}
