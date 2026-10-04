import { projectCustomerControls, separateProjectUrl } from './projectCustomerControls';

test('shared BidBlitz accounts open existing customer and audited wallet tools', () => {
  const tools = projectCustomerControls({ id: 'pay', open_mode: 'internal' });
  expect(tools.customerPath).toBe('/admin/manage');
  expect(tools.creditPath).toBe('/admin/wallet');
  expect(tools.note).toContain('Gemeinsame BidBlitz');
});

test('catalogue metadata cannot invent native or remote financial permissions', () => {
  expect(projectCustomerControls({ id: 'unknown', open_mode: 'internal', native_path: '/admin/wallet' }).available).toBe(false);
  expect(projectCustomerControls({ id: 'eyes', open_mode: 'unavailable' }).available).toBe(false);
  expect(projectCustomerControls({ id: 'trade', open_mode: 'sso' }).note).toContain('keine Broker- oder Wallet');
  expect(projectCustomerControls({ id: 'stack', open_mode: 'sso' }).actions).toEqual(['Organisationen ansehen']);
});

test.each(['javascript:alert(1)', 'https://user:password@example.com', 'https://example.com?token=secret', 'https://example.com#code=secret', '/admin/wallet', 'https://example.com:8001', 'https://example.com\\@evil.test'])('rejects unsafe separate login links: %s', url => {
  expect(separateProjectUrl({ admin_url: url })).toBeNull();
});

test('valid HTTPS links permit an explicitly separate login without issuing codes', () => {
  expect(separateProjectUrl({ url: 'https://eyes.bidblitz.ae', status: 'coming_soon' })).toBe('https://eyes.bidblitz.ae/');
  expect(separateProjectUrl({ url: 'https://eyes.bidblitz.ae', status: 'hidden' })).toBeNull();
});

test('observed public project sites are separate from central account capabilities', () => {
  expect(separateProjectUrl({ id: 'aion', status: 'coming_soon', admin_url: null, url: null })).toBe('https://aion.bidblitz.ae/');
  expect(projectCustomerControls({ id: 'aion', open_mode: 'unavailable' }).available).toBe(false);
  expect(separateProjectUrl({ id: 'passport', admin_url: null, url: null })).toBeNull();
  expect(separateProjectUrl({ id: 'games', admin_url: null, url: null })).toBeNull();
});
