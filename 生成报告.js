/* 生成「合香 · 网页游戏调研与打包实施方案」报告（.docx）
   运行：node 生成报告.js  →  output/合香-调研与打包方案.docx
   依赖：docx（npm 包，已预装在 skill 目录）*/
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak, LevelFormat,
  Header, Footer, PageNumber, TabStopPosition, TabStopType
} = require('docx');

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------- 工具函数 ---------- */
const h1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
const h2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
const h3 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } });
const p = (runs, opts = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [new TextRun(runs)], spacing: { after: 100, line: 360 }, ...opts });
const b = t => new TextRun({ text: t, bold: true });
const code = t => new TextRun({ text: t, font: 'Consolas', size: 20 });
const link = t => new TextRun({ text: t, color: '2E75B6', underline: {} });

/* 带编号的列表（用 paragraph 手工实现，避免 docx-js numbering 复杂性） */
const li = (idx, text, indent = 360) => new Paragraph({
  children: [new TextRun(`${idx}. ${text}`)],
  spacing: { after: 80, line: 340 },
  indent: { left: indent }
});

/* 简单表格 */
function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((s, x) => s + x, 0);
  const hdrRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'D9E2F3', color: 'auto' },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
      verticalAlign: 'center'
    })),
    tableHeader: true
  });
  const bodyRows = rows.map(r => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      children: Array.isArray(cell) ? cell.map(line => new Paragraph({ children: [new TextRun({ text: line, size: 20 })], spacing: { after: 40, line: 320 } }))
        : [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })], spacing: { after: 40, line: 320 } })],
      verticalAlign: 'top'
    }))
  }));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    rows: [hdrRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'B4C7E7' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'B4C7E7' }
    }
  });
}

/* ---------- 文档正文 ---------- */
const children = [];

/* 封面 */
children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: '合香 · 乾隆香料商道', size: 56, bold: true, font: '思源宋体', color: 'A23E2B' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 400 },
  children: [new TextRun({ text: '同类项目调研分析 & 桌面打包实施方案', size: 36, font: '思源宋体', color: '5A4A36' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: '编制日期：2026-09-30', size: 24, color: '808080' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: '版本：v2.3 评估稿', size: 24, color: '808080' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: '适用项目：spice3d / hexiang', size: 24, color: '808080' })]
}));

/* 分页 */
children.push(new Paragraph({ children: [new PageBreak()] }));

/* 目录占位（手动写主要章节导航） */
children.push(h1('目录'));
[
  '一、项目背景与调研目的',
  '二、同类项目调研（5 个优质项目深度分析）',
  '  2.1 项目一：Bitburner —— 编程向增量游戏的工程典范',
  '  2.2 项目二：Cookie Clicker —— 放置类开山之作的极简架构',
  '  2.3 项目三：Merchant Roads —— 中世纪商队经营模拟',
  '  2.4 项目四：vue-XiuXianGame —— 中文文字修仙放置类',
  '  2.5 项目五：Global Trader —— 纯文本系统驱动叙事',
  '三、横向对比与可复用方案',
  '  3.1 五项核心维度对比表',
  '  3.2 可直接复用的技术方案与代码片段',
  '四、桌面打包实施方案',
  '  4.1 技术选型：Electron vs NW.js vs Tauri vs PWA',
  '  4.2 推荐方案：Electron + electron-builder',
  '  4.3 项目目录结构设计',
  '  4.4 主进程 main.js 核心实现',
  '  4.5 跨平台兼容性处理',
  '  4.6 资源加载性能优化',
  '  4.7 本地数据存储方案',
  '  4.8 安装程序与界面设计',
  '  4.9 实施步骤与风险评估',
  '五、结论与建议'
].forEach(line => {
  children.push(new Paragraph({
    children: [new TextRun({ text: line, size: 22 })],
    spacing: { after: 60, line: 340 },
    indent: { left: line.startsWith('  ') ? 480 : 0 }
  }));
});

children.push(new Paragraph({ children: [new PageBreak()] }));

/* ============== 第一章 ============== */
children.push(h1('一、项目背景与调研目的'));
children.push(p([
  new TextRun('「合香 · 乾隆香料商道」（以下简称「本项目」）是一款基于原生 HTML/CSS/JavaScript 的古风经营类网页游戏，融合香道文化（调香、识药）与商道经营（行价、贩运、铺面、商队），当前版本 v2.3，含 13 个游戏屏、72 味香料、797 道问答题目，回归测试 189 项断言全过。'),
]));
children.push(p('本次调研与方案编制服务于两个目标：'));
children.push(li(1, '横向研究 GitHub 及开源社区中 3–5 个与本项目类型相近（经营模拟 / 放置类 / 文字向 / 网页端）的优质项目，提炼其架构设计、功能模块划分、交互逻辑的可取之处，形成可复用的技术方案与代码参考，为 v2.4 及后续版本升级提供决策依据。'));
children.push(li(2, '制定将当前网页版游戏转换为可打包安装的桌面应用的完整实施方案，涵盖技术选型、跨平台兼容、资源优化、本地存储、安装界面设计等关键环节，供决策是否启动桌面版开发。'));

