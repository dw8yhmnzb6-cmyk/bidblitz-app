const fs=require('node:fs'), assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const cookieFile='/tmp/bidblitz-admin-browser-cookie.txt';
(async()=>{
 const token=fs.readFileSync(cookieFile,'utf8').trim(), results=[];
 try { for(const [name,type,width] of [['chromium',chromium,1440],['chromium-mobile',chromium,390],['webkit-mobile',webkit,390]]) {
  const browser=await type.launch({headless:true});
  try {
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
   await context.addCookies([{name:'access_token',value:token,url:'https://bidblitz.ae',secure:true,httpOnly:true,sameSite:'Lax'}]);
   await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());return u.hostname==='bidblitz.ae'&&['GET','HEAD'].includes(req.method())?route.continue():route.abort()});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://bidblitz.ae/admin/projects',{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Alle Projekte',exact:true}).waitFor();
   const identity=page.locator('.owner-identity');await identity.waitFor();assert((await identity.innerText()).includes('@'));
   assert.equal(await identity.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
   await page.getByRole('button',{name:'Kunden · Sperren · Gutschriften',exact:true}).click();
   await page.getByRole('heading',{name:'Kunden nach Projekt verwalten',exact:true}).waitFor();
   assert(await page.locator('article').count()>=35);
   const native=page.locator('article').filter({has:page.getByRole('heading',{name:'BidBlitz',exact:true})});
   await native.getByRole('button',{name:'Kunden · Sperren / Entsperren',exact:true}).click();
   await page.getByTestId('admin-management-page').waitFor();
   await page.getByTestId('customer-search-input').waitFor();
   const customer=page.locator('[data-testid^="customer-"][data-testid]:not([data-testid="customer-search-input"]):not([data-testid^="customer-filter-"]):not([data-testid^="customer-kyc-"])').first();
   if(await customer.count()){await customer.click();await page.getByTestId('customer-action-ban').waitFor()}
   await page.goto('https://bidblitz.ae/admin/projects',{waitUntil:'domcontentloaded'});
   const creditCard=page.locator('article').filter({has:page.getByRole('heading',{name:'BidBlitz',exact:true})});
   const walletLoaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/wallet/users'&&r.request().method()==='GET');
   await creditCard.getByRole('button',{name:'Gutschriften & Buchungen',exact:true}).click();
   await page.getByTestId('admin-wallet-page').waitFor();
   await page.getByTestId('user-search-input').waitFor();
   const walletResponse=await walletLoaded;assert.equal(walletResponse.status(),200);await walletResponse.finished();
   const walletUser=page.locator('button[data-testid^="user-row-"]').first();await walletUser.waitFor();
   const historyLoaded=page.waitForResponse(r=>/^\/api\/admin\/wallet\/users\/[^/]+\/login-history$/.test(new URL(r.url()).pathname)&&r.request().method()==='GET');
   await walletUser.click();const historyResponse=await historyLoaded;assert.equal(historyResponse.status(),200);await historyResponse.finished();
   await page.getByTestId('amount-eur').waitFor();await page.getByTestId('reason-input').waitFor();
   await page.getByTestId('submit-btn').waitFor();assert.equal(await page.getByLabel('Admin-Passwort',{exact:true}).inputValue(),'');
   await page.goto('https://bidblitz.ae/admin/projects',{waitUntil:'domcontentloaded'});await identity.waitFor();
   const missing=page.locator('article').filter({has:page.getByRole('heading',{name:'BidBlitz Passport',exact:true})});
   assert(await missing.getByRole('button',{name:'Noch nicht verfügbar',exact:true}).isDisabled());
   await missing.getByRole('button',{name:'Anbindung prüfen',exact:true}).click();
   assert(!await missing.getByRole('button',{name:'Kunden · Sperren / Entsperren',exact:true}).count());
   assert.deepEqual(errors,[]);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
   results.push({browser:name,width,owner_contrast:true,customer_navigation:true,customer_list:true,credit_navigation:true,missing_connections_explained:true,no_account_mutations:true,no_page_errors:true,no_overflow:true});
   console.log('ADMIN_CUSTOMER_UI_VERIFIED',JSON.stringify(results.at(-1)));
  } finally {await browser.close()}
 }
 fs.writeFileSync('/tmp/admin-customer-ui-evidence.json',JSON.stringify(results,null,2));
 if(process.env.ADMIN_VERIFY_EXTERNAL_SSO==='false') {
  fs.writeFileSync('/tmp/admin-customer-sso-evidence.json',JSON.stringify({status:'not_run_in_this_frontend_release',reason:'External project receivers and flags are unchanged. A concurrent Trade frontend deployment replaced the separately verified customer-entry additions; external UI publication requires coordination.'},null,2));
  return;
 }
 const targetResults=[];
 for(const engine of ['chromium','webkit']) {
  fs.writeFileSync(cookieFile,token,{mode:0o600});
  require('node:child_process').execFileSync(process.execPath,['scripts/verify_central_sso_live.cjs'],{stdio:'inherit',env:{...process.env,ADMIN_PLAYWRIGHT_PATH:require.resolve('playwright'),ADMIN_SSO_BROWSER:engine}});
  targetResults.push(...JSON.parse(fs.readFileSync('/tmp/admin-sso-browser-results.json','utf8')).map(row=>({...row,browser:engine})));
 }
 fs.writeFileSync('/tmp/admin-customer-sso-evidence.json',JSON.stringify(targetResults,null,2));
 } finally {fs.rmSync(cookieFile,{force:true})}
 fs.writeFileSync('/tmp/admin-customer-ui-evidence.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
