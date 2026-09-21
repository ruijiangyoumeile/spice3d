/* 线上实测：直接打线上 Pages，验证 v2.0 可用（含素材路径与零异常） */
const puppeteer = require('puppeteer-core');
const URL = 'https://ruijiangyoumeile.github.io/spice3d/hexiang/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('response', r => { if(r.status() >= 400 && /hexiang|models|shared/.test(r.url())) errs.push(r.status() + ' ' + r.url().slice(-70)); });
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.XiangYe && window.HX && window.HX.state', { timeout: 45000 });
  const r = await page.evaluate(() => {
    const XY = window.XiangYe, S = window.HX.state;
    const out = {};
    out.spices = Object.keys(XY.SPICES).length;
    out.herbs = Object.keys(window.HX.HERBS).length;
    out.tabs = document.querySelectorAll('#xyTabs [data-sc]').length;
    out.screens = ['book','farm','market','cara','shop','annals','ach'].filter(id => !!document.getElementById('sc-' + id)).length;
    out.build = (document.querySelector('#uiVer') || {}).textContent || '';
    out.assetReady = Object.keys(XY.SPICES).filter(id => XY.assetOf(id).status === 'ready').length;
    out.assetImage = Object.keys(XY.SPICES).filter(id => XY.assetOf(id).status === 'image').length;
    out.assetPlaceholder = Object.keys(XY.SPICES).filter(id => XY.assetOf(id).status === 'placeholder').length;
    /* 七屏逐一渲染不报错 */
    let ok = 0;
    ['book','farm','market','cara','shop','annals','ach'].forEach(id => {
      S.screen = id; window.HX.render();
      const el = document.getElementById('sc-' + id);
      if(el && el.innerHTML.length > 400) ok++;
    });
    out.rendered = ok;
    /* 田亩与商队可交互 */
    S.money = 500000;
    XY.plantCrop('xian', 0, 'huajiao');
    out.planted = ((S.co.plots.xian[0].sow || [])[0] || {}).id || null;
    /* 成就对话必须能关闭（回归：曾出现点确认后不收起） */
    const dlg = () => { const e = document.getElementById('xyAch'); return !!(e && e.classList.contains('on')); };
    for(let i = 0; i < 30 && dlg(); i++) document.getElementById('xyAchClose').click();
    XY.showAch([{ id:'live1', name:'线上校验', desc:'线上实测用', reward:{ money:1 } }]);
    out.dialogOpens = dlg();
    document.getElementById('xyAchOk').click();
    out.dialogCloses = !dlg();
    return out;
  });
  console.log('线上实测 ' + URL);
  console.log(JSON.stringify(r, null, 1));

  /* ---------- 移动端（390×844）与推进耗时 ---------- */
  const mp = await browser.newPage();
  await mp.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mErrs = [];
  mp.on('pageerror', e => mErrs.push(String(e.message).slice(0, 120)));
  await mp.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await mp.waitForFunction('window.XiangYe && window.HX && window.HX.state', { timeout: 45000 });
  const m = await mp.evaluate(async () => {
    const XY = window.XiangYe, HX = window.HX, S = HX.state, o = {};
    const dlg = () => { const e = document.getElementById('xyAch'); return !!(e && e.classList.contains('on')); };
    while(dlg()) document.getElementById('xyAchClose').click();
    XY.showAch([{ id:'m1', name:'移动端校验', desc:'底部抽屉', reward:{ money:1 } }]);
    await new Promise(r => setTimeout(r, 600));
    const card = document.querySelector('#xyAch .xy-ach-card').getBoundingClientRect();
    const btn = document.getElementById('xyAchOk').getBoundingClientRect();
    o.dialogIsSheet = card.bottom >= window.innerHeight - 4;      /* 贴底=底部抽屉 */
    o.btnHeight = Math.round(btn.height);
    document.getElementById('xyAchClose').click();
    S.screen = 'market'; HX.render();
    o.noHScroll = document.documentElement.scrollWidth <= window.innerWidth + 2;   /* 无横向滚动 */
    const row = document.querySelector('#sc-market .xy-mrow[data-good]');
    o.rowFits = row ? row.scrollWidth <= row.clientWidth + 2 : true;
    o.tabsScrollable = (() => { const t = document.getElementById('xyTabs'); return t.scrollWidth > t.clientWidth || t.clientWidth > 300; })();
    /* 推进十日耗时（性能基线） */
    S.money = 500000;
    const t0 = performance.now();
    XY.commitDays(10);
    o.commit10ms = Math.round(performance.now() - t0);
    return o;
  });
  console.log('\n移动端实测（390×844）：' + JSON.stringify(m));
  console.log('移动端异常：' + (mErrs.length ? mErrs.join(' | ') : '无'));

  console.log('\n异常：' + (errs.length ? '\n  ' + errs.slice(0, 6).join('\n  ') : '无'));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('实测脚本异常：' + e.message); process.exit(2); });