/* ============== 第二章 ============== */
children.push(h1('二、同类项目调研（5 个优质项目深度分析）'));

/* 2.1 Bitburner */
children.push(h2('2.1 项目一：Bitburner —— 编程向增量游戏的工程典范'));
children.push(p([
  b('项目定位：'), new TextRun('赛博朋克题材的编程类增量游戏，玩家通过编写 JavaScript 脚本（Netscript）自动化黑客行为来推进游戏。Steam 上 7400+ 评价，94% 好评。'),
]));
children.push(p([b('核心特点：')]));
children.push(li(1, '约 300 个 Netscript API 函数，形成完整的游戏内编程沙箱'));
children.push(li(2, 'TypeScript + React 前端，Webpack 打包，代码体量大但结构清晰'));
children.push(li(3, '官方提供 Electron 打包，同时支持纯浏览器运行'));
children.push(li(4, '存档系统支持离线进度计算与版本迁移（SaveDataMigrationUtils）'));

children.push(h3('2.1.1 架构设计'));
children.push(p('Bitburner 的架构分五层，每层职责单一：'));
children.push(makeTable(
  ['层级', '核心实体', '职责'],
  [
    ['UI 层', 'React 组件 + Router', '渲染界面、处理用户交互、页面路由'],
    ['API 层', 'NSProxy + NetscriptFunctions', '玩家脚本调用入口：上下文注入、RAM 校验、环境检查'],
    ['引擎层', 'engine.tsx（200ms 主循环）', '驱动游戏世界时钟、状态更新、事件派发'],
    ['数据层', 'PlayerObject + SaveObject', '集中式状态管理，单一真相来源'],
    ['工具层', 'Constants + ErrorHandler + 迁移工具', '配置常量、错误边界、存档版本迁移']
  ],
  [1600, 3000, 4200]
));

children.push(h3('2.1.2 可借鉴点'));
children.push(li(1, 'Proxy 模式封装 API 调用：在真正执行业务逻辑之前，统一做参数校验、权限检查、资源计费。本项目的 HX 桥接层（window.HX）可以参考此模式，在 mutator 外层包一层 Proxy，自动加日志/校验/统计，不用在每个函数里重复写。'));
children.push(li(2, '存档迁移链（SaveDataMigrationUtils）：每个版本只写「从 vN 升到 vN+1」的迁移函数，加载时按版本号依次应用。本项目当前只有一次迁移（旧档 crop → sow），后续版本多了以后必须有系统化的迁移链，否则老玩家丢档。'));
children.push(li(3, '主循环定长 tick（200ms）：用 setInterval 而非 requestAnimationFrame，避免后台标签页降频导致游戏暂停。本项目当前 commitDays 是手动触发，若将来加「时间流逝」自动模式，必须走 setInterval。'));

children.push(h3('2.1.3 代码参考：API Proxy 模式'));
children.push(p([code(`// 参考 Bitburner 的 NSProxyHandler，给 HX.mutate 加一层统一校验
const HXProxy = {
  get(target, prop) {
    const val = target[prop];
    if (typeof val !== 'function') return val;
    return function (...args) {
      // 统一前置：校验存档版本、记录操作日志
      console.debug('[HX]', prop, args.slice(0, 2));
      const result = val.apply(target, args);
      // 统一后置：自动 save（防抖）
      scheduleSave();
      return result;
    };
  }
};
window.HX = new Proxy(originalHX, HXProxy);`)]));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* 2.2 Cookie Clicker */
children.push(h2('2.2 项目二：Cookie Clicker —— 放置类开山之作的极简架构'));
children.push(p([
  b('项目定位：'), new TextRun('2013 年由 Julien Thiennot 一晚间写出的放置类游戏鼻祖，5 万玩家在数小时内涌入，单日 20 万玩家。核心循环一句话：点击 → 数字上涨 → 买升级 → 数字涨更快。'),
]));

children.push(h3('2.2.1 核心架构'));
children.push(p('Cookie Clicker 的架构极简到可以概括为「一个变量 + 一个定时器」：'));
children.push(li(1, '单一状态变量：cookies（曲奇数）+ upgrades（升级列表）'));
children.push(li(2, '每帧（或每 100ms）按 totalCPS × deltaTime 增加 cookies'));
children.push(li(3, '升级价格公式：cost = base × 1.15^owned（1.15 指数增长，全行业事实标准）'));
children.push(li(4, 'localStorage 自动存档 + 离线收益计算'));

