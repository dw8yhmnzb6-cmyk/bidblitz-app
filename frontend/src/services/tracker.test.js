jest.mock('../components/CookieBanner', () => ({
  getCookieConsent: jest.fn(),
}));
import { getCookieConsent } from '../components/CookieBanner';
import { tracker } from './tracker';

describe('legacy conversion tracker consent and minimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    process.env.REACT_APP_BACKEND_URL = 'https://api.bidblitz.test';
    getCookieConsent.mockReturnValue({ analytics: false });
  });
  test('does not send events or store analytics keys when rejected', () => {
    tracker.guestVisit();
    tracker.registerComplete('customer');
    tracker.pageView('home');
    expect(fetch).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
  test('sends allowlisted event metadata, not payment amounts', () => {
    getCookieConsent.mockReturnValue({ analytics: true });
    tracker.firstPayment(3000, 'card');
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({ event: 'first_payment', meta: { type: 'card' } });
    expect(fetch.mock.calls[0][0]).toBe('https://api.bidblitz.test/api/analytics/track');
  });
  test('refuses potentially sensitive labels', () => {
    getCookieConsent.mockReturnValue({ analytics: true });
    tracker.ctaClick('pay@example.com', '/checkout?token=secret');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.meta).toEqual({});
  });
  test('once tracking is skipped until opt-in', () => {
    tracker.guestVisit();
    getCookieConsent.mockReturnValue({ analytics: true });
    tracker.guestVisit();
    tracker.guestVisit();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('withdrawal aborts pending requests and clears dedupe markers before re-consent', () => {
    const signals = [];
    fetch.mockImplementation((_url, options) => new Promise((resolve, reject) => {
      signals.push(options.signal);
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));

    getCookieConsent.mockReturnValue({ analytics: true });
    tracker.guestVisit();
    expect(sessionStorage.getItem('bb_ev_guest_visit')).toBe('1');

    getCookieConsent.mockReturnValue({ analytics: false });
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { analytics: false } }));
    expect(signals[0].aborted).toBe(true);
    expect(sessionStorage.getItem('bb_ev_guest_visit')).toBeNull();

    tracker.pageView('home');
    expect(fetch).toHaveBeenCalledTimes(1);

    getCookieConsent.mockReturnValue({ analytics: true });
    tracker.guestVisit();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(false);

    getCookieConsent.mockReturnValue({ analytics: false });
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { analytics: false } }));
    expect(signals[1].aborted).toBe(true);
  });

  test('cleans up a request controller when fetch throws synchronously', () => {
    let failedSignal;
    getCookieConsent.mockReturnValue({ analytics: true });
    fetch.mockImplementationOnce((_url, options) => {
      failedSignal = options.signal;
      throw new Error('network unavailable');
    });

    expect(tracker.pageView('home')).toBe(false);
    expect(failedSignal.aborted).toBe(false);

    getCookieConsent.mockReturnValue({ analytics: false });
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { analytics: false } }));
    expect(failedSignal.aborted).toBe(false);
  });
});
