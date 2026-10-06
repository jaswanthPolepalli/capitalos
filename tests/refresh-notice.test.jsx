// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DataRefreshNotice } from '../client/src/components/DataRefreshNotice';
const mock = vi.hoisted(() => ({ state: {}, toast: vi.fn() }));
vi.mock('../client/src/useStoreStatus', () => ({ useStoreStatus: () => mock.state }));
vi.mock('../client/src/components/Toast', () => ({ useToast: () => ({ addToast: mock.toast }) }));
beforeEach(() => { vi.stubGlobal('React', React); sessionStorage.clear(); mock.toast.mockClear(); mock.state = { status: 'loading', hasData: false }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows one three-second notice after success, without repeating after refresh or remount', () => {
  const view = render(<DataRefreshNotice />);
  expect(mock.toast).not.toHaveBeenCalled();
  mock.state = { status: 'ready', hasData: true, isStale: false };
  view.rerender(<DataRefreshNotice />);
  expect(mock.toast).toHaveBeenCalledExactlyOnceWith('Records refreshed.', 'success', 3000);
  mock.state = { ...mock.state, status: 'loading' }; view.rerender(<DataRefreshNotice />);
  mock.state = { ...mock.state, status: 'ready' }; view.rerender(<DataRefreshNotice />);
  view.unmount(); render(<DataRefreshNotice />);
  expect(mock.toast).toHaveBeenCalledTimes(1);
});