children.push(h3('2.2.2 可借鉴点'));
children.push(li(1, '指数定价公式 1.15^n：本项目的香料升级、田亩扩展、商队扩容如果将来做，直接用这个公式即可，平衡性经过全球玩家验证。'));
children.push(li(2, '离线收益（offline progress）：玩家关闭游戏再打开时，按离开时长 × 生产率给奖励（通常打 50% 折扣并设上限）。这是放置类游戏的「第二日留存」核心机制——让玩家每天打开都有「不在也在赚」的爽感。本项目当前是「过一日」手动推进，若加自动流逝模式，离线收益是标配。'));
children.push(li(3, '视觉反馈密度：每次点击都有数字飘字 + 饼干抖动 + 音效，信息密度极高但不杂乱。本项目 game-feel 层已具备基础，可以参考其「每操作必有反馈」的原则继续加密。'));

children.push(h3('2.2.3 代码参考：离线收益计算'));
children.push(p([code(`// 参考 Cookie Clicker 式离线收益
function calcOfflineEarnings(lastTick, now) {
  const dt = Math.min((now - lastTick) / 1000, 8 * 3600); // 上限 8 小时
  const discount = 0.5; // 离线打五折
  const dailyIncome = calcDailyIncome(); // 每日自动收益
  const days = dt / 86400;
  return Math.floor(dailyIncome * days * discount);
}

// 加载存档时补发
function load() {
  const save = JSON.parse(localStorage.getItem(KEY) || '{}');
  state = Object.assign(defaultState(), save);
  if (save.lastTick) {
    const bonus = calcOfflineEarnings(save.lastTick, Date.now());
    if (bonus > 0) {
      state.money += bonus;
      toast(\`你离开了 \${Math.floor((Date.now()-save.lastTick)/86400000)} 日，账房结算得银 \${fmt(bonus)}\`);
    }
  }
  state.lastTick = Date.now();
}`)]));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* 2.3 Merchant Roads */
children.push(h2('2.3 项目三：Merchant Roads —— 中世纪商队经营模拟'));
children.push(p([
  b('项目定位：'), new TextRun('Phaser 3 构建的中世纪商队贸易模拟，玩法与本项目商道层高度相似：城镇网络、低买高卖、货物损耗、强盗遭遇、产业投资、银行存贷。纯前端无后端，单 HTML 文件即可运行。'),
]));

children.push(h3('2.3.1 功能模块划分'));
children.push(makeTable(
  ['模块', '核心内容', '与本项目对照'],
  [
    ['贸易经济', '22 种商品、动态供需、30% 买卖价差、销售税 15%、商品每日腐烂 2%', '本项目已有行价漂移 + 产地限制，可加「损耗/税」增加真实感'],
    ['世界地图', '12 城镇 4 种生态、23 条道路、距离 1–4 日、危险等级 1–5、实时动画旅行', '本项目是文本/卡片式，若升级可参考地图可视化'],
    ['强盗遭遇', '4 种选择（战斗/贿赂/投降/逃跑），护卫损失、物品损失、死亡概率', '本项目商队「风险」目前只扣钱，可扩展为多结局事件'],
    ['城镇活动', '市场 / 地产 / 酒馆 / 银行，8 种工坊收租', '本项目已有铺面 + 商队，缺工坊生产链（v2.4 合香工坊可补）'],
    ['生存系统', '护卫工资、食物消耗、士气 0–100%、士气归零游戏结束', '本项目目前只有钱/声望二维，可加「士气/名望」丰富维度'],
    ['AI 竞争', '每日 20% 概率 AI 商人扫货，影响行价', '本项目 v3.0 竞争商号 AI 的直接参考']
  ],
  [1600, 3400, 3800]
));

children.push(h3('2.3.2 可借鉴点'));
children.push(li(1, '程序化生成美术（procedural sprites）：全部 NPC 肖像、物品图标用代码生成，不需要美术资源，零成本。本项目目前香料「小印」已经用 SVG 内联实现了类似思路，可以推广到人物/场景。'));
children.push(li(2, '商品腐烂（item decay）：易腐货物每日损失 2%，迫使玩家快速周转，制造策略深度。本项目可引入「鲜花类香料易凋、树脂类耐久」的差异化机制。'));
children.push(li(3, '声望影响价格（reputation → ±25%）：城镇声望高则买价低卖价高。本项目「名望」目前只有成就用，可联动到行价折扣。'));
children.push(li(4, '多结局事件：强盗遭遇给玩家 4 个选项，不同性格的玩家选不同策略。本项目随机事件目前是「发生了 → 结算」的单向通知，没有选择分支，可以升级为事件卡。'));

