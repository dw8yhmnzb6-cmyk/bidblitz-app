const {chromium} = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route("https://bidblitz.test/**",route=>route.fulfill({
      contentType:"text/html",
      body:'<!doctype html><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font:16px system-ui}main{padding:16px}button{max-width:100%;white-space:normal}</style><h1>Alle Projekte</h1><main><section id="box"></section></main>'
    }));
    await page.goto("https://bidblitz.test/admin/projects");
    await page.addScriptTag({path:path.resolve(__dirname,"../../frontend/public/admin-box-native.js")});
    await page.evaluate(()=>{
      window.requests=[];
      window.answer={status:200,body:{applications:[],has_more:false,next_cursor:null}};
      window.testFetch=async (url,options)=>{
        window.requests.push({url,credentials:options.credentials,cache:options.cache});
        return {ok:window.answer.status===200,status:window.answer.status,json:async()=>window.answer.body};
      };
      window.handle=window.BidBlitzBoxInbox.mount(document.getElementById("box"),{fetcher:window.testFetch});
    });
    async function load(status,body,expected) {
      await page.evaluate(({status,body})=>window.answer={status,body},{status,body});
      await page.getByRole("button",{name:"Bewerbungen laden",exact:true}).click();
      await page.waitForFunction(text=>document.querySelector('[role="status"]').textContent===text,expected);
    }
    await load(200,{applications:[],has_more:false,next_cursor:null},
      "Es sind noch keine Standortbewerbungen eingegangen.");
    await load(401,{},"Deine BidBlitz-Anmeldung ist abgelaufen. Bitte erneut anmelden.");
    await load(403,{},"Für dein Konto fehlt die Berechtigung für diesen BOX-Bereich.");
    await load(503,{},"Die interne BOX-Anbindung ist noch nicht verfügbar.");
    const evil='<img src=x onerror="window.XSS=true">';
    await load(200,{applications:[{business:evil,reference:"BPA-test",city:"Prishtina"}],has_more:true,next_cursor:5},
      "1 Bewerbungen angezeigt.");
    assert.equal(await page.locator("#box img").count(),0);
    assert.equal(await page.locator("#box article h3").textContent(),evil);
    await page.evaluate(()=>window.answer={status:200,body:{
      applications:[{business:"Zweites Geschäft"}],has_more:false,next_cursor:null}});
    await page.getByRole("button",{name:"Weitere Bewerbungen",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll("#box article").length===2);
    assert((await page.evaluate(()=>window.requests.at(-1).url)).endsWith("after=5"));
    assert.equal(await page.locator("#box a, #box iframe").count(),0);
    assert.equal(page.url(),"https://bidblitz.test/admin/projects");
    assert(await page.evaluate(()=>window.requests.every(r=>r.credentials==="same-origin"&&r.cache==="no-store")));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.evaluate(()=>window.BidBlitzBoxInbox.mount(document.getElementById("box")));
    assert.equal(await page.locator("#box h2").count(),1);
    await load(200,{applications:[null],has_more:false,next_cursor:null},"Ungültige Bewerbung.");
    await page.evaluate(()=>window.handle.destroy());
    console.log("PASS: mobile native inbox, empty state, 401/403/503, safe text rendering, pagination, same-origin/no-store, no redirects/iframe, no overflow, duplicate mount, malformed data, teardown.");
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
