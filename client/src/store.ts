import { cashbackTotals, monthlyCashback } from '../../functions/capitalos-api/cashback.mjs';
import type { Cashback } from '../../functions/capitalos-api/cashback.mjs';
export type { Cashback };
/**
 * CapitalOS store — cloud-backed via Catalyst Datastore API.
 *
 * All data is persisted to the cloud function and synced across devices.
 * Falls back gracefully on network errors.
 */

import type { Combination, CombineInput } from '../../functions/capitalos-api/combinations.mjs';
import { revertReason, firstCombinedProfitDate } from '../../functions/capitalos-api/combinations.mjs';
export type { CombineInput };
import { currentProfitCycleAmount, latestProfitPayment } from '../../functions/capitalos-api/profit-cycles.mjs';
import { pendingProfit, type PaymentGroupInput, type PaymentGroupResult } from '../../functions/capitalos-api/payment-groups.mjs';
export type { PaymentGroupInput, PaymentGroupResult };
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
  cashback?: Cashback;
  cashbackEligibility?: string;
  cashbackSelectedAllocationId?: string | null;
  cashbackSelectionStatus?: string | null;
  cashbackOtherPaidAllocationIds?: string[];
  cashbackSelectionUpdatedAt?: string | null;
  combination?: Combination;
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
  /** ISO datetime when this row was created in Catalyst Datastore */
  createdAt?: string;
}

export interface CapitalReturn {
  paymentGroupId?: string;
  id: string;
  allocationId: string;
  partnerId: string;
  /** Amount returned in rupees */
  amountRupees: number;
  /** ISO date capital was returned */
  returnedDate: string;
  notes: string;
  /** ISO datetime when this row was created in Catalyst Datastore */
  createdAt?: string;
}