children.push(h3('2.3.3 代码参考：多结局事件系统'));
children.push(p([code(`// 参考 Merchant Roads 的事件设计，把当前一维事件升级为带选择的事件卡
const EVENTS_V2 = [
  {
    id: 'bandit',
    cat: '风险',
    title: '山道遇响马',
    text: '行至秦岭深处，一伙响马拦住去路。为首者横刀立马，喝道：留下买路钱！',
    choices: [
      { label: '破财消灾（付 50 两）', effect: s => { s.money -= 5000; return '交了买路钱，平安通过。'; } },
      { label: '拼死一战（-2 护卫，损失 30% 货）', effect: s => { /* 战斗判定 */ return '一番厮杀，折损两名护卫，保住了大半货物。'; } },
      { label: '弃车保帅（丢一半货保人）', effect: s => { /* 丢货 */ return '弃了半车货物，人都完好。'; } },
      { label: '绕路而行（多 2 日行程）', effect: s => { /* 延迟 */ return '绕了远路，多走了两日，总算安稳。'; } }
    ]
  }
  // ... 更多事件
];`)]));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* 2.4 vue-XiuXianGame */
children.push(h2('2.4 项目四：vue-XiuXianGame —— 中文文字修仙放置类'));
children.push(p([
  b('项目定位：'), new TextRun('基于 Vue.js + Element Plus + Pinia 的中文文字修仙模拟器，开源 1.8k star。玩法：修炼 → 突破境界 → 炼器 → 炼丹 → 打怪 → 灵宠 → 秘境，完全靠文字和数值驱动。'),
]));

children.push(h3('2.4.1 架构特点'));
children.push(li(1, 'Vue 3 + Pinia：状态管理集中化，组件响应式更新，开发效率高'));
children.push(li(2, 'Docker 一键部署：提供 amd64/arm64 双架构镜像，运维门槛低'));
children.push(li(3, '自动挂机系统：自动修炼 / 自动打怪 / 自动打 Boss，放置类核心体验'));
children.push(li(4, '境界体系：练气 → 筑基 → 金丹 → 元婴 → … → 登仙，大境界突破有失败概率'));

children.push(h3('2.4.2 可借鉴点'));
children.push(li(1, '「自动战斗 / 自动修炼」是放置类留存关键：本项目当前是纯手动推进（过一日、答一轮题），可以加「托管」模式——选好策略后游戏自动推进，玩家隔段时间来看结果。这直接对应 Cookie Clicker 式的「离线也在赚」体验。'));
children.push(li(2, '境界 / 等级体系的仪式感：每个大境界突破都有独立 UI、特效、文案。本项目「香道等级」（初识/通鼻/辨味/知香/香师/香圣）可以做成更有仪式感的突破事件，而不只是数字增加。'));
children.push(li(3, 'Pinia 集中状态管理：本项目当前 state 是普通对象 + mutate() 函数式更新，思路一致。如果未来上 React/Vue，直接迁移到 Pinia/Zustand 等状态库即可，架构上不用大改。'));

children.push(h3('2.4.3 代码参考：自动推进（托管模式）'));
children.push(p([code(`// 参考修仙放置类的「自动挂机」，给本项目加托管模式
let autoMode = false;
let autoTimer = null;

function toggleAuto(strategy) {
  autoMode = !autoMode;
  if (autoMode) {
    autoTimer = setInterval(() => {
      // 按策略自动决策：比如「只种本地最便宜的香料，成熟就收，熟了就卖」
      autoDecision(strategy);
      nextDay();
    }, 1000); // 每秒推进一日（可变速）
  } else {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

function autoDecision(strategy) {
  // 收获所有成熟作物
  // 按策略买种子/卖货
  // 触发可接的契约订单
  // ……
}`)]));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* 2.5 Global Trader */
children.push(h2('2.5 项目五：Global Trader —— 纯文本系统驱动叙事'));
children.push(p([
  b('项目定位：'), new TextRun('完全基于文字的贸易/犯罪/音乐多系统模拟游戏，17000 行 JS，无图形、无外部库，靠系统间联动产生叙事。最初是 iOS Scriptable 上的原生 Alert() 对话框实验，后移植到浏览器。'),
]));

children.push(h3('2.5.1 核心设计理念'));
children.push(li(1, '系统驱动叙事：没有预设剧情，所有故事由系统联动产生（买卖 → 赚钱 → 买吉他 → 写歌 → 演出 → 成名，完全是玩家自己走出来的）'));
children.push(li(2, '300 万种每日心情组合：用程序生成制造「每次玩都不一样」的感觉'));
children.push(li(3, '多系统叠加：贸易 / 犯罪 / 音乐 / 地产 / 格斗 五个相对独立的系统，互相可以联动也可以单独玩，玩家随时切换主线'));

children.push(h3('2.5.2 可借鉴点'));
children.push(li(1, '系统叠加而非线性剧情：本项目香道层 + 商道层已经是两个相对独立的系统，答案正确给种子、种子种出香料、香料合香又卖钱——这条链路已经走通。可以继续加更多平行系统（如：合香工坊、契约订单、竞争商号），让玩家自由选择玩什么。'));
children.push(li(2, '纯文本也能好玩：证明了「文字 + 数值 + 系统联动」足以支撑数十小时游戏时间。本项目走「古籍 / 账房 / 香事」的文字美学路线是正确的方向，不必强求 3D 或像素画。'));
children.push(li(3, '每日 mood / 随机事件密度：Global Trader 每天都有小事件，让玩家「明天会不会有好事」成为上线动力。本项目当前随机事件池 17 则，可以继续扩充到 40–50 则，并且让事件之间有因果链（比如：「天旱」之后接「花椒减产」再接「花椒涨价」）。'));

