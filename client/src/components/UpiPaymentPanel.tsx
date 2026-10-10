import { ExternalLink } from "lucide-react";
import { useState } from "react";

export interface UpiPaymentState {
  enabled: boolean;
  app: string;
  payee: string;
  opened: boolean;
  confirmed: boolean;
}

export const emptyUpiPayment: UpiPaymentState = { enabled: false, app: "any", payee: "", opened: false, confirmed: false };

export function upiPaymentNote(state: UpiPaymentState): string {
  return state.enabled ? `UPI payment${state.app !== "any" ? ` via ${state.app}` : ""}${state.payee.trim() ? ` · Payee: ${state.payee.trim()}` : ""}` : "";
}

export function UpiPaymentPanel({ amount, onAmountChange, partnerName, initialPayee = "", onStateChange, disabled = false }: {
  amount: string;
  onAmountChange: (amount: string) => void;
  partnerName?: string | undefined;
  initialPayee?: string | null | undefined;
  onStateChange: (state: UpiPaymentState) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<UpiPaymentState>({ ...emptyUpiPayment, payee: initialPayee ?? "" });
  function update(patch: Partial<UpiPaymentState>) {
    const next = { ...state, ...patch };
    setState(next);
    onStateChange(next);
  }
  function openApp() {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) return;
    const params = new URLSearchParams({ am: String(value), cu: "INR", pn: partnerName ?? "Partner" });
    const payee = state.payee.trim();
    if (payee.includes("@")) params.set("pa", payee);
    const urls: Record<string, string> = { any: `upi://pay?${params}`, gpay: `gpay://upi/pay?${params}`, cred: `credpay://upi/pay?${params}` };
    window.location.href = urls[state.app] ?? urls.any!;
    update({ opened: true, confirmed: false });
  }
  return <section className="upi-payment-panel">
    <label className="upi-payment-panel__toggle">
      <input type="checkbox" checked={state.enabled} disabled={disabled} onChange={e => update({ enabled: e.target.checked, opened: false, confirmed: false })} />
      <span><strong>Pay using a UPI app</strong><small>Open a UPI app, then return here to mark the payment successful.</small></span>
    </label>
    {state.enabled && <div className="upi-payment-panel__fields">
      <div className="form-row">
        <div className="form-field"><label className="form-label">Amount to send (₹)</label><input className="form-input" type="number" min="1" step="1" value={amount} disabled={disabled} onChange={e => { onAmountChange(e.target.value); update({ opened: false, confirmed: false }); }} /></div>
        <div className="form-field"><label className="form-label" htmlFor="upi-app">UPI app</label><select id="upi-app" className="form-input" value={state.app} disabled={disabled} onChange={e => update({ app: e.target.value, opened: false, confirmed: false })}><option value="any">Choose on phone</option><option value="gpay">Google Pay</option><option value="cred">CRED</option></select></div>
      </div>
      <div className="form-field"><label className="form-label" htmlFor="upi-payee">Payee mobile number or UPI ID</label><input id="upi-payee" className="form-input" value={state.payee} disabled={disabled} onChange={e => update({ payee: e.target.value, opened: false, confirmed: false })} placeholder="Optional" /></div>
      <p className="form-hint">A UPI ID is prefilled when entered. A mobile number is kept as a reference; apps vary in whether they can resolve it, so you may need to select the payee in the app. Payment is not verified automatically.</p>
      <button type="button" className="button button--secondary" onClick={openApp} disabled={disabled || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0}><ExternalLink size={15} /> Proceed to UPI app</button>
      {state.opened && <label className="checkbox-row"><input type="checkbox" checked={state.confirmed} disabled={disabled} onChange={e => update({ confirmed: e.target.checked })} />I completed this payment successfully</label>}
    </div>}
  </section>;
}
