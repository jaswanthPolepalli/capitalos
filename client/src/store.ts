/**
 * CapitalOS store — cloud-backed via Catalyst Datastore API.
 *
 * All data is persisted to the cloud function and synced across devices.
 * Falls back gracefully on network errors.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export interface CapitalAllocation {
  id: string;
  partnerId: string;
  /** Amount received from partner in rupees */
  amountRupees: number;
  /** Profit % per month */
  profitPercent: number;
  /** ISO date capital was received */
  receivedDate: string;
  /** ISO date capital must be returned (optional, can be edited) */
  returnDate: string | null;
  /** Credit card ID if this allocation was funded via credit card */
  creditCardId: string | null;
  notes: string;
}

export interface CapitalReturn {
  id: string;
  allocationId: string;
  partnerId: string;
  /** Amount returned in rupees */
  amountRupees: number;
  /** ISO date capital was returned */
  returnedDate: string;
  notes: string;
}

export interface ProfitRecord {
  id: string;
  allocationId: string;
  partnerId: string;
  /** Amount in rupees */
  amountRupees: number;
  /** ISO date profit was paid */
  paidDate: string;
  notes: string;
}

export interface CreditCard {
  id: string;
  partnerId: string;
  cardName: string;
  /** Card credit limit in rupees */
  cardLimit: number;
  /** Current available / pending limit in rupees */
  pendingLimit: number;
  /** ISO date of current billing cycle's bill generation date (e.g. "2026-09-04") */
  billGenerationDate: string;
  /** ISO date of current billing cycle's due date (e.g. "2026-09-24" or "2026-10-11") */
  dueDate: string;
  notes: string;
  createdAt: string;
}

export type LedgerEventType =
  | "CAPITAL_RECEIVED"
  | "CAPITAL_RETURNED"
  | "PROFIT_PAID";

export interface LedgerEvent {
  id: string;
  eventType: LedgerEventType;
  partnerId: string;
  allocationId: string;
  refId: string;
  amountRupees: number;
  date: string;
  notes: string;
  /** ISO datetime when this event was created — used for accurate same-day ordering */
  createdAt: string;
}

// ─── API base URL ─────────────────────────────────────────────────────────────

const API_BASE = "/server/capitalos-api";

