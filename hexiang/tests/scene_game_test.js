const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const puppeteer=process.env.TEST_ENGINE ? require('./playwright_adapter') : require('puppeteer-core');
const ROOT=process.env.SITE_ROOT||path.resolve(__dirname,'../..');
const PORT=Number(process.env.SCENE_PORT||8913);
const stateOnly=process.argv.includes('--state-only');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.wasm':'application/wasm','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
(async()=>{
 let browser,server;const errors=[];let total=0;
 try{
  server=http.createServer((req,res)=>{let rel;try{rel=decodeURIComponent(req.url.split('?')[0]);}catch(e){res.writeHead(400);res.end();return;}
   let f=path.resolve(ROOT,'.'+rel);if(!f.startsWith(path.resolve(ROOT)+path.sep)){res.writeHead(403);res.end();return;}
   if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
   if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',MIME[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
  });await new Promise((r,j)=>{server.once('error',j);server.listen(PORT,'127.0.0.1',r)});
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--mute-audio']});
  const page=await browser.newPage();await page.setViewport({width:390,height:844});
  const firstRequests=[];page.on('request',r=>firstRequests.push(r.url()));
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+PORT+'/hexiang/',{waitUntil:'load'});
  await page.waitForFunction('window.HX && window.XiangYe');
  assert.ok(!firstRequests.some(url=>/model-viewer\.min\.js/.test(url)),'first courtyard must not fetch the 3D viewer before observation');total++;
  const R=await page.evaluate(()=>{
   const R=[],ok=(name,p)=>R.push({name,pass:!!p});const HX=window.HX;
   ok('first courtyard shows mounted herb count',document.querySelector('.scene-count')?.textContent.trim().endsWith('/ '+Object.keys(HX.HERBS).length));
   ok('presentation API exists',typeof HX.ensurePresentationState==='function');
   ok('plant and harvest operations exist',typeof HX.plantHerb==='function'&&typeof HX.harvestPlant==='function');
   if(!R.every(x=>x.pass))return R;
   const save=JSON.parse(HX.exportSave()),before={money:save.money,seeds:JSON.stringify(save.seeds),co:JSON.stringify(save.co)};delete save.presentation;
   const imported=HX.importSave(JSON.stringify(save));
   ok('old save imports presentation defaults',imported.ok&&HX.state.presentation.v===1);
   ok('old money retained',HX.state.money===before.money);
   ok('old seeds retained',JSON.stringify(HX.state.seeds)===before.seeds);
   ok('old city state retained',JSON.stringify(HX.state.co)===before.co);
   [null,[],42,'bad'].forEach(value=>{const s={presentation:value,money:123};HX.ensurePresentationState(s);ok('malformed presentation '+JSON.stringify(value),s.presentation.v===1&&s.money===123&&Object.keys(s.presentation.dismissedHints).length===0)});
   const malformed={presentation:{introDismissed:'yes',dismissedHints:{'first-plant':true,evil:true,'first-sale':'true'}}};HX.ensurePresentationState(malformed);
   ok('hint whitelist and boolean validation',malformed.presentation.introDismissed===false&&JSON.stringify(malformed.presentation.dismissedHints)==='{"first-plant":true}');
   const initialSeeds=HX.state.seeds.aicao;
   ok('invalid herb rejected',HX.plantHerb('missing','干燥')===false);
   ok('invalid climate rejected',HX.plantHerb('aicao','missing')===false&&HX.state.seeds.aicao===initialSeeds);
   ok('no seeds rejected',HX.plantHerb('peilan','湿润')===false);
   ok('default seed plants',HX.plantHerb('aicao','干燥')===true&&HX.state.seeds.aicao===initialSeeds-1);
   const p=HX.state.plants.find(p=>p.herb==='aicao');
   ok('immature cannot harvest',HX.harvestPlant(p.id)===false);
   ok('no negative seeds',HX.plantHerb('aicao','干燥')===false&&HX.state.seeds.aicao===0);
   HX.mutate(()=>HX.nextDay());const qty=HX.state.inventory.aicao||0;
   ok('mature harvest succeeds',HX.harvestPlant(p.id)===true&&HX.state.inventory.aicao===qty+1);
   ok('duplicate harvest rejected',HX.harvestPlant(p.id)===false&&HX.state.inventory.aicao===qty+1);
   ok('unknown plant rejected',HX.harvestPlant('missing')===false);
   for(let i=0;i<30&&document.querySelector('#xyAch.on');i++)document.getElementById('xyAchClose').click();
   HX.go('hub');return R;
  });
  R.forEach(r=>{total++;console.log((r.pass?'PASS ':'FAIL ')+r.name)});
  assert.ok(R.every(r=>r.pass),'state compatibility/operation failure');
  if(!stateOnly){
   await page.click('#bottomNav [data-go="garden"]');assert.equal(await page.evaluate(()=>HX.state.screen),'garden');total++;
   await page.click('#bottomNav [data-go="hub"]');assert.equal(await page.$$eval('.scene-hotspot[data-go="garden"]',e=>e.length),1);total++;
   await page.focus('.scene-hotspot[data-go="garden"]');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>HX.state.screen),'garden');total++;
   for(const id of ['hub','garden','blend','codex','study','quiz','book','farm','market','cara','shop','annals','ach']){
    await page.evaluate(id=>HX.go(id),id);assert.equal(await page.evaluate(()=>HX.state.screen),id);total++;
   }
   const usability=await page.evaluate(()=>{
    document.getElementById('btnTools').click();
    document.querySelector('#sceneTools [data-set="sound"]').click();
    const open=document.getElementById('sceneTools').open;
    HX.go('blend');window.scrollTo(0,400);const wasScrolled=scrollY>0;
    HX.go('garden');return {settingsStayOpen:open,navigationResetsScroll:wasScrolled&&scrollY===0};
   });
   assert.deepEqual(usability,{settingsStayOpen:true,navigationResetsScroll:true});total+=2;
   const preferences=await page.evaluate(()=>{
    HX.go('hub');const intro=document.querySelector('[data-dismiss-intro]');if(!intro)return {available:false};
    intro.click();const introHidden=HX.state.presentation.introDismissed&&!document.querySelector('[data-dismiss-intro]');
    HX.importSave(HX.exportSave());const introPersisted=HX.state.presentation.introDismissed;
    HX.go('blend');const hint=document.querySelector('[data-dismiss-hint="first-blend"]');if(!hint)return {available:false};
    hint.click();const hintHidden=HX.state.presentation.dismissedHints['first-blend']===true&&!document.querySelector('[data-dismiss-hint="first-blend"]');
    HX.importSave(HX.exportSave());const hintPersisted=HX.state.presentation.dismissedHints['first-blend']===true;HX.go('garden');
    return {available:true,introHidden,introPersisted,hintHidden,hintPersisted};
   });
   assert.deepEqual(preferences,{available:true,introHidden:true,introPersisted:true,hintHidden:true,hintPersisted:true});total+=4;
   assert.equal(await page.$$eval('.garden-scene [data-z]',e=>e.length),3,'three climate beds are interactive on the scene');total++;
   await page.click('.garden-scene [data-z="干燥"]');
   assert.ok(await page.evaluate(()=>document.getElementById('seedPick').textContent.includes('种于 干燥区')),'scene bed opens matching seed selection');total++;
   const guided=await page.evaluate(()=>{
    HX.go('study');const target=document.querySelector('[data-study-herb="peilan"]');if(!target)return null;
    target.click();document.getElementById('btnBuy').click();
    const quote=document.querySelector('.gj-quote').textContent.trim();
    return HX.ANCIENT_CARDS.find(c=>c.quote===quote)?.herb;
   });
   assert.equal(guided,'peilan','starter herb discovery should choose a real Peilan card');total++;
   await page.click('#optGrid [data-h="peilan"]');
   assert.ok(await page.evaluate(()=>HX.state.known.peilan&&HX.state.seeds.peilan===1),'guided card earns normal seed reward');total++;
   for(const width of [360,390,1200]){await page.setViewport({width,height:844});for(const id of ['hub','garden','blend','codex']){await page.evaluate(id=>HX.go(id),id);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'overflow '+id+' '+width);total++;}}
   await page.setViewport({width:390,height:844});await page.evaluate(()=>HX.go('hub'));
   await page.setRequestInterception(true);page.on('request',r=>/\/assets\/art\//.test(r.url())?r.abort():r.continue());
   await page.reload({waitUntil:'load'});await page.waitForFunction('window.HX');await page.click('.scene-hotspot[data-go="garden"]');assert.equal(await page.evaluate(()=>HX.state.screen),'garden');total++;
  }
  assert.deepEqual(errors,[],'page errors');console.log('Scene verification: '+total+'/'+total+' passed');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
