import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsPortfolioPanel from './AnalyticsPortfolioPanel';

const portfolio = (days = 7) => ({
  period_days: days, as_of: '2026-10-27T01:30:00+00:00', timezone: 'UTC',
  data_scope: 'v1_project_events_only', verified_revenue_included: false,
  projects: [
    { project: 'trade', period_days: days, totals: {page_view: 12, signup_completed: 2},
      data_scope: 'v1_project_events_only', verified_revenue_included: false },
    { project: 'eyes', period_days: days, totals: {page_view: 5, checkout_started: 3},
      data_scope: 'v1_project_events_only', verified_revenue_included: false },
  ],
  summary: {
    project_count: 2, totals: { page_view: 17, signup_completed: 2, checkout_started: 3 },
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
  const data=portfolio();data.projects.forEach(p=>p.totals={});data.summary.totals={};
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
  data.projects[1].totals.page_view=1;
  data.summary.totals.page_view=Number.MAX_SAFE_INTEGER;
  global.fetch=jest.fn().mockResolvedValue(ok(data));await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain('ungültige Ereigniszähler');
  expect(container.querySelector('article')).toBeNull();
});
