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
    const readyIds = Object.keys(XY.SPICES).filter(id => XY.assetOf(id).status === 'ready').slice(0, 3);
    const imgIds = Object.keys(XY.SPICES).filter(id => XY.assetOf(id).status === 'image').slice(0, 2);
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