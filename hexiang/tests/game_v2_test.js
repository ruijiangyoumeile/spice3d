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
  page.on('dialog', async d => { try{ await d.accept(); }catch(e){} });
  await page.waitForFunction('window.XiangYe && window.HX && window.HX.state', { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const R = [], ok = (n, c, x) => R.push({ n, p: !!c, x: x === undefined ? '' : String(x) });
    const XY = window.XiangYe, HX = window.HX, S = HX.state;
    /* 天然香料 id 快照：须在 J 段用扩展点注册假香料之前取样，供 O 段取真素材用 */
    const NATURAL_IDS = Object.keys(XY.SPICES);
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
    const sowOf = (ci, pi) => ((S.co.plots[ci][pi] || {}).sow || []);
    XY.plantCrop('xian', 0, 'huajiao');
    ok('C1 西安可种花椒', (sowOf('xian', 0)[0] || {}).id === 'huajiao', JSON.stringify(sowOf('xian', 0)));
    /* 苗钱须扣（同一次结算里可能另有成就赏银，故按「至少扣了苗钱」断言） */
    ok('C6 苗钱已扣', (m0 - S.money) >= XY.SPICES.huajiao.crop.s - 100, m0 + '->' + S.money);
    XY.plantCrop('xian', 1, 'tanxiang');
    ok('C2 洋货不能下种', sowOf('xian', 1).length === 0, JSON.stringify(sowOf('xian', 1)));
    XY.plantCrop('xian', 1, 'moli');
    ok('C3 非本产城不可下种', sowOf('xian', 1).length === 0, '提示为准');
    XY.commitDays(41);
    ok('C4 熟期到即可收', XY.abs() >= sowOf('xian', 0)[0].ready, XY.abs() + '/' + sowOf('xian', 0)[0].ready);
    XY.harvest('xian', 0);
    ok('C5 收获入本城仓', (S.co.store.xian.huajiao || 0) > 0, S.co.store.xian.huajiao);
    ok('C5b 收获后畦位归零', sowOf('xian', 0).length === 0, JSON.stringify(sowOf('xian', 0)));

    /* ---------- C′. 每块田本茬种植上限（PLOT_SLOTS 畦） ---------- */
    const SLOTS = XY.PLOT_SLOTS;
    ok('C7 每块田上限为常数', SLOTS >= 1, SLOTS);
    XY.plantCrop('xian', 1, 'huajiao');
    ok('C8 第一畦下种成功', (sowOf('xian', 1)[0] || {}).id === 'huajiao', JSON.stringify(sowOf('xian', 1)));
    XY.plantCrop('xian', 1, 'huajiao');
    ok('C9 第二畦下种成功', sowOf('xian', 1).length === 2, sowOf('xian', 1).length);
    const mFill = S.money;
    XY.plantCrop('xian', 1, 'huajiao');
    ok('C10 畦满拒种（且不扣苗钱）', sowOf('xian', 1).length === SLOTS && S.money === mFill,
      sowOf('xian', 1).length + ' / 钱 ' + mFill + '->' + S.money);
    XY.commitDays(45);
    XY.harvest('xian', 1, 0);
    ok('C11 收获腾出一畦', sowOf('xian', 1).length === SLOTS - 1, sowOf('xian', 1).length);
    XY.plantCrop('xian', 1, 'huajiao');
    ok('C12 腾畦后可再种', sowOf('xian', 1).length === SLOTS, sowOf('xian', 1).length);
    /* 旧档 {crop,ready} 迁移为 {sow:[…]} */
    S.co.plots.xian[0] = { crop: 'huajiao', ready: XY.abs() + 3 };
    S.screen = 'farm'; HX.render();
    const xTab = document.querySelector('#sc-farm [data-city="xian"]'); if(xTab) xTab.click();
    ok('C13 旧档田块自动迁移为畦',
      Array.isArray(S.co.plots.xian[0].sow) && S.co.plots.xian[0].sow[0].id === 'huajiao' &&
      S.co.plots.xian[0].crop === undefined,
      JSON.stringify(S.co.plots.xian[0]).slice(0, 80));

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

    /* ---------- L. 香料视觉表现（图标 / 粒子） ---------- */
    const g1 = XY.spiceGlyph('moli', 20), g2 = XY.spiceGlyph('tanxiang', 20);
    ok('L1 香料图标为内联 SVG（零请求）', /^<svg/.test(g1) && !/src=/.test(g1) && g1 !== g2, g1.length);
    ok('L2 品类异色·品级异边', g1.indexOf('#8a4a7a') > 0 && g2.indexOf('#2f5d8a') > 0);
    S.screen = 'market'; HX.render();
    ok('L3 市集列表带图标', (screenHTML('market').match(/xy-glyph/g) || []).length > 5, (screenHTML('market').match(/xy-glyph/g) || []).length);
    S.known.aicao = true; S.screen = 'codex'; HX.render();
    ok('L4 香草志含香篆青烟层', !!document.querySelector('#modelStage .codex-smoke'));
    ok('L5 青烟为纯 CSS 粒子', (() => {
      const i = document.querySelector('#modelStage .codex-smoke i');
      return !!i && /xySmoke/.test(getComputedStyle(i).animationName);
    })());

    /* ---------- M. 成就对话：必须能关闭（回归本轮修复） ---------- */
    const mkAch = n => ({ id:'t' + n, name:'测成就' + n, desc:'测试用成就', reward:{ money:1 } });
    const dlgOpen = () => { const e = document.getElementById('xyAch'); return !!(e && e.classList.contains('on')); };
    /* 前置：清掉此前游戏过程中真实触发而排队的成就条目（顺带验证反复关闭） */
    for(let i = 0; i < 30 && dlgOpen(); i++) document.getElementById('xyAchClose').click();
    ok('M0 前置：队列可清空', !dlgOpen());
    XY.showAch([mkAch(1)]);
    ok('M1 弹出后可见', dlgOpen());
    document.getElementById('xyAchOk').click();
    ok('M2 点「确认」后关闭', !dlgOpen());
    XY.showAch([mkAch(2), mkAch(3)]);
    ok('M3 多条排队并提示余量', dlgOpen() && /尚有/.test(document.getElementById('xyAch').textContent));
    document.getElementById('xyAchOk').click();
    ok('M4 连点「确认」逐条推进', dlgOpen());
    document.getElementById('xyAchClose').click();
    ok('M5 点「关闭」立即隐藏（清空队列）', !dlgOpen());
    XY.showAch([mkAch(4)]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape' }));
    ok('M6 ESC 可关闭', !dlgOpen());
    /* 对话框不得压住页签栏（关键操作区）：顶部须在页签栏底边之下 */
    XY.showAch([mkAch(5)]);
    await new Promise(r => setTimeout(r, 600));            /* 等入场动画结束再测位置 */
    const cardRect = document.querySelector('#xyAch .xy-ach-card').getBoundingClientRect();
    const tabsRect = document.getElementById('xyTabs').getBoundingClientRect();
    ok('M7 不遮挡页签栏', cardRect.top >= tabsRect.bottom - 2, Math.round(cardRect.top) + ' vs 页签底 ' + Math.round(tabsRect.bottom));
    document.getElementById('xyAchClose').click();

    /* ---------- N. 交互链路（真点 DOM） ---------- */
    S.screen = 'market'; HX.render();
    const mRow = document.querySelector('#sc-market .xy-mrow[data-good]');
    const mBuy = mRow && mRow.querySelector('[data-buy]');
    const moneyBefore = S.money;
    if(mBuy && !mBuy.disabled) mBuy.click();
    ok('N1 市集买入按钮真点可用', S.money < moneyBefore, moneyBefore + '->' + S.money);
    S.co.plots.xian.forEach(p => { p.sow = []; });
    S.screen = 'farm'; HX.render();
    const plantBtns = document.querySelectorAll('#sc-farm [data-plant]');
    if(plantBtns.length) plantBtns[0].click();
    ok('N2 田亩播种按钮真点可用', plantBtns.length > 0 && S.co.plots.xian.some(p => (p.sow || []).length > 0),
      plantBtns.length + ' 钮 / ' + S.co.plots.xian.map(p => (p.sow || []).length).join(','));
    const tabMarket = document.querySelector('#xyTabs [data-sc="market"]');
    tabMarket.click();
    ok('N3 页签点击切屏', HX.state.screen === 'market' && document.getElementById('sc-market').classList.contains('on'), HX.state.screen);
    S.known.jinyinhua = true; S.screen = 'codex'; HX.render();
    const ct = document.querySelector('#codexTabs [data-h="jinyinhua"]');
    if(ct) ct.click();
    ok('N4 香草志可切味', /金银花/.test(screenHTML('codex')));
    ok('N5 顶栏口径为银两与农历', /两|钱|分/.test((document.getElementById('uiMoney') || {}).textContent || '') &&
      /年/.test((document.getElementById('uiDay') || {}).textContent || ''),
      (document.getElementById('uiMoney') || {}).textContent + ' / ' + (document.getElementById('uiDay') || {}).textContent);
    /* ---------- O. 素材路径真取 + 脏档健壮性 ---------- */
    const readyIds = NATURAL_IDS.filter(id => XY.assetOf(id).status === 'ready').slice(0, 3);
    const imgIds = NATURAL_IDS.filter(id => XY.assetOf(id).status === 'image').slice(0, 2);
    let okModel = readyIds.length > 0, dM = [];
    for(const id of readyIds){
      try{
        const r = await fetch(XY.assetOf(id).model);
        const b = await r.blob();
        dM.push(id + ':' + r.status + '/' + Math.round(b.size / 1024) + 'KB');
        if(!r.ok || b.size < 20000) okModel = false;
      }catch(e){ okModel = false; dM.push(id + ':ERR'); }
    }
    ok('O1 三维素材路径真可取', okModel, dM.join(' '));
    let okImg = true, dI = [];
    for(const id of imgIds){
      try{
        const r = await fetch(XY.assetOf(id).image);
        const b = await r.blob();
        dI.push(id + ':' + r.status + '/' + Math.round(b.size / 1024) + 'KB');
        if(!r.ok || b.size < 5000) okImg = false;
      }catch(e){ okImg = false; dI.push(id + ':ERR'); }
    }
    ok('O2 正视图路径真可取', okImg, dI.join(' '));
    /* 旧档残留未知香料 id：三屏不得崩，且不得渲染为未知条目 */
    S.co.store.xian['__ghost__'] = 5; S.co.store.xian['__ghost2__'] = 3;
    let ghostOk = true, ghostErr = '';
    try{ S.screen = 'market'; HX.render(); S.screen = 'farm'; HX.render(); S.screen = 'cara'; HX.render(); }
    catch(e){ ghostOk = false; ghostErr = e.message; }
    ok('O3 脏档未知香料不致崩', ghostOk && !/__ghost__/.test(screenHTML('market') + screenHTML('farm') + screenHTML('cara')),
      ghostErr || ('leak=' + /__ghost__/.test(screenHTML('market')) + '/' + /__ghost__/.test(screenHTML('farm')) + '/' + /__ghost__/.test(screenHTML('cara'))));
    delete S.co.store.xian['__ghost__']; delete S.co.store.xian['__ghost2__'];

    /* ---------- P. 读古籍：卡库 / 定向择读 / 未读优先 ---------- */
    const CARDS = HX.ANCIENT_CARDS;
    ok('P1 古籍卡库 ≥ 50 张', CARDS.length >= 50, CARDS.length);
    const idDup = CARDS.map(c => c.id).filter((v, i, a) => a.indexOf(v) !== i);
    ok('P2 卡号无重复', idDup.length === 0, idDup.join(','));
    const orphan = CARDS.filter(c => !HX.HERBS[c.herb] || !HX.HERBS[c.herb].aroma).map(c => c.id);
    ok('P3 每张卡的香草皆在谱中且有性味', orphan.length === 0, orphan.slice(0, 5).join(','));
    const noQuote = CARDS.filter(c => !c.quote || !c.src || !c.desc).map(c => c.id);
    ok('P4 每张卡引文出处齐全', noQuote.length === 0, noQuote.join(','));

    const natOf = id => { const a = HX.HERBS[id].aroma;
      const t = (a.辛 >= a.苦 && a.辛 >= a.甘) ? '辛' : (a.苦 >= a.甘 ? '苦' : '甘');
      return t + ((a.温 || 0) >= (a.凉 || 0) ? '温' : '凉'); };
    /* 卡片视图的引文唯一，可据以反查抽到的是哪张卡 */
    const drawnCard = () => { const html = screenHTML('study'); return CARDS.find(c => html.indexOf(c.quote) >= 0) || null; };
    const backToList = () => { const b = document.querySelector('#sc-study [data-again]'); if(b) b.click(); };
    const chipOf = k => document.querySelector('#kindRow .kind-chip[data-kind="' + k + '"]');
    const draw = n => {                       /* 连抽 n 张，答对后回目录，返回抽到的卡 */
      const got = [];
      for(let i = 0; i < n; i++){
        const bb = document.getElementById('btnBuy');
        if(!bb || bb.disabled) break;
        bb.click();
        const c = drawnCard(); if(!c) break;
        got.push(c);
        const ob = [...document.querySelectorAll('#optGrid .opt')].find(x => x.dataset.h === c.herb);
        if(ob) ob.click();                     /* 辨对，写已读 */
        backToList();
        if(!document.getElementById('kindRow')) break;
      }
      return got;
    };
    S.money = 500000;
    S.screen = 'study'; S.readCards = []; HX.render();
    ok('P5 定向栏目含纲目与性味两轴', document.querySelectorAll('#kindRow .kind-chip').length === 11,
      document.querySelectorAll('#kindRow .kind-chip').length);

    const hkAll = CARDS.filter(c => HX.HERBS[c.herb].cat === '洋货').length;
    chipOf('cat:洋货').click();
    const hk = draw(Math.min(8, hkAll));
    ok('P6 定向「洋货」：所抽之卡皆属洋货',
      hk.length >= Math.min(4, hkAll) && hk.every(c => HX.HERBS[c.herb].cat === '洋货'),
      hk.length + '/' + hkAll + ' 张 / ' + [...new Set(hk.map(c => HX.HERBS[c.herb].cat))].join(','));

    const xwAll = CARDS.filter(c => natOf(c.herb) === '辛温').length;
    const chipSpicy = chipOf('nature:辛温');
    ok('P7 性味片可选中且有卡', !!chipSpicy && xwAll > 0, xwAll);
    if(chipSpicy && xwAll) chipSpicy.click();
    const xw = draw(Math.min(6, xwAll));
    ok('P8 定向「辛温」：所抽之卡性味皆辛温',
      xw.length >= Math.min(3, xwAll) && xw.every(c => natOf(c.herb) === '辛温'),
      xw.length + '/' + xwAll + ' 张 / ' + [...new Set(xw.map(c => natOf(c.herb)))].join(','));

    chipOf('').click();                        /* 回到随机读，验「未读优先、不重复」 */
    S.readCards = []; HX.render();
    const any = draw(12);
    ok('P9 未读优先：连读十二张无重复',
      any.length >= 10 && new Set(any.map(c => c.id)).size === any.length,
      any.length + ' 张 / 去重后 ' + new Set(any.map(c => c.id)).size);
    ok('P10 读后登记入册', S.readCards.length === any.length && S.readCards.indexOf(any[0].id) >= 0,
      S.readCards.length + ' / ' + any.length);
    const chipCnt = document.querySelector('#kindRow .kind-chip .kc');
    ok('P11 纲目片显示进度', /\d+\/\d+/.test(chipCnt ? chipCnt.textContent : ''), chipCnt && chipCnt.textContent);
    ok('P12 定向不改动金钱口径', typeof S.money === 'number' && S.money > 0, S.money);

    /* ---------- Q. 搜索：中文/连续输入（不重建输入框）+ 拼音与模糊匹配 ---------- */
    S.money = 500000;
    S.inventory = { aicao: 5, huajiao: 3, baizhi: 2 };   /* 艾草 / 花椒 / 白芷 */
    S.seeds = { aicao: 3, huajiao: 2, bohe: 1, baizhi: 1 };
    const inp = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles:true })); };
    const idsOf = sel => [...document.querySelectorAll(sel)].map(b => b.dataset.inv || b.dataset.seed);

    /* Q1–Q5 香室配香搜索 */
    S.screen = 'blend'; HX.render();
    const b0 = document.getElementById('invSearch');
    ok('Q1 香室搜索框存在', !!b0);
    b0.focus();
    inp(b0, '艾');
    ok('Q2 搜「艾」仅命中艾草（子串模糊）', idsOf('#invRow [data-inv]').join(',') === 'aicao', idsOf('#invRow [data-inv]').join(','));
    ok('Q3 命中处有朱笔圈点高亮', !!document.querySelector('#invRow mark'), !!document.querySelector('#invRow mark'));
    inp(b0, 'AICAO');
    ok('Q4 全拼且忽略大小写 → 艾草', idsOf('#invRow [data-inv]').join(',') === 'aicao', idsOf('#invRow [data-inv]').join(','));
    inp(b0, 'hj');
    ok('Q5 拼音首字母 hj → 花椒', idsOf('#invRow [data-inv]').join(',') === 'huajiao', idsOf('#invRow [data-inv]').join(','));
    inp(b0, '菊科');
    ok('Q6 科属也参与匹配 → 艾草（菊科）', idsOf('#invRow [data-inv]').indexOf('aicao') >= 0, idsOf('#invRow [data-inv]').join(','));
    inp(b0, '艾 xyz');
    ok('Q7 空格分词为「全须命中」→ 无结果提示',
      !!document.querySelector('#invRow .inv-empty'), (document.querySelector('#invRow .inv-empty') || {}).textContent);
    inp(b0, '');
    ok('Q8 清空即恢复全部库存', idsOf('#invRow [data-inv]').length === Object.keys(S.inventory).length, idsOf('#invRow [data-inv]').length);
    ok('Q9 香室输入全程不重建输入框、焦点不丢',
      document.getElementById('invSearch') === b0 && document.activeElement === b0,
      (document.activeElement || {}).id || String(document.activeElement));

    /* Q10–Q16 药圃选种搜索（含中文输入法组词） */
    S.screen = 'garden'; HX.render();
    const zoneBtn = document.querySelector('#zoneGrid [data-z]');
    if(zoneBtn) zoneBtn.click();
    const g0 = document.getElementById('seedSearch');
    ok('Q10 药圃搜索框存在', !!g0);
    g0.focus();
    inp(g0, '草');
    ok('Q11 搜「草」仅命中艾草', idsOf('#seedRow [data-seed]').join(',') === 'aicao', idsOf('#seedRow [data-seed]').join(','));

    /* 中文输入法：组词期间不刷新（不被拼音中间态打断），上屏后一次刷新 */
    inp(g0, '');                                        /* 先恢复全部种子 */
    const allN = idsOf('#seedRow [data-seed]').length;
    g0.value = '';
    g0.dispatchEvent(new CompositionEvent('compositionstart'));
    inp(g0, 'ai');
    const midN = idsOf('#seedRow [data-seed]').length;
    g0.value = '艾';
    g0.dispatchEvent(new CompositionEvent('compositionend', { data:'艾' }));
    const endN = idsOf('#seedRow [data-seed]').length;
    ok('Q12 组词期间不刷新、上屏后刷新', midN === allN && endN === 1, allN + '→' + midN + '→' + endN);
    ok('Q13 组词全程输入框与焦点不变（可连续输入）',
      document.getElementById('seedSearch') === g0 && document.activeElement === g0,
      (document.activeElement || {}).id || String(document.activeElement));

    inp(g0, 'ac');
    ok('Q14 首字母 ac → 艾草', idsOf('#seedRow [data-seed]').join(',') === 'aicao', idsOf('#seedRow [data-seed]').join(','));
    inp(g0, 'mentha');
    ok('Q15 学名 mentha → 薄荷', idsOf('#seedRow [data-seed]').join(',') === 'bohe', idsOf('#seedRow [data-seed]').join(','));
    inp(g0, '艾 草');
    ok('Q16 多词全须命中 → 艾草', idsOf('#seedRow [data-seed]').join(',') === 'aicao', idsOf('#seedRow [data-seed]').join(','));

    /* 播种后整屏重绘：关键字仍在、列表仍过滤、焦点交还（可连续播种） */
    const seedBtn = document.querySelector('#seedRow [data-seed]');
    if(seedBtn) seedBtn.click();
    const gs1 = document.getElementById('seedSearch');
    inp(gs1, 'aicao');
    gs1.focus();
    document.querySelector('#seedRow [data-seed]').click();      /* 种下 → mutate 整屏重绘 */
    const gs2 = document.getElementById('seedSearch');
    ok('Q17 播种重绘后保留关键字与焦点',
      gs2 && gs2.value === 'aicao' && document.activeElement === gs2 &&
      idsOf('#seedRow [data-seed]').length <= 1,
      (gs2 ? gs2.value : 'null') + ' / ' + ((document.activeElement || {}).id || '-'));

    /* ---------- R. 手感层（game-feel）：震动 / 飘字 / 粒子 / 停帧 / 分级 / 可访问性 / 性能 ---------- */
    const stageEl = document.querySelector('.stage');
    const fxNodes = () => document.querySelectorAll('.fx-float,.fx-ink,.fx-flash').length;
    S.settings.shake = true; S.settings.reduceMotion = false;
    ok('R1 手感层接口齐备',
      !!(HX.fx && HX.fx.tier && HX.fx.shake && HX.fx.float && HX.fx.inkBurst && HX.fx.hitStop && HX.fx.pop));
    ok('R2 分层音效接口在位', typeof HX.playTone === 'function');

    HX.fx.shake(0.8);
    await new Promise(r => setTimeout(r, 90));
    const shaken = !!stageEl.style.transform && stageEl.style.transform !== 'none';
    ok('R3 震动产生位移（只动视觉层）', shaken, stageEl.style.transform);
    await new Promise(r => setTimeout(r, 1400));
    ok('R4 震动自动衰减归零（不残留新常态）', !stageEl.style.transform, JSON.stringify(stageEl.style.transform));

    const fEl = HX.fx.float(null, '测试 +1', 'up');
    ok('R5 飘字节点生成', !!fEl && !!document.querySelector('.fx-float'));
    const inkN = HX.fx.inkBurst(200, 200, 8, 5);
    ok('R6 墨点粒子按数生成', inkN === 8 && document.querySelectorAll('.fx-ink').length === 8,
      inkN + '/' + document.querySelectorAll('.fx-ink').length);
    await new Promise(r => setTimeout(r, 1200));
    ok('R7 特效节点自清（无节点泄漏）', fxNodes() === 0, fxNodes());

    HX.fx.hitStop(80);
    const hsOn = !!document.querySelector('.hitstop');
    await new Promise(r => setTimeout(r, 240));
    ok('R8 停帧短暂生效后解除（不锁输入）', hsOn && !document.querySelector('.hitstop'), hsOn);

    const tS = HX.fx.tier('small', null, '', ''), tL = HX.fx.tier('large', null, '', '');
    ok('R9 重要性分级强度递增', tL.tr > tS.tr && tL.ink > tS.ink && tL.hs > tS.hs,
      tS.tr + '/' + tL.tr);

    await new Promise(r => setTimeout(r, 1500));         /* 先让上一轮震动彻底归零 */
    S.settings.shake = false;
    HX.fx.shake(1);
    await new Promise(r => setTimeout(r, 80));
    ok('R10 关震感后不再位移', !stageEl.style.transform && HX.fx.enabled === false,
      JSON.stringify(stageEl.style.transform) + ' enabled=' + HX.fx.enabled);
    S.settings.shake = true; S.settings.reduceMotion = true;
    const fSilent = HX.fx.float(null, 'x');
    HX.fx.inkBurst(10, 10, 4, 4); HX.fx.shake(1);
    await new Promise(r => setTimeout(r, 90));
    ok('R11 静默模式：飘字/墨点/震动全停',
      fSilent === null && document.querySelectorAll('.fx-ink').length === 0 && !stageEl.style.transform,
      'float=' + fSilent + ' ink=' + document.querySelectorAll('.fx-ink').length);
    S.settings.reduceMotion = false;

    /* 键盘模式：重绘后自动把焦点交还首个控件（此前不在输入框中） */
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
    S.screen = 'study'; HX.render();
    const afEl = document.activeElement;
    ok('R12 键盘模式重绘后自动聚焦首个控件',
      !!afEl && afEl.tagName === 'BUTTON' && !!afEl.closest('#sc-study'),
      afEl && (afEl.id || afEl.textContent || afEl.tagName));

    /* 性能：大号粒子连续触发为同步开销，且节点仍能自清 */
    const tPerf = performance.now();
    for(let i = 0; i < 10; i++) HX.fx.inkBurst(120, 120, 22, 6);
    const perfMs = performance.now() - tPerf;
    ok('R13 十次大号粒子同步开销 < 80ms', perfMs < 80, Math.round(perfMs) + 'ms');
    await new Promise(r => setTimeout(r, 1200));
    ok('R14 大量粒子后仍无泄漏', fxNodes() === 0, fxNodes());

    /* ---------- T. UI 合规与测试钩子 ----------
       依 game-ui-design 的硬性校验（字号 / 触控 / 动画时长）与
       develop-web-game 的明文要求（render_game_to_text / advanceTime） */
    const fsOf = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
    const shownFs = () => Array.prototype.filter.call(document.querySelectorAll('body *'),
      e => e.offsetParent !== null && !e.children.length).map(fsOf);
    const bodySel = '.hint,.chip,.opt,.quiz-opt,.inv-item,.lg-item,.zone .zd,.hub-tile .d';
    const allFs = shownFs();
    const smallBody = [];
    ['hub','blend','study','garden'].forEach(scr => {
      S.screen = scr; HX.render();
      Array.prototype.forEach.call(document.querySelectorAll('body *'), e => { if(e.offsetParent !== null) allFs.push(fsOf(e)); });
      Array.prototype.forEach.call(document.querySelectorAll(bodySel), e => {
        if(e.offsetParent !== null && fsOf(e) < 13)
          smallBody.push((e.className || e.tagName) + '@' + scr + '=' + fsOf(e) + 'px');
      });
    });
    ok('T1 全局无不可读小字（最小 ≥11px）', allFs.length > 20 && Math.min(...allFs) >= 11,
      'min=' + Math.min(...allFs) + ' n=' + allFs.length);
    ok('T2 正文/次要文字 ≥13px（game-ui-design 校验）', smallBody.length === 0,
      smallBody.slice(0, 5).join(' | ') || '全部达标');

    let g2t = null, t3err = '';
    try{ g2t = JSON.parse(window.render_game_to_text()); }catch(e){ t3err = String(e.message); }
    ok('T3 render_game_to_text 返回可解析状态契约',
      !!g2t && typeof g2t.screen === 'string' && typeof g2t.day === 'number' && typeof g2t.money === 'number' &&
      !!g2t.seeds && !!g2t.co && typeof g2t.co.fame === 'number' && !!g2t.settings &&
      typeof g2t.settings.shake === 'boolean' && g2t.screen === S.screen,
      t3err || Object.keys(g2t || {}).join(','));

    HX.fx.shake(1);
    const backTxt = window.advanceTime(1000);
    ok('T4 advanceTime 把视觉推到静息（确定性，免真等）',
      typeof window.advanceTime === 'function' && !stageEl.style.transform && HX.fx.trauma === 0 &&
      fxNodes() === 0 && JSON.parse(backTxt).screen === S.screen,
      JSON.stringify(stageEl.style.transform) + ' trauma=' + HX.fx.trauma);

    S.screen = 'hub'; HX.render();
    const tbEl = document.querySelector('.topbar .brand');
    const cdEl = document.querySelector('#sc-hub .card') || document.querySelector('.card');
    const dL = Math.abs(tbEl.getBoundingClientRect().left - cdEl.getBoundingClientRect().left);
    ok('T5 顶部栏与内容卡左缘对齐（safe-area 落在 .wrap 上）', dL <= 1.5, dL.toFixed(2) + 'px');
    ok('T6 无横向溢出', document.documentElement.scrollWidth <= window.innerWidth + 1,
      document.documentElement.scrollWidth + '/' + window.innerWidth);

    let maxAni = 0, worst = '';
    Array.prototype.forEach.call(document.styleSheets, sh => {
      let rules; try{ rules = sh.cssRules; }catch(e){ return; }
      Array.prototype.forEach.call(rules, r => {
        if(!r.selectorText || r.selectorText.indexOf('.fx-') >= 0 || !r.style) return;
        const anim = String(r.style.animation || '');
        if(/infinite/.test(anim)) return;                 /* 环境循环（如香篆青烟）非 UI 过渡，不计时长 */
        (anim.match(/([0-9.]+)(m?s)\b/g) || []).forEach(tok => {
          const m = tok.match(/([0-9.]+)(m?s)/);
          const sec = m[2] === 'ms' ? +m[1] / 1000 : +m[1];
          if(sec > maxAni){ maxAni = sec; worst = r.selectorText + ' ' + tok; }
        });
      });
    });
    ok('T7 一次性界面动画 ≤500ms（.fx-* 与 infinite 环境循环另计）', maxAni > 0 && maxAni <= 0.5,
      maxAni + 's @ ' + worst);

    S.screen = 'hub'; HX.render();
    const moneyEl = document.getElementById('uiMoney');
    const txt0T8 = moneyEl.textContent;
    S.money = S.money + 7; HX.render();
    ok('T8 银钱变动时数字跳动提示（因果可见）',
      moneyEl.classList.contains('num-pop') && moneyEl.textContent !== txt0T8,
      moneyEl.className + ' / ' + txt0T8 + '->' + moneyEl.textContent);

    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
    const kbdOn = document.body.classList.contains('kbd');
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
    ok('T9 键盘态挂 body.kbd，鼠标一动即撤（焦点环只在键盘时炫）',
      kbdOn && !document.body.classList.contains('kbd') && HX.setKbd !== undefined, String(kbdOn));

    /* ---------- NA. 底部导航（4 项）与二级菜单 ---------- */
    const navKeys = [...document.querySelectorAll('#bottomNav .bn-item')].map(b => b.dataset.nav);
    ok('NA1 底部导航 4 项且顺序正确（首页/香道/商道/我的）',
      navKeys.length === 4 && navKeys.join(',') === 'hub,xiang,shang,mine', navKeys.join(','));
    S.screen = 'quiz'; HX.render();
    ok('NA2 香道屏高亮「香道」且子项高亮问答',
      document.querySelector('#bottomNav .bn-item[data-nav="xiang"]').classList.contains('on') &&
      document.querySelector('#xiang-menu [data-go="quiz"]').classList.contains('on'),
      'nav=' + document.querySelector('#bottomNav .bn-item.on').dataset.nav);
    S.screen = 'market'; HX.render();
    ok('NA3 商道屏高亮「商道」且子项高亮市集',
      document.querySelector('#bottomNav .bn-item[data-nav="shang"]').classList.contains('on') &&
      document.querySelector('#shang-menu [data-go="market"]').classList.contains('on'),
      'nav=' + document.querySelector('#bottomNav .bn-item.on').dataset.nav);
    S.screen = 'ach'; HX.render();
    ok('NA4 成就屏映射「我的」高亮',
      document.querySelector('#bottomNav .bn-item[data-nav="mine"]').classList.contains('on'),
      'nav=' + document.querySelector('#bottomNav .bn-item.on').dataset.nav);
    /* 二级菜单交互：点「香道」弹出 → 点子项跳转并自动收起 */
    const xiangItem = document.querySelector('#bottomNav .bn-item[data-nav="xiang"]');
    xiangItem.click();
    const popOpen = document.getElementById('xiang-menu').classList.contains('show');
    document.querySelector('#xiang-menu [data-go="garden"]').click();
    ok('NA5 二级菜单展开后点子项跳转并收起',
      popOpen && HX.state.screen === 'garden' && !document.getElementById('xiang-menu').classList.contains('show'),
      'pop=' + popOpen + ' screen=' + HX.state.screen);
    S.screen = 'hub'; HX.render();

    /* ---------- B2. 契约系统（v2.4 订单与契约） ---------- */
    /* 种子机制：清空后 seedContracts 应补 3 张可接单（验完即恢复，不扰动后续断言） */
    var ctBackup = S.co.contracts.slice();
    S.co.contracts = [];
    XiangYe.seedContracts();
    var seededN = S.co.contracts.length;
    var seedOk = seededN === 3 && S.co.contracts.every(function(c){ return c.status === 'open' && c.cargo && c.reward > 0; });
    S.co.contracts = ctBackup;
    ok('B2-1 种子机制：空列表时 seedContracts 补 3 张可接契约', seedOk && seededN === 3,
      '种子数=' + seededN);
    var openList = XiangYe.contractsByStatus().open;
    if(!openList.length){ S.co.contracts.push(XiangYe.rollContract()); openList = XiangYe.contractsByStatus().open; }
    ok('B2-1b 常规运行中仍有可接契约（列表非空）', openList.length >= 1, '可接=' + openList.length);
    ok('B2-2 契约结构完整（id/cat/city/cargo/reward/deadline/status）',
      openList.length > 0 && openList.every(function(c){
        return c.id && c.cat && c.city && c.cargo && typeof c.reward === 'number' &&
          typeof c.deadline === 'number' && c.status === 'open' && c.title && c.catName;
      }),
      openList[0] ? JSON.stringify(openList[0]) : '(空)');
    ok('B2-3 契约货物为 2–4 种本地可购香料，数量 > 0',
      openList.every(function(c){
        var ids = Object.keys(c.cargo);
        return ids.length >= 2 && ids.length <= 4 && ids.every(function(id){
          return XiangYe.priceS.canBuy(c.city, id) && c.cargo[id] > 0;
        });
      }),
      openList.slice(0,2).map(function(c){ return c.city + ':' + Object.keys(c.cargo).join(','); }).join(' | '));
    /* 接第一张单 */
    var first = openList[0], mBefore = S.money, openBefore = XiangYe.contractsByStatus().open.length;
    var okAccept = XiangYe.acceptContract(first.id);
    ok('B2-4 接单成功：状态转 active + 订金入帐 + 可接数减一',
      okAccept && first.status === 'active' && first.acceptDay === XiangYe.abs() &&
      S.money >= mBefore && XiangYe.contractsByStatus().open.length === openBefore - 1,
      'money=' + mBefore + '->' + S.money + ' open=' + openBefore + '->' + XiangYe.contractsByStatus().open.length);
    /* 直接把货塞进仓库，测交付结算（绕过买卖流程） */
    var delivCity = first.city;
    if(!S.co.store[delivCity]) S.co.store[delivCity] = {};
    Object.keys(first.cargo).forEach(function(id){ S.co.store[delivCity][id] = first.cargo[id] + 5; });
    var fameBefore = S.co.fame, mBef2 = S.money;
    var dr = XiangYe.deliverContract(first.id);
    ok('B2-5 交付成功：扣货 + 收尾款 + 声望 +2 + 状态 done',
      dr && dr.ok && !dr.late && first.status === 'done' && first.finishDay === XiangYe.abs() &&
      S.co.fame >= fameBefore + 2 && S.money > mBef2,
      'fame=' + fameBefore + '->' + S.co.fame + ' money=' + mBef2 + '->' + S.money + ' late=' + dr.late);
    /* 测逾期罚金：开一短单，推进 3 天让 deadline 过去（顺带验 tick 的自动逾期判定），再交付 */
    var lateC = XiangYe.rollContract();
    lateC.deadline = XiangYe.abs() + 2;                    /* 故意设得很短（2 天） */
    lateC.city = 'xian'; lateC.cargo = { huajiao: 10 };
    S.co.contracts.push(lateC);
    XiangYe.acceptContract(lateC.id);
    if(!S.co.store.xian) S.co.store.xian = {};
    S.co.store.xian.huajiao = (S.co.store.xian.huajiao || 0) + 20;
    var fameB2 = S.co.fame;
    for(var di = 0; di < 3; di++) HX.nextDay();
    ok('B2-6a tick 逾期自动判罚：到期未交扣声望并标记（_overdueNoted）',
      lateC._overdueNoted === 1 && S.co.fame < fameB2,
      'fame=' + fameB2 + '->' + S.co.fame + ' noted=' + lateC._overdueNoted);
    var fameB2b = S.co.fame;
    var dr2 = XiangYe.deliverContract(lateC.id);
    ok('B2-6b 逾期交付：状态 fail + 声望再 -1 + 罚金 30%',
      dr2 && dr2.ok && dr2.late && lateC.status === 'fail' && S.co.fame <= fameB2b - 1,
      'fame=' + fameB2b + '->' + S.co.fame + ' late=' + dr2.late + ' status=' + lateC.status);
    /* 推进 35 天，过期完成的契约应被清掉（30 天自动归档） */
    for(var di2 = 0; di2 < 35; di2++) HX.nextDay();
    ok('B2-7 完成/失败的契约 30 天后自动清理（log 仍留痕）',
      S.co.contracts.filter(function(c){ return c.id === first.id; }).length === 0 &&
      S.co.log.some(function(l){ return l.text && l.text.indexOf(first.title) >= 0; }),
      'contracts=' + S.co.contracts.length + ' logHit=' + S.co.log.some(function(l){ return l.text && l.text.indexOf(first.title) >= 0; }));
    /* 六类契约池齐全：直接采样 60 次 rollContract（声望拉满），漏类概率 ≈ 0.01% */
    S.co.fame = 20;
    var cats = {};
    for(var ci = 0; ci < 60; ci++){ cats[XiangYe.rollContract().cat] = 1; }
    ok('B2-8 高声望下 6 类契约全能生成（香行/寺观/官衙/药铺/织造/海贸）',
      Object.keys(cats).length === 6,
      '采样得 ' + Object.keys(cats).length + ' 类：' + Object.keys(cats).sort().join(','));
    /* 低声望时高级单不出现（海贸需声望 12） */
    S.co.fame = 0;
    var lowCats = {};
    for(var ci2 = 0; ci2 < 30; ci2++){ lowCats[XiangYe.rollContract().cat] = 1; }
    ok('B2-9 低声望（0）时海贸/织造等高级契约不出现',
      !lowCats.sea && !lowCats.textile,
      '低声望采样：' + Object.keys(lowCats).sort().join(','));
    S.co.fame = fameBefore;                                    /* 恢复声望，避免影响后续断言 */

    /* UI 级：号簿契约面板 —— 页签切换 + 接单按钮真点击（验证事件绑定，而非只调 API） */
    if(!XiangYe.contractsByStatus().open.length) S.co.contracts.push(XiangYe.rollContract());
    HX.go('book');
    var openTab = document.querySelector('#sc-book [data-ct-tab="open"]');
    if(openTab) openTab.click();                                 /* 切到「可接」栏再看行数 */
    var ctRows = document.querySelectorAll('#sc-book .xy-ct-row').length;
    var acceptBtn = document.querySelector('#sc-book [data-ct-accept]');
    var uiCtId = acceptBtn ? acceptBtn.dataset.ctAccept : '';
    var openN0 = XiangYe.contractsByStatus().open.length;
    if(acceptBtn) acceptBtn.click();
    var afterCt = (S.co.contracts || []).find(function(c){ return c.id === uiCtId; });
    ok('B2-10 号簿契约面板：页签可切、接单按钮真点即转进行中',
      ctRows > 0 && !!acceptBtn && !!afterCt && afterCt.status === 'active' &&
      XiangYe.contractsByStatus().open.length === openN0 - 1,
      'rows=' + ctRows + ' id=' + uiCtId + ' status=' + (afterCt ? afterCt.status : '?') +
      ' open=' + openN0 + '->' + XiangYe.contractsByStatus().open.length);
    S.screen = 'hub'; HX.render();

    /* 重开档（会 confirm，已在 Node 侧自动接受）——放最后，验证重建路径 */
    document.getElementById('btnReset').click();
    const S2 = HX.state;
    ok('N6 重开档后商道层重建', !!document.getElementById('xyTabs') &&
      Object.keys(S2.co.price.xian).length >= 50 && S2.money === 40000 &&
      document.querySelectorAll('#xyTabs [data-sc]').length >= 13,
      S2.money + ' / ' + Object.keys(S2.co.price.xian).length);

    return { R };
  });

  const pass = result.R.filter(r => r.p).length, fail = result.R.filter(r => !r.p);
  const extra = [];
  const okx = (n, c, x) => extra.push({ n, p: !!c, x: x === undefined ? '' : String(x) });

  /* ---------- S. 真键盘端到端（Node 侧 page.keyboard，验证「不用鼠标也能玩」） ---------- */
  const optN = await page.evaluate(() => {
    HX.state.money = 500000; HX.state.screen = 'study'; HX.state.readCards = []; HX.render();
    const b = document.getElementById('btnBuy'); if(b) b.click();
    return document.querySelectorAll('#optGrid .opt').length;
  });
  okx('S1 购卡后选项网格就绪', optN === 4, optN);
  await page.evaluate(() => { document.querySelector('#optGrid .opt').focus(); });
  await page.keyboard.press('ArrowRight');
  const movedTo = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('#optGrid .opt')];
    return { i: opts.indexOf(document.activeElement), h: (document.activeElement || {}).dataset ? document.activeElement.dataset.h : '' };
  });
  okx('S2 方向键在选项组内走位', movedTo.i === 1, 'index=' + movedTo.i);
  const readBefore = await page.evaluate(() => HX.state.readCards.length);
  await page.keyboard.press('Enter');                      /* 真键盘激活，原生 click */
  await new Promise(r => setTimeout(r, 120));
  const after = await page.evaluate(() => ({
    read: HX.state.readCards.length,
    flt: [...document.querySelectorAll('.fx-float')].map(f => f.textContent).join('|')
  }));
  okx('S3 键盘激活选项生效', after.read === readBefore + 1, readBefore + '->' + after.read);
  /* 对错皆有反馈：辨对 medium（含墨点）、辨错 small（仅飘字），故此处只验飘字文案 */
  okx('S4 键盘交互触发反馈文案', /辨对|辨错/.test(after.flt), after.flt);

  /* S5 确定性路径：药圃收获走 medium 档，必有墨点 + 飘字 */
  const hv = await page.evaluate(async () => {
    HX.state.seeds = { aicao: 2 };
    HX.state.plants = [{ id:'p_test', herb:'aicao', zone:'干燥', plantedDay:HX.state.day, ready:true, quality:0.92 }];
    HX.state.screen = 'garden'; HX.render();
    const b = document.querySelector('#sc-garden [data-harvest]');
    if(!b) return { ok:false };
    b.click();
    await new Promise(r => setTimeout(r, 60));
    return { ok:true, ink: document.querySelectorAll('.fx-ink').length,
             flt: [...document.querySelectorAll('.fx-float')].map(f => f.textContent).join('|') };
  });
  okx('S5 收获触发 medium 反馈包（墨点 + 飘字）',
    hv.ok && hv.ink >= 8 && /收获/.test(hv.flt), hv.ink + ' / ' + hv.flt);

  /* 键盘导航至商道层页签并切屏（跨模块兼容） */
  const tabJump = await page.evaluate(async () => {
    const tab = document.querySelector('#xyTabs [data-sc="market"]');
    if(!tab || tab.disabled) return { ok:false };
    tab.focus();
    return { ok:true, focused: document.activeElement === tab };
  });
  if(tabJump.ok){
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 150));
    const jumped = await page.evaluate(() => HX.state.screen);
    okx('S6 键盘可达商道页签并切屏', jumped === 'market', jumped);
  }
  const kbClick = await page.evaluate(() => {
    const row = document.querySelector('#sc-market .xy-mrow[data-good]');
    const btn = row && row.querySelector('[data-buy]');
    if(!btn || btn.disabled) return { ok:false };
    btn.focus();
    return { ok:true, money: HX.state.money };
  });
  if(kbClick.ok){
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 120));
    const money2 = await page.evaluate(() => HX.state.money);
    okx('S7 键盘完成一次市集买入', money2 < kbClick.money, kbClick.money + '->' + money2);
  }

  /* ---------- U. 粗指针命中区 + 窄屏不溢出（game-ui-design 校验，需真设备模拟） ---------- */
  await page.setViewport({ width:390, height:780, hasTouch:true, isMobile:true });
  const touch = await page.evaluate(() => {
    const coarse = window.matchMedia('(pointer:coarse)').matches;
    const probe = (cls) => {
      const e = document.createElement('button');
      e.className = cls; e.textContent = '香';
      document.querySelector('.wrap').appendChild(e);
      const r = e.getBoundingClientRect();
      const h = Math.round(r.height);
      e.remove();
      return h;
    };
    return { coarse: coarse, sm: probe('btn sm'), opt: probe('opt'), chip: probe('kind-chip'), tab: probe('xy-tab') };
  });
  okx('U1 粗指针下可点元素命中区 ≥44px',
    touch.coarse === true && [touch.sm, touch.opt, touch.chip, touch.tab].every(h => h >= 44),
    JSON.stringify(touch));

  await page.setViewport({ width:360, height:720, hasTouch:true, isMobile:true });
  const narrow = await page.evaluate(() => {
    const out = { iw: window.innerWidth };
    ['hub','blend','garden','study','market','farm','shop','annals','ach'].forEach(sc => {
      HX.go(sc);
      out[sc] = document.documentElement.scrollWidth;
    });
    HX.go('hub');
    return out;
  });
  const over = Object.keys(narrow).filter(k => k !== 'iw' && narrow[k] > narrow.iw + 1);
  okx('U2 360px 窄屏九屏皆无横向溢出', over.length === 0,
    over.length ? over.map(k => k + '=' + narrow[k]).join(',') : 'iw=' + narrow.iw);
  await page.setViewport({ width:900, height:800 });

  /* ---------- V. A2 品类分组与检索（市集 / 田亩 / 香草志） ---------- */
  const v1 = await page.evaluate(() => {
    HX.go('market');
    const bar = [...document.querySelectorAll('#sc-market [data-mkcat]')];
    return { n: bar.length, cats: bar.map(b => b.getAttribute('data-mkcat')).join(','),
             total: document.querySelectorAll('#sc-market .xy-mrow[data-good]').length,
             hasSearch: !!document.getElementById('mkSearch'),
             cnt: (document.getElementById('mkCount') || {}).textContent || '' };
  });
  okx('V1 市集设品类页签与搜索框', v1.n >= 3 && v1.hasSearch && v1.total > 10 && /共 \d+ \/ \d+ 味/.test(v1.cnt),
    JSON.stringify(v1));

  const v2 = await page.evaluate(() => {
    const chip = document.querySelector('#sc-market [data-mkcat]:not([data-mkcat="*"])');
    if(!chip) return { ok:false };
    const want = chip.getAttribute('data-mkcat');
    chip.click();
    const rows = [...document.querySelectorAll('#sc-market .xy-mrow[data-good]')];
    const bad = rows.filter(r => (XiangYe.SPICES[r.dataset.good] || {}).cat !== want).length;
    const back = document.querySelector('#sc-market [data-mkcat="*"]');
    if(back) back.click();
    return { ok:true, want: want, after: rows.length, bad: bad };
  });
  okx('V2 品类页签收窄后列表只余该类', v2.ok && v2.after > 0 && v2.after < v1.total && v2.bad === 0,
    '类=' + v2.want + ' rows=' + v2.after + ' 越类=' + v2.bad + ' 全部=' + v1.total);

  /* 真键盘输入拼音：命中即收窄，且全程不需再点一次输入框（焦点仍在搜索框） */
  await page.evaluate(() => { HX.go('market'); const si = document.getElementById('mkSearch'); si.value = ''; si.focus(); });
  await page.keyboard.type('huajiao', { delay: 20 });
  await new Promise(r => setTimeout(r, 80));
  const v3 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#sc-market .xy-mrow[data-good]')];
    return { ids: rows.map(r => r.dataset.good).join(','), n: rows.length,
             focus: (document.activeElement || {}).id || '',
             hit: document.querySelectorAll('#sc-market .xy-searchhit').length };
  });
  /* 注：mkHl 只对「名中的中文子串」加朱笔标（与香道层 hlName 口径一致），
     故拼音 huajiao 命中但不加标（hit===0 属预期），中文关键词才加标 → 见 V3b */
  okx('V3 市集拼音检索收窄且焦点未丢', v3.n === 1 && v3.ids === 'huajiao' && v3.focus === 'mkSearch',
    JSON.stringify(v3));

  /* 连续输入中文（不经鼠标重点）：清空 → 直接输入「花」→ 命中项名皆含花且加朱笔标 */
  await page.evaluate(() => { const si = document.getElementById('mkSearch'); si.value = ''; si.focus(); });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('花', { delay: 30 });
  await new Promise(r => setTimeout(r, 80));
  const v3b = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#sc-market .xy-mrow[data-good]')];
    const names = rows.map(r => (XiangYe.SPICES[r.dataset.good] || {}).zh || '');
    return { n: rows.length, allHas: names.every(n => n.indexOf('花') >= 0),
             focus: (document.activeElement || {}).id || '',
             hit: document.querySelectorAll('#sc-market .xy-searchhit').length };
  });
  okx('V3b 市集中文检索命中并加朱笔标', v3b.n >= 1 && v3b.allHas && v3b.focus === 'mkSearch' && v3b.hit >= 1,
    JSON.stringify(v3b));

  const v4 = await page.evaluate(() => {
    HX.state.co.plots.xian.forEach(p => { p.sow = []; });
    HX.go('farm');
    const all = document.querySelectorAll('#sc-farm [data-plant]').length;
    const chip = document.querySelector('#sc-farm [data-fmcat="土产"]');
    if(!chip || !all) return { ok:false, all: all };
    chip.click();
    const rows = [...document.querySelectorAll('#sc-farm [data-plant]')];
    const bad = rows.filter(b => (XiangYe.SPICES[b.dataset.plant.split(':')[1]] || {}).cat !== '土产').length;
    const back = document.querySelector('#sc-farm [data-fmcat="*"]');
    if(back) back.click();
    return { ok:true, all: all, after: rows.length, bad: bad };
  });
  okx('V4 田亩品类页签收束下种清单', v4.ok && v4.after > 0 && v4.after < v4.all && v4.bad === 0,
    JSON.stringify(v4));

  const v5 = await page.evaluate(() => {
    HX.go('codex');
    const all = document.querySelectorAll('#codexTabs [data-h]').length;
    const chip = document.querySelector('#codexCats [data-cat="花"]');
    if(!chip) return { ok:false, all: all };
    chip.click();
    const tabs = [...document.querySelectorAll('#codexTabs [data-h]')];
    const bad = tabs.filter(b => (XiangYe.SPICES[b.dataset.h] || {}).cat !== '花').length;
    const cur = document.querySelector('#codexTabs .codex-tab.on');
    const out = { ok:true, all: all, after: tabs.length, bad: bad,
                  cur: cur ? (XiangYe.SPICES[cur.dataset.h] || {}).cat : '(none)' };
    const back = document.querySelector('#codexCats [data-cat="*"]');
    if(back) back.click();
    HX.go('hub');
    return out;
  });
  okx('V5 香草志品类页签收束香谱且选中同品', v5.ok && v5.after > 0 && v5.after < v5.all && v5.bad === 0 && v5.cur === '花',
    JSON.stringify(v5));

  /* ---------- W. A3 题库容量与「未读优先」调度 ---------- */
  const w1 = await page.evaluate(() => {
    const pool = HX.buildQuizPool();
    const byKind = {};
    pool.forEach(it => { byKind[it.kind] = (byKind[it.kind] || 0) + 1; });
    /* 结构完整：有稳定 id、选项数对（宜种区只三区→三选一；行价题问五城→五选一；余四选一）、
       ans 指向唯一且存在的选项——选项文字重复即判残缺（同名项答对也判错） */
    const wantN = it => (it.kind === 'zone' ? 3 : (it.kind === 'cheap' || it.kind === 'dear') ? 5 : 4);
    const bad = pool.filter(it => !it.id || !it.q || !Array.isArray(it.opts) || it.opts.length !== wantN(it) ||
      typeof it.ans !== 'number' || it.ans < 0 || it.ans >= it.opts.length ||
      it.opts.filter(o => o === it.opts[it.ans]).length !== 1);
    return { n: pool.length, byKind, bad: bad.length,
             dup: pool.length - new Set(pool.map(it => it.id)).size,
             sample: bad.slice(0, 2).map(it => it.id + '@' + it.kind) };
  });
  okx('W1 题库 ≥ 300 题且条目结构完整、id 不重', w1.n >= 300 && w1.bad === 0 && w1.dup === 0,
    '共' + w1.n + '题 重复id' + w1.dup + ' 残缺' + w1.bad + (w1.sample.length ? ' ' + w1.sample.join(',') : ''));

  okx('W4 题库含商道类题（行市／商路／编年／农时）',
    ['cheap','dear','edge','crop','hist','histc'].every(k => (w1.byKind[k] || 0) > 0),
    JSON.stringify(w1.byKind));

  /* 抽样 20 题：只信原始数据（HERBS/CODEX/XY），按 kind+key 独立复算正解，
     不复用 buildQuizPool 的造题逻辑——故能真正验出「答案张冠李戴」 */
  const w2 = await page.evaluate(() => {
    const pool = HX.buildQuizPool();
    const H = HX.HERBS, C = HX.CODEX, XY = XiangYe;
    const step = Math.max(1, Math.floor(pool.length / 20));
    const idx = [...pool.keys()].filter(i => i % step === 0).slice(0, 20);
    const ks = Object.keys(H).filter(k => C[k] && C[k].latin && C[k].latin.indexOf('待补') < 0);
    const card = id => HX.ANCIENT_CARDS.find(x => x.id === id);
    const hist = id => XY.HISTORY.find(x => x.id === id);
    const argmin = g => XY.CITY_IDS.reduce((b, c) => XY.priceS.priceAt(c, g) < XY.priceS.priceAt(b, g) ? c : b, XY.CITY_IDS[0]);
    const argmax = g => XY.CITY_IDS.reduce((b, c) => XY.priceS.priceAt(c, g) > XY.priceS.priceAt(b, g) ? c : b, XY.CITY_IDS[0]);
    const want = it => {
      switch(it.kind){
        case 'zone':   return H[it.key].zone + '区';
        case 'latin':  return C[it.key].latin;
        case 'fam':    return C[it.key].family;
        case 'med': case 'parts': case 'eff': return H[it.key].name;
        case 'src':    return card(it.key).src;
        case 'qherb':  return H[card(it.key).herb].name;
        case 'aroma':  { const mx = ks.reduce((b, k) => H[k].aroma[it.key] > H[b].aroma[it.key] ? k : b, ks[0]);
                         return H[mx].name; }
        case 'cheap':  return XY.CITIES[argmin(it.key)].name;
        case 'dear':   return XY.CITIES[argmax(it.key)].name;
        case 'edge':   return XY.EDGES.find(e => e.name === it.key).li + ' 里';
        case 'crop':   return XY.SPICES[it.key].crop.d + ' 日';
        case 'hist':   return hist(it.key).title;
        case 'histc':  return hist(it.key).cat;
        default:       return null;
      }
    };
    const bad = [];
    idx.forEach(i => {
      const it = pool[i], w = want(it);
      if(w === null) bad.push(it.id + ' 未知题类');
      else if(it.opts[it.ans] !== w) bad.push(it.id + ' 期望「' + w + '」实为「' + it.opts[it.ans] + '」');
    });
    return { n: idx.length, badN: bad.length, bad: bad.slice(0, 3),
             kinds: [...new Set(idx.map(i => pool[i].kind))].join(',') };
  });
  okx('W2 抽样 20 题正解零错（按原始数据独立复算）', w2.n === 20 && w2.badN === 0,
    '抽样' + w2.n + ' 越' + w2.badN + (w2.bad.length ? ' ' + w2.bad.join(' / ') : '') + ' 类=' + w2.kinds);

  /* 连开十轮（绕开「一日一轮」）：一轮内不重题，跨轮重复率须远低于 15% */
  const w3 = await page.evaluate(() => {
    const ids = [], lens = [];
    for(let r = 0; r < 10; r++){
      HX.state.quizDay = -1;
      HX.startQuiz();
      const cur = HX.state.quiz.qs.map(q => q.id);
      lens.push(new Set(cur).size === cur.length);
      ids.push(...cur);
    }
    const seenAt = {}; let rep = 0;
    ids.forEach(id => { if(seenAt[id]) rep++; else seenAt[id] = 1; });
    return { total: ids.length, rep, rate: +(rep / ids.length * 100).toFixed(1),
             inRound: lens.every(Boolean), qLen: HX.QUIZ_LEN, seen: HX.state.qSeen.length };
  });
  okx('W3 未读优先：十轮 50 题重复率 < 15%', w3.total === 50 && w3.inRound && w3.rate < 15,
    '总' + w3.total + ' 重' + w3.rep + ' 重复率' + w3.rate + '% 轮内不重=' + w3.inRound + ' qSeen=' + w3.seen);

  okx('W5 出题记录只记五题/轮且可持久化', w3.seen === 50,
    'qSeen=' + w3.seen + '（期望 50）');

  /* 五选一题的标号必须齐备：曾经选项标号只到「丁」，第五项会渲成空标 */
  const w6 = await page.evaluate(() => {
    const five = HX.buildQuizPool().filter(it => it.opts.length === 5).slice(0, HX.QUIZ_LEN);
    const q = HX.state.quiz;                      /* quizRun 与 state.quiz 同引用，原地改即可 */
    q.qs = five.map(it => ({ id: it.id, q: it.q, why: it.why, opts: it.opts.slice(), ans: it.ans }));
    q.i = 0; q.picked = []; q.done = false;
    HX.go('quiz');
    const opts = [...document.querySelectorAll('#sc-quiz .quiz-opt')];
    const labels = opts.map(el => { const k = el.querySelector('.k'); return k ? k.textContent.trim() : ''; });
    return { n: five.length, opts: opts.length, labels: labels.join(''),
             bad: labels.filter(t => !/^[甲乙丙丁戊]$/.test(t)).length };
  });
  okx('W6 五选一题标号齐备（不至于渲成空标）',
    w6.n === 5 && w6.opts === 5 && w6.bad === 0, JSON.stringify(w6));

  const all = result.R.concat(extra);
  const passAll = all.filter(r => r.p).length, failAll = all.filter(r => !r.p);
  console.log('\n=========== 合香 · 乾隆香料商道 v2.4 回归 ===========');
  all.forEach(r => { if(!r.p) console.log('  ✗ ' + r.n + (r.x ? '  [' + r.x + ']' : '')); });
  console.log(`\n通过 ${passAll} / ${all.length}`);
  if(failAll.length) console.log('失败项：' + failAll.map(f => f.n).join('；'));
  const errs = pageErrors.filter(e => !/404|Failed to load resource|net::ERR/.test(e));
  if(errs.length) console.log('页面异常：\n  ' + errs.slice(0, 8).join('\n  '));
  else console.log('页面无未捕获异常。');

  await browser.close();
  server.close();
  process.exit(failAll.length ? 1 : 0);
})().catch(e => {
  console.error('测试脚本异常：', e.message);
  process.exit(2);
});