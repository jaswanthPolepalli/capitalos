export function deletedAt(notes) {
  return typeof notes === 'string' && notes.startsWith('DELETED:') ? notes.slice(8).split('\n')[0] : null;
}
export function originalNotes(notes) {
  return deletedAt(notes) ? notes.replace(/^DELETED:[^\n]*\n?/, '') : (notes || '');
}
export function visibility(type, row, partners, allocations) {
  const own = deletedAt(row.notes);
  if (type !== 'partners') {
    const partner = partners.find(p => String(p.ROWID) === String(row.partner_id));
    if (!partner || deletedAt(partner.notes)) return { deleted: true, deletedAt: own || deletedAt(partner?.notes), restoreBlocked: 'Restore the partner first.', deletedBecause: 'Partner unavailable' };
  }
  if (type === 'capital-returns' || type === 'profit-records') {
    const parent = allocations.find(a => String(a.ROWID) === String(row.allocation_id));
    if (!parent || deletedAt(parent.notes)) return { deleted: true, deletedAt: own || deletedAt(parent?.notes), restoreBlocked: 'Restore the contribution first.', deletedBecause: 'Contribution unavailable' };
  }
  return { deleted: Boolean(own), deletedAt: own, restoreBlocked: '', deletedBecause: own ? 'Deleted directly' : '' };
}
