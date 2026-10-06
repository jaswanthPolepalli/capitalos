export type ImportKind = 'partners' | 'allocations';
export interface ImportSourceRow { rowNumber: number; values: Record<string, string> }
export interface ImportPreviewRow extends ImportSourceRow { data: Record<string, string | number | null>; status: 'ready' | 'duplicate' | 'rejected'; messages: string[] }
export interface ImportContext {
  partners: Array<{ id: string; name: string; email?: string; phone?: string }>;
  allocations: Array<{ id: string; partnerId: string; amountRupees: number; profitPercent: number; receivedDate: string; returnDate: string | null; creditCardId: string | null }>;
  creditCards: Array<{ id: string; partnerId: string }>;
}
export const IMPORT_FIELDS: Record<ImportKind, string[]>;
export const REQUIRED_FIELDS: Record<ImportKind, string[]>;
export function importFingerprint(kind: ImportKind, data: Record<string, string | number | null>): string;
export function previewImport(kind: ImportKind, rows: ImportSourceRow[], context: ImportContext): ImportPreviewRow[];

export function validDate(value: string): boolean;
