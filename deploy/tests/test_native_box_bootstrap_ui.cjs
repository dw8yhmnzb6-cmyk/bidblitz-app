const {chromium} = require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

(async()=>{
  const root=path.resolve(__dirname,"../..");
  const candidate=fs.readFileSync(path.join(root,".dev-verification/native-admin-candidate.html"),"utf8");
  const marker="<!-- BIDBLITZ_NATIVE_BOX_INBOX_V1 -->";
  assert(candidate.includes(marker));
  const addition=candidate.slice(candidate.indexOf(marker),candidate.lastIndexOf("</body>"));
  const fixture='<!doctype html><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font:16px system-ui}main{padding:16px}button{max-width:100%}</style><header><div style="display:flex"><h1>Alle Projekte</h1></div></header><main><section class="project-owner">Haupt-Admin · BidBlitz</section></main>'+addition;
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const requests=[];
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());requests.push(url.href);
      if(url.origin!=="https://bidblitz.test")return route.abort();
      if(url.pathname.startsWith("/admin-box-native.")&&url.pathname.endsWith(".js"))
        return route.fulfill({contentType:"application/javascript",body:fs.readFileSync(path.join(root,"frontend/public/admin-box-native.js"),"utf8")});
      if(url.pathname==="/api/admin/box/partner-applications")
        return route.fulfill({contentType:"application/json",body:JSON.stringify({
          applications:[{business:"Testgeschäft",city:"Prishtina",reference:"BPA-fixture",status:"RECEIVED"}],
          has_more:false,next_cursor:null})});
      return route.fulfill({contentType:"text/html",body:fixture});
    });
    await page.goto("https://bidblitz.test/admin/projects");
    const panel=page.locator("#bidblitz-admin-box-link");
    await panel.waitFor({state:"visible"});
    assert(await panel.evaluate(e=>e.parentElement.tagName==="MAIN"));
    assert(await panel.evaluate(e=>e.nextElementSibling.classList.contains("project-owner")));
    await page.getByRole("button",{name:"Bewerbungen laden",exact:true}).click();
    await page.getByRole("heading",{name:"Testgeschäft",exact:true}).waitFor();
    assert.equal(await panel.locator("a,iframe").count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.evaluate(()=>{history.pushState({},"","/admin");dispatchEvent(new PopStateEvent("popstate"));});
    assert.equal(await page.locator("#bidblitz-admin-box-link").count(),0);
    await page.evaluate(()=>{history.pushState({},"","/admin/projects");dispatchEvent(new PopStateEvent("popstate"));});
    await page.locator("#bidblitz-admin-box-link").waitFor({state:"visible"});
    assert.equal(await page.locator("#bidblitz-admin-box-link").count(),1);
    assert(requests.every(url=>new URL(url).origin==="https://bidblitz.test"));
    console.log("PASS: reviewed HTML bootstrap loads hashed UI asset, native panel above owner card, same-origin API renders fixture, mobile width, no external navigation/iframe, route teardown and remount.");
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
