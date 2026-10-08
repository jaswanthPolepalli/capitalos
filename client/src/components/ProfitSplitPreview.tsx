import { useId } from 'react';
import { splitProfit } from '../../../functions/capitalos-api/profit-sharing.mjs';
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export function profitOptions(value: string | null) {
  const direct = value?.startsWith('amount:') ?? false;
  return { partnerAmountRupees: direct ? Number(value!.slice(7)) : null, noCfoSplit: value === 'no-cfo', partnerProfitPercent: direct || value === null || value === 'no-cfo' ? null : Number(value) };
}
export function profitPreview(amount: number, capital?: number, customPercent: string | null = null) {
  try {
    if (customPercent !== null && customPercent.trim() === '') throw new Error('Enter the partner profit percentage.');
    if (customPercent?.startsWith('amount:') && customPercent.slice(7).trim() === '') throw new Error('Enter the partner amount.');
    return { split: splitProfit(amount, profitOptions(customPercent).partnerProfitPercent, capital, profitOptions(customPercent).noCfoSplit, profitOptions(customPercent).partnerAmountRupees), error: '' };
  } catch (e) { return { split: null, error: e instanceof Error ? e.message : 'Review the profit amounts.' }; }
}
export function ProfitSplitPreview({ amount, capital, customPercent = null, onPercentChange, disabled = false, kind = 'profit' }: {
  kind?: 'profit' | 'cashback'; amount: number; capital?: number | undefined; customPercent?: string | null; onPercentChange?: (percent: string | null) => void; disabled?: boolean;
}) {
  const id = useId();
  const direct = customPercent?.startsWith('amount:') ?? false;
  const { split, error } = profitPreview(amount, capital, customPercent);
  const rate = split && capital && capital > 0 ? split.amountRupees / capital * 100 : null;
  return <div className="form-hint" aria-live="polite">
    <p>{customPercent === 'no-cfo' ? 'No CFO split. The full entered amount goes to the partner; CFO share is ₹0.' : customPercent === null ? 'Enter the combined partner + CFO amount. Partner receives 5/7; CFO receives 2/7.' : 'Adjusted partner share for this payment. The combined amount stays fixed; the CFO receives the remainder.'} Rounded to whole rupees.</p>
    {capital !== undefined && capital > 0 && <p>Invested capital: <strong>{fmt(capital)}</strong></p>}
    {split && <p><strong>Partner share: {fmt(split.amountRupees)}</strong>{rate !== null && <> · <strong>Final partner {kind}: {Number(rate.toFixed(4))}%</strong></>} · <strong>CFO share: {fmt(split.cfoShareRupees)}</strong></p>}
    {onPercentChange && <>
      <label className="checkbox-row" htmlFor={`${id}-no-cfo`}><input id={`${id}-no-cfo`} type="checkbox" checked={customPercent === 'no-cfo'} disabled={disabled} onChange={e => onPercentChange(e.target.checked ? 'no-cfo' : null)} />{kind === 'cashback' ? 'No CFO share — all cashback to partner' : 'No CFO split — all amount to partner'}</label>
      <label className="checkbox-row" htmlFor={`${id}-adjust`}><input id={`${id}-adjust`} type="checkbox" checked={customPercent !== null && customPercent !== 'no-cfo'} disabled={disabled || customPercent === 'no-cfo' || !capital || capital <= 0} onChange={e => onPercentChange(e.target.checked ? String(rate === null ? '' : Number(rate.toFixed(4))) : null)} />{kind === 'cashback' ? 'Change cashback % or amount' : 'Adjust partner profit %'}</label>
      {customPercent !== null && customPercent !== 'no-cfo' && <div className="form-field"><label className="form-label" htmlFor={`${id}-rate`}>Partner {kind} % of invested capital</label><input id={`${id}-rate`} className="form-input" type="number" min="0.0001" max="100" step="0.0001" value={direct ? (rate === null ? '' : Number(rate.toFixed(4))) : customPercent} disabled={disabled} onChange={e => onPercentChange(e.target.value)} /><label className="form-label" htmlFor={`${id}-amount`}>Or partner amount (₹)</label><input id={`${id}-amount`} className="form-input" type="number" min="1" max={amount} step="1" value={direct ? customPercent.slice(7) : split?.amountRupees ?? ''} disabled={disabled} onChange={e => onPercentChange(`amount:${e.target.value}`)} /><p>Enter either the percentage or the amount; the other value updates automatically.</p><p>This changes only this payment. Review the amounts before confirming.</p></div>}
    </>}
    {error && amount > 0 && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
