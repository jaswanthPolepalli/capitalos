import { useState } from 'react';
import type { AllocationSummary } from '../store';
import { GroupedPaymentModal, paymentEligible } from './GroupedPaymentModal';

export function PaymentSelectionActions({ entries, onClear, profitOnly = false }: {
  entries: AllocationSummary[]; onClear: () => void; profitOnly?: boolean;
}) {
  const [payment, setPayment] = useState<{ kind: 'profit' | 'capital'; entries: AllocationSummary[] } | null>(null);
  const samePartner = entries.length > 0 && entries.every(a => a.partnerId === entries[0]?.partnerId);
  const enabled = (kind: 'profit' | 'capital') => samePartner && entries.length <= 50 && entries.every(a => paymentEligible(a, kind));
  return <>
    <div className="payment-selection-actions">
      <span>{entries.length} selected</span>
      <button className="button button--primary" type="button" disabled={!enabled('profit')} onClick={() => setPayment({ kind: 'profit', entries })}>Record selected profit</button>
      {!profitOnly && <button className="button button--secondary" type="button" disabled={!enabled('capital')} onClick={() => setPayment({ kind: 'capital', entries })}>Return selected capital</button>}
      {entries.length > 0 && <button className="button button--secondary" type="button" onClick={onClear}>Clear payment selection</button>}
      {entries.length > 0 && !samePartner && <span role="status">Select entries from one partner for a combined payment.</span>}
      {samePartner && !enabled('profit') && !enabled('capital') && <span role="status">Select up to 50 entries with an outstanding balance of the same kind.</span>}
    </div>
    {payment && <GroupedPaymentModal entries={payment.entries} kind={payment.kind} onClose={() => { setPayment(null); onClear(); }} />}
  </>;
}
