import { createBidBlitzAnalytics, ANALYTICS_EVENTS } from './bidblitzAnalytics';

const setup = (consent = true, response = { ok: true }) => {
  const fetchImpl = jest.fn().mockResolvedValue(response);
  const analytics = createBidBlitzAnalytics({
    project: 'bidblitz_main',
    endpoint: '/api/analytics/track', allowedPaths: ['/', '/home', '/pricing'],
    hasConsent: () => consent,
    fetchImpl,
  });
  return { analytics, fetchImpl };
};

describe('shared analytics privacy contract', () => {
  test('does not send anything without consent', async () => {
    const { analytics, fetchImpl } = setup(false);
    expect(await analytics.track('page_view', { path: '/home?email=private' })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('rejects unknown events before network', async () => {
    const { analytics, fetchImpl } = setup();
    expect(await analytics.track('password_entered')).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('only sends allowlisted event fields and strips URL query/hash', async () => {
    const { analytics, fetchImpl } = setup();
    expect(await analytics.track('cta_click', {
      path: '/pricing?email=test@example.com#section',
      label: 'start_checkout',
      email: 'must-not-be-sent@example.com',
      amount: 100,
    })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/analytics/track');
    const payload = JSON.parse(opts.body);
    expect(payload).toMatchObject({
      project: 'bidblitz_main', event: 'cta_click', path: '/pricing', label: 'start_checkout',
    });
    expect(payload.email).toBeUndefined();
    expect(payload.amount).toBeUndefined();
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  test('rejects unsafe destinations', () => {
    for (const endpoint of ['https://tracker.example', '//tracker.example/x', '/api/events?token=x']) {
      expect(() => createBidBlitzAnalytics({
        project: 'bidblitz_main', endpoint, allowedPaths: ['/'], hasConsent: () => true, fetchImpl: jest.fn(),
      })).toThrow();
    }
  });

  test('network errors never interrupt customer flow', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const analytics = createBidBlitzAnalytics({
      project: 'trade', endpoint: '/api/analytics/track', allowedPaths: ['/', '/home', '/pricing'], hasConsent: () => true, fetchImpl,
    });
    expect(await analytics.track('signup_started')).toBe(false);
  });

  test('all documented event types are unique', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
  test('rejects paths with dynamic identifiers and private text', async () => {
    const { analytics, fetchImpl } = setup();
    expect(await analytics.track('page_view', { path: '/users/12345' })).toBe(false);
    expect(await analytics.track('page_view', { path: '/user/name@example.com' })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('browser cannot report a completed payment', async () => {
    const { analytics, fetchImpl } = setup();
    expect(await analytics.track('checkout_completed')).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('rejects unregistered but syntactically valid customer slugs', async () => {
    const { analytics, fetchImpl } = setup();
    expect(await analytics.track('page_view', { path: '/users/alice' })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('revoked consent blocks subsequent events', async () => {
    let consent = true;
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const analytics = createBidBlitzAnalytics({
      project: 'trade', endpoint: '/api/analytics/track', allowedPaths: ['/', '/home', '/pricing'],
      hasConsent: () => consent, fetchImpl,
    });
    expect(await analytics.track('page_view')).toBe(true);
    consent = false;
    expect(await analytics.track('page_view')).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

});