/* ============== 第三章 ============== */
children.push(h1('三、横向对比与可复用方案'));

children.push(h2('3.1 五项核心维度对比表'));
children.push(makeTable(
  ['项目', '体量', '架构模式', '核心循环', '存档方案', '视觉风格', '可借鉴度'],
  [
    ['Bitburner', '大（10万行+）', 'TS+React+Proxy+分层引擎', '编程→自动化→扩张', 'JSON+版本迁移链', '赛博朋克/终端', '★★★★★（工程架构）'],
    ['Cookie Clicker', '小（千行级）', '单变量+定时器+localStorage', '点击→升级→更多点击', 'localStorage+离线收益', '像素/卡通', '★★★★☆（平衡公式）'],
    ['Merchant Roads', '中', 'Phaser 3+模块化场景', '贸易→升级→更远处贸易', 'localStorage 5日自动存', '像素/中世纪', '★★★★★（玩法系统）'],
    ['vue-XiuXianGame', '中', 'Vue 3+Pinia+组件化', '修炼→突破→更多修炼', 'localStorage+云存档（可选）', '古风文字界面', '★★★★☆（放置体验）'],
    ['Global Trader', '中（1.7万行）', '多系统叠加+纯文本', '多系统自由探索', '未披露', '终端/纯文字', '★★★☆☆（叙事设计）'],
    ['本项目 v2.3', '中（~1500行逻辑）', '原生JS+双层桥接+innerHTML', '识香→种药→贩运→调香', 'localStorage+单次迁移', '古风水墨/账房', '基准']
  ],
  [1800, 1200, 1900, 1700, 1500, 1300, 1400]
));

children.push(h2('3.2 可直接复用的技术方案与代码片段'));

children.push(h3('3.2.1 存档迁移链（高优先级，预计 v2.4 引入）'));
children.push(p('参考 Bitburner 的 SaveDataMigrationUtils。当版本多了以后，每次加新字段/改结构都写一个迁移函数，加载时按版本号依次跑：'));
children.push(p([code(`const MIGRATIONS = [
  { v: 1, up: s => { /* v1 就是初始版，什么都不做 */ } },
  { v: 2, up: s => { s.qSeen = []; } },       // v2 加了题库未读优先
  { v: 3, up: s => { s.workshop = {}; } },     // v3 加了合香工坊
  { v: 4, up: s => { /* 下版本迁移逻辑 */ } },
];

function migrate(save) {
  let v = save.v || 1;
  for (const m of MIGRATIONS) {
    if (m.v > v) { m.up(save); v = m.v; }
  }
  save.v = v;
  return save;
}`)]));

children.push(h3('3.2.2 指数定价公式（平衡基石，v2.4 工坊可用）'));
children.push(p([code(`// 第 n 个的价格 = 基础价 × 1.15^n（Cookie Clicker 验证过的行业标准）
function upgradeCost(base, owned) {
  return Math.ceil(base * Math.pow(1.15, owned));
}`)]));

children.push(h3('3.2.3 离线收益 / 托管模式（放置类标配，v2.5 考虑）'));
children.push(p('见 2.2.3 / 2.4.3 节代码。核心是：玩家离开时记时间戳，回来时算离开了多久 × 每日收益 × 折扣系数（0.5 是行业惯例），上限设 8 小时防止挂机刷。'));

children.push(h3('3.2.4 多选择事件卡（v2.4 事件升级）'));
children.push(p('见 2.3.3 节代码。把当前一维事件（发生→结算→通知）升级为有 3–4 个选项的事件卡，每个选项不同代价与收益，玩家根据自身情况决策。'));

children.push(h3('3.2.5 HX 桥接层统一 Proxy（工程质量提升）'));
children.push(p('见 2.1.3 节代码。在不破坏现有接口的前提下，给 HX 包一层 Proxy，可以无侵入地加操作日志、自动存盘防抖、参数校验、成就检测等横切关注点。'));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* ============== 第四章 ============== */
children.push(h1('四、桌面打包实施方案'));

children.push(h2('4.1 技术选型对比：Electron vs NW.js vs Tauri vs PWA'));
children.push(makeTable(
  ['维度', 'Electron', 'NW.js', 'Tauri', 'PWA（非真安装）'],
  [
    ['技术内核', 'Chromium + Node.js', 'Chromium + Node.js', 'WebView + Rust', '浏览器 + Service Worker'],
    ['包体积（win）', '~60–80 MB', '~80–100 MB', '~3–8 MB', '≈ 0（浏览器内）'],
    ['Node API 访问', '完整（主/渲染隔离）', '完整（页面直接调用）', '有限（Rust 侧实现）', '无'],
    ['本地文件系统', 'fs 完整支持', 'fs 完整支持', '受限（需 Rust 桥）', '无（只能 IndexedDB）'],
    ['开发难度', '中（双进程模型）', '低（单进程）', '高（需 Rust）', '极低'],
    ['跨平台', 'Win/Mac/Linux', 'Win/Mac/Linux', 'Win/Mac/Linux', '全平台'],
    ['安装包格式', 'NSIS/MSI/DMG/DEB', 'NSIS/DMG/DEB', 'MSI/DMG/DEB', '—（添加到桌面）'],
    ['自动更新', 'electron-updater 成熟', '需自实现', 'tauri-updater', 'Service Worker 自动更新'],
    ['适合本项目', '★★★★★', '★★★★☆', '★★★☆☆', '★★☆☆☆']
  ],
  [1800, 2200, 2200, 2200, 1600]
));

