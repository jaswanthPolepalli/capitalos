// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
const response = data => new Response(JSON.stringify({ status: 'success', data }));
const pathOf = url => url.split('/').at(-1);
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function start(fetcher) {
  vi.resetModules(); vi.stubGlobal('fetch', vi.fn(fetcher));
  const store = await import('../client/src/store');
  await store.loadAll(); return store;
}
it('distinguishes failed first load from empty success and retries reads only', async () => {
  let fail = true;
  const store = await start(async () => fail ? new Response('offline', { status: 503 }) : response([]));
  expect(store.getLoadState()).toMatchObject({ status: 'error', hasData: false, lastSuccess: null });
  fail = false; await store.loadAll();
  expect(store.getLoadState()).toMatchObject({ status: 'ready', hasData: true });
  expect(fetch.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it('keeps the complete last snapshot if a required card endpoint fails or returns malformed data', async () => {
  let failure = '';
  const store = await start(async url => {
    if (failure === pathOf(url)) return response(null);
    return response(pathOf(url) === 'partners' ? [{ id: 'p', name: failure ? 'New snapshot' : 'Saved snapshot' }] : []);
  });
  const lastSuccess = store.getLoadState().lastSuccess;
  failure = 'credit-cards'; await store.loadAll();
  expect(store.getPartners()[0].name).toBe('Saved snapshot');
  expect(store.getLoadState()).toMatchObject({ status: 'error', hasData: true, isStale: true, lastSuccess });
});
it('deduplicates refreshes and times out a stalled fetch so retry remains possible', async () => {
  const store = await start(async () => response([]));
  vi.useFakeTimers();
  fetch.mockImplementation(() => new Promise(() => {}));
  const one = store.loadAll(), two = store.loadAll();
  expect(one).toBe(two);
  await vi.advanceTimersByTimeAsync(20001); await one;
  expect(store.getLoadState().error).toContain('timed out');
  fetch.mockImplementation(async () => response([]));
  await store.loadAll(); expect(store.getLoadState().status).toBe('ready');
});
it('does not overwrite a local save with an older in-flight snapshot', async () => {
  const store = await start(async () => response([]));
  const releases = [];
  fetch.mockImplementation((url, options) => options?.method === 'POST'
    ? Promise.resolve(response({ id: 'p', name: 'Just saved' }))
    : new Promise(resolve => releases.push(() => resolve(response([])))));
  const refresh = store.loadAll();
  await store.addPartner({ name: 'Just saved', phone: '', email: '', notes: '' });
  releases.forEach(release => release()); await refresh;
  expect(store.getPartners()[0].name).toBe('Just saved');
  expect(store.getLoadState()).toMatchObject({ status: 'error', isStale: true });
});
