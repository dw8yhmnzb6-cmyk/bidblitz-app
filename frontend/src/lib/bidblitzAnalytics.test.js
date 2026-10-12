import { createBidBlitzAnalytics, ANALYTICS_EVENTS } from './bidblitzAnalytics';

const setup = (consent = true, response = { ok: true }) => {
  const fetchImpl = jest.fn().mockResolvedValue(response);
  const analytics = createBidBlitzAnalytics({
    project: 'bidblitz_main',
    endpoint: '/api/analytics/track',
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
        project: 'bidblitz_main', endpoint, hasConsent: () => true, fetchImpl: jest.fn(),
      })).toThrow();
    }
  });

  test('network errors never interrupt customer flow', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const analytics = createBidBlitzAnalytics({
      project: 'trade', endpoint: '/api/analytics/track', hasConsent: () => true, fetchImpl,
    });
    expect(await analytics.track('signup_started')).toBe(false);
  });

  test('all documented event types are unique', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});