children.push(h2('4.2 推荐方案：Electron + electron-builder'));
children.push(p([b('选型理由：')]));
children.push(li(1, '本项目以 HTML/CSS/JS 开发，Electron 是最成熟的网页转桌面方案，生态完善'));
children.push(li(2, '将来若做「本地存档迁移」「截图分享」「自定义窗口标题栏」「单实例锁」等，Electron 都有成熟方案'));
children.push(li(3, 'electron-builder 一键生成 NSIS 安装包、绿色版、DMG 等，中文资料丰富'));
children.push(li(4, 'Tauri 包体小但需要 Rust 开发能力，且 Windows 7 不支持 WebView2（需额外安装），对用户门槛较高'));
children.push(li(5, 'PWA 本质仍是网页，不能脱离浏览器，无桌面图标仪式感，不符合「安装包」预期'));

children.push(h2('4.3 项目目录结构设计'));
children.push(p([code(`香料3D展示/
├── hexiang/                  ← 现有游戏本体（不变）
│   ├── index.html
│   ├── shared/
│   │   ├── xiangye.js
│   │   ├── spice-prose.js
│   │   └── ...
│   └── models/               ← 3D 模型
│
├── desktop/                  ← 【新增】Electron 打包目录
│   ├── main.js               ← 主进程
│   ├── preload.js            ← 预加载脚本（安全桥）
│   ├── package.json
│   ├── build/                ← electron-builder 配置
│   │   └── icon.ico          ← 应用图标（256×256）
│   └── dist/                 ← 打包输出（installer / portable）
│
└── 升级方案-v2.0到v3.0.md`)]));

children.push(h2('4.4 主进程 main.js 核心实现'));
children.push(p([code(`// desktop/main.js
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: '合香 · 乾隆香料商道',
    icon: path.join(__dirname, 'build/icon.png'),
    backgroundColor: '#f5efe2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    // 自定义标题栏（可选，让设计更一体化）
    // titleBarStyle: 'hidden',
    // frame: false
  });

  // 加载游戏页面
  const gameUrl = isDev
    ? 'http://127.0.0.1:5500/hexiang/index.html'  // 开发期用本地服务
    : \`file://\${path.join(__dirname, '../hexiang/index.html')}\`;  // 打包后用 file 协议
  mainWindow.loadURL(gameUrl);

  // 外链在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 简化菜单（保留基本功能，去掉 Electron 默认菜单里没用的项）
  const template = [
    {
      label: '游戏',
      submenu: [
        { label: '重新开始', click: () => mainWindow.reload() },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于',
            message: '合香 · 乾隆香料商道',
            detail: '版本：' + app.getVersion() + '\\n基于 Electron 构建\\n© 2026'
          });
        }},
        { label: '官方站点', click: () => shell.openExternal('https://github.com/ruijiangyoumeile/spice3d') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ===== IPC：存档导出 / 导入 ===== */
ipcMain.handle('save:export', async (_evt, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出存档',
    defaultPath: '合香存档.json',
    filters: [{ name: 'JSON 存档', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }
  return false;
});

ipcMain.handle('save:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入存档',
    filters: [{ name: 'JSON 存档', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths[0]) {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(raw);
  }
  return null;
});

/* ===== 单实例锁（防止开多个窗口互相覆盖存档）===== */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });`)]));

children.push(h2('4.5 跨平台兼容性处理'));
children.push(p([b('Windows（主目标）')]));
children.push(li(1, '支持 Win 10 / Win 11：Electron 25+ 已放弃 Win 7，需明确告知用户'));
children.push(li(2, '安装包格式：NSIS（.exe 安装向导，用户最熟悉）+ portable（绿色免安装版）'));
children.push(li(3, '高 DPI：Electron 默认已支持，但要确保游戏内 CSS 不依赖系统字号缩放'));
children.push(li(4, '中文路径：用 app.getPath(\'userData\') 存存档，避免装在中文目录下的路径编码问题'));

children.push(p([b('macOS（次目标）')]));
children.push(li(1, '打包 DMG 格式，需配置 electron-builder 的 mac 目标'));
children.push(li(2, '若要上架 App Store 需要额外的公证（notarization）和沙盒，成本高，建议先做 dmg 直装版'));
children.push(li(3, '菜单栏 macOS 风格调整（第一个菜单是 app 名字而非「游戏」）'));

