export const IMPORT_FIELDS = {
  partners: ['name', 'phone', 'email', 'notes'],
  allocations: ['partner', 'amountRupees', 'profitPercent', 'receivedDate', 'returnDate', 'creditCardId', 'notes'],
};
export const REQUIRED_FIELDS = { partners: ['name'], allocations: ['partner', 'amountRupees', 'profitPercent', 'receivedDate'] };
const normalized = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const phoneKey = value => String(value || '').replace(/[^0-9]/g, '');
export function importFingerprint(kind, row) {
  return kind === 'partners' ? JSON.stringify([kind, normalized(row.name), phoneKey(row.phone), normalized(row.email)])
    : JSON.stringify([kind, row.partnerId, row.amountRupees, row.profitPercent, row.receivedDate, row.returnDate || '', row.creditCardId || '']);
}
export function previewImport(kind, rows, context) {
  if (!IMPORT_FIELDS[kind]) throw new Error('Choose partners or contributions.');
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Import up to 500 rows at a time.');
  const existing = [...(kind === 'partners' ? context.partners : context.allocations)];
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !row.values || typeof row.values !== 'object' || Array.isArray(row.values)) {
      return { rowNumber: index + 2, values: {}, data: {}, status: 'rejected', messages: ['Row must contain mapped column values.'] };
    }
    const rowNumber = row.rowNumber || index + 2;
    const values = row.values || {};
    const errors = [];
    const string = key => String(values[key] ?? '').trim();
    let data;
    const notes = string('notes');
    if (notes.length > 2000) errors.push('Notes must be 2,000 characters or fewer.');
    if (/^(DELETED:|CAPITALOS_COMBINATION_V1:)/.test(notes)) errors.push('Notes start with a reserved system marker.');
    if (kind === 'partners') {
      data = { name: string('name'), phone: string('phone'), email: string('email'), notes };
      if (!data.name || data.name.length > 255) errors.push('Name is required and must be 255 characters or fewer.');
      if (data.phone.length > 30) errors.push('Phone must be 30 characters or fewer.');
      if (data.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 255)) errors.push('Email is invalid.');
    } else {
      const partnerRef = string('partner');
      let matches = context.partners.filter(p => p.id === partnerRef);
      if (!matches.length) matches = context.partners.filter(p => normalized(p.name) === normalized(partnerRef));
      if (matches.length !== 1) errors.push(matches.length ? 'Partner name is ambiguous; use the partner ID.' : 'Partner not found. Import the partner first or use its exact name/ID.');
      const rawAmount = string('amountRupees').replace(/[₹,\s]/g, '');
      const rawRate = string('profitPercent').replace(/%$/, '');
      const amount = Number(rawAmount), rate = Number(rawRate);
      if (!rawAmount || !/^\d+(\.0+)?$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount <= 0) errors.push('Amount must be a positive whole number of rupees; fractions are not rounded.');
      if (!rawRate || !/^\d+(\.\d+)?$/.test(rawRate) || !Number.isFinite(rate) || rate < 0 || rate > 100) errors.push('Monthly profit rate must be between 0 and 100.');
      const receivedDate = string('receivedDate'), returnDate = string('returnDate');
      if (!validDate(receivedDate)) errors.push('Received date must be a valid YYYY-MM-DD date.');
      if (returnDate && (!validDate(returnDate) || returnDate < receivedDate)) errors.push('Return date must be valid and on/after received date.');
      const cardId = string('creditCardId');
      if (cardId && !context.creditCards.some(c => c.id === cardId && c.partnerId === matches[0]?.id)) errors.push('Credit card ID must belong to the selected partner.');
      data = { partnerId: matches[0]?.id || '', amountRupees: amount, profitPercent: rate, receivedDate, returnDate: returnDate || null, creditCardId: cardId || null, notes };
    }
    const duplicate = !errors.length && existing.some(previous => kind === 'partners'
      ? normalized(previous.name) === normalized(data.name) || (data.email && normalized(previous.email) === normalized(data.email)) || (phoneKey(data.phone) && phoneKey(previous.phone) === phoneKey(data.phone))
      : importFingerprint(kind, previous) === importFingerprint(kind, data));
    if (!errors.length && !duplicate) existing.push(data);
    return { rowNumber, values, data, status: errors.length ? 'rejected' : duplicate ? 'duplicate' : 'ready',
      messages: errors.length ? errors : duplicate ? ['Possible duplicate in existing records or this file. Skipped; review and enter manually if intentional.'] : [] };
  });
}
