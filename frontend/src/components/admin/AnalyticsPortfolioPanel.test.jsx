import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsPortfolioPanel from './AnalyticsPortfolioPanel';

const EXTRA_PROJECTS = ['bidblitz_main', 'power', 'verify', 'iptv', 'games', 'fuel', 'identity', 'stack'];
const portfolio = (days = 7) => ({
  period_days: days, as_of: '2026-10-27T01:30:00+00:00', timezone: 'UTC',
  data_scope: 'v1_project_events_only', verified_revenue_included: false,
  projects: [
    { project: 'trade', period_days: days, totals: {page_view: 12, signup_completed: 2},
      daily: {'2026-10-26': {page_view: 4}, '2026-10-27': {page_view: 8, signup_completed: 2}},
      data_scope: 'v1_project_events_only', verified_revenue_included: false },
    { project: 'eyes', period_days: days, totals: {page_view: 5, checkout_started: 3},
      daily: {'2026-10-27': {page_view: 5, checkout_started: 3}},
      data_scope: 'v1_project_events_only', verified_revenue_included: false },
    ...EXTRA_PROJECTS.map(project => ({
      project, period_days: days, totals: {}, daily: {},
      data_scope: 'v1_project_events_only', verified_revenue_included: false,
    })),
  ],
  summary: {
    project_count: 10, totals: { page_view: 17, signup_completed: 2, checkout_started: 3 },
    data_scope: 'v1_project_events_only', verified_revenue_included: false,
    unique_visitors: null, net_profit_available: false,
  },
});
const ok = (body) => ({ok:true, status:200, json:async()=>body});
let container, root, originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());container.remove();
  global.fetch = originalFetch;
});
// This suite uses react-dom/client without Testing Library rendering helpers.
// eslint-disable-next-line testing-library/no-unnecessary-act
const mount = async () => {await act(async () => {root.render(<AnalyticsPortfolioPanel />);});};
const click = async (label) => {const b=[...container.querySelectorAll('button')].find(x=>x.textContent===label);await act(async()=>b.click());};
const select = async (label,value) => {const s=container.querySelector(`select[aria-label="${label}"]`);await act(async()=>{s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));});};

test('shows recorded counters, project filter and no invented revenue',async()=>{
  global.fetch=jest.fn().mockResolvedValue(ok(portfolio()));await mount();
  const values=()=>[...container.querySelectorAll('article')].map(x=>x.textContent);
  expect(values()[0]).toContain('17');expect(values()[3]).toContain('Nicht angebunden');
  await select('Projekt','trade');expect(values()[0]).toContain('12');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/analytics\/v1\/portfolio\?days=7$/);
  expect(global.fetch.mock.calls[0][1].credentials).toBe('include');
});

test.each([[401,'Bitte erneut anmelden'],[403,'Adminrechte'],[404,'noch nicht verfügbar'],[500,'nicht geladen']])('HTTP %s is visible without fabricated zero counters',async(status,message)=>{
  global.fetch=jest.fn().mockResolvedValue({ok:false,status});await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain(message);
  expect(container.querySelector('article')).toBeNull();
});

test('empty event storage has an explicit coverage warning',async()=>{
  const data=portfolio();data.projects.forEach(p=>{p.totals={};p.daily={};});data.summary.totals={};
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="status"]').textContent).toContain('Keine aufgezeichneten V1-Ereignisse');
  expect(container.textContent).toContain('keine eindeutigen Besucher');
});

test('malformed successful responses are errors, not empty dashboards',async()=>{
  global.fetch=jest.fn().mockResolvedValue(ok({projects:[]}));await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain('kein gültiges Portfolio');
  expect(container.querySelector('article')).toBeNull();
});

test('retry recovers from an unavailable API',async()=>{
  global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:500}).mockResolvedValueOnce(ok(portfolio()));
  await mount();await click('Erneut versuchen');
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelectorAll('article')).toHaveLength(4);
});