children.push(p([b('Linux（可选）')]));
children.push(li(1, 'AppImage / deb / rpm 三种格式，electron-builder 都支持'));
children.push(li(2, '需求不大的话可以先不做，精力集中在 Win 版'));

children.push(h2('4.6 资源加载性能优化'));
children.push(p([b('当前状态评估：'), new TextRun('本项目首屏约 300KB（HTML+JS+CSS），72 味香料的 GLB 模型约 0.5MB/味但按需加载，整体性能良好。打包成 Electron 后走 file:// 协议，没有网络延迟，加载会更快。')]));

children.push(p([b('优化点：')]));
children.push(li(1, '模型 preload 策略：只预加载当前屏幕可能用到的模型（如香室里的 3–5 味常用香料），其余首次进入香草志才加载'));
children.push(li(2, '图片转 AVIF/WebP：正视图 PNG（0.6–0.8MB/张）→ AVIF（约 0.15MB/张），全站图片总量 −60%'));
children.push(li(3, 'localStorage 数据量：当前存档约 5–10KB，远小于 5MB 上限，不必上 IndexedDB。但如果将来加「合香历史记录」「事件日志」等大数据，再迁 IndexedDB'));
children.push(li(4, '启动时骨架屏：在 Electron 窗口 ready-to-show 之前先显示一个古风 loading 画面，避免白屏'));

children.push(h2('4.7 本地数据存储方案'));

children.push(h3('4.7.1 存档位置'));
children.push(p('Electron 推荐用 app.getPath(\'userData\') 目录，不同平台自动对应：'));
children.push(makeTable(
  ['平台', '路径示例'],
  [
    ['Windows', '%APPDATA%\\[app-name]\\'],
    ['macOS', '~/Library/Application Support/[app-name]/'],
    ['Linux', '~/.config/[app-name]/']
  ],
  [2000, 6800]
));

children.push(h3('4.7.2 存储方案三层设计'));
children.push(li(1, '第一层（当前）：localStorage（游戏内读写，零改动，兼容网页版）'));
children.push(li(2, '第二层（新增）：主进程定期备份到 userData/saves/ 目录，保留最近 5 份，防损坏'));
children.push(li(3, '第三层（新增）：玩家可手动导出 / 导入 JSON 存档文件（通过 IPC 调用系统文件对话框）'));

children.push(h3('4.7.3 存档迁移保障'));
children.push(p('配合 3.2.1 节的迁移链，桌面版加载时先读 localStorage，若版本过旧则依次迁移。同时每次启动前备份上一份存档到 saves/backup-prev.json，迁移失败可以回滚。'));

children.push(h2('4.8 安装程序与界面设计'));

children.push(h3('4.8.1 NSIS 安装向导配置'));
children.push(p([code(`// desktop/package.json 中的 electron-builder 配置
{
  "build": {
    "appId": "com.ruijiangyoumeile.hexiang",
    "productName": "合香 · 乾隆香料商道",
    "directories": { "output": "dist" },
    "files": [
      "main.js",
      "preload.js",
      "../hexiang/**/*"
    ],
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,          // 不做一键安装，给用户选择路径
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "合香 · 乾隆香料商道",
      "deleteAppDataOnUninstall": false,   // 卸载保留存档
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeader": "build/installer-header.bmp",  // 顶部 banner（古风）
      "installerSidebar": "build/installer-sidebar.bmp", // 侧边图
      "license": "../LICENSE"
    }
  }
}`)]));

children.push(h3('4.8.2 安装界面视觉方案'));
children.push(p([b('设计方向：'), new TextRun('延续游戏内「古籍 / 账房 / 宣纸」的视觉语言，避免默认 NSIS 的蓝白系统风。')]));
children.push(li(1, '安装包图标：256×256 ico，用游戏 logo（香炉+印章），古铜色调'));
children.push(li(2, '顶部 Banner：164×314（NSIS 标准尺寸），宣纸底 + 竖排「合香」二字 + 小印'));
children.push(li(3, '侧边图：古风水墨山水或香料手绘图，增加仪式感'));
children.push(li(4, '欢迎页文案：「合香 · 乾隆香料商道——识香、种药、调香、贩运。愿君铺号遍天下。」'));
children.push(li(5, '卸载时保留存档：默认勾选「保留游戏存档」，防止误删丢失进度'));

children.push(h3('4.8.3 应用内关于窗口'));
children.push(p('主菜单「帮助 → 关于」调用 dialog.showMessageBox，显示版本号、构建日期、官方链接、许可证。'));

children.push(h2('4.9 实施步骤与风险评估'));

children.push(h3('4.9.1 实施步骤（预计 2–3 个工作日）'));
children.push(li(1, '第一天：搭建 desktop/ 目录，写 main.js + preload.js，本地跑通开发模式，验证游戏能正常加载、存档可读'));
children.push(li(2, '第二天：配置 electron-builder，生成 NSIS 安装包 + 绿色版，在干净虚拟机/另一台电脑上测试安装、运行、卸载'));
children.push(li(3, '第三天：做安装界面素材（icon/banner/sidebar），加存档导出/导入功能，加自动更新配置（electron-updater + GitHub Releases）'));