async function apiGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${API_BASE}/${path}`);
  const json = await res.json() as { status: string; data: T[] };
  if (json.status !== "success") throw new Error(`API error: ${JSON.stringify(json)}`);
  return json.data || [];
}

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { status: string; data: T };
  if (json.status !== "success") throw new Error(`API error: ${JSON.stringify(json)}`);
  return json.data;
}

async function apiPatch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { status: string; data: T };
  if (json.status !== "success") throw new Error(`API error: ${JSON.stringify(json)}`);
  return json.data;
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json() as { status: string; data: T };
  if (json.status !== "success") throw new Error(`API error: ${JSON.stringify(json)}`);
  return json.data;
}

async function apiPostEmpty<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = await res.json() as { status: string; data: T };
  if (json.status !== "success") throw new Error(`API error: ${JSON.stringify(json)}`);
  return json.data;
}

// ─── Mutable in-memory cache (synced from cloud) ──────────────────────────────

let partners: Partner[] = [];
let allocations: CapitalAllocation[] = [];
let capitalReturns: CapitalReturn[] = [];
let profitRecords: ProfitRecord[] = [];
let creditCards: CreditCard[] = [];
let ledger: LedgerEvent[] = [];
let _loaded = false;
let _loading = false;

// ─── Listeners ────────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ─── Bootstrap load ───────────────────────────────────────────────────────────

export async function loadAll(): Promise<void> {
  if (_loading) return; // Prevent concurrent in-flight fetches
  _loading = true;
  _loaded = false;
  try {
    const [p, a, cr, pr, cc] = await Promise.all([
      apiGet<Partner>("partners"),
      apiGet<CapitalAllocation>("allocations"),
      apiGet<CapitalReturn>("capital-returns"),
      apiGet<ProfitRecord>("profit-records"),
      // Credit cards table may not exist yet in older deployments — fail gracefully
      apiGet<CreditCard>("credit-cards").catch(() => [] as CreditCard[]),
    ]);
    partners = p;
    allocations = a;
    capitalReturns = cr;
    profitRecords = pr;
    creditCards = cc;
    // Reconstruct ledger from allocations, capital returns, and profit records.
    ledger = [
      ...allocations.map((a) => ({
        id: `l-a-${a.id}`,
        eventType: "CAPITAL_RECEIVED" as LedgerEventType,
        partnerId: a.partnerId,
        allocationId: a.id,
        refId: a.id,
        amountRupees: a.amountRupees,
        date: a.receivedDate,
        createdAt: `${a.receivedDate}T00:00:00.${String(Number(a.id)).padStart(9, "0")}Z`,
        notes: a.notes || `Capital received — ${a.amountRupees} @ ${a.profitPercent}% p.m.`,
      })),
      ...capitalReturns.map((cr) => ({
        id: `l-cr-${cr.id}`,
        eventType: "CAPITAL_RETURNED" as LedgerEventType,
        partnerId: cr.partnerId,
        allocationId: cr.allocationId,
        refId: cr.id,
        amountRupees: cr.amountRupees,
        date: cr.returnedDate,
        createdAt: `${cr.returnedDate}T00:00:00.${String(Number(cr.id)).padStart(9, "0")}Z`,
        notes: cr.notes || "Capital returned to partner",
      })),
      ...profitRecords.map((pr) => ({
        id: `l-pr-${pr.id}`,
        eventType: "PROFIT_PAID" as LedgerEventType,
        partnerId: pr.partnerId,
        allocationId: pr.allocationId,
        refId: pr.id,
        amountRupees: pr.amountRupees,
        date: pr.paidDate,
        createdAt: `${pr.paidDate}T00:00:00.${String(Number(pr.id)).padStart(9, "0")}Z`,
        notes: pr.notes || "Profit paid",
      })),
    ];
    _loaded = true;
    notify();
  } catch (err) {
    console.error("[store] Failed to load from cloud:", err);
  } finally {
    _loading = false;
  }
}

// Auto-load on first import
loadAll();

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getPartners(): Partner[] { return partners; }
export function getPartner(id: string): Partner | undefined { return partners.find((p) => p.id === id); }
export function getAllocations(): CapitalAllocation[] { return allocations; }
export function getAllocationsForPartner(partnerId: string): CapitalAllocation[] { return allocations.filter((a) => a.partnerId === partnerId); }
export function getCapitalReturns(): CapitalReturn[] { return capitalReturns; }
export function getCapitalReturnsForAllocation(allocationId: string): CapitalReturn[] { return capitalReturns.filter((r) => r.allocationId === allocationId); }
export function getCapitalReturnsForPartner(partnerId: string): CapitalReturn[] { return capitalReturns.filter((r) => r.partnerId === partnerId); }
export function getProfitRecords(): ProfitRecord[] { return profitRecords; }
export function getProfitRecordsForAllocation(allocationId: string): ProfitRecord[] { return profitRecords.filter((r) => r.allocationId === allocationId); }
export function getProfitRecordsForPartner(partnerId: string): ProfitRecord[] { return profitRecords.filter((r) => r.partnerId === partnerId); }
export function getCreditCards(): CreditCard[] { return creditCards; }
export function getCreditCard(id: string): CreditCard | undefined { return creditCards.find((c) => c.id === id); }
export function getCreditCardsForPartner(partnerId: string): CreditCard[] { return creditCards.filter((c) => c.partnerId === partnerId); }
export function getLedger(): LedgerEvent[] {
  return [...ledger].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    const caDiff = (b.createdAt || "").localeCompare(a.createdAt || "");
    if (caDiff !== 0) return caDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });
}
export function getLedgerForPartner(partnerId: string): LedgerEvent[] { return getLedger().filter((e) => e.partnerId === partnerId); }
export function isLoaded(): boolean { return _loaded; }

// ─── Credit card due date helper ──────────────────────────────────────────────

/**
 * Computes the next due date for a credit card given a transaction date.
 *
 * The card stores a sample billGenerationDate and dueDate to encode the cycle pattern.
 * From these, we derive:
 *   - billDay: day of month the bill generates
 *   - daysFromBillToDue: offset in days from bill generation to due date
 *
 * Then for a given transactionDate we find the next bill generation date at or
 * after the transaction date, and compute the corresponding due date.
 *
 * Example:
 *   billGenerationDate = "2026-09-04", dueDate = "2026-09-24" → same month, offset 20 days
 *   billGenerationDate = "2026-09-23", dueDate = "2026-10-11" → different month, offset 18 days
 */
/**
 * Parse an ISO date string (YYYY-MM-DD) as local midnight to avoid timezone offsets.
 * Using `new Date("YYYY-MM-DD")` parses as UTC midnight which shifts to the previous
 * day in UTC+5:30 (IST) when formatted back with toISOString(). This helper avoids that.
 */
function parseLocalDate(isoDate: string): Date {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  return new Date(y, m - 1, d); // local midnight — timezone safe
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeNextDueDate(card: CreditCard, transactionDate: string): string {
  const billGenDate = parseLocalDate(card.billGenerationDate);
  const dueDateSample = parseLocalDate(card.dueDate);
  const offsetDays = Math.round(
    (dueDateSample.getTime() - billGenDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const billDay = billGenDate.getDate();

  const txDate = parseLocalDate(transactionDate);
  const txYear = txDate.getFullYear();
  const txMonth = txDate.getMonth(); // 0-indexed

  // Find the next bill generation date at or after the transaction date
  let nextBillGen = new Date(txYear, txMonth, billDay);
  if (nextBillGen < txDate) {
    // Bill gen day already passed this month, move to next month
    nextBillGen = new Date(txYear, txMonth + 1, billDay);
  }

  // Add offset in whole calendar days (avoids DST/timezone drift)
  const nextDue = new Date(
    nextBillGen.getFullYear(),
    nextBillGen.getMonth(),
    nextBillGen.getDate() + offsetDays,
  );
  return toLocalISO(nextDue);
}

// ─── Derived calculations ─────────────────────────────────────────────────────

export interface AllocationSummary extends CapitalAllocation {
  partner: Partner | undefined;
  creditCard: CreditCard | undefined;
  totalCapitalReturned: number;
  capitalOutstanding: number;
  isFullyReturned: boolean;
  totalProfitPaid: number;
  profitAccrued: number;
  /** Profit still owed for the current cycle (0 if already paid) */
  profitPending: number;
  expectedMonthlyProfit: number;
  /**
   * Next-month profit — only set when the recur checkbox was used.
   */
  nextMonthProfit: number;
  /** True if the most recent profit payment had "Capital reinvested" in notes */
  isRecurring: boolean;
  /** True if the latest profit payment was marked as partial */
  isPartiallyPaid: boolean;
}

/**
 * Parses the remaining profit amount stored in a partial payment note.
 * Looks for tag: "Partial payment · Remaining: ₹<amount>"
 * Returns the rupee amount or null if not found / not parseable.
 */
export function parsePartialRemainingFromNotes(notes: string): number | null {
  const match = notes.match(/Partial payment · Remaining: ₹([\d,]+)/);
  if (!match || !match[1]) return null;
  const parsed = parseInt(match[1].replace(/,/g, ""), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parses the remaining profit rate stored in a partial payment note.
 * Looks for tag: "Partial payment · Remaining %: <rate>%"
 * Returns the rate number (e.g. 4 for 4%) or null if not found.
 */
export function parsePartialRemainingPercentFromNotes(notes: string): number | null {
  const match = notes.match(/Partial payment · Remaining %: ([\d.]+)%/);
  if (!match || !match[1]) return null;
  const parsed = parseFloat(match[1]);
  return isNaN(parsed) ? null : parsed;
}

export function getAllocationSummaries(): AllocationSummary[] {
  return allocations.map((a) => {
    const partner = getPartner(a.partnerId);
    const creditCard = a.creditCardId ? getCreditCard(a.creditCardId) : undefined;
    const returns = getCapitalReturnsForAllocation(a.id);
    const profitRecs = getProfitRecordsForAllocation(a.id);

    const totalCapitalReturned = returns.reduce((s, r) => s + r.amountRupees, 0);
    const capitalOutstanding = Math.max(0, a.amountRupees - totalCapitalReturned);
    const isFullyReturned = capitalOutstanding === 0;
    const totalProfitPaid = profitRecs.reduce((s, r) => s + r.amountRupees, 0);

    const expectedMonthlyProfit = Math.round((capitalOutstanding * a.profitPercent) / 100);

    const isRecurring = profitRecs.some((r) => r.notes.includes("Capital reinvested"));

    // Find the most recent profit record (by paidDate, then by id)
    const latestProfitRec = profitRecs.length > 0
      ? [...profitRecs].sort((x, y) => {
          const dateDiff = y.paidDate.localeCompare(x.paidDate);
          if (dateDiff !== 0) return dateDiff;
          return Number(y.id) - Number(x.id);
        })[0]
      : undefined;

    const isPartiallyPaid = !!latestProfitRec?.notes?.includes("Partial payment");

    let profitPending: number;
    if (totalProfitPaid === 0) {
      // No payment at all — full monthly profit is pending
      profitPending = expectedMonthlyProfit;
    } else if (isPartiallyPaid && latestProfitRec) {
      // Partial payment — check if a specific remaining amount was stored
      const storedRemaining = parsePartialRemainingFromNotes(latestProfitRec.notes);
      if (storedRemaining !== null) {
        // Explicit remaining ₹ amount stored — use directly
        profitPending = storedRemaining;
      } else {
        const storedRemainingPct = parsePartialRemainingPercentFromNotes(latestProfitRec.notes);
        if (storedRemainingPct !== null) {
          // Remaining % rate stored — compute from outstanding capital (independent of what was paid)
          profitPending = Math.round((capitalOutstanding * storedRemainingPct) / 100);
        } else {
          // Nothing explicit stored — auto-calculate: expected - paid
          profitPending = Math.max(0, expectedMonthlyProfit - totalProfitPaid);
        }
      }
    } else {
      // Fully paid (no partial flag on latest record)
      profitPending = 0;
    }

    const nextMonthProfit = (totalProfitPaid > 0 && !isPartiallyPaid && isRecurring) ? expectedMonthlyProfit : 0;

    const profitAccrued = expectedMonthlyProfit + totalProfitPaid;

    return { ...a, partner, creditCard, totalCapitalReturned, capitalOutstanding, isFullyReturned, totalProfitPaid, profitAccrued, profitPending, expectedMonthlyProfit, nextMonthProfit, isRecurring, isPartiallyPaid };
  });
}

export interface PartnerSummary {
  partner: Partner;
  totalCapital: number;
  totalCapitalReturned: number;
  capitalOutstanding: number;
  cashOutstanding: number;
  cardOutstanding: number;
  allocationCount: number;
  activeAllocationCount: number;
  totalProfitPaid: number;
  totalProfitPending: number;
  expectedMonthlyProfit: number;
  nextReturnDate: string | null;
  hasCreditCards: boolean;
}

export function getPartnerSummaries(): PartnerSummary[] {
  const summaries = getAllocationSummaries();
  return partners.map((partner) => {
    const pa = summaries.filter((s) => s.partnerId === partner.id);
    const partnerCards = getCreditCardsForPartner(partner.id);
    const totalCapital = pa.reduce((s, a) => s + a.amountRupees, 0);
    const totalCapitalReturned = pa.reduce((s, a) => s + a.totalCapitalReturned, 0);
    const capitalOutstanding = pa.reduce((s, a) => s + a.capitalOutstanding, 0);
    const cashOutstanding = pa.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
    const cardOutstanding = pa.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
    const activeAllocationCount = pa.filter((a) => !a.isFullyReturned).length;
    const totalProfitPaid = pa.reduce((s, a) => s + a.totalProfitPaid, 0);
    const totalProfitPending = pa.reduce((s, a) => s + a.profitPending, 0);
    const expectedMonthlyProfit = pa.reduce((s, a) => s + a.expectedMonthlyProfit, 0);
    const returnDates = pa.filter((a) => !a.isFullyReturned && a.returnDate !== null).map((a) => a.returnDate as string).sort();
    const nextReturnDate = returnDates[0] ?? null;
    const hasCreditCards = partnerCards.length > 0;
    return { partner, totalCapital, totalCapitalReturned, capitalOutstanding, cashOutstanding, cardOutstanding, allocationCount: pa.length, activeAllocationCount, totalProfitPaid, totalProfitPending, expectedMonthlyProfit, nextReturnDate, hasCreditCards };
  });
}

export interface PortfolioTotals {
  totalCapital: number;
  totalCapitalReturned: number;
  capitalOutstanding: number;
  cashOutstanding: number;
  cardOutstanding: number;
  totalProfitPaid: number;
  totalProfitPending: number;
  expectedMonthlyProfit: number;
  activePartners: number;
  allocationCount: number;
}

export function getPortfolioTotals(): PortfolioTotals {
  const summaries = getAllocationSummaries();
  return {
    totalCapital: summaries.reduce((s, a) => s + a.amountRupees, 0),
    totalCapitalReturned: summaries.reduce((s, a) => s + a.totalCapitalReturned, 0),
    capitalOutstanding: summaries.reduce((s, a) => s + a.capitalOutstanding, 0),
    cashOutstanding: summaries.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0),
    cardOutstanding: summaries.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0),
    totalProfitPaid: summaries.reduce((s, a) => s + a.totalProfitPaid, 0),
    totalProfitPending: summaries.reduce((s, a) => s + a.profitPending, 0),
    expectedMonthlyProfit: summaries.reduce((s, a) => s + a.expectedMonthlyProfit, 0),
    activePartners: new Set(summaries.filter((a) => a.capitalOutstanding > 0).map((a) => a.partnerId)).size,
    allocationCount: summaries.length,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface AddPartnerInput {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export async function addPartner(input: AddPartnerInput): Promise<Partner> {
  const partner = await apiPost<Partner>("partners", input);
  partners = [...partners, partner];
  notify();
  return partner;
}

export interface UpdatePartnerInput {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export async function updatePartner(partnerId: string, input: UpdatePartnerInput): Promise<Partner> {
  const updated = await apiPatch<Partner>(`partners/${partnerId}`, input);
  partners = partners.map((p) => p.id === partnerId ? updated : p);
  notify();
  return updated;
}

export interface AddAllocationInput {
  partnerId: string;
  amountRupees: number;
  profitPercent: number;
  receivedDate: string;
  returnDate: string | null;
  creditCardId: string | null;
  notes: string;
}

export async function addAllocation(input: AddAllocationInput): Promise<CapitalAllocation> {
  const allocation = await apiPost<CapitalAllocation>("allocations", input);
  allocations = [...allocations, allocation];
  ledger = [...ledger, {
    id: `l-a-${allocation.id}`,
    eventType: "CAPITAL_RECEIVED",
    partnerId: allocation.partnerId,
    allocationId: allocation.id,
    refId: allocation.id,
    amountRupees: allocation.amountRupees,
    date: allocation.receivedDate,
    createdAt: new Date().toISOString(),
    notes: input.notes.trim() || `Capital received — ${input.amountRupees} @ ${input.profitPercent}% p.m.`,
  }];
  notify();
  return allocation;
}

export async function updateAllocationReturnDate(allocationId: string, returnDate: string | null): Promise<void> {
  const updated = await apiPatch<CapitalAllocation>(`allocations/${allocationId}`, { returnDate: returnDate || null });
  allocations = allocations.map((a) => a.id === allocationId ? updated : a);
  notify();
}

/**
 * Persists WhatsApp due-date confirmation for an allocation.
 *
 * When confirmed=true: saves the confirmed date as returnDate and appends
 * "WA_CONFIRMED" marker to notes (used to re-check the checkbox on next open).
 * When confirmed=false: removes the WA_CONFIRMED marker from notes and
 * does NOT clear the returnDate (preserves the auto-computed date).
 */
export async function updateAllocationWAConfirmed(
  allocationId: string,
  confirmed: boolean,
  returnDate: string | null,
): Promise<void> {
  const alloc = allocations.find((a) => a.id === allocationId);
  if (!alloc) return;

  // Strip any existing WA_CONFIRMED from notes, then add/remove as needed
  const baseNotes = (alloc.notes || "").replace(/\s*WA_CONFIRMED/g, "").trim();
  const newNotes = confirmed ? (baseNotes ? `${baseNotes} WA_CONFIRMED` : "WA_CONFIRMED") : baseNotes;

  const body: Record<string, unknown> = { notes: newNotes };
  if (confirmed && returnDate) body.returnDate = returnDate;

  const updated = await apiPatch<CapitalAllocation>(`allocations/${allocationId}`, body);
  allocations = allocations.map((a) => a.id === allocationId ? updated : a);
  notify();
}

export async function updateAllocationCreditCard(allocationId: string, creditCardId: string | null, returnDate?: string | null): Promise<void> {
  const body: Record<string, unknown> = { creditCardId: creditCardId || null };
  if (returnDate !== undefined) body.returnDate = returnDate || null;
  const updated = await apiPatch<CapitalAllocation>(`allocations/${allocationId}`, body);
  allocations = allocations.map((a) => a.id === allocationId ? updated : a);
  notify();
}

export interface AddCapitalReturnInput {
  allocationId: string;
  partnerId: string;
  amountRupees: number;
  returnedDate: string;
  notes: string;
}

export async function addCapitalReturn(input: AddCapitalReturnInput): Promise<CapitalReturn> {
  const cr = await apiPost<CapitalReturn>("capital-returns", input);
  capitalReturns = [...capitalReturns, cr];
  ledger = [...ledger, {
    id: `l-cr-${cr.id}`,
    eventType: "CAPITAL_RETURNED",
    partnerId: cr.partnerId,
    allocationId: cr.allocationId,
    refId: cr.id,
    amountRupees: cr.amountRupees,
    date: cr.returnedDate,
    createdAt: new Date().toISOString(),
    notes: input.notes.trim() || "Capital returned to partner",
  }];
  notify();
  return cr;
}

export interface AddProfitRecordInput {
  allocationId: string;
  partnerId: string;
  amountRupees: number;
  paidDate: string;
  notes: string;
}

export async function addProfitRecord(input: AddProfitRecordInput): Promise<ProfitRecord> {
  const record = await apiPost<ProfitRecord>("profit-records", input);
  profitRecords = [...profitRecords, record];
  ledger = [...ledger, {
    id: `l-pr-${record.id}`,
    eventType: "PROFIT_PAID",
    partnerId: record.partnerId,
    allocationId: record.allocationId,
    refId: record.id,
    amountRupees: record.amountRupees,
    date: record.paidDate,
    createdAt: new Date().toISOString(),
    notes: input.notes.trim() || "Profit paid",
  }];
  notify();
  return record;
}

export interface DeleteEntryResult {
  id: string;
  deletedAt: string;
  originalNotes: string;
}

export interface DeletePartnerResult {
  partnerId: string;
  deletedAt: string;
  cascaded: {
    allocations: number;
    capitalReturns: number;
    profitRecords: number;
  };
}

// ─── Delete individual ledger entries ─────────────────────────────────────────

export async function deleteProfitRecord(id: string): Promise<DeleteEntryResult> {
  const result = await apiDelete<DeleteEntryResult>(`profit-records/${id}`);
  profitRecords = profitRecords.filter((r) => r.id !== id);
  ledger = ledger.filter((e) => e.refId !== id || e.eventType !== "PROFIT_PAID");
  notify();
  return result;
}

export async function deleteCapitalReturn(id: string): Promise<DeleteEntryResult> {
  const result = await apiDelete<DeleteEntryResult>(`capital-returns/${id}`);
  capitalReturns = capitalReturns.filter((r) => r.id !== id);
  ledger = ledger.filter((e) => e.refId !== id || e.eventType !== "CAPITAL_RETURNED");
  notify();
  return result;
}

export async function deleteAllocation(id: string): Promise<DeleteEntryResult> {
  const result = await apiDelete<DeleteEntryResult>(`allocations/${id}`);
  allocations = allocations.filter((a) => a.id !== id);
  ledger = ledger.filter((e) => e.refId !== id || e.eventType !== "CAPITAL_RECEIVED");
  notify();
  return result;
}

export async function restoreAllocation(id: string): Promise<CapitalAllocation> {
  const result = await apiPostEmpty<CapitalAllocation>(`allocations/${id}/restore`);
  allocations = allocations.map((a) => a.id === id ? result : a);
  notify();
  return result;
}

export async function restoreCapitalReturn(id: string): Promise<CapitalReturn> {
  const result = await apiPostEmpty<CapitalReturn>(`capital-returns/${id}/restore`);
  capitalReturns = capitalReturns.map((r) => r.id === id ? result : r);
  notify();
  return result;
}

export async function restoreProfitRecord(id: string): Promise<ProfitRecord> {
  const result = await apiPostEmpty<ProfitRecord>(`profit-records/${id}/restore`);
  profitRecords = profitRecords.map((r) => r.id === id ? result : r);
  notify();
  return result;
}

/**
 * Soft-delete a partner.
 */
export async function deletePartner(partnerId: string): Promise<DeletePartnerResult> {
  const result = await apiDelete<DeletePartnerResult>(`partners/${partnerId}`);
  // Remove partner and all related records from local cache
  partners = partners.filter((p) => p.id !== partnerId);
  const allocationIds = allocations.filter((a) => a.partnerId === partnerId).map((a) => a.id);
  allocations = allocations.filter((a) => a.partnerId !== partnerId);
  capitalReturns = capitalReturns.filter((r) => r.partnerId !== partnerId);
  profitRecords = profitRecords.filter((r) => r.partnerId !== partnerId);
  ledger = ledger.filter((e) => e.partnerId !== partnerId);
  void allocationIds; // suppress unused warning
  notify();
  return result;
}

// ─── Update individual ledger entries ────────────────────────────────────────

export interface UpdateProfitRecordInput {
  amountRupees?: number;
  paidDate?: string;
  notes?: string;
}

export async function updateProfitRecord(id: string, input: UpdateProfitRecordInput): Promise<ProfitRecord> {
  const updated = await apiPatch<ProfitRecord>(`profit-records/${id}`, input);
  profitRecords = profitRecords.map((r) => r.id === id ? updated : r);
  // Sync to ledger
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "PROFIT_PAID"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.paidDate, notes: updated.notes || e.notes }
      : e,
  );
  notify();
  return updated;
}

export interface UpdateCapitalReturnInput {
  amountRupees?: number;
  returnedDate?: string;
  notes?: string;
}

export async function updateCapitalReturn(id: string, input: UpdateCapitalReturnInput): Promise<CapitalReturn> {
  const updated = await apiPatch<CapitalReturn>(`capital-returns/${id}`, input);
  capitalReturns = capitalReturns.map((r) => r.id === id ? updated : r);
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "CAPITAL_RETURNED"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.returnedDate, notes: updated.notes || e.notes }
      : e,
  );
  notify();
  return updated;
}

export interface UpdateAllocationInput {
  amountRupees?: number;
  profitPercent?: number;
  receivedDate?: string;
  notes?: string;
}

export async function updateAllocation(id: string, input: UpdateAllocationInput): Promise<CapitalAllocation> {
  const updated = await apiPatch<CapitalAllocation>(`allocations/${id}`, input);
  allocations = allocations.map((a) => a.id === id ? updated : a);
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "CAPITAL_RECEIVED"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.receivedDate, notes: updated.notes || e.notes }
      : e,
  );
  notify();
  return updated;
}

// ─── Credit Card Mutations ────────────────────────────────────────────────────

export interface AddCreditCardInput {
  partnerId: string;
  cardName: string;
  cardLimit: number;
  pendingLimit: number;
  billGenerationDate: string;
  dueDate: string;
  notes: string;
}

export async function addCreditCard(input: AddCreditCardInput): Promise<CreditCard> {
  const card = await apiPost<CreditCard>("credit-cards", input);
  creditCards = [...creditCards, card];
  notify();
  return card;
}

export interface UpdateCreditCardInput {
  cardName?: string;
  cardLimit?: number;
  pendingLimit?: number;
  billGenerationDate?: string;
  dueDate?: string;
  notes?: string;
}

export async function updateCreditCard(cardId: string, input: UpdateCreditCardInput): Promise<CreditCard> {
  const updated = await apiPatch<CreditCard>(`credit-cards/${cardId}`, input);
  creditCards = creditCards.map((c) => c.id === cardId ? updated : c);
  notify();
  return updated;
}

export async function deleteCreditCard(cardId: string): Promise<void> {
  await apiDelete<{ id: string; deletedAt: string }>(`credit-cards/${cardId}`);
  creditCards = creditCards.filter((c) => c.id !== cardId);
  notify();
}