test('network errors clear stale data on refresh',async()=>{
  global.fetch=jest.fn().mockResolvedValueOnce(ok(portfolio())).mockRejectedValueOnce(new TypeError('Network failed'));
  await mount();await click('Aktualisieren');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test('unexpected transport errors never expose internal exception details',async()=>{
  global.fetch=jest.fn().mockRejectedValue(new Error('INTERNAL_API_TOKEN_SENTINEL'));
  await mount();
  const alert=container.querySelector('[role="alert"]');
  expect(alert).not.toBeNull();
  expect(alert.textContent).toContain('Die Analysedaten konnten nicht geladen werden.');
  expect(container.textContent).not.toContain('INTERNAL_API_TOKEN_SENTINEL');
  expect(container.querySelector('article')).toBeNull();
});

test('non-Error transport rejections show a safe error instead of a stuck loading screen',async()=>{
  global.fetch=jest.fn().mockRejectedValue(null);
  await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain('Die Analysedaten konnten nicht geladen werden.');
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test('period changes discard late responses from the previous period',async()=>{
  let finishOld;
  global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(resolve=>finishOld=resolve))
    .mockResolvedValueOnce(ok(portfolio(30)));
  await mount();expect(container.querySelector('[role="status"]').textContent).toContain('geladen');
  await select('Zeitraum','30');
  const old=portfolio(7);old.projects[0].totals.page_view=999;
  await act(async()=>finishOld(ok(old)));
  expect(container.querySelector('[aria-label="Zeitraum"]').value).toBe('30');
  expect(container.querySelector('article').textContent).toContain('17');
  expect(container.textContent).not.toContain('999');
  expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
});

test.each(['duplicate','negative','unknown','noninteger'])('rejects %s project counts instead of showing misleading values',async(kind)=>{
  const data=portfolio();
  if(kind==='duplicate')data.projects.push({...data.projects[0]});
  if(kind==='negative')data.projects[0].totals.page_view=-1;
  if(kind==='unknown')data.projects[0].project='foreign-tenant';
  if(kind==='noninteger')data.projects[0].totals.page_view=1.5;
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test.each(['missing','mismatch','unknown','negative','revenue','badCount','unverified'])('rejects %s summaries rather than displaying misleading portfolio totals',async(kind)=>{
  const data=portfolio();
  if(kind==='missing')delete data.summary;
  if(kind==='mismatch')data.summary.totals.page_view=18;
  if(kind==='unknown')data.summary.totals.personal_email=1;
  if(kind==='negative')data.summary.totals.page_view=-1;
  if(kind==='revenue')data.summary.verified_revenue_included=true;
  if(kind==='badCount')data.summary.project_count=3;
  if(kind==='unverified')data.summary.unique_visitors=123;
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test('rejects unsafe portfolio sums that exceed JavaScript safe integers',async()=>{
  const data=portfolio();
  data.projects[0].totals.page_view=Number.MAX_SAFE_INTEGER;
  data.projects[0].daily={'2026-10-27':{page_view:Number.MAX_SAFE_INTEGER,signup_completed:2}};
  data.projects[1].totals.page_view=1;
  data.projects[1].daily['2026-10-27'].page_view=1;
  data.summary.totals.page_view=Number.MAX_SAFE_INTEGER;
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain('ungültige Ereigniszähler');
  expect(container.querySelector('article')).toBeNull();
});

test('daily graph combines recorded UTC page views without additional API calls',async()=>{
  global.fetch=jest.fn().mockResolvedValue(ok(portfolio()));await mount();
  const chart=container.querySelector('[aria-label="Tagesverlauf"]');
  expect(chart).not.toBeNull();
  expect(chart.querySelector('[data-day="2026-10-27"]').textContent).toContain('13');
  expect(chart.querySelector('[data-day="2026-10-26"]').textContent).toContain('4');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('daily graph respects project filter',async()=>{
  global.fetch=jest.fn().mockResolvedValue(ok(portfolio()));await mount();
  await select('Projekt','trade');
  const chart=container.querySelector('[aria-label="Tagesverlauf"]');
  expect(chart.querySelector('[data-day="2026-10-27"]').textContent).toContain('8');
  expect(chart.querySelector('[data-day="2026-10-26"]').textContent).toContain('4');
});

test.each(['missing','mismatch','unknown_event','bad_date','out_of_window','negative'])(
  'rejects %s daily history rather than displaying a false chart',async(kind)=>{
  const data=portfolio();
  const trade=data.projects[0];
  if(kind==='missing')delete trade.daily;
  if(kind==='mismatch')trade.daily['2026-10-27'].page_view=7;
  if(kind==='unknown_event')trade.daily['2026-10-27'].customer_email=1;
  if(kind==='bad_date')trade.daily['2026-02-30']={page_view:1};
  if(kind==='out_of_window')trade.daily['2026-01-01']={page_view:1};
  if(kind==='negative')trade.daily['2026-10-27'].page_view=-1;
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Tagesverlauf"]')).toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test.each([
  ['date-only', '2026-10-27'],
  ['missing UTC offset', '2026-10-27T01:30:00'],
  ['non-UTC offset', '2026-10-27T01:30:00+02:00'],
  ['invalid calendar date', '2026-02-30T01:30:00+00:00'],
  ['non-string timestamp', 1793064600000],
])('rejects %s as_of metadata before drawing misleading trends', async (_kind, asOf) => {
  const data = portfolio(); data.as_of = asOf;
  global.fetch = jest.fn().mockResolvedValue(ok(data)); await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain('kein gültiges Portfolio');
  expect(container.querySelector('article')).toBeNull();
});

test.each(['2026-10-27T01:30:00Z', '2026-10-27T01:30:00.123456+00:00'])(
  'accepts valid UTC timestamp %s from the API', async (asOf) => {
    const data = portfolio(); data.as_of = asOf;
    global.fetch = jest.fn().mockResolvedValue(ok(data)); await mount();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(4);
  }
);

test('rejects an incomplete project catalog even when the API summary matches the partial set', async () => {
  const data = portfolio();
  data.projects = data.projects.filter(report => report.project !== 'stack');
  data.summary.project_count = data.projects.length;
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('article')).toBeNull();
});

test('accepts the complete authorized project catalog regardless of response order', async () => {
  const data = portfolio();
  data.projects.reverse();
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
  expect(container.querySelector('article').textContent).toContain('17');
});

test('project comparison shows signup starts and workflow abandonment as event counts', async () => {
  const data = portfolio();
  data.projects[0].totals.signup_started = 6;
  data.projects[0].daily['2026-10-27'].signup_started = 6;
  data.projects[1].totals.flow_abandoned = 4;
  data.projects[1].daily['2026-10-27'].flow_abandoned = 4;
  data.summary.totals.signup_started = 6;
  data.summary.totals.flow_abandoned = 4;
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  const headings = [...container.querySelectorAll('thead th')].map(node => node.textContent);
  expect(headings).toContain('Registrierungen begonnen (Ereignisse)');
  expect(headings).toContain('Abbrüche (Ereignisse)');
  const rows = container.querySelectorAll('tbody tr');
  expect([...rows[0].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(
    ['12', '0', '6', '2', '0', '0']);
  expect([...rows[1].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(
    ['5', '0', '0', '0', '3', '4']);
  expect(container.textContent).toContain('Nicht angebunden');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('project selector limits the new event columns to the selected project', async () => {
  const data = portfolio();
  data.projects[0].totals.signup_started = 6;
  data.projects[0].daily['2026-10-27'].signup_started = 6;
  data.summary.totals.signup_started = 6;
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  await select('Projekt', 'eyes');
  const rows = container.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(1);
  expect([...rows[0].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(
    ['5', '0', '0', '0', '3', '0']);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

const csvResponse = (overrides = {}) => ({
  ok: true, status: 200,
  headers: { get: name => name === 'content-type' ? 'text/csv; charset=utf-8' : null },
  blob: async () => new Blob(['project,utc_date,record_status\r\ntrade,2026-10-27,recorded_events\r\n'], {type: 'text/csv'}),
  ...overrides,
});

test('CSV button requires a validated portfolio and documents full-project scope', async () => {
  let finish;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  const button = [...container.querySelectorAll('button')].find(x => x.textContent === 'CSV exportieren');
  expect(button.disabled).toBe(true);
  await act(async () => finish(ok(portfolio())));
  expect(button.disabled).toBe(false);
  expect(container.textContent).toContain('immer alle registrierten Projekte');
  await select('Projekt', 'trade');
  expect(button.disabled).toBe(false);
});

test('CSV download uses existing admin session, fixed filename and selected period, never project filter', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(portfolio())).mockResolvedValueOnce(csvResponse());
  await mount();
  await select('Projekt', 'trade');
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const createMock = jest.fn(() => 'blob:csv-safe');
  const revokeMock = jest.fn();
  URL.createObjectURL = createMock;
  URL.revokeObjectURL = revokeMock;
  const clicks = [];
  const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    clicks.push({href: this.href, filename: this.download});
  });
  const timeout = jest.spyOn(window, 'setTimeout').mockImplementation(fn => { fn(); return 1; });
  try {
    await click('CSV exportieren');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, opts] = global.fetch.mock.calls[1];
    expect(url).toMatch(/\/api\/analytics\/v1\/portfolio\/export\.csv\?days=7$/);
    expect(url).not.toContain('trade');
    expect(opts.credentials).toBe('include');
    expect(opts.headers.Accept).toBe('text/csv');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(clicks).toEqual([{href: 'blob:csv-safe', filename: 'bidblitz-v1-events-7d.csv'}]);
    expect(revokeMock).toHaveBeenCalledWith('blob:csv-safe');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    timeout.mockRestore(); clickSpy.mockRestore();
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
  }
});

test.each([
  [401, 'Bitte erneut anmelden.'],
  [403, 'Adminrechte'],
  [404, 'noch nicht verfügbar'],
  [503, 'derzeit nicht verfügbar'],
])('CSV HTTP %s fails closed without creating a download', async (status, expected) => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(portfolio()))
    .mockResolvedValueOnce({ok: false, status});
  await mount();
  await click('CSV exportieren');
  expect(container.querySelector('[role="alert"]').textContent).toContain(expected);
  expect(container.querySelector('article')).not.toBeNull();
});

test.each([
  ['JSON disguised as success', {headers: {get: () => 'application/json'}}, 'keine gültige CSV'],
  ['oversized announced file', {headers: {get: name => name === 'content-type' ? 'text/csv' : '2097153'}}, 'keine gültige CSV'],
  ['empty CSV body', {blob: async () => new Blob([])}, 'leer oder zu groß'],
  ['oversized CSV body', {blob: async () => new Blob([new Uint8Array(2097153)])}, 'leer oder zu groß'],
])('CSV rejects %s without starting any download', async (_kind, override, expected) => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(portfolio()))
    .mockResolvedValueOnce(csvResponse(override));
  await mount();
  await click('CSV exportieren');
  expect(container.querySelector('[role="alert"]').textContent).toContain(expected);
});

test('CSV transport failure hides internal exception text and allows retry', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(portfolio()))
    .mockRejectedValueOnce(new Error('SENSITIVE_TOKEN_DEBUG'))
    .mockResolvedValueOnce({ok: false, status: 503});
  await mount();
  await click('CSV exportieren');
  expect(container.querySelector('[role="alert"]').textContent).toContain('konnte nicht erstellt');
  expect(container.textContent).not.toContain('SENSITIVE_TOKEN_DEBUG');
  await click('CSV exportieren');
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(container.querySelector('[role="alert"]').textContent).toContain('derzeit nicht verfügbar');
});

test('changing time window aborts pending CSV so stale data is never downloaded', async () => {
  let finishCsv;
  global.fetch = jest.fn().mockResolvedValueOnce(ok(portfolio()))
    .mockImplementationOnce(() => new Promise(resolve => { finishCsv = resolve; }))
    .mockResolvedValueOnce(ok(portfolio(30)));
  await mount();
  await click('CSV exportieren');
  const signal = global.fetch.mock.calls[1][1].signal;
  expect(signal.aborted).toBe(false);
  expect(container.textContent).toContain('CSV wird vorbereitet');
  await select('Zeitraum', '30');
  expect(signal.aborted).toBe(true);
  await act(async () => finishCsv(csvResponse()));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('[aria-label="Zeitraum"]').value).toBe('30');
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
