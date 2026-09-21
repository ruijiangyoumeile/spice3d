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
    out.planted = S.co.plots.xian[0].crop || null;
    return out;
  });
  console.log('线上实测 ' + URL);
  console.log(JSON.stringify(r, null, 1));
  console.log('异常：' + (errs.length ? '\n  ' + errs.slice(0, 6).join('\n  ') : '无'));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('实测脚本异常：' + e.message); process.exit(2); });