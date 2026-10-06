import { useCallback, useEffect, useState } from 'react';

export async function operationsRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/server/capitalos-api/${path}`, {
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
  const result = await response.json() as { status: string; data: T; message?: string };
  if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to load records. Please retry.');
  return result.data;
}

export function useRemoteList<T>(path: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try { const data = await operationsRequest<T[]>(path, undefined, signal); if (!signal?.aborted) setRows(data); }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load records.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [path]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  return { rows, loading, error, refresh, setRows };
}

export interface ActivityEvent {
  id: string; operationId: string; entityType: string; entityId: string;
  action: string; status: 'pending' | 'committed' | 'unconfirmed'; actor: string; occurredAt: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string;
}
export interface ReminderEvent {
  id: string; obligationId: string; partnerId: string; allocationId: string; kind: 'principal' | 'profit-estimate';
  action: 'prepared' | 'sent' | 'snoozed' | 'note'; channel: string; amountRupees: number;
  dueDate: string; followUpDate: string; notes: string; occurredAt: string;
}
