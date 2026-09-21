/* ============================================================
   合香 · 乾隆香料商道 v2.0 —— 浏览器回归测试
   跑法：node game_v2_test.js            （在 .tools 目录下）
   要点：起一个本地静态服务（根＝香料3D展示，与线上站点结构一致），
        用系统 Chrome 无头打开 hexiang/index.html，先清空存档，再逐项断言。
   ============================================================ */
const path = require('path');
const http = require('http');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

/* 站点根目录＝本脚本的上两级（hexiang/tests → hexiang → 站点根），与线上结构一致 */
const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.TEST_PORT || 8899);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.glb':'model/gltf-binary', '.mp3':'audio/mpeg', '.wav':'audio/wav',
  '.wasm':'application/wasm', '.svg':'image/svg+xml', '.css':'text/css' };

function serve(){
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ rq.writeHead(404); rq.end('404'); return; }
      rq.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if(m.type() === 'error') pageErrors.push('console: ' + m.text().slice(0, 200)); });
  await page.evaluateOnNewDocument(() => { try{ localStorage.clear(); }catch(e){} });
  await page.goto(`http://127.0.0.1:${PORT}/hexiang/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.XiangYe && window.HX && window.HX.state', { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const R = [], ok = (n, c, x) => R.push({ n, p: !!c, x: x === undefined ? '' : String(x) });
    const XY = window.XiangYe, HX = window.HX, S = HX.state;
    const T = (id) => document.getElementById(id);
    const screenHTML = (id) => (T('sc-' + id) ? T('sc-' + id).innerHTML : '');

    /* ---------- A. 架构与装载 ---------- */
    ok('A1 商道层已挂载', !!XY && !!HX);
    ok('A2 桥接接口齐全', ['state','mutate','save','render','toast','go','nextDay','randomSeed','rewardText'].every(k => HX[k] !== undefined));
    ok('A3 香料谱 ≥ 50 味', Object.keys(XY.SPICES).length >= 50, Object.keys(XY.SPICES).length);
    ok('A4 香道层香谱同步扩充', Object.keys(HX.HERBS).length === Object.keys(XY.SPICES).length, Object.keys(HX.HERBS).length);
    const noCodex = Object.keys(HX.HERBS).filter(k => !HX.CODEX[k] || !HX.CODEX[k].latin);
    ok('A5 每味皆有词条', noCodex.length === 0, noCodex.join(','));
    const pendingCodex = Object.keys(HX.HERBS).filter(k => HX.CODEX[k].latin.indexOf('待补') >= 0);
    ok('A6 词条待补者 ≤ 2 味', pendingCodex.length <= 2, pendingCodex.join(','));
    ok('A7 扩展点 API', ['registerAsset','registerScreen','renderScreen','mount','assetOf','spiceIcon'].every(k => typeof XY[k] === 'function'));
    ok('A8 商道七屏已注册', ['book','farm','market','cara','shop','annals','ach'].every(id => HX.SCREENS.indexOf(id) >= 0));
    ok('A9 页签 13 个', document.querySelectorAll('#xyTabs [data-sc]').length === 13, document.querySelectorAll('#xyTabs [data-sc]').length);
    ok('A10 屏容器齐备', ['book','farm','market','cara','shop','annals','ach'].every(id => !!T('sc-' + id)));

    /* ---------- B. 数据与口径 ---------- */
    ok('B1 银两口径 400两', XY.fmt(40000) === '400两', XY.fmt(40000));
    ok('B2 复合口径', XY.fmt(40123) === '401两2钱3分', XY.fmt(40123));
    ok('B3 历法：开局', XY.dateText({ day:1 }) === '乾隆四十年正月初一日', XY.dateText({ day:1 }));
    ok('B4 纪元改元', XY.eraText(61) === '嘉庆元年' && XY.eraText(60) === '乾隆六十年', XY.eraText(60) + '/' + XY.eraText(61));
    const c = XY.CITIES, P = XY.priceS;
    let priceBad = [];
    XY.CITY_IDS.forEach(cid => Object.keys(XY.SPICES).forEach(id => { if(!(P.priceAt(cid, id) > 0)) priceBad.push(cid + ':' + id); }));
    ok('B5 行价全域有效', priceBad.length === 0, priceBad.slice(0, 3).join(','));
    ok('B6 产地贱、远地贵', P.priceAt('xian','huajiao') < P.priceAt('suzhou','huajiao'),
      P.priceAt('xian','huajiao') + '<' + P.priceAt('suzhou','huajiao'));
    ok('B7 洋货只广州可购', P.canBuy('guangzhou','tanxiang') && !P.canBuy('xian','tanxiang'));
    ok('B8 洋货不可种', !P.canFarm('xian','tanxiang') && !P.canFarm('guangzhou','chenxiang'));
    ok('B9 城邑五座', XY.CITY_IDS.length === 5 && !!c.guangzhou);
    ok('B10 商路十条', XY.EDGES.length === 10 && !!P.edgeOf('xian','hankou'));
    ok('B11 脚力三种', Object.keys(XY.MODES).length === 3);
    ok('B12 编年十九则', XY.HISTORY.length >= 19, XY.HISTORY.length);
    ok('B13 商道成就 ≥ 15', XY.ACH_EXTRA.length >= 15, XY.ACH_EXTRA.length);
    ok('B14 事件池 ≥ 17', XY.EVENTS.length >= 17, XY.EVENTS.length);

    /* ---------- C. 种植：地域限制与农时 ---------- */
    S.money = 500000;
    const m0 = S.money;
    XY.plantCrop('xian', 0, 'huajiao');
    ok('C1 西安可种花椒', S.co.plots.xian[0].crop === 'huajiao', S.co.plots.xian[0].crop);
    /* 苗钱须扣（同一次结算里可能另有成就赏银，故按「至少扣了苗钱」断言） */
    ok('C6 苗钱已扣', (m0 - S.money) >= XY.SPICES.huajiao.crop.s - 100, m0 + '->' + S.money);
    XY.plantCrop('xian', 1, 'tanxiang');
    ok('C2 洋货不能下种', S.co.plots.xian[1].crop === null, S.co.plots.xian[1].crop);
    XY.plantCrop('xian', 1, 'moli');
    ok('C3 非本产城不可下种', S.co.plots.xian[1].crop === null, '提示为准');
    XY.commitDays(41);
    ok('C4 熟期到即可收', XY.abs() >= S.co.plots.xian[0].ready, XY.abs() + '/' + S.co.plots.xian[0].ready);
    XY.harvest('xian', 0);
    ok('C5 收获入本城仓', (S.co.store.xian.huajiao || 0) > 0, S.co.store.xian.huajiao);

    /* ---------- D. 市集与行价 ---------- */
    const before = S.co.store.xian.huajiao;
    const cost = XY.priceS.buyPrice('xian','huajiao') * 50;
    const m1 = S.money;
    XY.buyGood('xian','huajiao',50);
    ok('D1 买入入仓扣银', S.co.store.xian.huajiao === before + 50 && Math.abs((m1 - S.money) - cost) < 2,
      S.co.store.xian.huajiao + ' cost=' + (m1 - S.money));
    const m2 = S.money;
    XY.sellGood('xian','huajiao',20);
    ok('D2 卖出入账', S.money > m2 && S.co.store.xian.huajiao === before + 30, (S.money - m2));
    const base = XY.priceS.priceAt('xian','huajiao');
    XY.priceS.addMod('*','huajiao',1.5,5,'测试涨价');
    ok('D3 事件修正生效', XY.priceS.priceAt('xian','huajiao') > base, base + '->' + XY.priceS.priceAt('xian','huajiao'));

    /* ---------- E. 商队与物流 ---------- */
    XY.openShop('hankou');
    ok('E1 可开第二分号', !!S.co.shops.hankou);
    const est = XY.estTrip('xian','hankou','tuo',{ huajiao:100 });
    ok('E2 里程按真实商路', est && est.li === 1400 && est.days === Math.ceil(1400/75), est && (est.li + '里/' + est.days + '日'));
    ok('E3 水路限制：驮队不通水', XY.estTrip('hankou','suzhou','tuo',{ huajiao:10 }) === null);
    ok('E4 船只通水', !!XY.estTrip('hankou','suzhou','chuan',{ huajiao:10 }));
    const m3 = S.money;
    XY.dispatch('xian','hankou','tuo',{ huajiao:100 });
    ok('E5 发运扣运费并入在途', S.co.transit.length === 1 && S.money < m3, S.co.transit.length);
    ok('E6 在途不入仓（到货制）', (S.co.store.hankou.huajiao || 0) === 0, S.co.store.hankou.huajiao);
    XY.commitDays(est.days + 6);
    ok('E7 抵埠方入分号仓', (S.co.store.hankou.huajiao || 0) > 0, S.co.store.hankou.huajiao);
    ok('E8 抵埠加声望', S.co.fame >= 1, S.co.fame);
    ok('E9 行程数累计', S.co.trips >= 1, S.co.trips);
    ok('E10 未开分号不可发运', (() => { const n0 = S.co.transit.length; XY.dispatch('xian','suzhou','chuan',{ huajiao:1 }); return S.co.transit.length === n0; })());

    /* ---------- F. 成就与对话 ---------- */
    ok('F1 商道成就已记名', !!S.ach.c1_trip, Object.keys(S.ach).filter(k => /^c\d/.test(k)).join(','));
    const dlg = T('xyAch');
    ok('F2 成就对话已弹出', !!dlg && dlg.classList.contains('on'));
    if(dlg){
      const nameEl = dlg.querySelector('.xy-ach-name');
      const fs2 = nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : 0;
      ok('F3 成就名 ≥ 18pt(24px)', fs2 >= 24, fs2 + 'px');
      const svg = dlg.querySelector('.xy-ach-badge svg');
      const sw = svg ? parseFloat(svg.getAttribute('width')) : 0;
      ok('F4 图标 ≥ 64×64', sw >= 64 && parseFloat(svg.getAttribute('height')) >= 64, sw);
      const bt = dlg.querySelector('#xyAchOk'), bt2 = dlg.querySelector('#xyAchClose');
      const r1 = bt ? bt.getBoundingClientRect() : { width:0, height:0 };
      const r2 = bt2 ? bt2.getBoundingClientRect() : { width:0, height:0 };
      ok('F5 按钮 ≥ 40×40 且点击区明确', r1.width >= 40 && r1.height >= 40 && r2.width >= 40 && r2.height >= 40,
        r1.width + 'x' + r1.height + ' / ' + r2.width + 'x' + r2.height);
      ok('F6 描述与奖励齐备', !!dlg.querySelector('.xy-ach-desc').textContent.trim() && /奖励/.test(dlg.querySelector('.xy-ach-reward').textContent));
      const card = dlg.querySelector('.xy-ach-card');
      ok('F7 入场动画', /xyAch/.test(getComputedStyle(card).animationName), getComputedStyle(card).animationName);
      const top = card.getBoundingClientRect().top;
      ok('F8 不遮挡顶栏操作区', top > 40, Math.round(top));
      bt && bt.click();
    }
    /* 音效：MP3 存在且 ≤ 2 秒 */
    let dur = 0, mp3ok = false;
    try{
      const buf = await (await fetch('shared/sfx/achievement.mp3')).arrayBuffer();
      mp3ok = buf.byteLength > 1000;
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const ab = await ac.decodeAudioData(buf.slice(0));
      dur = ab.duration; ac.close();
    }catch(e){ mp3ok = false; }
    ok('F9 成就音效为 MP3', mp3ok);
    ok('F10 音效时长 ≤ 2 秒', dur > 0 && dur <= 2, dur.toFixed(2) + 's');

    /* ---------- G. 编年与政策 ---------- */
    S.day = XY.HQ(41, 2, 20) + 1;      /* 乾隆四十一年二月二十日 */
    XY.commitDays(10);                  /* 跨过二月二十四 · 两金川荡平 */
    ok('G1 编年大事届期必发', S.co.histSeen.indexOf('jinchuan') >= 0, S.co.histSeen.join(','));
    const mg = XY.priceS.priceAt('hangzhou','longnao');
    ok('G2 大典牵动行价', S.co.mods.length > 0, S.co.mods.length);
    S.day = XY.HQ(45, 6, 1) + 1;       /* 乾隆四十五年五月末 */
    XY.commitDays(2);
    ok('G3 议罪银之制入档', !!S.co.eraTribute);
    const mA = S.money;
    S.day = XY.HQ(45, 12, 1);          /* 冬月三十，再推一日即入腊月 */
    XY.commitDays(2);
    ok('G4 腊月摊派扣银', S.money < mA, mA + '->' + S.money);
    ok('G5 大事记有纪事', S.co.log.length > 5, S.co.log.length);

    /* ---------- H. 七屏渲染与素材解析 ---------- */
    ['book','farm','market','cara','shop','annals','ach'].forEach(id => {
      S.screen = id; HX.render();
      const html = screenHTML(id);
      ok('H-' + id + ' 屏可渲染', html.length > 400, html.length);
    });
    S.screen = 'garden'; HX.render();
    ok('H8 药圃未受影响', /药圃/.test(screenHTML('garden')));
    S.screen = 'hub'; HX.render();
    ok('H9 书斋新增商道入口', /号簿/.test(screenHTML('hub')) && /编年/.test(screenHTML('hub')));
    ok('H10 素材三级解析', (() => {
      const a = XY.assetOf('aicao'), b = XY.assetOf('moli'), d = XY.assetOf('__none__');
      return a.status === 'ready' && (b.status === 'image' || b.status === 'ready') && d.status === 'placeholder';
    })());
    ok('H11 占位标记可见', /待生成/.test(XY.spiceIcon('__none__', 96)));
    ok('H12 缺图兜底可用', (() => {
      const box = document.createElement('div');
      const img = document.createElement('img');
      img.setAttribute('data-spice','moli'); box.appendChild(img); document.body.appendChild(box);
      window.xyImgFail(img);
      const hit = /待生成/.test(box.textContent) || !!box.querySelector('.ic-fallback');
      box.remove(); return hit;
    })());
    /* 香草志：新味展示商道信息 */
    S.known.moli = true; S.screen = 'codex'; HX.render();
    const tab = document.querySelector('#codexTabs [data-h="moli"]');
    if(tab){ tab.click(); }
    const codexHTML = screenHTML('codex');
    ok('H13 香草志含获取与行价', /获取/.test(codexHTML) && /行价/.test(codexHTML) && /素材/.test(codexHTML));
    ok('H14 已知味显示三者之一', /3D 标本|正视图|墨线占位/.test(codexHTML));

    /* ---------- I. 存档与迁移 ---------- */
    HX.save();
    const raw = JSON.parse(localStorage.getItem('spiceGame_v1'));
    ok('I1 状态树入档', !!raw && !!raw.co && raw.co.shops.xian === true);
    ok('I2 香料谱已扩', Object.keys(raw.seeds).length >= 50, Object.keys(raw.seeds).length);
    ok('I3 行价入档', Object.keys(raw.co.price.xian).length >= 50, Object.keys(raw.co.price.xian).length);
    ok('I4 商道成就入档', !!raw.ach.c1_trip);

    /* ---------- J. 扩展点实测 ---------- */
    let ticked = 0;
    XY.registerDailyTick(() => { ticked++; });
    XY.registerAchievement({ id:'ext_1', name:'扩展成就', desc:'由扩展点注册', reward:{ money:1 }, check: () => false });
    XY.registerSpice('extspice', { zh:'测味', cat:'土产', tier:1, aroma:{辛:5,苦:5,甘:5,温:5,凉:5,香:5}, pot:1, zone:'干燥',
      eff:['辟秽'], farm:['xian'], base:10, pv:5, use:'测试', note:'测试',
      asset:{ image:'../__none__/front.png' } });
    let extRendered = 0;
    XY.registerScreen('extscreen', '测屏', () => { extRendered++; document.getElementById('sc-extscreen').innerHTML = '<div class="card">扩展屏</div>'; }, 'extscreen');
    XY.commitDays(1);
    ok('J1 每日钩子生效', ticked >= 1, ticked);
    ok('J2 扩展香料入谱', !!XY.SPICES.extspice && !!HX.HERBS.extspice, Object.keys(XY.SPICES).length);
    ok('J3 扩展成就入册', XY.ACH_EXTRA.some(a => a.id === 'ext_1'));
    ok('J4 扩展屏可渲染', (() => { S.screen = 'extscreen'; HX.render(); return extRendered >= 1 && /扩展屏/.test(screenHTML('extscreen')); })());
    ok('J5 扩展屏页签已加', document.querySelectorAll('#xyTabs [data-sc="extscreen"]').length === 1);

    /* ---------- K. 香道 × 商道 整合 ---------- */
    ok('K1 新香方已入谱', ['teahouse','sea','temple'].every(k => !!HX.ORDERS[k]), Object.keys(HX.ORDERS).length);
    ok('K2 新古籍卡已入册', ['gj22','gj23','gj24','gj25','gj26'].every(id => HX.ANCIENT_CARDS.some(c => c.id === id)), HX.ANCIENT_CARDS.length);
    ok('K3 引文均标出处', HX.ANCIENT_CARDS.every(c => c.src && c.quote && c.herb && HX.HERBS[c.herb]));
    S.inventory = Object.assign({}, S.inventory, { moli:3, guihua:3, zhizi:3, hujiao:3, dingxiang:3, tanxiang:3, chenpi:3 });
    S.known.moli = S.known.guihua = S.known.zhizi = true;
    S.screen = 'blend'; HX.render();
    ok('K4 香室含新香方', /窨茶花方|番货合香|斋醮降真香/.test(screenHTML('blend')));
    S.screen = 'quiz'; HX.render();
    const qb = document.getElementById('btnQuizStart');
    if(qb) qb.click();
    ok('K5 问答可开卷（题库含新味）', /题|甲|乙/.test(screenHTML('quiz')) && !/待补/.test(screenHTML('quiz')));

    return { R };
  });

  const pass = result.R.filter(r => r.p).length, fail = result.R.filter(r => !r.p);
  console.log('\n=========== 合香 · 乾隆香料商道 v2.0 回归 ===========');
  result.R.forEach(r => { if(!r.p) console.log('  ✗ ' + r.n + (r.x ? '  [' + r.x + ']' : '')); });
  console.log(`\n通过 ${pass} / ${result.R.length}`);
  if(fail.length) console.log('失败项：' + fail.map(f => f.n).join('；'));
  const errs = pageErrors.filter(e => !/404|Failed to load resource|net::ERR/.test(e));
  if(errs.length) console.log('页面异常：\n  ' + errs.slice(0, 8).join('\n  '));
  else console.log('页面无未捕获异常。');

  await browser.close();
  server.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => {
  console.error('测试脚本异常：', e.message);
  process.exit(2);
});