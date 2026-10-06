export function deletedAt(notes: unknown): string | null;
export function originalNotes(notes: unknown): string;
export interface RecordVisibility { deleted: boolean; deletedAt: string | null; restoreBlocked: string; deletedBecause: string }
export function visibility(type: string, row: Record<string, unknown>, partners: Record<string, unknown>[], allocations: Record<string, unknown>[]): RecordVisibility;
