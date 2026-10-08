import { monthlyPayout, monthlyRateLabel } from "../lib/profitDisplay";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useRole } from "../context/RoleContext";
import { formatDate } from "../lib/format";
import type { AllocationSummary, ProfitRecord } from "../store";
import { useStore } from "../useStore";
import { RecordProfitModal } from "../components/RecordProfitModal";
import "./dashboard.css";

const fmt = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value);
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) =>
  new Date(`${key}-01T12:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
const sourceLabel = (a: AllocationSummary) =>
  a.creditCardId ? (a.creditCard?.cardName ?? "Credit card") : "Cash / bank";
// Keep current-cycle balances authoritative: subtracting calendar-month payments
// from the run rate would lose partial settlements and combined-capital rules.
function metrics(
  allocations: AllocationSummary[],
  payments: ProfitRecord[],
  month: string,
  current: string,
  next: string,
) {
  const ids = new Set(allocations.map((a) => a.id));
  const regularPaid = payments.filter(p => ids.has(p.allocationId) && p.paidDate.startsWith(month)).reduce((sum, p) => sum + p.amountRupees, 0);
  const cashbackPaid = allocations.reduce((sum, a) => sum + (a.cashback?.status === 'paid' && a.cashback.paidDate.startsWith(month) ? a.cashback.amountRupees ?? 0 : 0), 0);
  return [
    allocations.reduce((sum, a) => sum + a.contributedAmount, 0),
    allocations.reduce((sum, a) => sum + a.totalCapitalReturned, 0),
    allocations.reduce((sum, a) => sum + a.capitalOutstanding, 0),
    month === current
      ? allocations.reduce((sum, a) => sum + monthlyPayout(a, payments, month), 0)
      : month === next
        ? allocations.reduce((sum, a) => sum + a.nextMonthProfit, 0)
        : null,
    payments
      .filter((p) => ids.has(p.allocationId) && p.paidDate.startsWith(month))
      .reduce((sum, p) => sum + p.amountRupees, 0),
    month === current
      ? allocations.reduce(
          (sum, a) => sum + a.profitPending,
          0,
        )
      : null,
    cashbackPaid, regularPaid + cashbackPaid,
  ];
}

export function DashboardPage() {
  const { allocationSummaries, profitRecords, ledger, isLoaded } = useStore();
  const { isCFO } = useRole();
  const now = new Date();
  const current = monthKey(now);
  const next = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const today = `${current}-${String(now.getDate()).padStart(2, "0")}`;
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const soonKey = `${monthKey(soon)}-${String(soon.getDate()).padStart(2, "0")}`;
  const [month, setMonth] = useState(current);
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selectedPartner) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selectedPartner]);

  const months = [
    ...new Set([
      next,
      ...Array.from({ length: 12 }, (_, index) =>
        monthKey(new Date(now.getFullYear(), now.getMonth() - index, 1)),
      ),
      ...profitRecords.map((p) => p.paidDate.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const filtered = allocationSummaries.filter(
    (a) =>
      (source === "all" ||
        (source === "card" ? !!a.creditCardId : !a.creditCardId)) &&
      `${a.partner?.name ?? "Unknown partner"} ${sourceLabel(a)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const groups = [...new Set(filtered.map((a) => a.partnerId))]
    .map((id) => {
      const allocations = filtered.filter((a) => a.partnerId === id);
      return {
        id,
        name: allocations[0]?.partner?.name ?? "Unknown partner",
        allocations,
        values: metrics(allocations, profitRecords, month, current, next),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const totals = metrics(filtered, profitRecords, month, current, next);
  const overdue = filtered.filter(
    (a) => a.capitalOutstanding > 0 && a.returnDate && a.returnDate < today,
  );
  const upcoming = filtered.filter(
    (a) =>
      a.capitalOutstanding > 0 &&
      a.returnDate &&
      a.returnDate >= today &&
      a.returnDate <= soonKey,
  );
  const selected = groups.find((g) => g.id === selectedPartner);
  const paying = selected?.allocations.find((a) => a.id === payingId);
  const selectedIds = new Set(selected?.allocations.map((a) => a.id));
  const history = ledger
    .filter(
      (e) =>
        selectedIds.has(e.allocationId) && e.eventType !== "CAPITAL_RECEIVED",
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const labels = [
    "Total contributed",
    "Capital returned",
    "Capital outstanding",
    month === next ? "Upcoming profit" : "Expected monthly payout",
    "Profit paid",
    "Profit pending",
  ];
  const columns = [
    "Contributed",
    "Returned",
    "Outstanding",
    month === next ? "Upcoming profit" : "Monthly payout",
    "Paid in month",
    "Pending now",
    "Cashback paid", "Total profits received",
  ];
  const close = () => {
    setSelectedPartner(null);
    setPayingId(null);
  };
  const cells = (values: (number | null)[]) =>
    values.map((value, index) => (
      <td
        key={index}
        data-label={columns[index]}
        className={
          index === 2
            ? "overview-money overview-outstanding"
            : index === 5 && (value ?? 0) > 0
              ? "overview-money overview-pending"
              : "overview-money"
        }
      >
        {fmt(value)}
      </td>
    ));

  return (
    <div className="capital-overview">
      <PageHeader
        eyebrow="Command center"
        title="Capital & Profit Overview"
        description="Capital contributions, returns, and profit payable to partners — together."
        actions={
          <Link
            className="button button--secondary"
            to="/capital-contributions"
          >
            View contributions
          </Link>
        }
      />
      <div className="overview-filters">
        <label className="overview-search">
          Search partner or card
          <input
            type="search"
            placeholder="Partner name or card…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Funding source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="cash">Cash / bank</option>
            <option value="card">Credit card</option>
          </select>
        </label>
        <label>
          Profit month
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option value={m} key={m}>
                {monthLabel(m)}
                {m === current ? " · Current" : m === next ? " · Upcoming" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!isLoaded ? (
        <div className="empty-state" role="status">
          Loading capital and profit overview…
        </div>
      ) : (
        <>
          <div className="overview-summaries">
            {[0, 1].map((section) => (
              <section
                className="overview-summary"
                key={section}
                aria-label={
                  section === 0 ? "Capital summary" : "Profit summary"
                }
              >
                <div className="overview-section-heading">
                  <h2>
                    {section === 0 ? "Capital" : "Profit payable to partners"}
                  </h2>
                  <span>
                    {section === 0
                      ? "Current position · all contributions"
                      : monthLabel(month)}
                  </span>
                </div>
                <div className="overview-metrics">
                  {totals
                    .slice(section * 3, section * 3 + 3)
                    .map((value, index) => (
                      <div
                        key={index}
                        className={
                          index === 2
                            ? "overview-metric overview-metric--primary"
                            : "overview-metric"
                        }
                      >
                        <span>{labels[section * 3 + index]}</span>
                        <strong>{fmt(value)}</strong>
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <div className="earnings-summary"><div><span>Cashback paid</span><strong>{fmt(totals[6] ?? 0)}</strong></div><div><span>Total profits received</span><strong>{fmt(totals[7] ?? 0)}</strong></div><p className="earnings-note">For {monthLabel(month)} · Regular profit + cashback. Cashback never reduces pending profit. Amounts not recorded are excluded.</p></div>
          <p className="overview-note">
            {month === current
              ? "Monthly payout is actual profit paid this month plus the live unpaid profit balance. Paid covers this calendar month; pending is the live unpaid cycle balance."
              : month === next
                ? "Upcoming profit includes contributions marked Principal will recur. Pending is available for the current month only."
                : "Historical months show recorded payments. Expected and pending balances are unavailable for past months."}{" "}
            Capital figures always show the current position. All totals follow
            your search and funding filter.
          </p>
          {(overdue.length > 0 || upcoming.length > 0) && (
            <div
              className="overview-attention"
              aria-label="Capital return reminders"
            >
              {overdue.length > 0 && (
                <Link to="/return-obligations">
                  {overdue.length} overdue capital return
                  {overdue.length === 1 ? "" : "s"} ·{" "}
                  {fmt(overdue.reduce((s, a) => s + a.capitalOutstanding, 0))}
                </Link>
              )}
              {upcoming.length > 0 && (
                <Link to="/return-obligations">
                  {upcoming.length} due in the next 7 days ·{" "}
                  {fmt(upcoming.reduce((s, a) => s + a.capitalOutstanding, 0))}
                </Link>
              )}
              <span>For matching contributions</span>
            </div>
          )}
          <section
            className="overview-partners"
            aria-labelledby="overview-partners-title"
          >
            <div className="overview-section-heading">
              <div>
                <h2 id="overview-partners-title">Partner overview</h2>
                <span>
                  {groups.length} partner{groups.length === 1 ? "" : "s"} ·{" "}
                  {filtered.length} contributions
                </span>
              </div>
              <Link className="entity-link" to="/pending-profits">
                All profit payments →
              </Link>
            </div>
            {groups.length === 0 ? (
              <div className="empty-state">
                <p>
                  {allocationSummaries.length
                    ? "No contributions match your filters."
                    : "Add your first contribution to see capital and profit together."}
                </p>
                {allocationSummaries.length > 0 ? (
                  <button
                    className="button button--secondary"
                    onClick={() => {
                      setQuery("");
                      setSource("all");
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link
                    className="button button--primary"
                    to="/capital-contributions"
                  >
                    View contributions
                  </Link>
                )}
              </div>
            ) : (
              <div
                className="overview-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Scrollable partner overview"
              >
                <table
                  className="overview-table"
                  aria-label="Capital and profit by partner"
                >
                  <thead>
                    <tr>
                      <th scope="col">Partner / source</th>
                      {columns.map((label) => (
                        <th scope="col" key={label} className="overview-money">
                          {label}
                        </th>
                      ))}
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <Fragment key={group.id}>
                        <tr>
                          <th scope="row">
                            <button
                              className="overview-expand"
                              aria-expanded={expanded.has(group.id)}
                              aria-label={`${expanded.has(group.id) ? "Collapse" : "Expand"} ${group.name}`}
                              onClick={() =>
                                setExpanded((previous) => {
                                  const updated = new Set(previous);
                                  if (updated.has(group.id))
                                    updated.delete(group.id);
                                  else updated.add(group.id);
                                  return updated;
                                })
                              }
                            >
                              {expanded.has(group.id) ? (
                                <ChevronDown size={15} />
                              ) : (
                                <ChevronRight size={15} />
                              )}
                              <span>
                                {group.name}
                                <small>
                                  {group.allocations.length} contributions ·{" "}
                                  {[
                                    ...new Set(
                                      group.allocations.map((a) =>
                                        a.creditCardId ? "Card" : "Cash",
                                      ),
                                    ),
                                  ].join(" + ")}
                                </small>
                              </span>
                            </button>
                          </th>
                          {cells(group.values)}
                          <td>
                            <button
                              className="overview-link"
                              onClick={() => setSelectedPartner(group.id)}
                              aria-label={`View ${group.name} payments`}
                            >
                              Payments →
                            </button>
                          </td>
                        </tr>
                        {expanded.has(group.id) &&
                          group.allocations.map((a) => (
                            <tr className="overview-contribution" key={a.id}>
                              <th scope="row">
                                <span>{sourceLabel(a)}</span>
                                <small>
                                  {formatDate(a.receivedDate)} ·{" "}
                                  {monthlyRateLabel(a, profitRecords, month)}
                                </small>
                                <small>
                                  {a.combinedInto
                                    ? "Transferred to combined capital"
                                    : a.receivedDate > today
                                      ? "Scheduled contribution"
                                      : a.isFullyReturned
                                        ? "Capital settled"
                                        : a.returnDate
                                          ? `Return ${formatDate(a.returnDate)}`
                                          : "Return date not set"}
                                </small>
                                {a.combination && (
                                  <small>
                                    Combined balance · {fmt(a.amountRupees)}
                                  </small>
                                )}
                              </th>
                              {cells(
                                metrics(
                                  [a],
                                  profitRecords,
                                  month,
                                  current,
                                  next,
                                ),
                              )}
                              <td>
                                <button
                                  className="overview-link"
                                  onClick={() => setSelectedPartner(group.id)}
                                >
                                  History
                                </button>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Filtered total</th>
                      {cells(totals)}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        className="overview-drawer"
        aria-labelledby="overview-drawer-title"
        onCancel={close}
        onClose={close}
      >
        <div className="overview-drawer-heading">
          <div>
            <p className="eyebrow">Partner payments</p>
            <h2 id="overview-drawer-title">{selected?.name ?? "Partner"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close payment panel"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {paying && isCFO ? (
          <RecordProfitModal
            key={paying.id}
            embedded
            allocationId={paying.id}
            partnerId={paying.partnerId}
            pendingAmount={paying.profitPending}
            expectedMonthlyProfit={
              paying.combinationReserved
                ? paying.profitPending
                : paying.currentCycleProfit
            }
            canRecur={!paying.combinationReserved}
            allocationLabel={`${sourceLabel(paying)} · ${fmt(paying.amountRupees)} @ ${paying.profitPercent}% p.m.`}
            partnerName={selected?.name ?? "Partner"}
            partnerPhone={paying.partner?.phone ?? null}
            capitalOutstanding={paying.capitalOutstanding}
            profitPercent={paying.profitPercent}
            fundingSource={paying.creditCardId ? "card" : "cash"}
            cardName={paying.creditCard?.cardName ?? null}
            amountGivenDate={paying.receivedDate}
            onClose={() => setPayingId(null)}
          />
        ) : (
          <>
            <h3>Current profit balances</h3>
            {selected?.allocations
              .filter(
                (a) =>
                  a.profitPending > 0,
              )
              .map((a) => (
                <div className="overview-drawer-item" key={a.id}>
                  <div>
                    <strong>
                      {sourceLabel(a)} · {fmt(a.profitPending)}
                    </strong>
                    <small>
                      {formatDate(a.receivedDate)} · {fmt(a.amountRupees)}{" "}
                      contribution
                    </small>
                  </div>
                  {isCFO && (
                    <button
                      className="button button--primary"
                      onClick={() => setPayingId(a.id)}
                    >
                      Record profit
                    </button>
                  )}
                </div>
              ))}
            {!selected?.allocations.some(
              (a) =>
                a.profitPending > 0,
            ) && <p className="overview-note">No profit payments pending.</p>}
            {!isCFO && (
              <p className="overview-note">
                Unlock CFO mode to record a payment.
              </p>
            )}
            <h3>
              Payment history <small>All time · matching funding source</small>
            </h3>
            {history.length ? (
              history.map((e) => (
                <div className="overview-drawer-item" key={e.id}>
                  <div>
                    <strong>
                      {e.eventType === "PROFIT_PAID"
                        ? "Profit paid"
                        : e.eventType === "CASHBACK_PAID" ? "Cashback sharing" : "Capital returned"}
                    </strong>
                    <small>
                      {formatDate(e.date)} ·{" "}
                      {sourceLabel(
                        selected!.allocations.find(
                          (a) => a.id === e.allocationId,
                        )!,
                      )}
                    </small>
                    {e.notes && <small>{e.notes}</small>}
                  </div>
                  <strong>{e.amountUnknown ? "Amount not recorded" : fmt(e.amountRupees)}</strong>
                </div>
              ))
            ) : (
              <p className="overview-note">No payments recorded yet.</p>
            )}
            {selected && (
              <Link
                className="button button--secondary"
                to={`/partners/${selected.id}`}
              >
                View partner statement
              </Link>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
