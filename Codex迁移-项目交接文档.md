# 合香 · 乾隆香料商道 —— Codex 迁移交接文档

> **文档用途**：将 spice3d 项目（香料科普展示站 + 经营游戏「合香 · 乾隆香料商道」）完整交接给 Codex 平台，使承接方无需前置对话即可全面理解项目并继续开发。
> **编制日期**：2026-10-06　**适用版本**：v2.5（本地最新）／v2.4（线上最新）
> **项目仓库**：https://github.com/ruijiangyoumeile/spice3d
> **配套文档**：[README.md](./README.md)（仓库门面）、[升级方案-v2.0到v3.0.md](./升级方案-v2.0到v3.0.md)（路线图）、[后续升级思路-v2.0.md](./后续升级思路-v2.0.md)（架构与维护手册）、[部署指南.md](./部署指南.md)（部署说明）

---

## 目录

1. [项目背景与定位](#一项目背景与定位)
2. [目标需求与验收标准](#二目标需求与验收标准)
3. [现有资源清单](#三现有资源清单)
4. [技术架构](#四技术架构)
5. [技术规格与工程约定（硬约束）](#五技术规格与工程约定硬约束)
6. [开发历史与本会话纪要](#六开发历史与本会话纪要)
7. [进度跟踪（截至 2026-10-06）](#七进度跟踪截至-2026-10-06)
8. [开发时间表（后续安排）](#八开发时间表后续安排)
9. [团队与角色分工](#九团队与角色分工)
10. [风险评估与应对策略](#十风险评估与应对策略)
11. [Codex 承接指引（交接清单）](#十一codex-承接指引交接清单)

---

## 一、项目背景与定位

### 1.1 项目是什么

「合香 · 乾隆香料商道」是一款**基于原生 HTML/CSS/JavaScript 的古风经营类网页游戏**，以清代乾隆朝为历史背景，融合两条主线：

- **香道线（科普向）**：读古籍辨草识香 → 药圃种植 → 香室按订单配伍（君臣佐使）→ 出售得钱；配套《香草志》百科、香料问答（797 题）、3D 标本与 AR 查看。
- **商道线（经营向）**：乾隆四十年自西安府起家，置田产、看行市、发商队、开分号，经四库开馆 → 两金川 → 南巡 → 议罪银 → 千叟宴 → 八旬万寿 → 英使入贡 → 嘉庆改元等 19 则编年大事。

项目同时承载一个**香料 3D 科普展示站**：111 个香料独立展示页（玻璃拟态 + model-viewer + 香料档案面板），页与游戏共用同一套素材与二维码体系，供微信扫码 AR 查看。

**定位声明**（写入 README 并须保留）：历史背景下的科普向虚构作品——香料形态、成分、药性、典故据《诗经》《楚辞》《神农本草经》《本草纲目》《香乘》《广东新语》等典籍考据，引文标出处；物价、里程、产量为史实约束下的游戏化设定，非史料原值；3D 模型由 AI 生成，仅作直观示意。

### 1.2 版本沿革

| 版本 | 内容 | 状态 |
|---|---|---|
| v1.4 – v1.6 | 展示站成形、玻璃拟态页、四味→十四味香草、古籍卡与墨线图谱 | 历史 |
| **v1.7** | 单文件六屏游戏 + 14 味香草（**已单独建档冻结** → [hexiang-v1.7](https://github.com/ruijiangyoumeile/hexiang-v1.7)，两仓库完全独立） | ❄️ 冻结 |
| **v2.0** | 并入乾隆经营层（七屏）+ 香料谱扩至 53 味 + 成就系统 + 素材管线与测试入仓 | 主线起点 |
| v2.1 | 手感层（game-feel：震动/飘字/停帧/音效）+ 键盘导航与安全区（game-ui-ux） | ✅ |
| v2.2 | 可读性与触控合规（game-ui-design）+ 确定性测试钩子（develop-web-game） | ✅ |
| v2.3 | A1 补 19 味（72 味达成）· A2 品类分栏与检索 · A3 题库 797 题（未读优先） | ✅ |
| **v2.4** | B2 订单与契约 · B1 时令谱（二十四节气）· D4 存档 IndexedDB + 导入导出 | ✅ 已推送 |
| **v2.5** | B3 合香工坊（香方→成品→陈化增值）；PWA 离线、Playwright 三引擎待做 | 🚧 进行中 |

### 1.3 线上地址

| 入口 | 地址 | 当前线上版本 |
|---|---|---|
| 游戏 | https://ruijiangyoumeile.github.io/spice3d/hexiang/ | v2.4（B3 未部署，本地 v2.5） |
| 香料 3D 展示站 | https://ruijiangyoumeile.github.io/spice3d/ | 与仓库同步 |
| v1.7 存档版 | https://github.com/ruijiangyoumeile/hexiang-v1.7 | 冻结 |

---

## 二、目标需求与验收标准

### 2.1 产品目标

1. **科普价值**：每味香料有可核对的考据词条（学名/科属/生境/成分/药性/典故/乾隆间流通），页面与游戏内词条同源。
2. **游戏性**：核心循环「读古籍 → 得种子 → 种植 → 合香 → 出售 → 再投入」闭合可玩；商道层提供长线经营深度（5 城 / 10 商路 / 3 脚力 / 契约 / 工坊 / 编年）。
3. **零依赖可玩**：无构建步骤、无外部 CDN（model-viewer 与 Draco 全自托管）、缺失素材不发任何网络请求；微信内置浏览器可秒开；支持 file:// 直开与 GitHub Pages 双模式。
4. **移动端优先**：触控目标 ≥44px、正文 ≥13px、无横向滚动、安全区适配（iPhone 底部横条）。
5. **可持续扩展**：内容可通过扩展点（registerSpice/registerScreen/registerAchievement/registerDailyTick/registerEventHandler）追加，不必改动商道层核心文件。

### 2.2 核心玩法循环（验收主线）

```
香道线：读古籍(辨草·得种子) → 药圃(选气候区下种) → 香室(君臣佐使配伍·评分)
        → 出售(得钱+历史小卡) 或 制香入坊(陈化增值) → 复投
商道线：置田产 → 依农时种植 → 市集买卖(行价浮动) → 商队发运(真实里程/脚力/风险)
        → 分号收货销售 → 接契约(定银/交期/违约金) → 扩张(声望解锁)
```

### 2.3 验收标准（质量门禁，每次发版必过）

| # | 门禁 | 判定方式 |
|---|---|---|
| G1 | 回归测试全过 | `node hexiang/tests/game_v2_test.js` → 当前基线 **224/224**；新功能必须带新断言（按原始数据独立复算，不复用被测逻辑） |
| G2 | 页面零未捕获异常 | 同上脚本自动采集 pageerror/console.error |
| G3 | 线上实测通过 | `node hexiang/tests/live_check.js` → 香料数/页签/七屏渲染/对话框/移动端全部正常 |
| G4 | 版本号核对 | 页面右下角 `BUILD` 常量（当前 `'2.5'`）与实测 build 字段一致（Pages 有缓存，部署需等 2–4 分钟） |
| G5 | 双副本 MD5 一致 | 部署仓与开发仓对应文件 MD5 相同（见 5.3） |
| G6 | 移动端合规 | 390×844 无横向滚动、按钮高度 ≥44px、成就对话框为底部抽屉 |
| G7 | UI 硬性校验 | 正文/次要文字 ≥13px、一次性动画 ≤500ms、z-index 尺度化（game-ui-design 判据，已转为 T1/T2/T5/T6/T7/T9 断言） |

---

## 三、现有资源清单

### 3.1 代码与关键文件（部署仓 `d:\trae文件\香料3D展示\`）

| 文件 | 体积 | 职责 |
|---|---|---|
| `hexiang/index.html` | **192.5 KB** | 游戏主文件：香道层六屏 + 底部导航 + 存档层 + 手感层 + 测试钩子 |
| `hexiang/shared/xiangye.js` | **171.5 KB** | 商道层七屏：城邑/商路/行价/种植/商队/契约/时令/成就/编年 + 扩展点 |
| `hexiang/shared/spice-prose.js` | 38.4 KB | 香料词条（考据文本） |
| `hexiang/shared/spice-assets.js` | 5 KB | 素材谱（gen_assets.js 自动生成；三维就位 71 味·仅正视图 1 味·占位 0） |
| `hexiang/shared/model-viewer.min.js` | 956 KB | 自托管 model-viewer（不依赖 CDN） |
| `hexiang/shared/draco/` | — | Draco 解码器（自托管） |
| `hexiang/shared/ar-launcher.js` | — | AR 启动与降级说明 |
| `hexiang/shared/sfx/achievement.mp3` | — | 成就音效 |
| `hexiang/models/*.glb` | 14 个 | v1.7 时代核心 14 味模型（0.4–0.8 MB/个，Draco+WebP） |
| `hexiang/tests/game_v2_test.js` | 78.9 KB | 回归测试（224 断言，puppeteer-core + 无头 Chrome + 本地静态服务） |
| `hexiang/tests/live_check.js` | — | 线上实测（打 Pages 验证） |
| `hexiang/tests/gen_assets.js` | — | 扫素材 → 重生成素材谱 + 各城需求清单 |
| 根目录 `<拼音>/index.html` × 111 | — | 香料独立展示页（各含 `models/` 目录） |
| `qr/index.html` | — | 本地二维码工具页（纯本地生成，自托管 qrcode-generator） |
| `shared/`（根级） | — | 站点公共资源（model-viewer、draco、二维码库） |

**游戏内数据规模**：香料 72 味 · 题库 797 题（词条类 548 + 商道类 249）· 成就 32 项 · 随机事件 17 则 · 编年 19 则 · 城邑 5 座 · 商路 10 条 · 脚力 3 种 · 24 节气。

### 3.2 素材资源（仓库外，迁移时必须一并交接）

| 资源 | 位置 | 说明 |
|---|---|---|
| 香料素材库 | `D:\blender素材库\香料\` | 116 个目录：各味 GLB 原档（混元 50k 面）、四视图、USDZ 等 |
| 二维码 PNG | `D:\blender素材库\香料\二维码\` | 111 张，文件名=香料中文名（如 `八角.png`）；**不在仓库内** |
| ComfyUI | `D:\trae文件\ComfyUI\` | 本地生图管线（FLUX.2 klein 4B + Qwen-Image-Edit 2509 + Lightning LoRA）、混元3D 浏览器自动化脚本 |
| 备份目录 | `D:\blender素材库\` | 素材总库（含非香料项目） |

### 3.3 文档体系

| 文档 | 内容 |
|---|---|
| `README.md` | 仓库门面：版本状态、内容结构、本地运行、亮点、声明 |
| `升级方案-v2.0到v3.0.md` | ★ 主路线图：功能扩展（B1–B5）、内容扩展、性能 P1–P8、技术栈、时间表、风险、验收指标；**已完成项以 ✅ + 实施详情标记** |
| `后续升级思路-v2.0.md` | 架构与玩法总览、香料与素材清单、成就规格、维护手册（怎么加香料/城邑/成就/编年） |
| `部署指南.md` | GitHub Pages 部署、二维码工具、注意事项 |
| `output\合香-调研与打包方案.docx` | 5 个同类开源项目调研 + Electron 桌面打包实施方案（未提交，见 7.1） |
| `生成报告.js` | 生成上述 docx 的脚本（依赖 docx npm 包，已装在 `.tools/node_modules`） |

### 3.4 技能与工具链（开发环境依赖）

**项目级技能目录** `d:\trae文件\.trae\skills\`（开发方法学依据，迁移时建议一并说明）：

- 与本项目强相关：`spice3d-pipeline`（素材上架全管线，权威规格）、`spice-game-art`（古风美术生成）、`game-feel`、`game-ui-design`、`game-ui-ux`、`game-design-theory`、`develop-web-game`、`higgsfield-game-generation`（需登录，未启用）
- 备选：`game-developer`、`game-engine`、`multiplayer-game`（暂不适用）、`threejs-game-ui-designer`、`huashu-design`、`taste-skill`、`dashi-ppt`、Gorden 系列（PPT 工具）

**运行时依赖**：

| 项 | 要求 |
|---|---|
| Node.js | 24+（`C:\Program Files\nodejs`，需在 PATH） |
| 测试依赖 | `puppeteer-core`（装在 `.tools\node_modules`，跑测试需设 `NODE_PATH`） |
| 浏览器 | 系统 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`，可用 `CHROME_PATH` 覆盖） |
| Python | 3.x（本地静态服务 `python -m http.server`；测试脚本自带 http 服务，可不装） |
| docx npm 包 | 仅生成报告用，在 `.tools\node_modules` |

---

## 四、技术架构

### 4.1 总体分层

```
┌────────────────────────────────────────────────────────────┐
│  香道层  hexiang/index.html（单文件，六屏）                  │
│  书斋 hub · 读古籍 study · 药圃 garden · 香室 blend          │
│  香草志 codex · 问答 quiz                                    │
│  + 底部导航（首页/香道/商道/我的，含二级菜单）                │
│  + 存档层（localStorage 主存 + IndexedDB 备份 + 导入导出）    │
│  + 手感层 FX（tier 分级/震动/飘字/停帧/音效）                 │
│  + 测试钩子（render_game_to_text / advanceTime）             │
└───────────────┬────────────────────────────────────────────┘
                │  window.HX（唯一桥接接口，商道层只经此读写）
┌───────────────▼────────────────────────────────────────────┐
│  商道层  hexiang/shared/xiangye.js（七屏）                   │
│  号簿 book · 田亩 farm · 市集 market · 商队 cara             │
│  铺面 shop · 编年 annals · 成就 ach                          │
│  系统：城邑/商路/行价/时令/种植/商队/契约/工坊数据/成就/编年   │
│  + 扩展点 API（registerSpice / registerScreen / …）          │
└────────────────────────────────────────────────────────────┘
```

- **数据单源**：`state`（= `HX.state`）为唯一真相来源；商道层扩展字段挂在 `state.co`。
- **屏容器**：香道六屏为 `#sc-hub` … `#sc-quiz`（index.html 内联）；商道七屏由 XiangYe 在 mount 时动态注入 `#sc-book` … `#sc-ach`。
- **商道层异常隔离**：mount 失败不拖垮香道层（try/catch + toast 提示），香道六屏照常可玩。

### 4.2 路由

```
SCREENS = ['hub','study','garden','blend','codex','quiz', …商道七屏]
HASH_OF = { hub:'#/shuzhai', study:'#/guji', garden:'#/yaopu', blend:'#/xiangshi',
            codex:'#/caozhi', quiz:'#/wenda', book:'#/haobu', … }
go(screen) → 校验 SCREENS → 写 state.screen → 同步 location.hash → save() → render()
hashchange → SCREEN_OF[hash] → 更新 state.screen → render()
```

商道屏通过 `registerScreens()` 向 `HX.SCREENS/HASH_OF/SCREEN_OF` 注册（mount 时执行），故 `go('market')` 等对香道层透明。

**底部导航（v2.4 新增）**：4 项（首页/香道/商道/我的），屏→导航映射集中在 `NAV_OF` 单点维护；香道/商道为弹出式二级菜单（`.bn-pop`）；问答并入香道二级菜单；`renderBottomNav()` 在 `render()` 末尾统一刷新高亮。

### 4.3 状态树与单一变异入口

```js
// 所有状态变更（香道层与商道层）都走这一条链：
mutate(fn)  →  改 state  →  checkAch（商道成就结算）  →  save()  →  render()

// 商道层内部封装：
act(fn)     →  HX.mutate(fn + checkAch)  →  showAch(新达成)  →  flushPops()
commitDays(n) → 逐日调 HX.nextDay()（每天含 XiangYe.tick 全量日结）
```

**每日结算链（XiangYe.tick，逐日执行）**：岁首通胀 → 腊月节敬 → 事件修正清理 → 行价漂移 → 在途事故判定 → 到货卸货 → 编年检查 → 随机事件 → **契约巡检（tickContracts）** → 扩展每日钩子。

### 4.4 存档体系（v2.4 D4 定稿）

| 层 | 机制 |
|---|---|
| 主存 | `localStorage['spiceGame_v1']`（同步读写，读档路径 `load()` 不变） |
| 迁移 | `load()` 中 `Object.assign(DEFAULT_STATE, p)` + 逐字段兜底（旧档补 `workshop`/`qSeen`/`history` 等）；商道层 `ensureCo(s)` 兜底 `state.co` 全部字段 |
| 备份 | 每次 `save()` 防抖 800ms 镜像到 IndexedDB（库 `spiceGame_v1` / 店 `saves`）；localStorage 写失败时立即转存并 toast 提示 |
| 救档 | `restoreFromIDB()`（localStorage 被清理时的恢复通道） |
| 导入导出 | `exportSave()` / `importSave(text)`（校验 `v===1`）+ `downloadSave()`（Blob 下载 `合香存档-YYYYMMDD.json`）；书斋「存档」工具条 UI |
| ⚠️ 陷阱 | `importSave` 后必须重建商道层（`XiangYe.mount(HX)`），否则商道层持有的 `state.co` 旧引用读到旧档 |

### 4.5 系统模块一览

| 模块 | 位置 | 要点 |
|---|---|---|
| 行价引擎 | xiangye.js | `priceAt = 底价 × 事件修正(modMul) × 时令(seasonMul)`；产地贱、远地贵；买入 1.04、卖出 0.96 |
| 时令谱（B1） | xiangye.js | 一年 360 日 = 24 节气 × 15 日（day 0 = 立春）；`jieqiOf/jieqiNow/jieqiLeft`；当令品类 `seasonMul=0.96`（价）、`seasonYieldMul=1.15`（产），纯函数可复现 |
| 种植 | xiangye.js | 每块田 2 畦（PLOT_SLOTS）、地域限制（`canFarm`）、洋货不可种、农时 `crop.d` 日成熟 |
| 商队 | xiangye.js | 10 条商路真实里程 × 驮队/镖车/漕船（速度/载重/运费/风险）；在途事故；抵埠入仓 |
| 契约（B2） | xiangye.js | 6 类（香行/寺观/官衙/药铺/织造/海贸）按声望解锁；定银 10–40%；逾期 tick 自动 -1 声望 + 交付罚 30%；挂单上限 8、每日 55% 新增、旧挂单 30 天撤回、已完 30 天归档 |
| 合香工坊（B3） | index.html | 香方 → 成品（香饼/香丸/线香）；品质 = 得分 ±6 波动；+2%/日陈化、封顶 +40%；容量 12 批；出货按陈化价值兑现 |
| 合香评分 | index.html | 功效分 60 + 配伍分 40；硬上限（无君/单味）；`payoutOf` 含重复接单衰减（工坊用 `craftValueOf` 同源不含衰减） |
| 题库 | index.html | 797 题由词条+商道数据自动生成（每类带稳定 `id = kind:key`）；`state.qSeen` 后进后出、「未读优先」调度 |
| 成就 | 双层 | 香道 14 + 商道 18（ACH_EXTRA，`check(s)` 只读存档）；达成弹对话框 + MP3 |
| 天气 | index.html | 影响各气候区品质增减（`wxDelta`） |
| 编年/事件 | xiangye.js | 19 则至期必发（改元自动化）、17 则随机事件牵动行价/脚价/风险 |
| 素材解析 | 双层 | `assetOf()` 三级：三维模型 → 正视图 → 墨线占位（缺失不发请求）；素材谱由 gen_assets.js 生成 |

### 4.6 桥接接口 `window.HX`（商道层契约）

```js
window.HX = {
  state, save, mutate, render, toast, go, esc, qOf, inkIcon, addLog, releaseViewer,
  nextDay, randomSeed, rewardText, achPop, setKbd,
  exportSave, importSave, downloadSave, restoreFromIDB, idbGet, idbPut,   // D4
  craftBlend, sellBatch, batchValue, ageBonus, craftValueOf,              // B3
  PRODUCT_OF, WORKSHOP_MAX, AGE_RATE, AGE_CAP, CRAFT_JITTER,              // B3
  fx: FX, playTone,                          // 手感层（旧宿主缺失时静默跳过）
  HERBS, CODEX, HERB_BASE, ORDERS, ANCIENT_CARDS, ACHIEVEMENTS, ZONES, EVENTS,
  SCREENS, HASH_OF, SCREEN_OF, hashOf(id),
  fuzzyHit, herbHay,                         // 检索（市集复用同一套模糊命中）
  buildQuizPool, startQuiz, QUIZ_LEN          // 题库（测试按原始数据独立复算）
};
```

**商道层对外 API**（`window.XiangYe`，节选）：`priceS.{priceAt,buyPrice,sellPrice,…}`、`plantCrop/harvest/buyPlot`、`buyGood/sellGood/dispatch`、`acceptContract/deliverContract/contractsByStatus`、`JIEQI/seasonMul/seasonYieldMul`、`renderScreen/mount`、扩展点 `registerSpice/registerScreen/registerAchievement/registerDailyTick/registerEventHandler`。

### 4.7 内容扩展方式（无需改核心文件）

| 要做的事 | 怎么做 |
|---|---|
| 新增香料 | `xiangye.js` 的 `SPICES` 加一条（或运行时 `XiangYe.registerSpice`），词条补进 `spice-prose.js` |
| 新增三维/图片 | 素材落到 `<拼音>/models/`（GLB 命名 `model.glb` 或 `<拼音>.glb`，图片 `front.png`），跑 `node hexiang/tests/gen_assets.js` 自动登记 |
| 新增城邑 | `CITIES` 加一条 + `EDGES` 加商路 + 香料 `farm` 里加城 id |
| 新增成就 | `ACH_EXTRA` 加一条（`check(s)` 只读存档），奖励支持 `money/fame/seeds` |
| 新增编年大事 | `HISTORY` 加一条（`at:HQ(年,月,日)` + `run()` 改行价/脚价/风险），年月须有史可依 |
| 新增契约类别 | `CONTRACT_CATS` 加一条（fameReq/rewardMul/daysMin/daysMax/advRate） |

### 4.8 部署架构

- **托管**：GitHub Pages（main 分支 /root），仓库根即站点根；游戏在 `/hexiang/`。
- **部署节奏**：push 后 Pages 构建 **2–4 分钟**（批量 20 页时约 3.5 分钟）；用 `live_check.js` 读页面 `BUILD` 字段确认是否生效。
- **零外部依赖**：model-viewer/Draco/二维码库全自托管（unpkg/gstatic 国内不可达）；双通道加载（主通道 4 秒无进展自动切 jsDelivr 备用）。
- **AR**：iOS 走 Quick Look（USDZ，未入库、按需生成）；Android 走 Scene Viewer/WebXR；国行安卓无 GMS 时降级为摄像头实景兜底。

---

## 五、技术规格与工程约定（硬约束）

### 5.1 代码约定

- **无构建步骤**：所有代码浏览器直开可用（file:// 与 Pages 双模式）；不得引入需要打包的依赖。
- **单文件约束**：香道层收敛在 `index.html`；商道层收敛在 `xiangye.js`；两者经 `window.HX` 桥接，商道层不得直接操作香道层内部变量。
- **状态变更**：只走 `mutate()` 单一入口（含成就结算 + 存档 + 重绘）；直接改 `state` 后不调 render 属违规。
- **旧档兼容**：任何新增 `state` 字段必须同时在 `DEFAULT_STATE`、`load()` 兜底、`ensureCo()`（商道层）三处补齐。
- **已出题库字段**：`state.qSeen` 等持久字段不得改名（会破坏存档）。
- **HTML 合法性**：`<button>` 内禁止嵌套 `<button>`（浏览器解析器会拆散 DOM——本会话已踩坑一次；导航项外层用 `div[role=button]` + 键盘处理）。

### 5.2 UI 规范

- 视觉语言：宣纸底（#f5efe2 系）+ 朱砂红 `--seal: #a23e2b` 选中态 + 楷体 `var(--kai)` 标题；古籍版框卡（外粗内细双线）。
- 尺寸地板：正文/次要文字 ≥13px（重要信息 24px+）；触控目标 ≥44px；一次性动画 ≤500ms。
- 响应式断点：<420px / 420–700px / ≥700px（底部导航 ≥700px 居中 480px 宽）；`env(safe-area-inset-bottom)` 安全区。
- 无障碍：`prefers-reduced-motion` 支持（设置里「静默」）；键盘导航（方向键走位/Enter 激活/Esc 返回）；`body.kbd` 焦点环。

### 5.3 双副本同步机制（重要）

| 副本 | 路径 | 用途 |
|---|---|---|
| **部署仓** | `d:\trae文件\香料3D展示\` | Git 仓库（origin=GitHub spice3d），Pages 源 |
| **开发仓** | `d:\trae文件\香料科普游戏\` | 平铺副本（index.html + shared/ + models/ + game.html），供本地开发/演示 |

**规则：任何游戏代码改动，改完必须同步两副本，并做 MD5 校验一致。**

```powershell
Copy-Item 'd:\trae文件\香料3D展示\hexiang\index.html' 'd:\trae文件\香料科普游戏\index.html' -Force
Copy-Item 'd:\trae文件\香料3D展示\hexiang\shared\xiangye.js' 'd:\trae文件\香料科普游戏\shared\xiangye.js' -Force
# 再比对 MD5
```

### 5.4 测试与发版流程（标准作业）

```powershell
# 1) 回归（改完必跑；端口冲突可用 TEST_PORT 换）
$env:NODE_PATH='d:\trae文件\香料3D展示\.tools\node_modules'
$env:TEST_PORT='8912'
& 'C:\Program Files\nodejs\node.exe' game_v2_test.js   # cwd = hexiang\tests

# 2) 双副本同步 + MD5 校验（见 5.3）

# 3) 提交（信息格式：feat(范围): 中文说明；正文列改动与验证数据）
git add <files>; git commit -m "..."

# 4) 推送（⚠️ 见 5.5 授权规则）

# 5) 等 Pages 2–4 分钟后跑线上实测
node hexiang/tests/live_check.js
```

### 5.5 红线与授权规则

1. **推送需逐次明确授权**：本会话安全策略要求每次 `git push` 前获得用户对**该次提交**的明确批准（历史授权不自动延续到新提交）。提交（commit）可按预授权直接做，**推送（push）必须询问**。
2. **不得强推/回退已推送的提交**（destructive 操作需用户明示）。
3. **香料页面硬规则**：每味香料的展示页/模型必须是「该香料植物的可辨识形态（植物器官）」，不得生成无关物件（血竭曾因深红树脂被内容审核拦截——改用中性色彩描述词「深琥珀褐色半透明树脂块」后通过）。
4. **词条真实性**：引文必须标出处且可核对；批量生成后须抽样复核。
5. **混元额度红线**：免费网页版 20 次/日；崩了的下载不要重跑生成（服务器上保留全部历史创作，可经 `/api/3d/creations/list` 重新下载，绝不重复扣额度）。
6. **工作目录边界**：所有工作须限制在指定文件夹内（部署仓/开发仓/D:\blender素材库），不得改动无关目录。

---

## 六、开发历史与本会话纪要

### 6.1 版本里程碑（近期提交）

```
0c3c560  feat(v2.5 B3): 合香工坊 —— 香方制成品与陈化增值生产链      ← 本地未推送
d84809b  feat(v2.4 D4): 存档加 IndexedDB 兜底备份与导出/导入 JSON   ← 已推送
7aa9bd0  feat(v2.4 B1): 时令谱 —— 二十四节气驱动采收与行价          ← 已推送
7ea0426  feat(v2.4 B2): 订单与契约系统 —— 六类契约 + 号簿契约面板   ← 已推送
2ad9393  feat(导航): 底部导航改 4 项（首页/香道/商道/我的）          ← 已推送
90911b9  feat(香料): 第四批 20 味上线（站点达 91 页）
bc84d9d  feat(v2.3 A3): 题库扩至 797 题（未读优先）
15ac642  feat(v2.3 A2): 市集/田亩/香草志按品类分栏 + 市集检索
354bf37  feat(v2.3 A1): 补入 19 味香料（游戏内达 72 味）
e1f74b6  feat(v2.2): 可读性与触控合规 + 确定性测试钩子
4e078aa  feat(手感层 v2.1): game-feel 反馈包 + 键盘导航与安全区
```

### 6.2 本会话（v2.4–v2.5）完成项与修复的缺陷

**完成项**：

| 项 | 内容 | 断言 |
|---|---|---|
| 底部导航 4 项 | 首页/香道/商道/我的 + 弹出式二级菜单（问答并入香道）；`NAV_OF` 单点映射；点击外部收起；Enter/Space 键盘激活 | NA1–NA5 |
| B2 订单与契约 | 6 类契约按声望解锁；定银/尾款/声望结算；逾期双重判罚；挂单生态（上限 8、30 天撤旧单/归档）；号簿契约面板（可接/进行中/已完三栏） | B2-1~B2-10 |
| B1 时令谱 | 24 节气 × 15 日；当令品类行价 ×0.96、采收 ×1.15（纯函数可复现）；田亩/市集时令提示行；号簿节气 chip | B1-1~B1-6 |
| D4 存档 | localStorage 主存 + IndexedDB 兜底/备份（防抖 800ms 镜像）+ 导出/导入 JSON + 救档 API | D4-1~D4-6 |
| B3 合香工坊 | 香方 → 香饼/香丸/线香；品质 ±6 波动；+2%/日陈化（封顶 +40%）；容量 12 批；出货兑现 | B3-1~B3-6 |

回归断言从 189 → **224**（全过），BUILD 由 2.3 升到 2.5。

**本会话修复的真缺陷**（均为自查发现，值得承接方警惕同类问题）：

1. **`<button>` 嵌套 `<button>`**：主导航项内嵌二级菜单按钮为非法 HTML，浏览器解析器拆散 DOM（实测只渲染出 2 个导航项）→ 外层改 `div[role=button]` + `tabindex` + Enter/Space 键处理。
2. **契约选货去重漏洞**：`rollContract` 选货用「重复即 continue」会致货物种类不足（可能只剩 1 种）→ 改洗牌取前 N。
3. **契约数组引用失效**：`tickContracts` 先 `filter` 返回新数组赋回存档、后向**旧引用** push——新契约静默丢失 → 改同数组追加后统一回写。
4. **旧挂单永久占坑**：open 单不过期会导致挂单上限被早期低级单占满、高级单（织造/海贸）永不出现 → 加 30 天撤回。
5. **换档后商道层引用失效**：`importSave` 替换 `state` 后 `state.co` 引用仍指向旧档 → 重建商道层（`XiangYe.mount`）。
6. **版本号断言脆弱**：测试曾依赖「截至当前推进日」的种子契约数——改为验证 seed 机制本身（清空后补 3 张）。

### 6.3 关键决策记录

1. **导航 5→4 项**：用户拍板「问答并入香道」，采用 brainstorming 技能的 Bounded 级流程（方案先行、批准后实施）。
2. **契约与工坊定位**：契约 = 把「被动等运到」变为「主动排期」（B2）；工坊 = 用时间换溢价的银钱水槽（B3），与「确认出售」并存不替代。
3. **时令系数保守取值**：行价 ±4%、产量 ±15%，确保不颠覆既有平衡（且纯函数化保证可复现、可断言）。
4. **D4 分层**：localStorage 保留为同步主存（读档路径与既有断言不变），IndexedDB 只做兜底与备份——不引入异步读档的确定性风险。
5. **推送授权流程**：因安全策略，每次 push 前单独询问（见 5.5 第 1 条）。
6. **工时口径**：契约/时令/工坊各按「一轮开发 + 回归 + 文档同步」交付，每项完成即提交。

---

## 七、进度跟踪（截至 2026-10-06）

### 7.1 Git 状态矩阵

| 位置 | 状态 |
|---|---|
| `origin/main`（GitHub） | `d84809b`（含导航/B2/B1/D4） |
| 本地 `main` | `0c3c560`（含 B3/v2.5）——**ahead 1，未推送** |
| 工作区未提交 | 修改：`qr/index.html`；未跟踪：**20 个新香料页**（changpu / fangfeng / gegen / hehua / jianghua / jiegeng / jiexiang / jiulixiang / lianqiao / liulanxiang / qinghao / ruixiang / sanqi / shuixian / tianma / wangxiangyu / xiangqinglan / yansui / yelaixiang / yulan）、`output/`、`生成报告.js` |
| 线上 Pages | BUILD **v2.4**（B3 未部署） |

> ⚠️ 迁移前建议：先让用户确认 20 个新香料页与 `qr/index.html` 的提交策略（页面已在磁盘、二维码已导出，但未入库）。

### 7.2 功能完成度矩阵

| 维度 | 现状 | 目标（v3.0） |
|---|---|---|
| 玩法屏 | 13 屏（香道 6 + 商道 7） | 不变 |
| 香料 | 游戏 72 味 / 站点 111 页 | 73 味（词条全覆盖） |
| 三维素材 | 就位 71 · 仅正视图 1 · 占位 0 | 100% 就位 |
| 题库 | 797 题 | ≥ 500（已超） |
| 成就 | 32 项 | 45 项 |
| 契约 | 6 类（B2 完成） | 6 类（已达成） |
| 时令 | 24 节气（B1 完成） | 已达成 |
| 工坊 | 生产链闭环（B3 完成） | 已达成 |
| 存档 | localStorage + IDB + 导入导出（D4 完成） | IndexedDB 自动切换（可选） |
| 回归断言 | **224/224** | ≥ 160（已超） |
| PWA 离线 | ❌ 未做 | v2.5 收尾项 |
| 三引擎回归 | ❌ 未做（现单引擎 puppeteer-core） | v2.5 收尾项 |
| 桌面打包 | 方案已交付（Electron + electron-builder，见 output/ docx） | 待决策是否启动 |

### 7.3 待办清单

**P0（发版阻塞）**
- [ ] 推送 `0c3c560`（B3/v2.5）——需用户逐次授权
- [ ] 决定 20 个新香料页 + `qr/index.html` 的提交方案
- [ ] 推送后跑 `live_check.js` 确认 BUILD v2.5 上线

**P1（v2.5 收尾）**
- [ ] PWA 离线可玩：Service Worker + manifest（缓存壳 + 素材）；注意「零请求」原则与缓存版本管理
- [ ] Playwright 三引擎回归（Chromium/WebKit/Firefox）+ 截图视觉基线

**P2（v3.0，见第八章）**
- [ ] B4 竞争商号 AI（轻量：3–5 家字号按日买卖、挤压价差，只影响行价）
- [ ] B5 海运与季风（广州—南洋航线、季风窗口、海险、单趟毛利 2–3 倍）
- [ ] 银钱双轨与汇兑（制钱/银两兑换比波动 + 票号汇兑）
- [ ] 跨纪元与传承（嘉庆朝长线：子嗣、字号传承、改元后主线刷新）
- [ ] （可选）云端存档/排行榜（需后端：Cloudflare Workers + D1/KV 或 Supabase）

**P3（体验与工程，按需穿插）**
- [ ] C1 反馈锚点补齐（收获/卖出/契约三处 medium 级反馈）；C2 HUD 信息分级；C3 窄屏顶栏重排（≤460px）；C4 成就音效升级（higgsfield）
- [ ] D1 `perf_probe.js` 量化基线（LCP/TBT/长任务/commitDays 耗时/请求数）
- [ ] D2 市集/田亩长列表局部 diff + DocumentFragment；D3 数据懒加载 + brotli；D5 Playwright（同 P1）
- [ ] E1–E3 美术音频（5 城街景 + 人物立绘 + 环境音，需 higgsfield 账号）

---

## 八、开发时间表（后续安排）

> 详细路线图见 [升级方案-v2.0到v3.0.md](./升级方案-v2.0到v3.0.md)（含每项的实施详情与验收指标）。以下为**承接方视角**的相对排期建议。

| 阶段 | 内容 | 交付物 | 验收 |
|---|---|---|---|
| **第 1 步（立即）** | 推送 B3 + 处理 20 页入库 + 线上验证 | 线上 BUILD v2.5 | live_check 全绿 |
| **第 2 步（v2.5 收尾）** | PWA 离线 + Playwright 三引擎回归与截图基线 | service worker + 多引擎测试脚本 | 离线可玩；三引擎断言全过 |
| **第 3 步（v3.0-A）** | B4 竞争商号 AI + B5 海运季风 | 两系统上线 | AI 交易影响行价可观测；海运毛利 2–3 倍 |
| **第 4 步（v3.0-B）** | 银钱双轨与汇兑 + 跨纪元（嘉庆）长线 | 双币种结算 + 改元主线刷新 | 兑换比联动可复现；跨纪元存档不丢 |
| **第 5 步（可选）** | 云端存档/排行榜（Workers + D1/KV） | 后端 + 前端接入 | 需先定数据合规与成本 |
| **持续项（每版必做）** | 素材管线跑通（gen_assets.js）、回归全过、线上实测、文档数字同步（README/升级方案/本交接文档）、双副本 MD5 | — | 同 2.3 节门禁 G1–G7 |

**素材补做排期**（与开发并行，受混元 20 次/日额度约束）：清零「仅正视图/占位」香料 → 补齐 5 城街景与人物立绘（higgsfield 账号就绪后）→ 单味 GLB 加 KTX2/Meshopt 压到 <400KB。

---

## 九、团队与角色分工

本项目为「个人产品主理 + AI 开发代理」协作模式，Codex 承接后角色如下：

| 角色 | 承担方 | 职责 |
|---|---|---|
| **产品主理 / 验收人** | 用户（仓库 owner: ruijiangyoumeile） | 拍板功能优先级与设计（如「问答并入香道」）；验收每轮交付；**逐次授权推送**；提供账号类资源（higgsfield 登录、混元额度策略） |
| **开发代理（当前）** | Trae（本会话） | 编码、测试、文档、素材管线执行、提交 |
| **开发代理（承接）** | **Codex 平台** | 承接第七章待办；沿用第五章工程约定与验收门禁；遇产品级决策（新玩法取舍、付费资源投入）须回到产品主理确认 |
| **素材生产** | 本地管线（非代理） | ComfyUI（FLUX.2 klein 文生图）→ 混元 3D 免费网页版（20/日）→ gltf-transform 压缩 → Blender 无头导 USDZ |
| **测试** | 开发代理 | puppeteer-core 单引擎（现在）→ Playwright 三引擎（v2.5 升级） |
| **托管** | GitHub Pages | 部署仓 push 即自动构建 |

**协作纪律**：产品决策类问题（做什么/取舍）由用户定；实现类问题（怎么做）由开发代理定；每次交付须附「回归结果 + 线上状态 + 双副本校验」三项证据。

---

## 十、风险评估与应对策略

| # | 风险 | 影响 | 概率 | 应对 |
|---|---|---|---|---|
| R1 | **GitHub 连通性**：github.com:443 间歇性不可达（本会话实测发生过；gh-proxy 仅支持读） | 无法 push，阻塞发版 | 中 | 重试；必要时挂代理；长期方案为导出 patch/zip 离线交付后于可联网环境 push |
| R2 | **推送授权政策**：安全策略要求逐次明确授权，历史授权不覆盖新提交 | 推送流程偶发中断 | 高 | 每次 push 前用一句话向产品主理确认（提交前先备好「本次推送了什么」摘要） |
| R3 | **单文件体积增长**：index.html 192.5KB + xiangye.js 171.5KB，无构建 | 首屏变慢；接近单文件维护极限 | 中 | 按 P1/D3 做数据懒加载 + 压缩；如继续增长再评估「双产物」（单文件 + 模块化）并行 |
| R4 | **混元 3D 免费额度**（20 次/日） | 新香料三维进度受限 | 中 | 排队补做；额度不足用腾讯云 API（≈3.6 元/次）或第三方；崩掉的下载不重跑（历史创作可重新下载） |
| R5 | **素材库在仓库外**（`D:\blender素材库`、ComfyUI 目录、二维码 PNG） | 换机/迁移丢失素材 | 中 | 迁移时一并打包这些目录；二维码/素材补齐后建议同步入库或备份 |
| R6 | **双副本漂移**：部署仓与开发仓（`香料科普游戏\`）手工同步 | 本地演示与线上不一致 | 中 | 每次改动按 5.3 流程同步 + MD5 校验（已写入标准作业） |
| R7 | **存档结构演进**：新增字段/改名会破坏旧档 | 玩家丢档 | 低 | 三处兜底（DEFAULT_STATE/load/ensureCo）；字段不改名；导入导出通道已就绪 |
| R8 | **localStorage 配额** | 存档写入失败 | 低 | D4 已兜底：写失败转存 IndexedDB 并提示（已实现） |
| R9 | **内容真实性成本**：词条须考据、引文须可核 | 内容扩展速度受限 | 中 | 保持「引文必标出处 + 检索验真 + 抽样复核」流程 |
| R10 | **浏览器 AR 碎片化**（国行安卓无 GMS/ARCore） | 部分机型 AR 不可用 | 高 | 保留摄像头实景兜底（已实现）；文案明确「实景叠加 ≠ 真 AR」；iOS USDZ 未入库（按需生成） |
| R11 | **知识集中度**：开发脉络此前主要沉淀在会话与记忆文件中 | 承接方理解成本高 | 中 | 本文档 + 仓库四份文档 + 升级方案「✅ 实施详情」共同构成知识底座；后续每版更新本档第七章 |
| R12 | **内容审核误伤**：深色/血红色系图像可能被内容审核拦截（血竭案例） | 素材生成返工 | 低 | 用中性色描述词重写 prompt（已总结为硬规则 5.5-3） |

---

## 十一、Codex 承接指引（交接清单）

### 11.1 需要迁移的内容

| # | 内容 | 来源 | 备注 |
|---|---|---|---|
| 1 | 代码仓库（全量历史） | https://github.com/ruijiangyoumeile/spice3d | 或经 Codex 托管新建仓库（origin.cursor.com 系）后 push |
| 2 | 未提交工作区 | 部署仓工作区（20 个新香料页 + qr/index.html + output/ + 生成报告.js） | 建议先与产品主理确认提交策略再入库 |
| 3 | 本文档 + 四份仓库文档 | 仓库根目录 | 文档随仓库走 |
| 4 | 素材库 | `D:\blender素材库\香料\`（含 `二维码\` 111 张） | 仓库外，必须单独打包 |
| 5 | ComfyUI 管线 | `D:\trae文件\ComfyUI\`（工作流/脚本/模型） | 出图与混元自动化依赖 |
| 6 | 开发副本 | `d:\trae文件\香料科普游戏\` | 双副本机制的另一半 |
| 7 | 项目技能说明 | `d:\trae文件\.trae\skills\`（spice3d-pipeline 等） | 按需复制关键技能目录 |
| 8 | 项目记忆要点 | 已内联入本文档（第六章 + 第五章约束） | 无独立迁移物 |

### 11.2 环境搭建（承接方执行）

```powershell
# 1) 克隆仓库
git clone https://github.com/ruijiangyoumeile/spice3d.git
cd spice3d

# 2) 确认运行时
node -v            # 需 24+
# 测试依赖（puppeteer-core）已在 .tools/node_modules；如缺失：
#   cd .tools; npm i puppeteer-core

# 3) 本地起站（任选其一）
python -m http.server 8899 --bind 127.0.0.1
# 游戏 http://127.0.0.1:8899/hexiang/ · 展示站 http://127.0.0.1:8899/
```

### 11.3 首次验证步骤（按顺序）

```powershell
# ① 回归（零改动先跑一遍，确认基线 224/224）
$env:NODE_PATH='<repo>\.tools\node_modules'; $env:TEST_PORT='8912'
node hexiang/tests/game_v2_test.js

# ② 线上实测（确认当前线上 v2.4 状态）
node hexiang/tests/live_check.js

# ③ 素材谱核对（三维 71/正视图 1/占位 0）
node hexiang/tests/gen_assets.js
```

### 11.4 首次任务建议（承接后的第一个迭代）

1. **收尾 v2.5**：推送 B3（经产品主理授权）→ 处理 20 页入库 → 上线验证 BUILD v2.5。
2. **PWA 离线**：加 manifest + Service Worker（缓存壳与素材，注意与「零请求」原则、Pages 缓存策略的关系）。
3. **Playwright 三引擎回归**：在现有 224 断言基础上迁移/并行，建立截图视觉基线。
4. 之后按第八章进入 v3.0（B4 → B5 → 双轨 → 跨纪元）。

### 11.5 承接注意事项（一页速览）

- ✅ **改完必跑回归**（224/224 是地板不是天花板，新功能必须新增断言）。
- ✅ **改完必同步双副本 + MD5**（5.3）。
- ✅ **发版检查四项证据**：回归结果、线上 BUILD、双副本 MD5、移动端合规。
- ⚠️ **push 逐次授权**；不搞 force push。
- ⚠️ **新增 state 字段三处兜底**（DEFAULT_STATE / load / ensureCo）。
- ⚠️ **HTML 不嵌套 button**；状态变更只走 mutate。
- ⚠️ **素材库与二维码在仓库外**——备份/迁移勿遗漏。
- ⚠️ **香料页必须植物形态**；引文标出处；混元额度不重跑。
- 📌 每版完成后更新：README 版本行、升级方案勾选、**本文档第七章进度表**。

---

*本文档由当前开发代理（Trae）整理于 2026-10-06，覆盖 v1.4 → v2.5 全部开发脉络。若与仓库内其他文档数字冲突，以**代码实测 + 回归输出**为准。*