export interface ProfitRecord {
  paymentGroupId?: string;
  id: string;
  allocationId: string;
  partnerId: string;
  /** Amount in rupees */
  amountRupees: number;
  /** ISO date profit was paid */
  paidDate: string;
  notes: string;
  /** ISO datetime when this row was created in Catalyst Datastore */
  createdAt?: string;
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
  | "PROFIT_PAID"
  | "CASHBACK_PAID";

export interface LedgerEvent {
  amountUnknown?: boolean;
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

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(`${API_BASE}/${path}`, { signal: signal ?? null });
  if (!res.ok) throw new Error(`Could not load ${path}.`);
  const json = await res.json() as { status: string; data: T[] };
  if (json.status !== "success" || !Array.isArray(json.data)) throw new Error(`Invalid response for ${path}.`);
  return json.data;
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
let _status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
let _error: string | null = null;
let _lastSuccess: number | null = null;
let _revision = 0;
export function getLoadState() {
  return { status: _status, error: _error, lastSuccess: _lastSuccess, hasData: _loaded,
    isStale: _loaded && (_status === 'error' || !_lastSuccess || Date.now() - _lastSuccess >= 60000) };
}
let _loadPromise: Promise<void> | undefined;

// ─── Listeners ────────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(dataChanged = true) {
  if (dataChanged) _revision++;
  listeners.forEach((fn) => fn());
}

// ─── Bootstrap load ───────────────────────────────────────────────────────────

export function loadAll(): Promise<void> {
  if (_loadPromise) return _loadPromise;
  _loadPromise = performLoad().finally(() => { _loadPromise = undefined; });
  return _loadPromise;
}
async function performLoad(): Promise<void> {
  _status = 'loading';
  _error = null;
  notify(false);
  const revision = _revision;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const requests = Promise.all([
      apiGet<Partner>("partners", controller.signal),
      apiGet<CapitalAllocation>("allocations", controller.signal),
      apiGet<CapitalReturn>("capital-returns", controller.signal),
      apiGet<ProfitRecord>("profit-records", controller.signal),
      apiGet<CreditCard>("credit-cards", controller.signal),
    ]);
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(new Error('Loading timed out. Check your connection and retry.')); }, 20000);
    });
    const [p, a, cr, pr, cc] = await Promise.race([requests, deadline]);
    if (revision !== _revision) throw new Error('Records changed while refreshing. Refresh again to confirm the latest balances.');
    partners = p;
    allocations = a;
    capitalReturns = cr;
    profitRecords = pr;
    creditCards = cc;
    // Reconstruct ledger from allocations, capital returns, and profit records.
    // Use the real CREATEDTIME from Catalyst (returned as createdAt) when available,
    // falling back to a synthetic timestamp that preserves row ID ordering.
    ledger = [
      ...allocations.filter(a => !a.combination).map((a) => ({
        id: `l-a-${a.id}`,
        eventType: "CAPITAL_RECEIVED" as LedgerEventType,
        partnerId: a.partnerId,
        allocationId: a.id,
        refId: a.id,
        amountRupees: a.amountRupees,
        date: a.receivedDate,
        createdAt: a.createdAt || `${a.receivedDate}T00:00:00.${String(Number(a.id)).padStart(9, "0")}Z`,
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
        createdAt: cr.createdAt || `${cr.returnedDate}T00:00:00.${String(Number(cr.id)).padStart(9, "0")}Z`,
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
        createdAt: pr.createdAt || `${pr.paidDate}T00:00:00.${String(Number(pr.id)).padStart(9, "0")}Z`,
        notes: pr.notes || "Profit paid",
      })),
    ];
    _loaded = true;
    _status = 'ready';
    _lastSuccess = Date.now();
  } catch (err) {
    _status = 'error';
    _error = err instanceof Error ? err.message : 'Records could not be loaded. Please retry.';
    controller.abort();
  } finally {
    clearTimeout(timeout);
    notify(false);
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
  const cashbackEvents: LedgerEvent[] = allocations.flatMap(a => {
    const payment = a.cashback;
    if (payment?.status !== 'paid') return [];
    return [{ id: `l-cb-${a.id}`, eventType: 'CASHBACK_PAID', partnerId: a.partnerId, allocationId: a.id,
      refId: a.id, amountRupees: payment.amountRupees ?? 0, amountUnknown: payment.amountRupees == null, date: payment.paidDate,
      createdAt: payment.createdAt || payment.updatedAt || `${payment.paidDate}T00:00:00Z`, notes: payment.notes || 'Cashback sharing' }];
  });
  return [...ledger, ...cashbackEvents].sort((a, b) => {
    // Primary sort: by createdAt descending — this is the real Catalyst CREATEDTIME
    // which accurately reflects when each row was inserted, regardless of the
    // business date (receivedDate / paidDate) the user selected.
    // Both real ISO timestamps and synthetic midnight values sort correctly with
    // localeCompare because they're all ISO 8601 strings.
    const caDiff = (b.createdAt || "").localeCompare(a.createdAt || "");
    if (caDiff !== 0) return caDiff;
    // Fallback: compare numeric row IDs (higher ID = created later)
    const idA = parseInt((a.refId || "0"), 10);
    const idB = parseInt((b.refId || "0"), 10);
    return idB - idA;
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
  firstProfitDueDate: string | null;
  combinedInto: string | null;
  combinationReserved: boolean;
  contributedAmount: number;
  partner: Partner | undefined;
  creditCard: CreditCard | undefined;
  totalCapitalReturned: number;
  capitalOutstanding: number;
  isFullyReturned: boolean;
  totalProfitPaid: number;
  totalCashbackPaid: number;
  totalProfitsReceived: number;
  unknownCashbackCount: number;
  profitAccrued: number;
  /** Profit still owed for the current cycle (0 if already paid) */
  profitPending: number;
  /** Current-cycle profit on the original contribution; capital returns do not settle it. */
  currentCycleProfit: number;
  /** Forward monthly run rate on capital still deployed. */
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
  const today = new Date().toLocaleDateString('en-CA');
  return monthlyCashback(allocations).map((a) => {
    const owner = allocations.find(parent => parent.combination?.sources.some(s => s.id === a.id));
    const transferred = !!owner && owner.receivedDate <= today;
    const future = a.receivedDate > today;
    const firstProfitDueDate = a.combination ? firstCombinedProfitDate(a.receivedDate) : null;
    const partner = getPartner(a.partnerId);
    const creditCard = a.creditCardId ? getCreditCard(a.creditCardId) : undefined;
    const returns = getCapitalReturnsForAllocation(a.id);
    const profitRecs = getProfitRecordsForAllocation(a.id);

    const totalCapitalReturned = returns.reduce((s, r) => s + r.amountRupees, 0);
    const originalOutstanding = Math.max(0, a.amountRupees - totalCapitalReturned);
    const capitalOutstanding = transferred || future ? 0 : originalOutstanding;
    const isFullyReturned = capitalOutstanding === 0;
    const totalProfitPaid = profitRecs.reduce((s, r) => s + r.amountRupees, 0);

    const expectedMonthlyProfit = Math.round((capitalOutstanding * a.profitPercent) / 100);
    const currentCycleProfit = currentProfitCycleAmount(a, profitRecs, returns, today);

    const latestProfitRec = latestProfitPayment(profitRecs);

    const isRecurring = !!latestProfitRec?.notes.includes("Capital reinvested");
    const isPartiallyPaid = !!latestProfitRec?.notes?.includes("Partial payment");

    const profitPending = pendingProfit(a, allocations, profitRecords, today, capitalReturns);
    const nextMonthProfit = !owner && latestProfitRec?.paidDate.slice(0, 7) === today.slice(0, 7) && totalProfitPaid > 0 && !isPartiallyPaid && isRecurring ? expectedMonthlyProfit : 0;

    const profitAccrued = profitPending + totalProfitPaid;

    return { ...a, ...cashbackTotals([a]), totalProfitsReceived: totalProfitPaid + cashbackTotals([a]).totalCashbackPaid, firstProfitDueDate, combinedInto: transferred ? owner!.id : null, combinationReserved: !!owner, contributedAmount: a.combination ? 0 : a.amountRupees, partner, creditCard, totalCapitalReturned, capitalOutstanding, isFullyReturned, totalProfitPaid, profitAccrued, profitPending, currentCycleProfit, expectedMonthlyProfit, nextMonthProfit, isRecurring, isPartiallyPaid };
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
  totalCashbackPaid: number;
  totalProfitsReceived: number;
  unknownCashbackCount: number;
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
    const totalCapital = pa.reduce((s, a) => s + a.contributedAmount, 0);
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
    return { partner, ...cashbackTotals(pa), totalProfitsReceived: totalProfitPaid + cashbackTotals(pa).totalCashbackPaid, totalCapital, totalCapitalReturned, capitalOutstanding, cashOutstanding, cardOutstanding, allocationCount: pa.length, activeAllocationCount, totalProfitPaid, totalProfitPending, expectedMonthlyProfit, nextReturnDate, hasCreditCards };
  });
}

export interface PortfolioTotals {
  totalCapital: number;
  totalCapitalReturned: number;
  capitalOutstanding: number;
  cashOutstanding: number;
  cardOutstanding: number;
  totalProfitPaid: number;
  totalCashbackPaid: number;
  totalProfitsReceived: number;
  unknownCashbackCount: number;
  totalProfitPending: number;
  expectedMonthlyProfit: number;
  activePartners: number;
  allocationCount: number;
}

export function getPortfolioTotals(): PortfolioTotals {
  const summaries = getAllocationSummaries();
  return {
    ...cashbackTotals(summaries),
    totalProfitsReceived: summaries.reduce((s, a) => s + a.totalProfitsReceived, 0),
    totalCapital: summaries.reduce((s, a) => s + a.contributedAmount, 0),
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

export async function combineAllocations(input: CombineInput): Promise<CapitalAllocation> {
  const allocation = await apiPost<CapitalAllocation>('allocations/combine', input);
  allocations = [...allocations, allocation];
  notify();
  return allocation;
}

export function combinationRevertReason(id: string): string | null {
  return revertReason(allocations.find(a => a.id === id), allocations, capitalReturns, profitRecords);
}

export async function revertCombination(id: string): Promise<void> {
  const reason = combinationRevertReason(id);
  if (reason) throw new Error(reason);
  await apiPostEmpty<{ id: string }>(`allocations/${id}/revert-combination`);
  allocations = allocations.filter(a => a.id !== id);
  notify();
}

function markCombinationUsed(allocationId: string) {
  allocations = allocations.map(a => a.combination && (a.id === allocationId || a.combination.sources.some(s => s.id === allocationId))
    ? { ...a, combination: { ...a.combination, revertBlocked: true } } : a);
}

export async function updateAllocationReturnDate(allocationId: string, returnDate: string | null): Promise<void> {
  assertCombinationHistoryEditable('allocation', allocationId);
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
  assertCombinationHistoryEditable('allocation', allocationId);
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
  const summary = getAllocationSummaries().find(a => a.id === input.allocationId);
  if (!summary || summary.combinationReserved) throw new Error('Record capital returns against the combined entry after its effective date.');
  if (input.returnedDate < summary.receivedDate || input.amountRupees > summary.capitalOutstanding) throw new Error('Return date or amount is outside this contribution’s available capital.');
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
  const summary = getAllocationSummaries().find(a => a.id === input.allocationId);
  if (summary?.combinationReserved && (input.amountRupees > summary.profitPending || input.notes.includes('Capital reinvested'))) throw new Error('Only the remaining original profit can be paid on a combined source.');
  if (summary && input.paidDate < summary.receivedDate) throw new Error('Payment cannot be before the contribution’s effective date.');
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

/** Group writes are reserved server-side. Repeating the same input only checks its outcome. */
export async function addPaymentGroup(input: PaymentGroupInput): Promise<PaymentGroupResult> {
  const response = await fetch(`${API_BASE}/payment-groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const body = await response.json();
  if (!response.ok || body.status !== 'success') throw Object.assign(new Error(body.message || 'Unable to confirm the grouped payment.'), { canEdit: response.status === 400 });
  const result = body.data as PaymentGroupResult;
  for (const item of result.results) {
    if (item.status !== 'saved' || !item.record) continue;
    const record = item.record;
    const profit = 'paidDate' in record;
    if (profit) profitRecords = [...profitRecords.filter(p => p.id !== record.id), record];
    else capitalReturns = [...capitalReturns.filter(r => r.id !== record.id), record];
    const eventType = profit ? 'PROFIT_PAID' : 'CAPITAL_RETURNED';
    ledger = [...ledger.filter(e => !(e.refId === record.id && e.eventType === eventType)), {
      id: `l-${profit ? 'pr' : 'cr'}-${record.id}`, eventType, partnerId: record.partnerId,
      allocationId: record.allocationId, refId: record.id, amountRupees: record.amountRupees,
      date: profit ? record.paidDate : record.returnedDate, notes: record.notes,
      createdAt: record.createdAt || new Date().toISOString(),
    }];
  }
  notify();
  return result;
}

export interface DeleteEntryResult {
  id: string;
  deletedAt: string;
  originalNotes: string;
}

export interface DeletePartnerResult {
  partnerId: string;
  deletedAt: string;
  cascaded?: {
    allocations: number;
    capitalReturns: number;
    profitRecords: number;
  };
}

// ─── Delete individual ledger entries ─────────────────────────────────────────

export async function deleteProfitRecord(id: string): Promise<DeleteEntryResult> {
  assertCombinationHistoryEditable('profit', id);
  const result = await apiDelete<DeleteEntryResult>(`profit-records/${id}`);
  const old = profitRecords.find(r => r.id === id);
  if (old) markCombinationUsed(old.allocationId);
  profitRecords = profitRecords.filter((r) => r.id !== id);
  ledger = ledger.filter((e) => e.refId !== id || e.eventType !== "PROFIT_PAID");
  notify();
  return result;
}

export async function deleteCapitalReturn(id: string): Promise<DeleteEntryResult> {
  assertCombinationHistoryEditable('return', id);
  const result = await apiDelete<DeleteEntryResult>(`capital-returns/${id}`);
  const old = capitalReturns.find(r => r.id === id);
  if (old) markCombinationUsed(old.allocationId);
  capitalReturns = capitalReturns.filter((r) => r.id !== id);
  ledger = ledger.filter((e) => e.refId !== id || e.eventType !== "CAPITAL_RETURNED");
  notify();
  return result;
}

export async function deleteAllocation(id: string): Promise<DeleteEntryResult> {
  if (allocations.find(a => a.id === id)?.combination) throw new Error('A capital combination cannot be deleted. Its source history must be preserved.');
  assertCombinationHistoryEditable('allocation', id);
  const result = await apiDelete<DeleteEntryResult>(`allocations/${id}`);
  allocations = allocations.filter((a) => a.id !== id);
  capitalReturns = capitalReturns.filter(r => r.allocationId !== id);
  profitRecords = profitRecords.filter(r => r.allocationId !== id);
  ledger = ledger.filter(e => e.allocationId !== id);
  notify();
  return result;
}

export async function refreshAfterWrite(): Promise<void> {
  // Wait for any pre-write snapshot, then retrieve a fresh one so restoration
  // reinserts removed rows and rebuilds every affected ledger entry.
  if (_loadPromise) await _loadPromise;
  await loadAll();
  if (_status !== 'ready') throw new Error('The change was saved, but refreshing records failed. Reload before making another change.');
}
export async function restoreEntity<T>(resource: string, id: string): Promise<T> {
  const result = await apiPostEmpty<T>(`${resource}/${id}/restore`);
  await refreshAfterWrite();
  return result;
}
export const restoreAllocation = (id: string) => restoreEntity<CapitalAllocation>('allocations', id);
export const restoreCapitalReturn = (id: string) => restoreEntity<CapitalReturn>('capital-returns', id);
export const restoreProfitRecord = (id: string) => restoreEntity<ProfitRecord>('profit-records', id);

/**
 * Soft-delete a partner.
 */
export async function deletePartner(partnerId: string): Promise<DeletePartnerResult> {
  const result = await apiDelete<DeletePartnerResult>(`partners/${partnerId}`);
  // Remove partner and all related records from local cache
  partners = partners.filter((p) => p.id !== partnerId);
  creditCards = creditCards.filter(card => card.partnerId !== partnerId);
  allocations = allocations.filter((a) => a.partnerId !== partnerId);
  capitalReturns = capitalReturns.filter((r) => r.partnerId !== partnerId);
  profitRecords = profitRecords.filter((r) => r.partnerId !== partnerId);
  ledger = ledger.filter((e) => e.partnerId !== partnerId);
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
  assertCombinationHistoryEditable('profit', id);
  const updated = await apiPatch<ProfitRecord>(`profit-records/${id}`, input);
  profitRecords = profitRecords.map((r) => r.id === id ? updated : r);
  // Sync to ledger
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "PROFIT_PAID"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.paidDate, notes: updated.notes ?? "" }
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
  assertCombinationHistoryEditable('return', id);
  const updated = await apiPatch<CapitalReturn>(`capital-returns/${id}`, input);
  capitalReturns = capitalReturns.map((r) => r.id === id ? updated : r);
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "CAPITAL_RETURNED"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.returnedDate, notes: updated.notes ?? "" }
      : e,
  );
  notify();
  return updated;
}

export interface UpdateAllocationInput {
  amountRupees?: number;
  profitPercent?: number;
  receivedDate?: string;
  returnDate?: string | null;
  creditCardId?: string | null;
  notes?: string;
}

export async function updateAllocation(id: string, input: UpdateAllocationInput): Promise<CapitalAllocation> {
  assertCombinationHistoryEditable('allocation', id);
  const current = allocations.find(a => a.id === id);
  if (current?.combination && ((input.amountRupees !== undefined && input.amountRupees !== current.amountRupees) || (input.receivedDate !== undefined && input.receivedDate !== current.receivedDate) || (input.creditCardId !== undefined && input.creditCardId !== current.creditCardId))) throw new Error('Combined capital amount, effective date and source are fixed by its original contributions.');
  const updated = await apiPatch<CapitalAllocation>(`allocations/${id}`, input);
  allocations = allocations.map((a) => a.id === id ? updated : a);
  ledger = ledger.map((e) =>
    e.refId === id && e.eventType === "CAPITAL_RECEIVED"
      ? { ...e, amountRupees: updated.amountRupees, date: updated.receivedDate, notes: updated.notes ?? "" }
      : e,
  );
  notify();
  return updated;
}

function assertCombinationHistoryEditable(kind: 'allocation' | 'profit' | 'return', id: string) {
  const combined = allocations.filter(a => a.combination);
  const sources = combined.flatMap(a => a.combination!.sources);
  const protectedRecord = kind === 'allocation'
    ? sources.some(s => s.id === id)
    : kind === 'profit'
      ? sources.some(s => s.profitRecordIds.includes(id))
      : sources.some(s => capitalReturns.some(r => r.id === id && r.allocationId === s.id));
  if (protectedRecord) throw new Error('This record is preserved in a capital combination and cannot be changed.');
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

/** Save one cashback settlement without touching principal or regular profit. */
export async function updateCashback(id: string, cashback: Cashback, sendEmail = false, confirmedCashbackAllocationIds: string[] = []): Promise<CapitalAllocation> {
  const updated = await apiPatch<CapitalAllocation>(`allocations/${id}/cashback`, { ...cashback, sendEmail, confirmedCashbackAllocationIds });
  allocations = allocations.map(a => a.id === id ? updated : a);
  notify();
  return updated;
}
