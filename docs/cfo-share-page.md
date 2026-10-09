# CFO Share page

`client/src/pages/CFOSharePage.tsx` lists every transaction that produced a CFO
share, combining profit payments (`profitRecords`) with paid cashback entries
derived from allocations. Cashback rows are prefixed with the `cashback-` id and
labelled `Cashback` in the date cell.

## Which transactions appear

A record is listed only when **all** of the following hold:

1. `combinedAmountRupees` is defined — legacy payments without split metadata are
   never shown, because the partner/CFO split is unknown for them.
2. `cfoShareRupees` is greater than `0` — payments recorded with **No CFO split**
   (or with the entire combined amount assigned to the partner) are hidden, since
   they contribute nothing to CFO earnings. They remain untouched in the ledger,
   partner statements, portal and reports.
3. All active filters match (see below).

`Total amount` sums `cfoShareRupees` over the visible rows only, so it always
matches the listed transactions.

## Filters

| Filter | Control | Rule |
| --- | --- | --- |
| Payment month | `type="month"` (`#cfo-month`) | `paidDate` starts with `YYYY-MM` |
| From date | `type="date"` (`#cfo-from`) | `paidDate >= from` (inclusive) |
| To date | `type="date"` (`#cfo-to`) | `paidDate <= to` (inclusive) |
| Partner | select (`#cfo-partner`) | exact `partnerId` match |

Filters combine with AND, so a month plus a date range narrows to the
intersection of both. The date inputs constrain each other through `min`/`max`,
and an inverted range (`from > to`) renders the alert *"From date must be on or
before To date"* while the table legitimately shows the empty state.
`Clear filters` resets month, both dates and the partner selection.

Rows stay sorted newest-first by `paidDate`, with the numeric id as a stable
tiebreaker.

## Tests

`tests/cfo-sharing-ui.test.jsx` covers the zero-share exclusion (including the
total), the inclusive date-range filtering combined with the month filter, the
invalid-range alert and the clear-filters reset.
