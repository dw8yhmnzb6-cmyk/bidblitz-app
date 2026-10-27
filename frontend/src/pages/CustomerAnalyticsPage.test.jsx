import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CustomerAnalyticsPage from './CustomerAnalyticsPage';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const sites=(items=[{site_id:A,display_name:'Shop A'}])=>({sites:items,has_more:false});
const stats=(site=A,days=7,count=12)=>({site_id:site,period_days:days,timezone:'UTC',
 as_of:'2026-10-27T01:40:00+00:00',data_scope:'tenant_site_v1_events_only',
 verified_revenue_included:false,has_recorded_events:true,
 totals:{page_view:count,cta_click:3},daily:{'2026-10-27':{page_view:count,cta_click:3}}});
const ok=(body)=>({ok:true,status:200,json:async()=>body});
let container,root,originalFetch;
beforeEach(()=>{originalFetch=global.fetch;global.IS_REACT_ACT_ENVIRONMENT=true;
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();global.fetch=originalFetch;});
const mount=async(props={})=>{await act(async()=>root.render(<CustomerAnalyticsPage accountId="owner-a" {...props}/>));};
const choose=async(label,value)=>{await act(async()=>{const e=container.querySelector(`select[aria-label="${label}"]`);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));});};
const click=async(text)=>{await act(async()=>[...container.querySelectorAll('button')].find(e=>e.textContent===text).click());};
const queue=(report=stats(),list=sites())=>{global.fetch=jest.fn().mockResolvedValueOnce(ok(list)).mockResolvedValueOnce(ok(report));};

test('guest sees login and performs no analytics requests',async()=>{
 global.fetch=jest.fn();const onLogin=jest.fn();await mount({accountId:null,onLogin});
 expect(container.textContent).toContain('Melde dich an');expect(global.fetch).not.toHaveBeenCalled();
 await click('Anmelden');expect(onLogin).toHaveBeenCalledTimes(1);
});

test('owned site and statistics load through customer routes only',async()=>{
 queue();await mount();expect(container.querySelector('article').textContent).toContain('12');
 expect(container.textContent).toContain('Nicht angebunden');
 expect(global.fetch.mock.calls.map(([path])=>path)).toEqual([
  expect.stringMatching(/\/api\/analytics\/v1\/my\/sites$/),
  expect.stringMatching(new RegExp(`/my/sites/${A}/overview\\?days=7$`))]);
 for(const [,options] of global.fetch.mock.calls)expect(options.credentials).toBe('include');
 expect(container.textContent).not.toContain('owner-a');
});

test('no site assignment is a useful empty state without an overview request',async()=>{
 global.fetch=jest.fn().mockResolvedValue(ok(sites([])));await mount();
 expect(container.textContent).toContain('Noch keine bestätigte Website zugeordnet');
 expect(global.fetch).toHaveBeenCalledTimes(1);expect(container.querySelector('article')).toBeNull();
});

test('site selector requests the chosen owned site and clears the prior result',async()=>{
 queue(stats(),sites([{site_id:A,display_name:'Shop A'},{site_id:B,display_name:'Shop B'}]));await mount();
 global.fetch.mockResolvedValueOnce(ok(stats(B,7,8)));await choose('Website',B);
 expect(global.fetch.mock.calls[2][0]).toContain(`/my/sites/${B}/overview?days=7`);
 expect(container.querySelector('article').textContent).toContain('8');
});

test('period selector uses rolling days and validates response period',async()=>{
 queue();await mount();global.fetch.mockResolvedValueOnce(ok(stats(A,30,25)));
 await choose('Zeitraum','30');expect(container.querySelector('article').textContent).toContain('25');
 expect(global.fetch.mock.calls[2][0]).toContain('days=30');
});

test.each([401,403,404,500])('site list HTTP %s is explicit and does not query statistics',async(status)=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,status});await mount();
 expect(container.querySelector('[role="alert"]')).not.toBeNull();
 expect(container.querySelector('article')).toBeNull();expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('revoked site response removes old counters on reload',async()=>{
 queue();await mount();global.fetch.mockResolvedValueOnce({ok:false,status:404});
 await click('Statistik aktualisieren');expect(container.querySelector('[role="alert"]').textContent).toContain('nicht verfügbar');
 expect(container.querySelector('article')).toBeNull();
});

test('report for a different site is not displayed',async()=>{
 queue(stats(B));await mount();expect(container.querySelector('[role="alert"]').textContent).toContain('passt nicht');
 expect(container.querySelector('article')).toBeNull();
});

test('empty recorded data is labeled instead of claiming collection is healthy',async()=>{
 queue({...stats(),totals:{},daily:{},has_recorded_events:false});await mount();
 expect(container.querySelector('[role="status"]').textContent).toContain('nicht ableiten');
 expect(container.querySelector('article').textContent).toContain('0');
});

test.each(['unknown-id','duplicate','bad-label'])('malformed site list %s cannot select arbitrary API paths',async(kind)=>{
 const list=sites();if(kind==='unknown-id')list.sites[0].site_id='../../admin';
 if(kind==='duplicate')list.sites.push({...list.sites[0]});if(kind==='bad-label')list.sites[0].display_name=null;
 global.fetch=jest.fn().mockResolvedValue(ok(list));await mount();
 expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('late response after site change cannot replace the current site',async()=>{
 let finish;global.fetch=jest.fn().mockResolvedValueOnce(ok(sites([{site_id:A,display_name:'Shop A'},{site_id:B,display_name:'Shop B'}])))
 .mockImplementationOnce(()=>new Promise(resolve=>finish=resolve)).mockResolvedValueOnce(ok(stats(B,7,8)));
 await mount();await choose('Website',B);await act(async()=>finish(ok(stats(A,7,999))));
 expect(container.querySelector('article').textContent).toContain('8');expect(container.textContent).not.toContain('999');
 expect(global.fetch.mock.calls[1][1].signal.aborted).toBe(true);
});

test('account change clears old sites and never displays the previous account report',async()=>{
 queue();await mount();global.fetch.mockResolvedValueOnce(ok(sites([])));await mount({accountId:'owner-b'});
 expect(container.textContent).not.toContain('Shop A');expect(container.querySelector('article')).toBeNull();
 expect(container.textContent).toContain('Noch keine bestätigte Website zugeordnet');
});

test('failed site list can be retried',async()=>{
 global.fetch=jest.fn().mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValueOnce(ok(sites())).mockResolvedValueOnce(ok(stats()));
 await mount();await click('Website-Liste erneut laden');expect(container.querySelectorAll('article')).toHaveLength(4);
});

test('failed statistics can be retried without another metadata request',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(ok(sites())).mockResolvedValueOnce({ok:false,status:500}).mockResolvedValueOnce(ok(stats()));
 await mount();await click('Statistik erneut laden');expect(container.querySelectorAll('article')).toHaveLength(4);
 expect(global.fetch).toHaveBeenCalledTimes(3);
});

test.each(['negative','wrong-period','payment-claim'])('rejects misleading report %s',async(kind)=>{
 const report=stats();if(kind==='negative')report.totals.page_view=-1;
 if(kind==='wrong-period')report.period_days=90;if(kind==='payment-claim')report.verified_revenue_included=true;
 queue(report);await mount();expect(container.querySelector('[role="alert"]')).not.toBeNull();
 expect(container.querySelector('article')).toBeNull();
});
