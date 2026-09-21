/* ============================================================
   素材清单生成器：扫描站点目录，识别每味香料的 3D / 图片是否就位，
   ① 输出可直接粘回 xiangye.js 的 ASSETS / ASSET_PENDING 代码块
   ② 输出《各城素材需求清单》Markdown（含占位标记）
   跑法：node gen_assets.js  >  控制台查看 + 写 route_assets.js / asset_report.md
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', '..');            /* 站点根：hexiang/tests 的上两级 */
const LIB = process.env.SPICE_LIB || 'D:\\blender素材库\\香料'; /* 原始素材库（本机路径，可用环境变量覆盖） */
const XY = path.join(SITE, 'hexiang', 'shared', 'xiangye.js');
const src = fs.readFileSync(XY, 'utf8');

/* 城邑归属：与 xiangye.js 的 farm/sea 对应（此处按 id 归类，便于出清单） */
const CITY_NAME = { xian:'西安府', hankou:'汉口镇', suzhou:'苏州府', hangzhou:'杭州府', guangzhou:'广州府' };
const REGION_OF = { xian:'关中', hankou:'荆楚', suzhou:'江南', hangzhou:'江南', guangzhou:'岭南' };

/* 从源码里取出香料谱（id / 名 / 类别 / 品级 / farm / sea）
   注：逐条切分——条目内的换行缩进为 6 空格，条目之间才是 4 空格，故按 4 空格 + id 切 */