children.push(h3('4.9.2 风险评估'));
children.push(makeTable(
  ['风险', '影响', '概率', '应对'],
  [
    ['Electron 包体大（60MB+）', '下载慢，用户流失', '高', '同时提供 7z 自解压绿色版（更小）；官网上放分流下载'],
    ['杀毒软件误报', '用户不敢装', '中', '做代码签名（需要购买证书，约 300–1000 元/年）；或提供 SHA256 校验值供验证'],
    ['存档路径中文乱码', '存档丢失', '低', '统一用 app.getPath(\'userData\')，不自己拼接路径；文件名全英文'],
    ['自动更新失败', '版本升级困难', '低', 'electron-updater + GitHub Releases；同时提供完整安装包覆盖安装'],
    ['Windows 7 不兼容', '老用户用不了', '中', '明确说明系统要求；如需兼容 Win 7，锁定 Electron 22.x 版本']
  ],
  [2200, 1200, 1000, 4400]
));

/* ============== 第五章 ============== */
children.push(h1('五、结论与建议'));

children.push(h2('5.1 调研结论'));
children.push(p('经过对 5 个同类优质项目的分析，可以得出以下结论：'));
children.push(li(1, '本项目的「香道 + 商道」双层架构在同类项目中属于中等偏上的复杂度，玩法深度已经超过大部分纯放置类游戏。'));
children.push(li(2, '最值得借鉴的三个方向：①事件系统升级为多选择事件卡（Merchant Roads）；②引入托管/自动推进模式提升留存（vue-XiuXianGame + Cookie Clicker）；③建立系统化的存档迁移链保障长线运营（Bitburner）。'));
children.push(li(3, '纯文本/卡片式视觉风格是正确方向，Global Trader 证明了「系统联动 + 文字」足以支撑长时间游玩，不必强求像素或 3D 美术。'));

children.push(h2('5.2 打包建议'));
children.push(p('对于桌面打包，建议分两步走：'));
children.push(li(1, '第一步（快速验证，1–2 天）：用 Electron + electron-builder 出一版 NSIS 安装包 + 绿色版，验证核心功能正常，交付给小范围用户试用，收集反馈。包体大一点没关系，先验证「有没有人愿意下载桌面版」这个需求。'));
children.push(li(2, '第二步（品质打磨，3–5 天）：如果反馈好，再做安装界面定制、代码签名、自动更新、存档导出导入、多平台（macOS）等进阶功能。'));

children.push(h2('5.3 后续开发优先级建议'));
children.push(makeTable(
  ['优先级', '事项', '来源项目', '预计工时'],
  [
    ['★★★', '存档迁移链（v 字段 + 迁移函数数组）', 'Bitburner', '0.5 天'],
    ['★★★', '事件系统升级为多选择事件卡（10 个事件）', 'Merchant Roads', '2 天'],
    ['★★☆', '托管/自动推进模式（3 种策略）', 'vue-XiuXianGame + Cookie Clicker', '2 天'],
    ['★★☆', 'HX 桥接层统一 Proxy（日志/防抖存档/校验）', 'Bitburner', '0.5 天'],
    ['★★☆', 'Electron 桌面打包 v1', '—', '2 天'],
    ['★☆☆', '香料损耗 / 腐烂机制（差异化农时）', 'Merchant Roads', '1 天'],
    ['★☆☆', '声望联动行价折扣', 'Merchant Roads', '0.5 天'],
    ['☆☆☆', 'Tauri 版本（包体小但门槛高）', '—', '5 天以上']
  ],
  [1000, 4200, 1800, 1400]
));

children.push(new Paragraph({ spacing: { before: 400 }, children: [
  new TextRun({ text: '—— 报告完 ——', size: 22, color: '808080' })
], alignment: AlignmentType.CENTER }));

/* ---------- 生成文档 ---------- */
const doc = new Document({
  creator: '合香项目组',
  title: '合香 · 同类项目调研与桌面打包实施方案',
  description: '5 个同类网页游戏深度分析 + Electron 打包完整方案',
  styles: {
    default: {
      document: {
        run: { font: '思源宋体', size: 22 }
      }
    }
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '合香 · 调研与打包方案', size: 18, color: '808080', italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '第 ', size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '808080' }),
            new TextRun({ text: ' 页', size: 18, color: '808080' })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  const outPath = path.join(OUT_DIR, '合香-调研与打包方案.docx');
  fs.writeFileSync(outPath, buf);
  console.log('✅ 报告已生成：' + outPath);
  console.log('   文件大小：' + (buf.length / 1024).toFixed(1) + ' KB');
}).catch(err => {
  console.error('生成失败：', err.message);
  process.exit(1);
});
