/* Execute the same regression corpus through all three engines. No assertion is copied. */
const playwright=require('playwright');
const path=require('path');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH)process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve(__dirname,'../../.tools/playwright-browsers');
exports.launch=async function(){
 const engine=process.env.TEST_ENGINE||'chromium';
 if(!['chromium','firefox','webkit'].includes(engine))throw new Error('Unsupported TEST_ENGINE '+engine);
 const browser=await playwright[engine].launch({headless:true});
 const contexts=[];
 return {
  async newPage(){
   const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});contexts.push(context);
   const page=await context.newPage();
   let intercepted=false, requestHandler=null;
   return {
    on:(event,fn)=>{ if(event==='request' && intercepted){requestHandler=fn;return;} return page.on(event,fn); },
    evaluate:(fn,...args)=>{if(args.length>1)throw new Error('Use a single object argument');return page.evaluate(fn,args[0]);},
    evaluateOnNewDocument:fn=>page.addInitScript(fn),
    waitForFunction:(fn,options,...args)=>page.waitForFunction(fn,args[0],options||{}),
    goto:(url,options)=>page.goto(url,options),
    setViewport:v=>page.setViewportSize({width:v.width,height:v.height}),
    keyboard:page.keyboard,
    screenshot:options=>page.screenshot(options),
    click:selector=>page.click(selector),
    focus:selector=>page.focus(selector),
    $$eval:(selector,fn,arg)=>page.$$eval(selector,fn,arg),
    reload:options=>page.reload(options),
    async setRequestInterception(enabled){
      if(!enabled) throw new Error('Only enabling interception is supported');
      intercepted=true;
      await page.route('**/*',route=>{
        if(!requestHandler) return route.continue();
        return requestHandler({url:()=>route.request().url(),abort:()=>route.abort(),continue:()=>route.continue()});
      });
    },
    close:()=>context.close()
   };
  },
  async close(){await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser.close();}
 };
};
