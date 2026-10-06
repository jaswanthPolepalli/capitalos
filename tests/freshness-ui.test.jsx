// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DataStatus } from '../client/src/components/DataStatus';
import { PublicPortalPage } from '../client/src/pages/PublicPortalPage';
const mock = vi.hoisted(() => ({ state: {}, listeners: new Set(), load: vi.fn(), partner: vi.fn() }));
vi.mock('../client/src/store', () => ({ getLoadState: () => mock.state, loadAll: mock.load,
  subscribe: fn => { mock.listeners.add(fn); return () => mock.listeners.delete(fn); }, getPartner: mock.partner }));
beforeEach(() => { vi.stubGlobal('React', React); mock.load.mockClear(); mock.partner.mockClear(); mock.state = { status: 'loading', hasData: false, error: null, lastSuccess: null, isStale: false }; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function publish(state) { act(() => { mock.state = { ...mock.state, ...state }; mock.listeners.forEach(fn => fn()); }); }
it('does not show empty-state children on failure and supports retry with retained data', () => {
  render(<DataStatus><h1>No records</h1></DataStatus>);
  expect(screen.queryByText('No records')).toBeNull();
  publish({ status: 'error', error: 'Network unavailable' });
  expect(screen.getByRole('alert').textContent).toContain('Records could not be loaded');
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  expect(mock.load).toHaveBeenCalledTimes(2);
  publish({ hasData: true, lastSuccess: Date.now(), isStale: true });
  expect(screen.getByText('No records')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('Showing saved data');
});
it('shares refresh listeners, checks focus/reconnect and polls only while visible', () => {
  vi.useFakeTimers();
  const view = render(<><DataStatus>{null}</DataStatus><DataStatus>{null}</DataStatus></>);
  expect(mock.load).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(1001); window.dispatchEvent(new Event('focus')); });
  expect(mock.load).toHaveBeenCalledTimes(2);
  act(() => { vi.advanceTimersByTime(1001); window.dispatchEvent(new Event('online')); });
  expect(mock.load).toHaveBeenCalledTimes(3);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => { vi.advanceTimersByTime(60000); }); expect(mock.load).toHaveBeenCalledTimes(3);
  visibility.mockRestore();
  act(() => { document.dispatchEvent(new Event('visibilitychange')); }); expect(mock.load).toHaveBeenCalledTimes(4);
  act(() => { vi.advanceTimersByTime(60000); }); expect(mock.load).toHaveBeenCalledTimes(5);
  view.unmount();
  act(() => { vi.advanceTimersByTime(60000); window.dispatchEvent(new Event('focus')); });
  expect(mock.load).toHaveBeenCalledTimes(5);
});
it('shows a portal load error instead of spinning or resolving a missing token prematurely', () => {
  render(<MemoryRouter initialEntries={['/p/partner-p']}><Routes><Route path="/p/:token" element={<PublicPortalPage />} /></Routes></MemoryRouter>);
  expect(mock.partner).not.toHaveBeenCalled();
  publish({ status: 'error', error: 'Loading timed out.' });
  expect(screen.getByRole('alert').textContent).toContain('Loading timed out');
  expect(screen.getByRole('button', { name: 'Retry loading' })).toBeTruthy();
  expect(mock.partner).not.toHaveBeenCalled();
});

it('keeps healthy data and routine background refreshes free of the page banner', () => {
  mock.state = { status: 'ready', hasData: true, error: null, lastSuccess: Date.now(), isStale: false };
  render(<DataStatus><h1>Workspace</h1></DataStatus>);
  expect(screen.getByText('Workspace')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Data freshness' })).toBeNull();
  publish({ status: 'loading', isStale: true });
  expect(screen.queryByRole('region', { name: 'Data freshness' })).toBeNull();
  publish({ status: 'ready', isStale: true });
  expect(screen.getByRole('region', { name: 'Data freshness' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh records' })).toBeTruthy();
});
