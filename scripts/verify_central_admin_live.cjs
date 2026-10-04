const fs=require('node:fs');const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const token=fs.readFileSync('/tmp/bidblitz-admin-browser-cookie.txt','utf8').trim();const browser=await chromium.launch({headless:true});
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:'access_token',value:token,domain:'bidblitz.ae',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='bidblitz.ae'||!['GET','HEAD'].includes(req.method()))return route.abort();return route.continue();});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://bidblitz.ae/admin',{waitUntil:'domcontentloaded'});
const button=page.getByTestId('admin-all-projects');await button.waitFor({state:'visible',timeout:30000});const box=await button.boundingBox();assert(box.y<650);
const response=page.waitForResponse(r=>r.url().includes('/api/admin/projects')&&r.status()===200);await button.click();await response;
await page.getByRole('heading',{name:'Alle Projekte',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/admin/projects');
assert(await page.getByText('BIDTAX',{exact:true}).count()>0);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
console.log(JSON.stringify({viewport:width,visibleProjectEntry:true,ownerCatalogueHTTP:200,projectsPage:true,noOverflow:true,noPageErrors:true}));await context.close();}}
finally{await browser.close();fs.rmSync('/tmp/bidblitz-admin-browser-cookie.txt',{force:true});}})().catch(e=>{console.error(e.message);process.exitCode=1;});