const spices = [];
const spStart = src.indexOf('var SPICES = {');
const spEnd = src.indexOf('\n  };', spStart);
if(spStart < 0 || spEnd < 0){ console.error('未找到 SPICES 数据段'); process.exit(2); }
const body = src.slice(spStart, spEnd);
body.split(/\n    (?=[a-z][a-z0-9]*:\s*\{ zh:)/).forEach(seg => {
  const m = /^([a-z][a-z0-9]*):\s*\{ zh:'([^']+)', cat:'([^']+)', tier:(\d+)/.exec(seg);
  if(!m) return;
  const farm = (seg.match(/farm:\[([^\]]*)\]/) || [, ''])[1].replace(/['\s]/g, '').split(',').filter(Boolean);
  const sea = /sea:true/.test(seg);
  spices.push({ id:m[1], zh:m[2], cat:m[3], tier:+m[4], farm, sea });
});
if(!spices.length){ console.error('未能从 xiangye.js 解析香料谱'); process.exit(2); }

/* 目录名与 id 不同者：在此登记 */
const DIR_ALIAS = { baidoukou:'baikou' };
const dirOf = id => DIR_ALIAS[id] || id;
const exists = p => { try{ return fs.existsSync(p); }catch(e){ return false; } };

const rows = [], ready = [], imageOnly = [], missing = [];
spices.forEach(sp => {
  const dir = dirOf(sp.id);
  const dSite = path.join(SITE, dir, 'models');
  const dLib = path.join(LIB, sp.zh);
  /* 站点目录：兼容 <id>.glb 与 model.glb 两种命名 */
  let glb = null;
  [dir + '.glb', 'model.glb'].forEach(f => { if(!glb && exists(path.join(dSite, f))) glb = f; });
  const img = ['front.png', 'front.jpg', dir + '.png'].find(f => exists(path.join(dSite, f))) || null;
  const hasLib = exists(dLib);
  const usdz = exists(path.join(dSite, dir + '.usdz')) || exists(path.join(dSite, 'model.usdz'));
  const rel = f => '../' + dir + '/models/' + f;
  const item = { id:sp.id, zh:sp.zh, dir, glb:glb ? rel(glb) : null, img:img ? rel(img) : null, hasLib, usdz, cat:sp.cat, tier:sp.tier, farm:sp.farm, sea:sp.sea };
  rows.push(item);
  (glb ? ready : (img ? imageOnly : missing)).push(item);
});

/* ① 代码块 */
const codeOf = (list, kind) => list.map(x => kind === 'ready'
  ? "    " + x.id + ":{ model:'" + x.glb + "'" + (x.img ? ", image:'" + x.img + "'" : "") + " },"
  : "    " + x.id + ":{ image:'" + x.img + "' },").join('\n');
const block =
  '/* —— 已就位：三维模型（由 gen_assets.js 自动生成，勿手改） —— */\n' +
  (codeOf(ready, 'ready') || '    /* 暂无 */') + '\n' +
  '/* —— 待补：只有正视图，三维待生成 —— */\n' +
  (codeOf(imageOnly, 'image') || '    /* 暂无 */');

/* ② 清单 Markdown */
const cityList = { xian:[], hankou:[], suzhou:[], hangzhou:[], guangzhou:[] };
rows.forEach(x => { if(x.sea) cityList.guangzhou.push(x); else (x.farm || []).forEach(c => { if(cityList[c]) cityList[c].push(x); }); });
let md = '# 各城香料素材需求清单（自动生成）\n\n';
md += `共 ${rows.length} 味：三维就位 ${ready.length} · 仅正视图 ${imageOnly.length} · 完全缺失 ${missing.length}\n`;
md += `（三维文件为 GLB，图片为正视图 front.png；USDZ 供 iOS 实景 AR，本次不纳入仓库以控体积）\n\n`;
Object.keys(cityList).forEach(c => {
  const list = cityList[c];
  md += `## ${CITY_NAME[c]}（${REGION_OF[c]}）· ${list.length} 味\n\n`;
  md += '| 香料 | 品类 | 品级 | 三维模型 | 正视图 | 状态 |\n|---|---|---|---|---|---|\n';
  list.forEach(x => {
    const st = x.glb ? (x.img ? '齐备' : '模型就位·图待补') : (x.img ? '图就位·模型待生成' : '**占位·待生成**');
    md += `| ${x.zh} | ${x.cat} | ${x.tier} | ${x.glb ? '✓' : '—'} | ${x.img ? '✓' : '—'} | ${st} |\n`;
  });
  md += '\n';
});
/* 占位标记清单 */
if(missing.length || imageOnly.length){
  md += '## 占位标记（游戏中显示「素材待生成」墨线占位）\n\n';
  (missing.concat(imageOnly)).forEach(x => { md += `- ${x.zh}（${x.id}）：${missing.includes(x) ? '无 3D、无图' : '有正视图、无 3D'}　→ 待补 ${x.dir}/models/${x.glb ? '' : 'model.glb'}\n`; });
}

const OUT = process.env.GEN_OUT || require('os').tmpdir();
fs.writeFileSync(path.join(OUT, 'route_assets.js'), '/* 自动生成：素材登记代码块 */\n' + block + '\n');
fs.writeFileSync(path.join(OUT, 'asset_report.md'), md);

/* ③ 站点用素材谱：hexiang/shared/spice-assets.js（游戏运行时合并，免手改源码） */
const readyObj = {}, imageObj = {};
ready.forEach(x => { readyObj[x.id] = { model:x.glb }; if(x.img) readyObj[x.id].image = x.img; });
imageOnly.forEach(x => { imageObj[x.id] = { image:x.img }; });
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const js =
'/* 香料素材谱（由 .tools/gen_assets.js 自动生成，' + stamp + '）\n' +
'   三维就位 ' + ready.length + ' 味 · 仅正视图 ' + imageOnly.length + ' 味 · 占位 ' + missing.length + ' 味\n' +
'   游戏侧：XiangYe 启动时合并本表；未列名者自动退墨线占位，且不发起任何请求 */\n' +
'window.SPICE_ASSETS = {\n' +
'  ready: {\n' + ready.map(x => "    " + x.id + ":{ model:'" + x.glb + "'" + (x.img ? ", image:'" + x.img + "'" : "") + " },").join('\n') + '\n  },\n' +
'  image: {\n' + imageOnly.map(x => "    " + x.id + ":{ image:'" + x.img + "' },").join('\n') + '\n  }\n' +
'};\n';
[SITE].concat(process.env.MIRROR_DIR ? [process.env.MIRROR_DIR] : []).forEach(base => {
  const out = path.join(base, 'hexiang', 'shared', 'spice-assets.js');
  const alt = path.join(base, 'shared', 'spice-assets.js');
  const target = fs.existsSync(path.join(base, 'hexiang')) ? out : alt;
  fs.writeFileSync(target, js);
  console.log('写出 ' + target);
});

console.log('香料 ' + rows.length + ' 味 · 三维就位 ' + ready.length + ' · 仅图 ' + imageOnly.length + ' · 缺失 ' + missing.length);
console.log('USDZ 已就位 ' + rows.filter(x => x.usdz).length + ' 味（不入仓库）');
console.log('\n===== 粘贴回 xiangye.js 的代码块 =====\n' + block);
console.log('\n报告：.tools/asset_report.md');
console.log('缺失/待补：' + missing.concat(imageOnly).map(x => x.zh).join('、'));