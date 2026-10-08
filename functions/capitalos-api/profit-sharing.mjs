// Versioned metadata keeps historical payments unchanged and preserves the
// capital basis used when an adjusted rate was confirmed.
const marker = /(?:^|\n)PROFIT_SPLIT_V([1234]):([^\n]*)(?=\n|$)/g;
export function splitProfit(combinedAmountRupees, partnerProfitPercent, profitCapitalRupees, noCfoSplit = false, partnerAmountRupees) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!Number.isSafeInteger(combinedAmountRupees) || combinedAmountRupees <= 0) fail('Enter a positive whole-rupee combined profit amount.');
  if (typeof noCfoSplit !== 'boolean') fail('No CFO split must be a checkbox value.');
  if (noCfoSplit) return { amountRupees: combinedAmountRupees, combinedAmountRupees, cfoShareRupees: 0, noCfoSplit: true };
  if (partnerAmountRupees !== undefined && partnerAmountRupees !== null) {
    if (!Number.isSafeInteger(partnerAmountRupees) || partnerAmountRupees < 1 || partnerAmountRupees > combinedAmountRupees) fail('Enter a positive whole-rupee partner amount no greater than the combined amount.');
    if (partnerProfitPercent !== undefined && partnerProfitPercent !== null) fail('Choose either a partner amount or a percentage.');
    return { amountRupees: partnerAmountRupees, partnerAmountRupees, combinedAmountRupees, cfoShareRupees: combinedAmountRupees - partnerAmountRupees,
      ...(Number.isSafeInteger(profitCapitalRupees) && profitCapitalRupees > 0 ? { profitCapitalRupees } : {}) };
  }
  const adjusted = partnerProfitPercent !== undefined && partnerProfitPercent !== null;
  if (adjusted && (typeof partnerProfitPercent !== 'number' || !Number.isFinite(partnerProfitPercent) || partnerProfitPercent <= 0 || partnerProfitPercent > 100)) fail('Enter a partner profit rate greater than 0 and no more than 100%.');
  if (adjusted && (!Number.isSafeInteger(profitCapitalRupees) || profitCapitalRupees <= 0)) fail('A valid contribution amount is required to adjust the partner rate.');
  const amountRupees = Math.round(adjusted ? profitCapitalRupees * partnerProfitPercent / 100 : combinedAmountRupees * 5 / 7);
  if (amountRupees < 1 || amountRupees > combinedAmountRupees) fail('Partner share must be at least ₹1 and cannot exceed the combined amount.');
  return { amountRupees, combinedAmountRupees, cfoShareRupees: combinedAmountRupees - amountRupees,
    ...(adjusted ? { partnerProfitPercent, profitCapitalRupees } : {}) };
}
export function profitMetadata(notes = '') {
  const value = String(notes);
  const match = [...value.matchAll(marker)][0];
  const [total, rate, capital] = match ? match[2].split(':').map(Number) : [];
  return { notes: value.replace(marker, ''), ...(match ? splitProfit(total, match[1] === '2' ? rate : undefined, capital, match[1] === '3', match[1] === '4' ? rate : undefined) : {}) };
}
export function profitNotes(notes = '', combinedAmountRupees, partnerProfitPercent, profitCapitalRupees, noCfoSplit = false, partnerAmountRupees) {
  const clean = profitMetadata(notes).notes;
  const group = clean.match(/\nPAYMENT_GROUP:[a-zA-Z0-9-]{16,80}$/)?.[0] || '';
  if (combinedAmountRupees === undefined) return clean;
  const split = splitProfit(combinedAmountRupees, partnerProfitPercent, profitCapitalRupees, noCfoSplit, partnerAmountRupees);
  const tag = split.partnerAmountRupees !== undefined ? `PROFIT_SPLIT_V4:${combinedAmountRupees}:${split.partnerAmountRupees}:${split.profitCapitalRupees ?? 0}` : split.noCfoSplit ? `PROFIT_SPLIT_V3:${combinedAmountRupees}` : split.partnerProfitPercent === undefined ? `PROFIT_SPLIT_V1:${combinedAmountRupees}` : `PROFIT_SPLIT_V2:${combinedAmountRupees}:${split.partnerProfitPercent}:${split.profitCapitalRupees}`;
  return `${group ? clean.slice(0, -group.length) : clean}\n${tag}${group}`;
}
export function combinedForPartner(amount) { return Math.round(amount * 7 / 5); }
