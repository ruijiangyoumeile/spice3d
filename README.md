# 合香 · 香料小院 / 香料 3D 展示站

本地版本：**v3.0-preview.1**，场景化探索首轮预览。此前 v2.5 的配伍、种植、工坊与商道规则继续使用；本轮不自动推送或部署。

游戏入口：hexiang/index.html。香料展示站仍在仓库根目录，各味页面保留独立访问方式。

## 本轮变化

- 小院、药圃、香坊、图鉴四个主入口；发现册、行旅、成就和工具保持可达。
- 小院建筑可直接点击，待办显示可采收植株、现有材料及在途/契约事项。
- 药圃三种气候地块可直接选种；场景中点击成熟植物采收，下方保留全部植株列表。
- 艾草、佩兰、白芷提供定向古籍卡入口，仍按原价格购卡、辨对后获得种子。
- 香坊呈现来客、材料图片、四个配伍槽位与陈化架；原库存、评分、日结和出货保持单源。
- 十类正式美术：4 类内置生图、5 类本地生图/编辑、1 类复用。原图、提示词和失败任务保留在本机工作目录。
- 三维查看器按详细观察需要加载，首次小院不下载三维 SDK。
- presentation 只保存界面提示偏好，兼容旧 v1 存档；设置面板保持展开，切换场景回到顶部。

## 数据与资源

游戏 72 味香料、13 个业务屏、797 道题；展示站 111 个香料独立页。原三维素材谱保持 71 味模型、1 味仅图、缺失 0。USDZ 不纳入 Git，仍为 iOS 按需资源。

游戏插画清单：hexiang/shared/game-art.js。网页资源：hexiang/assets/art。来源说明：hexiang/assets/art/provenance.json。

植物图片是经过形态复核的艺术示意，不作为植物鉴定或医疗依据；详细词条与古籍引文继续保留出处。原三维模型未随本轮重新生成。

## 本地使用

直接打开 hexiang/index.html 可玩；本机 HTTP 预览可在仓库根目录启动静态服务：

~~~powershell
python -m http.server 8920 --bind 127.0.0.1
# http://127.0.0.1:8920/hexiang/
~~~

主仓是开发权威源。平铺副本 D:\trae文件\香料科普游戏 对应 index.html/shared/models/assets；每次修改运行文件同步并校验 MD5。副本额外的旧 game.html 不作为当前入口。

## 验证

~~~powershell
$env:NODE_PATH='D:\trae文件\香料3D展示\.tools\node_modules'
$env:TEST_PORT='8912'
node hexiang/tests/game_v2_test.js
node hexiang/tests/art_manifest_test.js
node hexiang/tests/scene_game_test.js
node hexiang/tests/scene_playwright.js
~~~

原 224 项回归继续共用；导航相关断言改为新入口的实际行为，并新增场景、旧档、缺图、重复操作、首次计数和按需加载检查。Playwright 的 Chromium/Firefox/WebKit 运行同一套回归与场景检查。Windows WebKit 没有 WebAudio API，音效素材时长通过原生 HTMLAudio 元数据验证。

浏览器缓存放在 .tools/playwright-browsers，依赖放 .tools，不参与游戏运行。浏览器模拟不代替 iOS AR/微信真机验收。

## 本地美术生产

ComfyUI 使用现有 FLUX.2 klein FP8 和 Qwen-Image-Edit GGUF＋Lightning 四步。工作流位于 D:\trae文件\ComfyUI\workflows；项目适配、试样、提示词、日志和原图位于 D:\codex\对话\游戏改版策略-2026-10-07。

适配器 tools/project_art.py 使用 --prompt-file/--out/--kind，可先 --dry-run；已有任务或输出拒绝覆盖，超时先核对 prompt_id。klein 提示词节点 4、种子节点 10；Qwen 编辑节点 10、上传节点 7、采样节点 12。Qwen 只使用已连接 Lightning 的四步配置。本轮不调用混元 3D。

## 后续阶段

首轮之后逐批扩展植物阶段图、成品图、人物表情、其余香料与城市美术。PWA 离线缓存将在正式素材清单稳定后独立实施，当前未宣称支持离线重载。

冻结的 hexiang-v1.7 独立保留。本项目是历史背景下的科普向虚构作品：物价、产量与里程用于游戏化设定，科普文本保留可核对来源；3D 与插画均仅作直观示意。
