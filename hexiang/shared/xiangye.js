/* ============================================================
   合香 · 乾隆香料商道  v2.0  商道层（经营模拟）
   ------------------------------------------------------------
   本文件与 hexiang/index.html 的「香道层」共同构成一个完整游戏：
     香道层（书斋/读古籍/药圃/香室/香草志/问答）＝ 识香、合香、声望；
     商道层（号簿/田亩/市集/商队/铺面/编年/成就）＝ 种植、贩运、扩张。

   架构分层
     A 数据层 DATA   : SPICES 香料谱 · CITIES 城邑 · EDGES 商路 · MODES 脚力
                       · HISTORY 编年 · EVENTS 事件池 · GOALS 目标 · ACH_EXTRA 成就
                       · ORDERS_EXTRA 香方 · CARDS_EXTRA 古籍卡 · ASSETS 素材谱
     B 核心层 CORE   : 日历（农历/纪元/推日）· 商号状态树 state.co · 存档迁移
                       · 单一变异入口 act() · 消息总线 push()/drain()
     C 系统层 SYSTEM : priceS 行价 · farmS 田亩 · marketS 市集 · transitS 商队
                       · eventS 事件 · histS 编年 · achS 成就
     D 表现层 VIEW   : 号簿/田亩/市集/商队/铺面/编年/成就 七屏 + 弹报 + 成就对话 + 音效
     E 资源层 ASSET  : 模型 / 图片 / 墨线占位 三级解析——无素材者不发任何网络请求
     F 扩展点 API    : XiangYe.registerSpice / registerScreen / registerAchievement
                       / registerDailyTick / registerEventHandler / registerAsset

   数据口径（凡例同见游戏内「凡例」）
     · 钱为准（文），一两 = 一百钱 = 一千分；货价以「分/斤」计，路程以「里」计。
     · 香料谱 53 味，分四类：土产（本产香药）· 南货（南省市集）· 洋货（粤海番舶）· 花（花市花田）。
     · 产地贱、远地贵：行价 = 基准价 × 产地系数 × 城际距离系数 × 时令/事件修正。
   ============================================================ */
(function (root) {
  'use strict';

  /* ============================================================
     A · DATA —— 城邑：乾隆年间真实城邑、商路与物产
     西安府（陕西省会·西北枢要）｜汉口镇（汉阳府巨镇·九省通衢）
     苏州府（江南首郡·工商萃聚）｜杭州府（浙江省会·西湖香市）
     广州府（粤海关所在·乾隆二十二年后一口通商，西洋番舶皆聚于此）
     ============================================================ */
  var CITIES = {
    xian: { name:'西安府', short:'陕', region:'关中', open:40000, plotCost:25000, maxPlots:4,
      addr:'南院门香药铺', land:'泾阳田庄', tag:'西北枢要',
      intro:'陕西省会。乾隆年间为陕甘驿路与边贸起点，城中香药铺、药材行多聚于南院门一带；城外泾阳、三原为陕商萃集之地，田庄宜植椒、艾、苍术。' },
    hankou: { name:'汉口镇', short:'汉', region:'荆楚', open:60000, plotCost:30000, maxPlots:4,
      addr:'汉正街货栈', land:'柏泉田圃', tag:'九省通衢',
      intro:'汉阳府巨镇，天下四大镇之首。长江与汉水交汇于此，漕船、盐船、货帮辐辏，北货南下、南货北上都以此为枢纽。' },
    suzhou: { name:'苏州府', short:'苏', region:'江南', open:65000, plotCost:45000, maxPlots:4,
      addr:'阊门外香铺', land:'虎丘花田', tag:'江南首郡',
      intro:'江南首郡，工商萃聚。苏薄荷、虎丘茉莉名闻天下，阊门内外香铺、花行、茶号鳞次栉比，为江南香市之冠。' },
    hangzhou: { name:'杭州府', short:'杭', region:'江南', open:80000, plotCost:50000, maxPlots:4,
      addr:'清河坊香号', land:'满觉陇山田', tag:'西湖香市',
      intro:'浙江省会。每岁春间西湖香市大开，天竺、昭庆寺进香者络绎，檀沉龙麝之属销行极盛；满觉陇植桂成林，杭菊亦为名产。' },
    guangzhou: { name:'广州府', short:'粤', region:'岭南', open:140000, fame:12, plotCost:60000, maxPlots:4,
      addr:'濠畔街香行', land:'新会柑园', tag:'粤海通洋',
      intro:'粤海关所在，乾隆二十二年一口通商后西洋番舶皆聚于此。濠畔街香药行林立，胡椒、檀香、龙脑诸番货皆由此入华，价廉于内地数倍。' }
  };
  var CITY_IDS = ['xian', 'hankou', 'suzhou', 'hangzhou', 'guangzhou'];
  /* 城际距离系数：产地贱、远地贵（同区 1.00，隔一区 +0.16，邻接 …） */
  var REGION = { xian:'关中', hankou:'荆楚', suzhou:'江南', hangzhou:'江南', guangzhou:'岭南' };
  var DIST = {
    关中:{ 关中:0, 荆楚:1, 江南:2, 岭南:3 },
    荆楚:{ 关中:1, 荆楚:0, 江南:1, 岭南:2 },
    江南:{ 关中:2, 荆楚:1, 江南:0, 岭南:2 },
    岭南:{ 关中:3, 荆楚:2, 江南:2, 岭南:0 }
  };

  /* ---------- 商路：里程（里）与通航性（据清代驿路、长江、运河、大庾岭商道） ---------- */
  var EDGES = [
    { a:'xian',     b:'hankou',    li:1400, water:false, name:'秦岭商道' },
    { a:'xian',     b:'suzhou',    li:1900, water:false, name:'秦洛驿路' },
    { a:'xian',     b:'hangzhou',  li:2100, water:false, name:'关中驿路' },
    { a:'xian',     b:'guangzhou', li:3600, water:false, name:'秦粤商道' },
    { a:'hankou',   b:'suzhou',    li:1700, water:true,  name:'长江航道' },
    { a:'hankou',   b:'hangzhou',  li:1900, water:true,  name:'江运河路' },
    { a:'hankou',   b:'guangzhou', li:2100, water:true,  name:'赣粤水道·大庾岭' },
    { a:'suzhou',   b:'hangzhou',  li:320,  water:true,  name:'江南运河' },
    { a:'suzhou',   b:'guangzhou', li:2400, water:false, name:'赣岭商道' },
    { a:'hangzhou', b:'guangzhou', li:2600, water:false, name:'浙粤商道' }
  ];
  /* 脚力：速度（里/日）、载重（斤）、运费（分/斤/百里）、风险（%/百里）、发运使费（分） */
  var MODES = {
    tuo:  { name:'骡马驮队', road:true, water:false, speed:75, cap:600,  rate:0.16, riskPct:1.15, base:0,
            desc:'脚夫骡马，价最廉。山路崎岖，遇匪失货之险最高。' },
    biao: { name:'镖局镖车', road:true, water:false, speed:66, cap:450,  rate:0.50, riskPct:0.22, base:600,
            desc:'镖局护送，凭字号信誉押运，稳妥可托，运费数倍于驮队。' },
    chuan:{ name:'民船漕帮', road:false, water:true, speed:85, cap:3000, rate:0.09, riskPct:0.50, base:300,
            desc:'水路船运，载重极巨，运费最省；唯船行日期受风信水势牵制。' }
  };

  /* ============================================================
     A · DATA —— 香料谱 53 味
     id      拼音，与素材目录同名（素材：<id>/models/<id>.glb · front.png）
     zh      名（史料习称）
     cat     土产 / 南货 / 洋货 / 花
     tier    品级 1–5：价与稀有度（5 为龙脑、沉香之属）
     aroma   香气取向 0–10（辛 苦 甘 温 凉 香）——合香评分沿用
     pot     药力 0.6–1.25——合香评分沿用
     zone    宜种气候区（干燥 / 湿润 / 半阴）——药圃沿用
     eff     功效标签（沿用香道层词表：辟秽 祛风 和胃 疏肝 清凉 散寒 理气 解毒 安神 通窍 解表）
     farm    可种城（农学与史地相合）· sea 洋货（粤海番舶所入）· buy 可购城（默认＝farm + sea）
     base    行价基准（分/斤）· pv 香草散卖底价（分/株，香道层甲用）
     crop    农时 { d 熟期, y 亩收, s 苗钱 }（farm 有则必有）
     note    行栈货品注（市集屏显示）
     use     香道用途（香草志显示）
     ============================================================ */
  var SPICES = {
    /* —— 关中所产：西安开局可种 —— */
    huajiao: { zh:'花椒', cat:'土产', tier:2, aroma:{辛:9,苦:2,甘:1,温:8,凉:0,香:8}, pot:1.05, zone:'干燥',
      eff:['散寒','辟秽'], farm:['xian','hankou'], base:16, pv:8,
      crop:{ d:40, y:480, s:600 }, use:'端午香囊之主，辟秽辛烈',
      note:'秦地椒园所产，辛烈辟秽，端午香囊必备。' },
    huixiang: { zh:'小茴香', cat:'土产', tier:1, aroma:{辛:7,苦:2,甘:4,温:7,凉:0,香:8}, pot:0.85, zone:'干燥',
      eff:['和胃','理气'], farm:['xian','hankou'], base:12, pv:7,
      crop:{ d:30, y:540, s:400 }, use:'温中和胃，合香调中',
      note:'关中田圃所种，烹调入药两宜。' },
    aicao: { zh:'艾草', cat:'土产', tier:1, aroma:{辛:6,苦:3,甘:2,温:9,凉:0,香:9}, pot:1.00, zone:'干燥',
      eff:['辟秽','祛风'], farm:['xian','hankou'], base:8, pv:6,
      crop:{ d:16, y:620, s:300 }, use:'悬门辟秽，灸病温经',
      note:'处处有之，五月采艾悬门，灸病辟秽。' },
    cangzhu: { zh:'苍术', cat:'土产', tier:2, aroma:{辛:7,苦:5,甘:1,温:7,凉:0,香:8}, pot:0.95, zone:'干燥',
      eff:['辟秽','祛风'], farm:['xian','hankou','hangzhou'], base:22, pv:7,
      crop:{ d:36, y:380, s:700 }, use:'与艾同燃，燥湿辟秽',
      note:'山地产，燥湿辟秽，与艾同燃可驱湿气。' },
    shengjiang: { zh:'生姜', cat:'土产', tier:1, aroma:{辛:8,苦:1,甘:3,温:9,凉:0,香:7}, pot:0.90, zone:'半阴',
      eff:['解表','和胃'], farm:['xian','hankou','hangzhou','guangzhou'], base:9, pv:6,
      crop:{ d:26, y:650, s:400 }, use:'解表温中，合香佐使',
      note:'南北皆植，辛温调味，端午酱姜亦入药。' },
    wuzhuyu: { zh:'吴茱萸', cat:'土产', tier:2, aroma:{辛:8,苦:4,甘:1,温:8,凉:0,香:6}, pot:0.95, zone:'半阴',
      eff:['散寒','辟秽'], farm:['xian','hankou'], base:26, pv:8,
      crop:{ d:34, y:340, s:800 }, use:'重阳佩之，御初寒之气',
      note:'山茱萸类，辛热气烈，重阳佩以辟邪。' },
    wujiapi: { zh:'五加皮', cat:'土产', tier:2, aroma:{辛:5,苦:4,甘:3,温:6,凉:1,香:6}, pot:0.90, zone:'半阴',
      eff:['祛风','理气'], farm:['xian','hankou','suzhou'], base:24, pv:8,
      crop:{ d:38, y:320, s:750 }, use:'浸酒祛风，入香通络',
      note:'山野根皮，祛风湿、壮筋骨，酒肆常货。' },
    gansong: { zh:'甘松', cat:'土产', tier:3, aroma:{辛:6,苦:3,甘:4,温:5,凉:1,香:10}, pot:0.95, zone:'半阴',
      eff:['理气','安神'], farm:['xian','hankou'], base:45, pv:9,
      crop:{ d:40, y:260, s:950 }, use:'合香要药，理气开郁，古方多用',
      note:'川陕山草，根香浓烈，合香古方中「甘松」一味不可少。' },
    jingjie: { zh:'荆芥', cat:'土产', tier:1, aroma:{辛:7,苦:2,甘:2,温:3,凉:4,香:7}, pot:0.80, zone:'湿润',
      eff:['解表','祛风'], farm:['xian','hankou','suzhou'], base:14, pv:6,
      crop:{ d:20, y:560, s:350 }, use:'祛风解表，香囊常用',
      note:'田圃易生，祛风解表，暑月香囊常配。' },
    /* —— 江南所产：苏州、杭州 —— */
    bohe: { zh:'薄荷', cat:'南货', tier:1, aroma:{辛:8,苦:1,甘:2,温:0,凉:10,香:6}, pot:0.85, zone:'湿润',
      eff:['清凉','疏肝'], farm:['suzhou','hangzhou','hankou'], base:14, pv:7,
      crop:{ d:22, y:520, s:450 }, use:'疏散风热，清利头目',
      note:'苏薄荷最良，太仓、苏州水乡所产，辛凉透表。' },
    peilan: { zh:'佩兰', cat:'南货', tier:2, aroma:{辛:4,苦:2,甘:4,温:3,凉:3,香:8}, pot:0.80, zone:'湿润',
      eff:['辟秽','和胃'], farm:['suzhou','hangzhou','hankou'], base:15, pv:7,
      crop:{ d:22, y:500, s:500 }, use:'浴兰汤，化湿醒脾',
      note:'泽畔香草，古之所谓「兰」，浴兰汤即此。' },
    baizhi: { zh:'白芷', cat:'南货', tier:2, aroma:{辛:9,苦:3,甘:1,温:6,凉:1,香:7}, pot:1.15, zone:'半阴',
      eff:['祛风','辟秽'], farm:['suzhou','hangzhou','hankou'], base:28, pv:8,
      crop:{ d:34, y:380, s:900 }, use:'通窍辟秽，可作面脂',
      note:'川谷园圃所植，芳香通窍，可作面脂香粉。' },
    xinyi: { zh:'辛夷', cat:'南货', tier:2, aroma:{辛:8,苦:2,甘:2,温:7,凉:1,香:8}, pot:1.00, zone:'半阴',
      eff:['通窍','祛风'], farm:['suzhou','hangzhou','hankou'], base:30, pv:9,
      crop:{ d:36, y:280, s:900 }, use:'通鼻窍，花苞含香最盛',
      note:'木兰类花蕾，含苞时香气最盛，饰门楣、通鼻窍。' },
    moli: { zh:'茉莉', cat:'花', tier:3, aroma:{辛:3,苦:1,甘:6,温:2,凉:4,香:10}, pot:0.85, zone:'湿润',
      eff:['理气','安神'], farm:['suzhou','hangzhou','guangzhou'], base:34, pv:9,
      crop:{ d:24, y:260, s:1000 }, use:'熏茶簪佩，清芬解郁',
      note:'虎丘花农所莳，熏茶、簪佩、入香皆宜。' },
    hangju: { zh:'杭菊', cat:'花', tier:2, aroma:{辛:2,苦:2,甘:6,温:1,凉:7,香:7}, pot:0.80, zone:'干燥',
      eff:['清凉','解毒'], farm:['hangzhou','suzhou'], base:26, pv:8,
      crop:{ d:26, y:300, s:800 }, use:'清芬入茶，亦可作枕囊',
      note:'杭城名产，清芬入茶，亦可作枕囊。' },
    guihua: { zh:'桂花', cat:'花', tier:3, aroma:{辛:3,苦:1,甘:7,温:5,凉:0,香:10}, pot:0.90, zone:'半阴',
      eff:['理气','安神'], farm:['hangzhou','suzhou'], base:40, pv:10,
      crop:{ d:30, y:200, s:1200 }, use:'糖渍入香，温中散寒',
      note:'满觉陇十里桂香，糖渍入香，江南珍品。' },
    meigui: { zh:'玫瑰', cat:'花', tier:3, aroma:{辛:4,苦:1,甘:6,温:5,凉:1,香:10}, pot:0.90, zone:'干燥',
      eff:['理气','疏肝'], farm:['suzhou','hangzhou','xian'], base:42, pv:10,
      crop:{ d:28, y:220, s:1100 }, use:'和血理气，制香饼香露',
      note:'园圃所植，花可窨茶制露，吴中女儿簪之。' },
    zhizi: { zh:'栀子', cat:'花', tier:2, aroma:{辛:2,苦:4,甘:2,温:0,凉:8,香:7}, pot:0.85, zone:'湿润',
      eff:['清凉','解毒'], farm:['suzhou','hangzhou','guangzhou'], base:22, pv:7,
      crop:{ d:30, y:280, s:700 }, use:'清热除烦，花白香远',
      note:'江南庭园常植，花白香远，亦可染黄。' },
    meihua: { zh:'梅花', cat:'花', tier:3, aroma:{辛:3,苦:2,甘:4,温:1,凉:5,香:10}, pot:0.80, zone:'干燥',
      eff:['理气','安神'], farm:['hangzhou','suzhou'], base:38, pv:9,
      crop:{ d:34, y:180, s:1000 }, use:'清芬高洁，入香为上',
      note:'孤山、邓尉梅林，花时可窨香，文人案头之珍。' },
    foshou: { zh:'佛手', cat:'南货', tier:3, aroma:{辛:4,苦:2,甘:5,温:3,凉:3,香:10}, pot:0.85, zone:'湿润',
      eff:['理气','和胃'], farm:['guangzhou','hangzhou'], base:44, pv:10,
      crop:{ d:40, y:240, s:1200 }, use:'清供闻香，理气和胃',
      note:'岭南佛手柑，清供闻香，亦可入药。' },
    luohanguo: { zh:'罗汉果', cat:'南货', tier:2, aroma:{辛:1,苦:1,甘:9,温:2,凉:5,香:6}, pot:0.80, zone:'半阴',
      eff:['清凉','理气'], farm:['guangzhou','hangzhou'], base:30, pv:8,
      crop:{ d:36, y:260, s:850 }, use:'甘凉润喉，代茶入香',
      note:'桂北山货，味甘性凉，茶号常备。' },
    furong: { zh:'木芙蓉花', cat:'花', tier:2, aroma:{辛:2,苦:3,甘:4,温:1,凉:6,香:7}, pot:0.80, zone:'湿润',
      eff:['清凉','解毒'], farm:['suzhou','hangzhou','hankou'], base:24, pv:7,
      crop:{ d:30, y:260, s:700 }, use:'花可入香，清热凉血',
      note:'江南水滨丛生，一日三变色，花叶皆入药。' },
    zisu: { zh:'紫苏', cat:'南货', tier:1, aroma:{辛:8,苦:2,甘:2,温:5,凉:2,香:8}, pot:0.85, zone:'湿润',
      eff:['解表','和胃'], farm:['suzhou','hangzhou','hankou'], base:13, pv:6,
      crop:{ d:20, y:520, s:400 }, use:'解表散寒，理气宽中',
      note:'家圃常植，苏叶解表，苏子降气，端午制饮。' },
    /* —— 岭南所产：广州 —— */
    chenpi: { zh:'陈皮', cat:'南货', tier:2, aroma:{辛:5,苦:2,甘:7,温:6,凉:1,香:8}, pot:0.90, zone:'干燥',
      eff:['理气','和胃'], farm:['guangzhou','hankou'], base:20, pv:6,
      crop:{ d:32, y:460, s:800 }, use:'愈陈愈良，理气和胃',
      note:'新会柑皮，愈陈愈良，理气和胃。' },
    huoxiang: { zh:'藿香', cat:'南货', tier:1, aroma:{辛:7,苦:2,甘:3,温:4,凉:2,香:8}, pot:0.85, zone:'湿润',
      eff:['辟秽','和胃'], farm:['guangzhou','hankou'], base:15, pv:7,
      crop:{ d:22, y:500, s:500 }, use:'暑湿要药，醒脾化浊',
      note:'石牌藿香（广藿香），岭南暑湿要药。' },
    liangjiang: { zh:'高良姜', cat:'南货', tier:2, aroma:{辛:8,苦:2,甘:3,温:9,凉:0,香:7}, pot:0.95, zone:'湿润',
      eff:['散寒','和胃'], farm:['guangzhou','hangzhou'], base:22, pv:8,
      crop:{ d:30, y:420, s:700 }, use:'暖中散寒，可作调味香辛',
      note:'岭南所产，辛热暖中，亦可作调味香辛。' },
    jinyinhua: { zh:'金银花', cat:'南货', tier:2, aroma:{辛:2,苦:3,甘:6,温:0,凉:9,香:5}, pot:0.85, zone:'干燥',
      eff:['清凉','解毒'], farm:['guangzhou','hankou','xian'], base:32, pv:8,
      crop:{ d:24, y:280, s:900 }, use:'清热解毒，暑月常饮',
      note:'忍冬花，岭南蔓生，清热解毒。' },
    xiangmaocao: { zh:'香茅草', cat:'南货', tier:2, aroma:{辛:6,苦:2,甘:3,温:4,凉:3,香:9}, pot:0.85, zone:'湿润',
      eff:['辟秽','祛风'], farm:['guangzhou','hangzhou'], base:18, pv:7,
      crop:{ d:24, y:480, s:600 }, use:'岭南香草，可作香露香囊',
      note:'岭南溪畔丛生，气味辛香，驱蚊辟秽。' },
    jianghuang: { zh:'姜黄', cat:'南货', tier:2, aroma:{辛:7,苦:4,甘:2,温:6,凉:1,香:6}, pot:0.90, zone:'湿润',
      eff:['理气','散寒'], farm:['guangzhou','hangzhou'], base:26, pv:8,
      crop:{ d:32, y:420, s:750 }, use:'行气活血，兼作染色',
      note:'川广所产，色黄味辛，入药兼可染。' },
    bajiao: { zh:'八角', cat:'南货', tier:2, aroma:{辛:6,苦:1,甘:5,温:7,凉:0,香:10}, pot:0.95, zone:'半阴',
      eff:['散寒','理气'], farm:['guangzhou'], base:36, pv:9,
      crop:{ d:44, y:300, s:1000 }, use:'大茴香，温中调味之要',
      note:'桂西山中茴香，船运粤东，调味入药两宜。' },
    caoguo: { zh:'草果', cat:'南货', tier:3, aroma:{辛:7,苦:3,甘:2,温:7,凉:0,香:9}, pot:0.95, zone:'半阴',
      eff:['散寒','和胃'], farm:['guangzhou'], base:48, pv:9,
      crop:{ d:46, y:260, s:1100 }, use:'燥湿温中，合香辟秽',
      note:'滇桂山货，辛香燥烈，食疗与香方并用。' },
    sharen: { zh:'砂仁', cat:'南货', tier:3, aroma:{辛:6,苦:2,甘:3,温:6,凉:1,香:9}, pot:0.95, zone:'半阴',
      eff:['和胃','理气'], farm:['guangzhou'], base:52, pv:9,
      crop:{ d:44, y:240, s:1200 }, use:'醒脾行气，广中要药',
      note:'阳春砂仁，岭南名产，行气醒脾之要。' },
    yujin: { zh:'郁金', cat:'南货', tier:3, aroma:{辛:5,苦:5,甘:2,温:3,凉:4,香:8}, pot:0.90, zone:'半阴',
      eff:['理气','疏肝'], farm:['guangzhou'], base:50, pv:9,
      crop:{ d:42, y:280, s:1100 }, use:'行气解郁，合香清芬',
      note:'川广郁金，行气解郁，色黄气香。' },
    sumu: { zh:'苏木', cat:'南货', tier:2, aroma:{辛:2,苦:5,甘:3,温:1,凉:4,香:4}, pot:0.80, zone:'半阴',
      eff:['理气','解毒'], farm:['guangzhou'], base:30, pv:8,
      crop:{ d:48, y:380, s:900 }, use:'染木亦香，行血破滞',
      note:'岭南染木，兼作药香，色赤味涩。' },
    bibo: { zh:'荜拨', cat:'洋货', tier:4, aroma:{辛:9,苦:2,甘:1,温:9,凉:0,香:7}, pot:1.05, zone:'湿润',
      eff:['散寒','和胃'], farm:['guangzhou'], base:70, pv:9,
      crop:{ d:46, y:240, s:1300 }, use:'辛热暖胃，番货之珍',
      note:'番舶所载，辛热下气，粤中行栈常有。' },
    linglingxiang: { zh:'零陵香', cat:'南货', tier:3, aroma:{辛:5,苦:2,甘:4,温:5,凉:1,香:10}, pot:0.90, zone:'湿润',
      eff:['辟秽','理气'], farm:['hankou','guangzhou'], base:46, pv:9,
      crop:{ d:34, y:300, s:950 }, use:'古方零陵香，香远持久',
      note:'湘南永州所出，古香方屡见，气香持久。' },
    muxiang: { zh:'木香', cat:'南货', tier:3, aroma:{辛:6,苦:4,甘:2,温:5,凉:1,香:9}, pot:0.95, zone:'半阴',
      eff:['理气','和胃'], farm:['guangzhou','hankou'], base:54, pv:9,
      crop:{ d:44, y:280, s:1150 }, use:'行气止痛，合香辟秽',
      note:'滇川云木香，根香浓，行气止痛。' },
    /* —— 粤海番舶：洋货（广州进口，内地不可种） —— */
    hujiao: { zh:'胡椒', cat:'洋货', tier:3, aroma:{辛:9,苦:1,甘:1,温:8,凉:0,香:6}, pot:1.00, zone:'湿润',
      eff:['散寒','和胃'], sea:true, base:60, pv:10,
      use:'温中散寒，下气消痰',
      note:'南洋番舶所载，粤中价廉，北地倍之，明时曾以之折俸。' },
    dingxiang: { zh:'丁香', cat:'洋货', tier:4, aroma:{辛:9,苦:2,甘:1,温:8,凉:0,香:9}, pot:1.05, zone:'湿润',
      eff:['和胃','散寒'], sea:true, base:95, pv:13,
      use:'温中降逆，香烈辟秽',
      note:'南洋花蕾，香烈辟秽，价同白银。' },
    rougui: { zh:'肉桂', cat:'洋货', tier:4, aroma:{辛:6,苦:1,甘:5,温:9,凉:0,香:9}, pot:1.10, zone:'半阴',
      eff:['散寒','辟秽'], sea:true, base:90, pv:12,
      use:'补火助阳，温通经脉',
      note:'南桂皮，辛甜暖香，合香调饮皆宜。' },
    baidoukou: { zh:'白豆蔻', cat:'洋货', tier:4, aroma:{辛:6,苦:2,甘:4,温:6,凉:1,香:9}, pot:0.95, zone:'湿润',
      eff:['和胃','理气'], sea:true, base:75, pv:11,
      use:'芳香化湿，醒脾开胃',
      note:'南洋豆蔻，芳香化湿，粤中茶点常用。' },
    tanxiang: { zh:'檀香', cat:'洋货', tier:4, aroma:{辛:3,苦:2,甘:6,温:4,凉:0,香:10}, pot:0.95, zone:'半阴',
      eff:['理气','安神'], sea:true, base:120, pv:14,
      use:'焚之清芬远逸，佛门香市所亟',
      note:'番舶白檀，佛门香市所亟，焚之清芬远逸。' },
    chenxiang: { zh:'沉香', cat:'洋货', tier:5, aroma:{辛:4,苦:3,甘:5,温:5,凉:1,香:10}, pot:1.15, zone:'半阴',
      eff:['理气','安神'], sea:true, base:260, pv:18,
      use:'香中之王，降气纳肾',
      note:'莞香、海南香皆佳，结香需年久，价几与金等。' },
    longnao: { zh:'龙脑', cat:'洋货', tier:5, aroma:{辛:2,苦:3,甘:2,温:0,凉:9,香:10}, pot:1.10, zone:'湿润',
      eff:['通窍','清凉'], sea:true, base:220, pv:16,
      use:'开窍醒神，宫中熏衣所用',
      note:'婆罗洲梅片，价几同金，宫中贵胄熏衣所用。' },
    ruxiang: { zh:'乳香', cat:'洋货', tier:4, aroma:{辛:5,苦:3,甘:3,温:5,凉:1,香:10}, pot:1.00, zone:'干燥',
      eff:['理气','解毒'], sea:true, base:65, pv:11,
      use:'树脂熏烧，行气活血',
      note:'西域树脂香，熏烧入药，佛道皆用。' },
    moyao: { zh:'没药', cat:'洋货', tier:4, aroma:{辛:4,苦:5,甘:2,温:4,凉:2,香:9}, pot:1.00, zone:'干燥',
      eff:['理气','解毒'], sea:true, base:72, pv:11,
      use:'与乳香相须，散瘀止痛',
      note:'西域树脂，与乳香并称「乳没」，药肆常配。' },
    anxixiang: { zh:'安息香', cat:'洋货', tier:4, aroma:{辛:4,苦:3,甘:4,温:5,凉:1,香:10}, pot:1.00, zone:'干燥',
      eff:['辟秽','安神'], sea:true, base:88, pv:12,
      use:'焚之辟秽安神，合香常用',
      note:'南洋树脂，焚之香浓，辟秽安神。' },
    suhexiang: { zh:'苏合香', cat:'洋货', tier:5, aroma:{辛:5,苦:3,甘:5,温:6,凉:1,香:10}, pot:1.10, zone:'干燥',
      eff:['通窍','辟秽'], sea:true, base:180, pv:15,
      use:'开窍辟秽，古方「苏合香丸」之主',
      note:'西域树脂，合香入丸，开窍之要药。' },
    jiangzhenxiang: { zh:'降真香', cat:'洋货', tier:4, aroma:{辛:4,苦:3,甘:4,温:5,凉:1,香:10}, pot:1.00, zone:'半阴',
      eff:['辟秽','安神'], sea:true, base:96, pv:12,
      use:'焚之降真，道家斋醮所尚',
      note:'岭南、海南所产，藤木结香，道家斋醮所尚。' },
    yuegui: { zh:'月桂', cat:'洋货', tier:3, aroma:{辛:5,苦:3,甘:3,温:5,凉:2,香:9}, pot:0.85, zone:'干燥',
      eff:['和胃','祛风'], sea:true, base:56, pv:10,
      use:'叶可调味，香露亦用之',
      note:'西域香叶，番舶与西洋货同来，庖厨香药两用。' },
    niuzhi: { zh:'牛至', cat:'洋货', tier:3, aroma:{辛:6,苦:4,甘:2,温:5,凉:2,香:9}, pot:0.85, zone:'干燥',
      eff:['辟秽','和胃'], sea:true, base:52, pv:10,
      use:'西土香草，气烈可入香囊',
      note:'西域香草，番舶携来，气烈如薄荷而厚。' },
    bailixiang: { zh:'百里香', cat:'洋货', tier:3, aroma:{辛:5,苦:3,甘:3,温:5,凉:3,香:9}, pot:0.85, zone:'干燥',
      eff:['辟秽','祛风'], sea:true, base:50, pv:10,
      use:'西土香草，焚之清芬',
      note:'西域香草，番舶携来，焚之清芬辟秽。' },
    midiexiang: { zh:'迷迭香', cat:'洋货', tier:3, aroma:{辛:5,苦:4,甘:2,温:5,凉:2,香:9}, pot:0.85, zone:'干燥',
      eff:['辟秽','安神'], sea:true, base:58, pv:10,
      use:'汉魏即入中土，植庭吐香',
      note:'原产地中海，汉魏传入中土，植于中庭，佩之辟秽。' }
  };

  /* ============================================================
     A · DATA —— 编年：与乾隆季世历史相表里，至期必发
     （年月据《清高宗实录》《清史稿》斟酌；庆典、灾荒、海疆、盘剥
       之变皆落实为行市、脚价、风险与农产之改）
     ============================================================ */
  var START_YEAR = 40;                       /* 开局：乾隆四十年正月 */
  var FOREIGN = ['hujiao','dingxiang','rougui','baidoukou','tanxiang','chenxiang','longnao','ruxiang','moyao','anxixiang','suhexiang','jiangzhenxiang','bibo','yuegui','niuzhi','bailixiang','midiexiang'];
  function HQ(y, m, d){ return (y - START_YEAR) * 360 + (m - 1) * 30 + (d - 1); }
  var HISTORY = [
    { id:'siku_open', at:HQ(38,2,10), cat:'文治', title:'四库开馆',
      text:'乾隆三十八年二月，诏开四库全书馆，征天下遗书入都校勘，汇为《四库全书》。此局开时，聚香号尚未开张。', run:function(){} },
    { id:'jinchuan', at:HQ(41,2,24), cat:'武功', title:'两金川荡平',
      text:'王师平定两金川，索诺木出降，露布奏达京师；旋行告成太学之典。凯旋赏赉、庆功香烛取用浩繁，龙脑、檀香、乳香诸香行价俱起。',
      run:function(){ addMod('*','longnao',1.45,75,'金川告捷'); addMod('*','tanxiang',1.35,75,'金川告捷'); addMod('*','ruxiang',1.28,75,'金川告捷'); } },
    { id:'nanxun5', at:HQ(45,1,12), cat:'南巡', title:'第五次南巡',
      text:'圣驾第五次南巡，扈从官兵络绎南下，江浙各府办差迎銮，结彩张灯、陈设香案。苏州、杭州香市之盛数十年所仅见，茉莉、桂花、檀麝诸价俱昂；御舟经行运河，民船回避，脚价亦涨。',
      run:function(){
        addMod('suzhou','moli',1.35,90,'迎銮香市'); addMod('suzhou','tanxiang',1.35,90,'迎銮香市');
        addMod('hangzhou','guihua',1.35,90,'迎銮香市'); addMod('hangzhou','tanxiang',1.35,90,'迎銮香市');
        CO.freightMul = { v:1.18, until: abs() + 40 };
      } },
    { id:'yizuiyin', at:HQ(45,6,1), cat:'朝局', title:'议罪银之制',
      text:'和珅任御前大臣、管户部事，用事日专。督抚有过，许「自行议罪」纳金内府以免处分，号为「议罪银」。官取于下，下取于民——此后每岁腊月，各铺号亦须备年节孝敬、支应摊派。',
      run:function(){ CO.eraTribute = true; } },
    { id:'gansu_case', at:HQ(46,7,15), cat:'朝局', title:'甘肃冒赈大案',
      text:'陕甘总督勒尔谨、前藩司王亶望等捏灾冒赈、折捐侵帑案发，通省州县伏诛者数十人，为乾隆朝第一贪案。陕甘官场人人自危，各铺号皆被叮嘱打点，你也送去一分人情。',
      run:function(){ var fee = Math.min(money(), 1200); addMoney(-fee); push('朝局', '陕甘官场大案牵连甚广，号中打点人情费银 ' + fmt(fee) + '。'); } },
    { id:'siku_done', at:HQ(47,12,10), cat:'文治', title:'文渊阁书成',
      text:'文渊阁《四库全书》缮写告竣，著录三千四百余部、七万九千余卷，汇古今典籍为一编。武英殿、琉璃厂书肆宾客满门，天下文风称极盛。', run:function(){} },
    { id:'nanxun6', at:HQ(49,1,21), cat:'南巡', title:'第六次南巡',
      text:'圣驾第六次南巡，亦为末次。江浙父老仍结彩燃香迎于道左，苏杭香市再盛。回銮后皇上谕臣下：「朕临御六十年，并无失德，惟六次南巡，劳民伤财，作无益害有益。」——此是后话。',
      run:function(){
        addMod('suzhou','moli',1.35,90,'迎銮香市'); addMod('suzhou','tanxiang',1.32,90,'迎銮香市');
        addMod('hangzhou','guihua',1.35,90,'迎銮香市'); addMod('hangzhou','tanxiang',1.32,90,'迎銮香市');
        CO.freightMul = { v:1.18, until: abs() + 40 };
      } },
    { id:'qiansou', at:HQ(50,1,15), cat:'典制', title:'乾清宫千叟宴',
      text:'皇上以御极五十年、海宇承平，于乾清宫行千叟宴，赴宴者三千余人，各赐鸠杖、银牌。京邸备办宴赏、熏香佩囊，龙脑、丁香诸贵货一时腾贵。',
      run:function(){ addMod('*','longnao',1.5,45,'千叟宴'); addMod('*','dingxiang',1.35,45,'千叟宴'); } },
    { id:'dahan50', at:HQ(50,6,10), cat:'天时', title:'乙巳数省大旱',
      text:'入夏后畿辅、山东、河南数省久旱不雨，河渠浅涸，禾苗枯槁，米价翔贵；山田所出香药亦减收三成。朝廷屡降谕旨祈雨、蠲缓赋税。',
      run:function(){ CO.yieldMul = { v:0.8, until: abs() + 150 }; addMod('*','cangzhu',1.18,120,'亢旱'); } },
    { id:'linshuangwen', at:HQ(51,11,27), cat:'海疆', title:'台湾林爽文起事',
      text:'台湾府天地会林爽文杀官踞城，全台震动；闽粤海口盘查严密，赣粤水道、岭南通商路上宵小蠢动，行旅皆加戒备。',
      run:function(){ CO.riskMul = { v:1.45, until: abs() + 150 }; } },
    { id:'pingtai', at:HQ(53,2,15), cat:'海疆', title:'台湾平定',
      text:'福康安渡海督师，林爽文就擒槛送京师，台湾平定。海疆肃清，闽粤商路复通，行旅称便。',
      run:function(){ CO.riskMul = { v:0.85, until: abs() + 60 }; } },
    { id:'wanshou80', at:HQ(55,8,13), cat:'典制', title:'八旬万寿',
      text:'皇上八旬万寿，普天同庆。自圆明园至西华门辇路数十里楼阁歌舞，四大徽班入京献艺，后遂留京，为京剧之滥觞。各省祝厘进贡，香药百货需用浩繁，通国物价俱腾。',
      run:function(){
        addMod('*','*',1.10,60,'万寿庆典');
        addMod('*','longnao',1.35,60,'万寿庆典'); addMod('*','tanxiang',1.30,60,'万寿庆典');
      } },
    { id:'honglou', at:HQ(56,11,20), cat:'文治', title:'《红楼梦》活字梓行',
      text:'程伟元、高鹗以木活字摆印《红楼梦》百二十回本，京华纸贵，人家案头争置一部。世家闺阁效书中风雅，熏衣佩兰、簪花品香之事大行。',
      run:function(){ addMod('suzhou','moli',1.12,60,'红楼新尚'); addMod('suzhou','peilan',1.12,60,'红楼新尚'); } },
    { id:'pingkuo', at:HQ(57,8,1), cat:'武功', title:'廓尔喀降·十全武功',
      text:'福康安越雪山入廓尔喀之境，其王请降称臣。皇上作《十全记》，自评「十全老人」。西陲台站道路宁静，商旅称便。',
      run:function(){ CO.riskMul = { v:0.82, until: abs() + 90 }; } },
    { id:'macartney_pre', at:HQ(58,6,20), cat:'海疆', title:'英使泊澳·洋行观望',
      text:'英吉利国使臣马戛尔尼乘炮船至澳门，云奉表入贡。粤中洋行莫测其来意，囤积番货以待，胡椒、檀香诸洋货行价暗涨。',
      run:function(){ FOREIGN.forEach(function(g){ addMod('guangzhou', g, 1.16, 50, '贡船观望'); }); } },
    { id:'macartney_post', at:HQ(58,9,10), cat:'海疆', title:'敕谕英使·番货放价',
      text:'贡使于热河万树园觐见，行三跪九叩礼；其请开口岸、减关税、驻京师诸事，皇上以「天朝物产丰盈，无所不有」尽行驳斥。贡使空帆将归，洋行急将积货脱手，番货放价。',
      run:function(){ FOREIGN.forEach(function(g){ addMod('guangzhou', g, 0.88, 50, '贡使空归'); }); } },
    { id:'miaoluan', at:HQ(60,1,20), cat:'世变', title:'湘黔苗变',
      text:'湖南、贵州苗民举事，湘黔道梗；楚南、岭北间商路戒严，驮队镖行皆添人护送。',
      run:function(){ CO.riskMul = { v:1.35, until: abs() + 120 }; } },
    { id:'chuli', at:HQ(60,9,3), cat:'典制', title:'宣示建储·明年归政',
      text:'皇上御勤政殿，召皇子皇孙王公大臣，启密缄，宣立皇十五子嘉亲王颙琰为皇太子，以明年为嗣皇帝嘉庆元年，行授受大典。各处分号闻讯，纷纷备办新朝例用。', run:function(){} },
    { id:'shanwei', at:HQ(61,1,1), cat:'典制', title:'授受大典·嘉庆元年',
      text:'正月朔旦，皇上行授受大典，传位于皇太子，自为太上皇帝；初四日复于皇极殿行千叟宴。庆典铺陈，香货之需不亚于八旬万寿。',
      run:function(){
        addMod('*','longnao',1.30,40,'新朝庆典'); addMod('*','dingxiang',1.30,40,'新朝庆典'); addMod('*','tanxiang',1.30,40,'新朝庆典');
      } },
    { id:'bailian', at:HQ(61,1,7), cat:'世变', title:'川楚教乱起',
      text:'湖北宜都、枝江白莲教起事，川、楚、陕南山老林从教者众，烽火连六省，是为川楚教乱。盛世之下暗流已涌，驮路不靖、脚价日增。——盛极而衰之会，你的商道，仍要走下去。',
      run:function(){ CO.riskMul = { v:1.35, until: abs() + 360 }; CO.freightMul = { v:1.08, until: abs() + 360 }; } }
  ];

  /* ============================================================
     A · DATA —— 商号目标 / 成就 / 香方 / 古籍卡
     ============================================================ */
  var GOALS = [
    { id:'b2', name:'初设分号', desc:'在第二座城市开设分号', chk:function(){ return ownedCities().length >= 2; } },
    { id:'b3', name:'三城连锁', desc:'分号开满三城', chk:function(){ return ownedCities().length >= 3; } },
    { id:'b5', name:'五城通衢', desc:'分号遍设五城', chk:function(){ return ownedCities().length >= 5; } },
    { id:'imp', name:'番货北运', desc:'将粤海洋货销往内地', chk:function(){ return !!CO.importSold; } },
    { id:'shengdian', name:'恭逢盛典', desc:'在号期间逢一朝大典（告捷、南巡、千叟宴或万寿）',
      chk:function(){ return ['jinchuan','nanxun5','nanxun6','qiansou','wanshou80','shanwei'].some(function(id){ return CO.histSeen.indexOf(id) >= 0; }); } },
    { id:'w1', name:'万两之资', desc:'积银至一万两', chk:function(){ return money() >= 1000000; } },
    { id:'fifty', name:'香谱五十', desc:'识得五十味香料', chk:function(){ var s = HX && HX.state; if(!s) return false;
        return Object.keys(s.known).filter(function(k){ return s.known[k]; }).length >= 50; } },
    { id:'tycoon', name:'囤积居奇', desc:'四城以上仓中存货值逾五千两', chk:function(){
        var cities = 0;
        CITY_IDS.forEach(function(c){ var v = 0; var st = CO.store[c] || {};
          Object.keys(st).forEach(function(g){ v += st[g] * priceAt(c, g); }); if(v >= 500000) cities++; });
        return cities >= 4; } }
  ];

  /* 商道层新增成就：check(state) 读全局存档，reward 可含 money / fame / seeds */
  var ACH_EXTRA = [
    { id:'c1_trip',   name:'初涉商道',   desc:'发运第一支商队',              reward:{ money:300,  fame:1 },
      check:function(s){ return (s.co.trips || 0) >= 1; } },
    { id:'c2_trip10', name:'行商老手',   desc:'商队发运累计十次',            reward:{ money:1200, fame:2 },
      check:function(s){ return (s.co.trips || 0) >= 10; } },
    { id:'c3_biao',   name:'字号可托',   desc:'首次以镖局押运',              reward:{ money:600 },
      check:function(s){ return (s.co.biaoTrips || 0) >= 1; } },
    { id:'c4_chuan',  name:'借水行舟',   desc:'首次以漕船水运',              reward:{ money:600 },
      check:function(s){ return (s.co.waterTrips || 0) >= 1; } },
    { id:'c5_shop2',  name:'开枝散叶',   desc:'开设第二间分号',              reward:{ money:2000, fame:3 },
      check:function(s){ return ownedCities(s).length >= 2; } },
    { id:'c6_shop5',  name:'五城通衢',   desc:'分号遍设五城',                reward:{ money:8000, fame:8 },
      check:function(s){ return ownedCities(s).length >= 5; } },
    { id:'c7_farm',   name:'田连阡陌',   desc:'置办田产十块',                reward:{ money:1500 },
      check:function(s){ var n = 0; CITY_IDS.forEach(function(c){ n += (s.co.plots[c] || []).length; }); return n >= 10; } },
    { id:'c8_harvest',name:'仓廪充实',   desc:'田亩收获累计五万斤',          reward:{ money:2000 },
      check:function(s){ return (s.co.harvested || 0) >= 50000; } },
    { id:'c9_import', name:'番货北运',   desc:'将粤海洋货销往内地',          reward:{ money:3000, fame:3 },
      check:function(s){ return !!s.co.importSold; } },
    { id:'c10_sea',   name:'南海一帆',   desc:'自广州发运番货',              reward:{ money:1500 },
      check:function(s){ return (s.co.seaTrips || 0) >= 1; } },
    { id:'c11_fame',  name:'行商引荐',   desc:'声望积至十二（可开粤海分号）', reward:{ money:2500 },
      check:function(s){ return (s.co.fame || 0) >= 12; } },
    { id:'c12_silk',  name:'江南采办',   desc:'在苏州与杭州各设分号并通货',  reward:{ money:3500, fame:2 },
      check:function(s){ return !!(s.co.shops.suzhou && s.co.shops.hangzhou) && (s.co.trips || 0) >= 3; } },
    { id:'c13_wansou',name:'恭逢万寿',   desc:'逢八旬万寿之庆',              reward:{ money:5000, fame:5 },
      check:function(s){ return s.co.histSeen.indexOf('wanshou80') >= 0; } },
    { id:'c14_jiading',name:'两朝之际',  desc:'历经改元（嘉庆元年）',        reward:{ money:6000, fame:5 },
      check:function(s){ return abs(s) >= HQ(61,1,1); } },
    { id:'c15_twenty',name:'廿味入谱',   desc:'识得二十味香料',              reward:{ seeds:3 },
      check:function(s){ return Object.keys(s.known).filter(function(k){ return s.known[k]; }).length >= 20; } },
    { id:'c16_fifty', name:'五十味通识', desc:'识得五十味香料',              reward:{ money:8000, fame:6 },
      check:function(s){ return Object.keys(s.known).filter(function(k){ return s.known[k]; }).length >= 50; } },
    { id:'c17_blend30',name:'香方三十',  desc:'累计合香三十次',              reward:{ money:2000 },
      check:function(s){ return (s.stats.blends || 0) >= 30; } },
    { id:'c18_rich',  name:'柜上殷实',   desc:'现银积至五千两',              reward:{ money:3000, fame:2 },
      check:function(s){ return (s.money || 0) >= 500000; } }
  ];

  /* 商道层新增香方（沿用香道层订单结构：功效需求 + 君臣佐使 + 香气取向） */
  var ORDERS_EXTRA = {
    teahouse: { buyer:'茶号', title:'窨茶花方', need:{理气:1.0, 安神:0.4}, ideal:{君:1,臣:1,佐:1},
      price:150, target:{辛:3,苦:1,甘:6,温:3,凉:4,香:10},
      ref:{君:'moli',臣:'guihua',佐:'zhizi'},
      intro:'阊门外茶号要窨一批花茶，需清芬解郁之香，忌辛烈夺茶。' },
    sea:      { buyer:'洋行', title:'番货合香', need:{散寒:0.8, 辟秽:1.0}, ideal:{君:1,臣:1,佐:1,使:1},
      price:240, target:{辛:8,苦:2,甘:3,温:8,凉:1,香:9},
      ref:{君:'hujiao',臣:'dingxiang',佐:'tanxiang',使:'chenpi'},
      intro:'濠畔街洋行要一批番货合香转运北地，辛温辟秽之外，还须压得住檀沉的厚重。' },
    temple:   { buyer:'寺观', title:'斋醮降真香', need:{安神:1.0, 辟秽:0.5}, ideal:{君:1,臣:1,佐:1},
      price:200, target:{辛:4,苦:3,甘:5,温:5,凉:1,香:10},
      ref:{君:'tanxiang',臣:'jiangzhenxiang',佐:'gansong'},
      intro:'虎丘寺观修醮，要一批焚之清芬远逸的降真香，以合斋仪。' }
  };

  /* 商道层新增古籍卡：引文皆真典可核（详见「编年」与香草志） */
  var CARDS_EXTRA = [
    { id:'gj22', herb:'huajiao', src:'《诗经·唐风·椒聊》',
      quote:'椒聊之实，蕃衍盈升。',
      desc:'椒聊即花椒，结实成串、蕃衍满升。先秦即以花椒喻子孙繁盛，亦采其实以香身辟秽——香囊之用，自此始。' },
    { id:'gj23', herb:'guihua', src:'白居易《忆江南》',
      quote:'山寺月中寻桂子，郡亭枕上看潮头。',
      desc:'唐时杭州山中多桂，秋夜月明，桂子飘落。白居易守杭时写下此句，杭人植桂、赏桂、以桂入糖入香之风，由来已久。' },
    { id:'gj24', herb:'moli', src:'《本草纲目·草部·茉莉》',
      quote:'茉莉原出波斯，移植南海，今滇、广人栽莳之。',
      desc:'李时珍明言茉莉来自波斯、经南海入华，岭南、云南广植。花气清芬，熏茶、簪佩、入香皆宜，虎丘花农尤以此为业。' },
    { id:'gj25', herb:'chenxiang', src:'屈大均《广东新语·卷二·地语·四市》',
      quote:'东粤有四市……一曰香市，在东莞之寥步，凡莞香生熟诸品皆聚焉。',
      desc:'清初屈大均记粤中四市，香市专在东莞寮步（原作「寥步」），莞香生熟诸品皆聚于此。同书记莞香之盛：「当莞香盛时，岁售逾数万金」「故莞人多以香起家」。沉香结香需年久，价几与金等，粤海关岁入亦倚此为一大宗。' },
    { id:'gj26', herb:'tanxiang', src:'周嘉胄《香乘·卷二·檀香》',
      quote:'檀香出海外诸国及滇粤诸地，树即今之檀木。',
      desc:'明末周嘉胄《香乘》为香事之总汇，檀香自卷首「香品」即列为一门；同卷又引《大明一统志》「檀香出广东云南及占城真蜡爪哇渤泥暹罗三佛斋回回等国」。佛门香市所亟，焚之清芬远逸，乾隆间番舶仍载之不绝。' }
  ];

  /* ============================================================
     E · ASSET —— 素材谱：模型 / 图片 / 墨线占位
     解析顺序：本地模型 → 本地图片 → 墨线占位（占位不发任何网络请求）
     新增素材只需在此登记，或在运行时用 registerAsset(id, {...}) 追加
     ============================================================ */
  var ASSETS = {
    /* hexiang/models 内随包携带的十四味（离线亦有三维）；
       站点其余各味（../<目录>/models/<文件>.glb）由出图出模管线登记，
       见下方合并逻辑与自动生成的 shared/spice-assets.js */
    aicao:{ model:'models/aicao.glb' }, peilan:{ model:'models/peilan.glb' }, baizhi:{ model:'models/baizhi.glb' },
    bohe:{ model:'models/bohe.glb' }, shengjiang:{ model:'models/shengjiang.glb' }, xinyi:{ model:'models/xinyi.glb' },
    rougui:{ model:'models/rougui.glb' }, midiexiang:{ model:'models/midiexiang.glb' }, dingxiang:{ model:'models/dingxiang.glb' },
    chenpi:{ model:'models/chenpi.glb' }, wuzhuyu:{ model:'models/wuzhuyu.glb' }, hujiao:{ model:'models/hujiao.glb' },
    jinyinhua:{ model:'models/jinyinhua.glb' }, cangzhu:{ model:'models/cangzhu.glb' }
  };
  var ASSET_PENDING = {};
  /* 合并管线自动生成的素材谱：ready（三维就位）优先，其次 image（仅正视图） */
  (function(){
    var A = root.SPICE_ASSETS;
    if(!A) return;
    Object.keys(A.ready || {}).forEach(function(id){ ASSETS[id] = A.ready[id]; });
    Object.keys(A.image || {}).forEach(function(id){ if(!ASSETS[id]) ASSET_PENDING[id] = A.image[id]; });
  })();

  /* ============================================================
     B · CORE —— 日历（农历）· 财货口径 · 消息总线
     ============================================================ */
  var CN = ['〇','一','二','三','四','五','六','七','八','九'];
  var MONTHS = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
  var HX = null;                 /* 香道层桥接（mount 时注入） */
  var CO = null;                 /* 商号状态树（state.co） */
  var QUEUE = [];                /* 本轮消息（弹报用） */

  function cnNum(n){
    if(n <= 10) return n === 10 ? '十' : CN[n];
    if(n < 20) return '十' + CN[n - 10];
    var t = Math.floor(n / 10), u = n % 10;
    return CN[t] + '十' + (u ? CN[u] : '');
  }
  /* 绝对日：以开局（乾隆四十年正月初一）为 0，与香道层 state.day 对齐（state.day 从 1 起） */
  function abs(s){ s = s || (HX && HX.state); return (s ? s.day : 1) - 1; }
  function calOf(a){
    var y = START_YEAR + Math.floor(a / 360), r = ((a % 360) + 360) % 360;
    return { year:y, month:Math.floor(r / 30) + 1, day:(r % 30) + 1 };
  }
  function eraText(y){ return y <= 60 ? '乾隆' + cnNum(y) + '年' : (y === 61 ? '嘉庆元年' : '嘉庆' + cnNum(y - 60) + '年'); }
  /* 农历日序：初一…初十、十一…十九、二十、廿一…廿九、三十 */
  function cnDay(d){
    if(d <= 10) return '初' + (d === 10 ? '十' : CN[d]);
    if(d < 20) return '十' + CN[d - 10];
    if(d === 20) return '二十';
    if(d < 30) return '廿' + CN[d - 20];
    return '三十';
  }
  function dateText(s){
    var c = calOf(abs(s));
    return eraText(c.year) + MONTHS[c.month - 1] + cnDay(c.day) + '日';
  }
  function absToText(a){ var c = calOf(a); return eraText(c.year) + MONTHS[c.month - 1] + cnDay(c.day) + '日'; }
  function absToYearMonth(a){ var c = calOf(a); return eraText(c.year) + MONTHS[c.month - 1]; }
  function month(){ return calOf(abs()).month; }
  function year(){ return calOf(abs()).year; }

  function money(s){ return (s || (HX && HX.state)).money; }
  function addMoney(n, s){ (s || (HX && HX.state)).money = Math.max(0, Math.round(money(s) + n)); }
  /* 银两口径：一两 = 一百钱 = 一千分 */
  function fmt(n){
    n = Math.round(n);
    var t = Math.floor(n / 100), q = Math.floor((n % 100) / 10), f = n % 10;
    if(f) return t + '两' + q + '钱' + f + '分';
    if(q) return t + '两' + q + '钱';
    return t + '两';
  }
  function fmtShort(n){
    n = Math.round(n);
    if(n >= 100) return fmt(n);
    return n + '分';
  }
  function push(title, body, opts){
    QUEUE.push(Object.assign({ t:title, b:body }, opts || {}));
  }
  function drain(){ var q = QUEUE.slice(); QUEUE.length = 0; return q; }
  function log(fr, text, cat){
    var s = HX.state;
    s.co.log.push({ d: dateText(s), fr:fr, text:text, cat:cat || '' });
    if(s.co.log.length > 120) s.co.log = s.co.log.slice(-120);
    if(HX.addLog) HX.addLog(text, cat);
  }

  /* ============================================================
     C · SYSTEM —— 行价：产地贱、远地贵 + 时令/事件修正
     ============================================================ */
  function goodOf(id){ return SPICES[id]; }
  /* 未知 id（旧档残留/外部数据）一律视为不可种、不可购、非洋货，避免取属性即崩 */
  function isSea(id){ return !!(SPICES[id] && SPICES[id].sea); }
  function canFarm(city, id){ return !!SPICES[id] && !isSea(id) && (SPICES[id].farm || []).indexOf(city) >= 0; }
  function canBuy(city, id){ if(!SPICES[id]) return false; return isSea(id) ? city === 'guangzhou' : (SPICES[id].farm || []).indexOf(city) >= 0; }
  function supplyOf(city){
    return Object.keys(SPICES).filter(function(id){ return canBuy(city, id); });
  }
  /* 基准锚价：品级与类别定基准，产地近则贱 */
  function anchorOf(city, id){
    var sp = SPICES[id];
    if(!sp) return 1;
    var origin = (sp.farm && sp.farm.length) ? REGION[sp.farm[0]] : '岭南';
    var d = (DIST[origin] && DIST[origin][REGION[city]]) || 0;
    var m = isSea(id) ? (city === 'guangzhou' ? 0.80 : 1 + d * 0.20) : (canFarm(city, id) ? 0.80 + (sp.tier >= 4 ? 0.06 : 0) : 1 + d * 0.16);
    if(sp.cat === '花' && (city === 'suzhou' || city === 'hangzhou')) m -= 0.06;
    return Math.max(1, Math.round(sp.base * m));
  }
  function curAnchor(city, id){
    var s = HX.state;
    return Math.max(1, Math.round(anchorOf(city, id) * (s.co.infl || 1)));
  }
  function modMul(city, id){
    var m = 1;
    (CO.mods || []).forEach(function(x){
      if((x.city === '*' || x.city === city) && (x.good === '*' || x.good === id)) m *= x.mul;
    });
    return m;
  }
  function priceAt(city, id){
    var s = HX.state;
    var p = (s.co.price[city] && s.co.price[city][id]) || curAnchor(city, id);
    return Math.max(1, Math.round(p * modMul(city, id)));
  }
  function buyPrice(city, id){ return Math.ceil(priceAt(city, id) * 1.04); }
  function sellPrice(city, id){ return Math.max(1, Math.floor(priceAt(city, id) * 0.96)); }
  function priceTag(city, id){
    var a = curAnchor(city, id), p = priceAt(city, id), r = p / a;
    if(r >= 1.12) return ['up', '贵'];
    if(r <= 0.90) return ['down', '廉'];
    return ['mute', '平'];
  }
  function driftPrices(){
    var s = HX.state;
    if(!s.co.price[X_]) initPrices(s);
    CITY_IDS.forEach(function(c){
      Object.keys(SPICES).forEach(function(id){
        var a = curAnchor(c, id);
        var cur = s.co.price[c][id] == null ? a : s.co.price[c][id];
        var p = cur + (a - cur) * 0.06 + a * (Math.random() - 0.5) * 0.07;
        s.co.price[c][id] = Math.max(Math.round(a * 0.72), Math.min(Math.round(a * 1.45), Math.round(p)));
      });
    });
  }
  function reshapePrice(city, id, dir, qty){
    var s = HX.state, a = curAnchor(city, id);
    var base = s.co.price[city][id] == null ? a : s.co.price[city][id];
    var n = base + Math.round(base * 0.012 * qty / 100) * dir;
    s.co.price[city][id] = Math.max(Math.round(a * 0.72), Math.min(Math.round(a * 1.45), n));
  }
  var X_ = 'xian';
  function initPrices(s){
    CITY_IDS.forEach(function(c){
      if(!s.co.price[c]) s.co.price[c] = {};
      Object.keys(SPICES).forEach(function(id){
        if(s.co.price[c][id] == null) s.co.price[c][id] = anchorOf(c, id);
      });
    });
  }
  function addMod(city, good, mul, days, label){
    CO.mods.push({ city:city, good:good, mul:mul, until: abs() + days,
      label: label || (city === '*' ? '通市' : CITIES[city].name) });
  }
  function freightNow(){ return (CO.freightMul && CO.freightMul.until > abs()) ? CO.freightMul.v : 1; }
  function riskNow(){ return (CO.riskMul && CO.riskMul.until > abs()) ? CO.riskMul.v : 1; }
  function yieldNow(){ return (CO.yieldMul && CO.yieldMul.until > abs()) ? CO.yieldMul.v : 1; }
  function ownedCities(s){
    var st = s || HX.state;
    return CITY_IDS.filter(function(c){ return st.co.shops[c]; });
  }
  function edgeOf(a, b){
    for(var i = 0; i < EDGES.length; i++){
      var e = EDGES[i];
      if((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return null;
  }
  /* ============================================================
     C · SYSTEM —— 田亩：按城置产、依农时下种、按气候收成
     ============================================================ */
  function plantCrop(city, idx, id){
    var s = HX.state;
    var p = s.co.plots[city][idx];
    if(!p || p.crop) return HX.toast('此田已有作物');
    if(!canFarm(city, id) || !SPICES[id].crop) return HX.toast('此地水土不宜种植此物');
    var seed = SPICES[id].crop.s;
    if(money() < seed) return HX.toast('银钱不足，付不起种苗钱');
    act(function(st){
      st.money -= seed;
      p.crop = id; p.ready = abs() + SPICES[id].crop.d;
      log(CITIES[city].name, '于' + CITIES[city].land + '种下' + SPICES[id].zh + '，约' + SPICES[id].crop.d + '日可收。', '农事');
    });
    HX.toast(SPICES[id].zh + '已下种，' + SPICES[id].crop.d + '日后可收');
  }
  function harvest(city, idx){
    var s = HX.state, p = s.co.plots[city][idx];
    if(!p || !p.crop) return;
    if(abs() < p.ready) return HX.toast('尚未成熟');
    var id = p.crop;
    act(function(st){
      var qty = Math.max(1, Math.round(SPICES[id].crop.y * (0.92 + Math.random() * 0.16) * yieldNow()));
      st.co.store[city][id] = (st.co.store[city][id] || 0) + qty;
      st.co.harvested = (st.co.harvested || 0) + qty;
      log(CITIES[city].name, '收获' + SPICES[id].zh + ' ' + qty + ' 斤，入' + CITIES[city].addr + '仓。', '农事');
      p.crop = null; p.ready = 0;
    });
    HX.toast('已收获入仓');
  }
  function buyPlot(city){
    var s = HX.state, C = CITIES[city];
    if(s.co.plots[city].length >= C.maxPlots) return HX.toast('此城田产已至上限');
    if(money() < C.plotCost) return HX.toast('银钱不足');
    act(function(st){
      st.money -= C.plotCost;
      st.co.plots[city].push({ crop:null, ready:0 });
      log(C.name, '置下' + C.land + '田产一块，费银 ' + fmt(C.plotCost) + '。', '产业');
    });
    HX.toast('已置田一块');
  }
  function openShop(city){
    var s = HX.state, C = CITIES[city];
    if(s.co.shops[city]) return;
    if(C.fame && s.co.fame < C.fame) return HX.toast('声望不足（需 ' + C.fame + '），粤中行商不肯引荐');
    if(money() < C.open) return HX.toast('银钱不足');
    act(function(st){
      st.money -= C.open;
      st.co.shops[city] = true;
      log(C.name, '在' + C.addr + '开设分号，费银 ' + fmt(C.open) + '。', '产业');
    });
    HX.toast('已在' + C.name + '开设分号');
  }

  /* ============================================================
     C · SYSTEM —— 市集：买入照行价加利，卖出坐扣行用
     ============================================================ */
  function buyGood(city, id, qty){
    if(!canBuy(city, id)) return HX.toast('此城行面不售此货');
    if(!(qty > 0)) return HX.toast('请填写数量');
    var cost = buyPrice(city, id) * qty;
    if(cost > money()) return HX.toast('银钱不足');
    act(function(st){
      st.money -= cost;
      st.co.store[city][id] = (st.co.store[city][id] || 0) + qty;
      reshapePrice(city, id, 1, qty);
      log(CITIES[city].name, '市集购入' + SPICES[id].zh + ' ' + qty + ' 斤，用银 ' + fmt(cost) + '。', '买卖');
    });
    HX.toast('已购' + SPICES[id].zh + ' ' + qty + ' 斤');
  }
  function sellGood(city, id, qty){
    var s = HX.state, have = s.co.store[city][id] || 0;
    if(!(qty > 0)) return HX.toast('请填写数量');
    if(qty > have) return HX.toast('本城存货不足');
    var rev = sellPrice(city, id) * qty;
    act(function(st){
      st.money += rev;
      st.co.store[city][id] = have - qty;
      reshapePrice(city, id, -1, qty);
      if(isSea(id) && city !== 'guangzhou') st.co.importSold = true;
      log(CITIES[city].name, '售出' + SPICES[id].zh + ' ' + qty + ' 斤，得银 ' + fmt(rev) + '。', '买卖');
    });
    HX.toast('已售' + SPICES[id].zh + ' ' + qty + ' 斤，得 ' + fmt(rev));
  }

  /* ============================================================
     C · SYSTEM —— 商队：真实里程 × 脚力，抵埠方入分号仓
     ============================================================ */
  function estTrip(from, to, modeId, cargo){
    var e = edgeOf(from, to);
    if(!e) return null;
    var M = MODES[modeId];
    if(e.water ? !M.water : !M.road) return null;
    var qty = 0;
    Object.keys(cargo).forEach(function(id){ qty += cargo[id]; });
    var days = Math.max(1, Math.ceil(e.li / M.speed));
    var cost = Math.round((M.base + (e.li / 100) * qty * M.rate) * freightNow());
    var riskPct = (e.li / 100) * M.riskPct * (e.water ? 1 : 1.12) * riskNow();
    return { route:e.name, li:e.li, days:days, cost:cost, riskPct:riskPct, cap:M.cap, qty:qty, water:e.water };
  }
  function dispatch(from, to, modeId, cargo){
    if(from === to) return HX.toast('起运与到达不可同城');
    if(!HX.state.co.shops[to]) return HX.toast('须先在彼处开设分号，方能收货');
    var est = estTrip(from, to, modeId, cargo);
    if(!est) return HX.toast('此路不通此等脚力');
    if(!est.qty) return HX.toast('请先勾选货品');
    if(est.qty > est.cap) return HX.toast('载重超出（' + MODES[modeId].name + '至多 ' + est.cap + ' 斤）');
    if(est.cost > money()) return HX.toast('银钱不足，付不起运费');
    act(function(s){
      s.money -= est.cost;
      Object.keys(cargo).forEach(function(id){
        s.co.store[from][id] -= cargo[id];
        if(s.co.store[from][id] <= 0) delete s.co.store[from][id];
      });
      var now = abs();
      var t = { id:'t' + (s.co.seq++), from:from, to:to, mode:modeId, cargo:Object.assign({}, cargo),
                li:est.li, days:est.days, depart:now, arrive:now + est.days,
                water:est.water, route:est.route, inc:[], done:false };
      rollIncidents(t, now);
      s.co.transit.push(t);
      /* 计数：镖局/水运/番货各记一笔，供成就判读 */
      if(modeId === 'biao') s.co.biaoTrips = (s.co.biaoTrips || 0) + 1;
      if(modeId === 'chuan') s.co.waterTrips = (s.co.waterTrips || 0) + 1;
      if(to === 'guangzhou' || from === 'guangzhou') s.co.seaTrips = (s.co.seaTrips || 0) + 1;
      log(CITIES[from].name, '发' + MODES[modeId].name + '赴' + CITIES[to].name + '，' + est.route + '，约' + est.days + '日到，运费 ' + fmt(est.cost) + '。', '商旅');
    });
    HX.toast('商队已发，静候佳音');
  }
  function rollIncidents(t, now){
    var chance = (t.li / 100) * MODES[t.mode].riskPct * (t.water ? 1 : 1.12) * riskNow();
    if(Math.random() * 100 >= chance) return;
    var kinds = t.water ? ['storm', 'tax', 'loot_boat', 'wind'] : ['bandit', 'road', 'tax', 'rain'];
    var n = Math.random() < 0.25 ? 2 : 1;
    for(var i = 0; i < n; i++){
      var kind = kinds[Math.floor(Math.random() * kinds.length)];
      var at = Math.min(t.arrive, t.depart + 1 + Math.floor(Math.random() * Math.max(1, t.days - 1)));
      var inc = { kind:kind, at:at, fired:false };
      if(kind === 'bandit') inc.pct = 0.18 + Math.random() * 0.25;
      if(kind === 'loot_boat') inc.pct = 0.12 + Math.random() * 0.20;
      if(kind === 'tax') inc.pct = 0.02 + Math.random() * 0.02;
      if(kind === 'storm' || kind === 'road'){ inc.delay = 2 + Math.floor(Math.random() * 4); t.arrive += inc.delay; }
      if(kind === 'wind' || kind === 'rain'){ inc.delay = 1 + Math.floor(Math.random() * 3); t.arrive += inc.delay; }
      t.inc.push(inc);
    }
    t.inc.sort(function(a, b){ return a.at - b.at; });
  }
  function fireIncident(t, inc){
    var label = CITIES[t.from].name + '→' + CITIES[t.to].name;
    var s = HX.state;
    if(inc.kind === 'bandit' || inc.kind === 'loot_boat'){
      var goods = Object.keys(t.cargo).filter(function(id){ return t.cargo[id] > 0; });
      if(!goods.length) return;
      var id = goods[Math.floor(Math.random() * goods.length)];
      var lost = Math.max(1, Math.round(t.cargo[id] * inc.pct));
      t.cargo[id] -= lost;
      if(t.cargo[id] <= 0) delete t.cargo[id];
      if(inc.kind === 'bandit') s.co.fame = Math.max(0, s.co.fame - 2);
      var txt = inc.kind === 'bandit'
        ? '商队行至' + t.route + '，遭逢劫匪，失' + SPICES[id].zh + ' ' + lost + ' 斤，字号名声亦损。'
        : '江上遇水贼夜劫，失' + SPICES[id].zh + ' ' + lost + ' 斤。';
      log(label, txt, '运输'); push('道途惊变', txt, { bad:true });
    } else if(inc.kind === 'tax'){
      var val = 0;
      Object.keys(t.cargo).forEach(function(id2){ val += t.cargo[id2] * priceAt(t.to, id2); });
      var fee = Math.min(money(), Math.round(val * inc.pct));
      addMoney(-fee);
      var t2 = '关津查验，抽分银 ' + fmt(fee) + '。';
      log(label, t2, '运输'); push('关津抽分', t2);
    } else {
      var txt2 = inc.kind === 'storm' ? '江上风浪大作，船行避泊数日。'
        : inc.kind === 'road' ? '山道塌方，绕行小路，行程阻滞。'
        : inc.kind === 'wind' ? '连日逆风，船行迟滞。' : '途中霪雨连绵，路泞难行。';
      var full = txt2 + '延误 ' + inc.delay + ' 日。';
      log(label, full, '运输'); push('行程阻滞', full);
    }
  }
  function deliver(t){
    var s = HX.state;
    var lines = Object.keys(t.cargo).map(function(id){ return SPICES[id].zh + ' ' + t.cargo[id] + ' 斤'; }).join('、');
    Object.keys(t.cargo).forEach(function(id){ s.co.store[t.to][id] = (s.co.store[t.to][id] || 0) + t.cargo[id]; });
    s.co.fame += 1; s.co.trips += 1;
    var txt = '商队自' + CITIES[t.from].name + '抵' + CITIES[t.to].name + '，卸货：' + lines + '。';
    log(CITIES[t.to].name, txt, '商旅');
    push('商队抵埠', txt + ' 声望 +1。', { good:true });
  }
  function cargoValue(t){
    var v = 0;
    Object.keys(t.cargo).forEach(function(id){ v += t.cargo[id] * priceAt(t.to, id); });
    return v;
  }

  /* ============================================================
     C · SYSTEM —— 事件池：市场 / 政策 / 社会 / 运输 / 天时
     ============================================================ */
  var EVENTS = [
    { id:'pepper_fleet', cat:'市场', w:6, run:function(){
        addMod('guangzhou', 'hujiao', 0.66, 5, '番舶到港');
        return '南洋番舶连樯而至，广州胡椒涌市，各洋货行竞相放价。'; } },
    { id:'court_fashion', cat:'市场', w:4, run:function(){
        addMod('*', 'longnao', 1.45, 6, '京尚龙脑');
        return '京中贵胄竞尚龙脑熏衣，此物一时腾贵。'; } },
    { id:'spice_short', cat:'市场', w:5, run:function(){
        var ids = Object.keys(SPICES);
        var id = ids[Math.floor(Math.random() * ids.length)];
        addMod('*', id, 1.35, 5, SPICES[id].zh + '缺');
        return '药材行传' + SPICES[id].zh + '缺货，行价骤起。'; } },
    { id:'flower_market', cat:'市场', w:5, run:function(){
        addMod('suzhou', 'moli', 1.40, 6, '花市大兴'); addMod('hangzhou', 'guihua', 1.35, 6, '花市大兴');
        return '江南茶市大兴，茉莉、桂花价昂，花农皆喜。'; } },
    { id:'tariff_up', cat:'政策', w:4, run:function(){
        addMod('guangzhou', '*', 1.14, 6, '粤关加税');
        return '粤海关加征课税，番货行价普涨一分。'; } },
    { id:'tariff_dn', cat:'政策', w:3, run:function(){
        addMod('guangzhou', '*', 0.92, 5, '关税宽减');
        return '关部宽减税课，粤中番货稍平。'; } },
    { id:'canal_check', cat:'政策', w:4, run:function(){
        CO.freightMul = { v:1.28, until: abs() + 5 };
        return '漕务整顿，船价、脚价俱涨，行旅称苦。'; } },
    { id:'seize', cat:'政策', w:4, cond:function(){ return HX.state.co.transit.length > 0; }, run:function(){
        var arr = HX.state.co.transit;
        var t = arr[Math.floor(Math.random() * arr.length)];
        var val = 0;
        Object.keys(t.cargo).forEach(function(id){ val += t.cargo[id] * priceAt(t.from, id); });
        var fee = Math.min(money(), Math.round(val * 0.03));
        addMoney(-fee);
        return '官府查缉私货，途中商队被关津抽分银 ' + fmt(fee) + '。'; } },
    { id:'westlake', cat:'社会', w:6, cond:function(){ return month() <= 3; }, run:function(){
        addMod('hangzhou', 'tanxiang', 1.42, 8, '西湖香市'); addMod('hangzhou', 'longnao', 1.35, 8, '西湖香市');
        return '西湖香市大开，天竺进香者络绎，檀沉龙脑销行极盛。'; } },
    { id:'duanwu', cat:'社会', w:6, cond:function(){ return month() === 5; }, run:function(){
        addMod('*', 'aicao', 1.35, 5, '端午将至'); addMod('*', 'peilan', 1.30, 5, '端午将至');
        return '端午将近，家家悬艾佩兰，二物价涨。'; } },
    { id:'temple_fair', cat:'社会', w:4, run:function(){
        addMod('suzhou', 'ruxiang', 1.38, 6, '寺观修醮'); addMod('suzhou', 'tanxiang', 1.30, 6, '寺观修醮');
        return '虎丘寺观修醮，香烛之属畅销。'; } },
    { id:'epidemic', cat:'社会', w:3, run:function(){
        addMod('*', 'huoxiang', 1.50, 7, '时疫'); addMod('*', 'cangzhu', 1.40, 7, '时疫');
        return '时疫流行，藿香、苍术为药肆所争，价增。'; } },
    { id:'official', cat:'社会', w:3, run:function(){
        var fee = Math.min(money(), 500);
        addMoney(-fee); CO.fame += 1;
        return '钦差巡按过境，各商号应酬打点，费银 ' + fmt(fee) + '，字号却也得了个勤谨之名。'; } },
    { id:'road_rumor', cat:'运输', w:4, run:function(){
        CO.riskMul = { v:1.5, until: abs() + 4 };
        return '道上不靖，传闻有匪出没，行旅皆加戒备。'; } },
    { id:'river_flood', cat:'运输', w:4, run:function(){
        CO.freightMul = { v:1.15, until: abs() + 3 };
        HX.state.co.transit.forEach(function(t){ if(t.water) t.arrive += 1; });
        return '江水暴涨，船行迟滞，各帮船期俱延。'; } },
    { id:'good_weather', cat:'天时', w:4, run:function(){
        CO.yieldMul = { v:1.10, until: abs() + 6 };
        return '风调雨顺，草木长势喜人，田亩可望丰收。'; } },
    { id:'drought', cat:'天时', w:3, run:function(){
        CO.yieldMul = { v:0.85, until: abs() + 6 };
        addMod('*', 'cangzhu', 1.20, 6, '亢旱');
        return '亢旱少雨，田亩歉收，山货价起。'; } }
  ];
  function maybeEvent(now){
    if(!(now - CO.lastEv >= 9 || Math.random() < 0.22)) return;
    var pool = EVENTS.filter(function(e){ return !e.cond || e.cond(); });
    if(!pool.length) return;
    var total = pool.reduce(function(n, e){ return n + e.w; }, 0);
    var r = Math.random() * total, hit = pool[0];
    for(var i = 0; i < pool.length; i++){ r -= pool[i].w; if(r <= 0){ hit = pool[i]; break; } }
    var text = hit.run();
    if(!text) return;
    CO.lastEv = now;
    log('市面', text, hit.cat);
    push('纪事 · ' + hit.cat, text);
  }
  function checkHistory(){
    var now = abs();
    HISTORY.forEach(function(h){
      if(now >= h.at && CO.histSeen.indexOf(h.id) < 0){
        CO.histSeen.push(h.id);
        if(h.run) h.run();
        log('朝局', h.text, h.cat);
        push('朝局 · ' + h.title, h.text, { hist:true });
      }
    });
  }

  /* ============================================================
     C · SYSTEM —— 每日推进（由香道层 nextDay 逐日调用）
     ============================================================ */
  function tick(){
    var s = HX.state;
    if(!s.co) return;
    var now = abs();
    var today = calOf(now), yest = calOf(now - 1);
    /* 岁首：生齿日繁、度支浩繁，百物岁涨约千分之六（银钱渐贱） */
    if(today.year !== yest.year){
      s.co.infl = Math.round((s.co.infl || 1) * 1.006 * 10000) / 10000;
      if([45, 50, 55, 60].indexOf(today.year) >= 0)
        log('户部', '届岁更始，度支出纳浩繁，百物翔贵，银钱渐微。', '朝局');
    }
    /* 腊月：议罪银兴后，年关节敬、层层摊派（约柜银千分之八，最少三两） */
    if(today.month === 12 && yest.month !== 12 && s.co.eraTribute && s.co.tribYear !== today.year){
      s.co.tribYear = today.year;
      var fee = Math.min(money(), Math.max(300, Math.round(money() * 0.008)));
      addMoney(-fee);
      var txt = '腊月年关，上官节敬、里甲摊派踵至，号中支应银 ' + fmt(fee) + '。';
      log('朝局', txt, '政策'); push('政策 · 年关节敬', txt);
    }
    s.co.mods = (s.co.mods || []).filter(function(m){ return m.until > now; });
    driftPrices();
    /* 在途：逐日核验途中变故 → 抵埠卸货入仓 */
    s.co.transit.forEach(function(t){
      t.inc.forEach(function(inc){ if(!inc.fired && inc.at <= now){ inc.fired = true; fireIncident(t, inc); } });
    });
    var arrived = s.co.transit.filter(function(t){ return t.arrive <= now; });
    s.co.transit = s.co.transit.filter(function(t){ return t.arrive > now; });
    arrived.forEach(deliver);
    checkHistory();
    maybeEvent(now);
    DAILY_TICKS.forEach(function(fn){ try{ fn(HX.state); }catch(e){} });
  }

  /* ============================================================
     B · CORE —— 单一变异入口：改状态 → 商道成就 → 存档/重绘 → 弹报
     ============================================================ */
  function act(fn){
    var got = [];
    HX.mutate(function(s){
      fn(s);
      got = checkAch(s);
    });
    if(got.length) showAch(got);
    flushPops();
  }
  /* 商道成就结算：达成即发奖（钱 / 声望 / 种子）并记名 */
  function checkAch(s){
    var got = [];
    ACH_EXTRA.forEach(function(a){
      var st = s || HX.state;
      if(st.ach[a.id]) return;
      var ok = false;
      try{ ok = !!a.check(st); }catch(e){ ok = false; }
      if(!ok) return;
      st.ach[a.id] = true;
      var r = a.reward || {};
      if(r.money) st.money += r.money;
      if(r.fame) st.co.fame = (st.co.fame || 0) + r.fame;
      if(r.seeds && HX.randomSeed){
        for(var i = 0; i < r.seeds; i++){
          var k = HX.randomSeed();
          st.seeds[k] = (st.seeds[k] || 0) + 1;
        }
      }
      got.push(a);
    });
    return got;
  }
  /* 推进时日：逐日走香道层的「过一日」（其中含本层的 tick） */
  function commitDays(n){
    if(!(n > 0)) n = 1;
    var got = [];
    HX.mutate(function(s){ for(var i = 0; i < n; i++) HX.nextDay(); got = checkAch(s); });
    if(got.length) showAch(got);
    var msgs = drain();
    if(!msgs.length){ HX.toast(n > 1 ? '已推进' + cnNum(n) + '日 · ' + dateText() : dateText()); return; }
    var hist = msgs.filter(function(m){ return m.hist; });
    var rest = msgs.filter(function(m){ return !m.hist; }).slice(-2);
    hist.concat(rest).slice(-4).forEach(function(m){ pop(m.t, m.b); });
    HX.toast('已推进' + cnNum(n) + '日 · ' + dateText() + ' · 纪事 ' + msgs.length + ' 宗');
  }

  /* ============================================================
     D · VIEW —— 弹报（右下角纪事）与成就对话（v2 重制）
     ============================================================ */
  function pop(title, body){
    var box = document.getElementById('xyPop');
    if(!box){
      box = document.createElement('div');
      box.id = 'xyPop';
      box.className = 'xy-pop';
      document.body.appendChild(box);
    }
    var d = document.createElement('div');
    d.className = 'xy-pop-item';
    d.innerHTML = '<div class="t">' + esc(title) + '</div><div class="b">' + esc(body) + '</div>';
    box.appendChild(d);
    while(box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function(){
      d.style.opacity = '0'; d.style.transition = 'opacity .4s';
      setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 420);
    }, 6500);
  }
  function flushPops(){
    var msgs = drain();
    if(!msgs.length) return;
    (msgs.length > 3 ? msgs.slice(-3) : msgs).forEach(function(m){ pop(m.t, m.b); });
  }

  /* 成就音效：MP3（1.35 秒）优先，缺失则退 WebAudio 合成，绝不阻塞界面 */
  var SFX_SRC = './shared/sfx/achievement.mp3';
  var audioEl = null, audioOk = true;
  function playSfx(){
    if(audioOk){
      try{
        if(!audioEl){ audioEl = new Audio(SFX_SRC); audioEl.preload = 'auto'; }
        audioEl.currentTime = 0;
        var p = audioEl.play();
        if(p && p.catch) p.catch(function(){ audioOk = false; beep(); });
        return;
      }catch(e){ audioOk = false; }
    }
    beep();
  }
  /* 无音频文件时的兜底：三音上行，与 MP3 同构（1.35 秒内） */
  function beep(){
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      var ctx = new AC();
      [659.25, 783.99, 1046.5].forEach(function(f, i){
        var t0 = ctx.currentTime + i * 0.26;
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.66);
      });
      setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 1600);
    }catch(e){}
  }
  var achQueue = [], achOpen = false, achEscBound = false;
  function showAch(list){
    achQueue = achQueue.concat(list);
    if(!achEscBound){                       /* ESC 亦可关闭，绑一次即可 */
      achEscBound = true;
      document.addEventListener('keydown', function(e){
        if((e.key === 'Escape' || e.key === 'Esc') && achOpen){ achQueue.length = 0; nextAch(); }
      });
    }
    if(!achOpen) nextAch();
  }
  /* 收起成就对话（队列取空时必须显式收起，否则面板会一直留在屏幕上） */
  function hideAch(){
    var el = document.getElementById('xyAch');
    if(el) el.classList.remove('on');
  }
  function nextAch(){
    var a = achQueue.shift();
    if(!a){ achOpen = false; hideAch(); return; }
    achOpen = true;
    var total = achQueue.length + 1;
    var el = document.getElementById('xyAch');
    if(!el){
      el = document.createElement('div');
      el.id = 'xyAch';
      el.className = 'xy-ach';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'false');
      document.body.appendChild(el);
    }
    var reward = rewardLine(a.reward);
    el.innerHTML =
      '<div class="xy-ach-card">' +
        '<div class="xy-ach-badge" aria-hidden="true">' + achIcon(a) + '</div>' +
        '<div class="xy-ach-body">' +
          '<div class="xy-ach-kicker">成就达成' + (total > 1 ? ' · 尚有 ' + (total - 1) + ' 项' : '') + '</div>' +
          '<div class="xy-ach-name">' + esc(a.name) + '</div>' +
          '<div class="xy-ach-desc">' + esc(a.desc) + '</div>' +
          '<div class="xy-ach-reward">奖励 · ' + esc(reward) + '</div>' +
        '</div>' +
        '<div class="xy-ach-btns">' +
          '<button class="xy-btn primary" id="xyAchOk">确认</button>' +
          '<button class="xy-btn" id="xyAchClose">关闭</button>' +
        '</div>' +
      '</div>';
    el.classList.add('on');
    playSfx();
    var ok = document.getElementById('xyAchOk'), cl = document.getElementById('xyAchClose');
    if(ok) ok.onclick = nextAch;
    if(cl) cl.onclick = function(){ achQueue.length = 0; nextAch(); };
  }
  function rewardLine(r){
    r = r || {};
    var parts = [];
    if(r.money) parts.push('银 ' + fmt(r.money));
    if(r.fame) parts.push('声望 +' + r.fame);
    if(r.seeds) parts.push('种子 ' + r.seeds + ' 枚');
    if(r.seed) parts.push('种子 1 枚');
    return parts.join('，') || '无';
  }
  /* 图片缺失的兜底：就地换成墨线占位并标「素材待生成」——素材管线未覆盖者亦不至于破图 */
  function imgFail(img){
    try{
      var id = img.getAttribute('data-spice');
      var box = img.parentNode;
      if(!box) return;
      var d = document.createElement('div');
      d.className = 'ic-fallback';
      d.innerHTML = spiceIcon(id, 160);
      box.innerHTML = '';
      box.appendChild(d);
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '素材待生成';
      box.appendChild(tag);
    }catch(e){}
  }
  /* 香料图标：内联 SVG 小印（品类定色 · 品级定边宽 · 取首字），零网络请求 */
  var CAT_COLOR = { 土产:'#a23e2b', 南货:'#3f6b57', 洋货:'#2f5d8a', 花:'#8a4a7a' };
  function spiceGlyph(id, size){
    var sp = SPICES[id];
    if(!sp) return '';
    var c = CAT_COLOR[sp.cat] || '#a23e2b', s = size || 20;
    var ring = (1 + Math.max(0, sp.tier - 1) * 0.35).toFixed(1);
    return '<svg class="xy-glyph" viewBox="0 0 32 32" width="' + s + '" height="' + s + '" role="img" aria-label="' + esc(sp.zh) + '">' +
      '<rect x="2.2" y="2.2" width="27.6" height="27.6" rx="7" fill="' + c + '" fill-opacity=".12" stroke="' + c + '" stroke-width="' + ring + '"/>' +
      '<text x="16" y="22.5" text-anchor="middle" font-family="KaiTi,STKaiti,serif" font-size="17" fill="' + c + '">' + esc(sp.zh.substr(0, 1)) + '</text></svg>';
  }
  /* 香篆青烟：纯 CSS 粒子上浮，随卷轴展卷而生（prefers-reduced-motion 下自动停） */
  function ensureSmoke(){
    var stage = document.getElementById('modelStage');
    if(!stage || stage.querySelector('.codex-smoke')) return;
    var d = document.createElement('div');
    d.className = 'codex-smoke';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    stage.appendChild(d);
  }
  root.xyImgFail = imgFail;
  /* 成就图标：≥64×64 的朱印方章，取成就名首字；商道类另加角标 */
  function achIcon(a){
    var ch = (a.name || '成')[0];
    var kind = /商会|分号|田|仓|柜|资|囤/.test(a.name) ? '商' : (/香|味|谱|方|合/.test(a.name) ? '香' : '道');
    return '<svg viewBox="0 0 72 72" width="72" height="72" role="img" aria-label="' + esc(a.name) + '">' +
      '<defs><linearGradient id="xyg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#b84a33"/><stop offset="1" stop-color="#8a3120"/></linearGradient></defs>' +
      '<rect x="3" y="3" width="66" height="66" rx="8" fill="url(#xyg)"/>' +
      '<rect x="7.5" y="7.5" width="57" height="57" rx="5" fill="none" stroke="rgba(250,243,230,.6)" stroke-width="1.6"/>' +
      '<text x="36" y="47" text-anchor="middle" font-family="KaiTi,STKaiti,serif" font-size="34" fill="#faf3e6">' + esc(ch) + '</text>' +
      '<text x="36" y="62" text-anchor="middle" font-family="KaiTi,STKaiti,serif" font-size="11" fill="rgba(250,243,230,.75)">' + kind + '</text>' +
      '</svg>';
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  /* ============================================================
     E · ASSET —— 素材解析：模型 → 图片 → 墨线占位
     素材谱里没有登记的香料一律走占位，**不发出任何网络请求**（省请求、省等待）
     ============================================================ */
  var PROSE = {};                       /* 香料词条（spice-prose.js 提供，缺失时用兜底文案） */
  function proseOf(id){
    var p = (root.SPICE_PROSE && root.SPICE_PROSE[id]) || null;
    return p;
  }
  function fallbackProse(id){
    var sp = SPICES[id];
    return {
      latin:'（词条待补）', family:'（科属待补）',
      habitat:'（生境待补，游戏内按「' + sp.zone + '」区试种）',
      parts:'（成分待补）',
      med:'性平，味辛；功效见《香草志》补编。',
      lore:'此味词条尚待补入——可据《本草纲目》《香乘》等补写。',
      era: sp.note || '', pending:true
    };
  }
  function assetOf(id){
    if(ASSETS[id]) return { model:ASSETS[id].model || null, image:ASSETS[id].image || null, status:'ready' };
    if(ASSET_PENDING[id]) return { model:null, image:ASSET_PENDING[id].image || null, status:'image' };
    return { model:null, image:null, status:'placeholder' };
  }
  function modelPathOf(id){ return assetOf(id).model; }
  function spiceOf(id){ return SPICES[id] || null; }
  /* 香料图形：有模型/图片则用之，否则墨线占位并明标「素材待生成」 */
  function spiceIcon(id, size){
    var sp = SPICES[id], a = assetOf(id);
    var s = size || 96;
    if(a.image) return '<img class="xy-icon" src="' + a.image + '" alt="' + esc(sp.zh) + '" style="width:' + s + 'px;height:' + s + 'px" loading="lazy">';
    if(a.model) return '<div class="xy-icon xy-icon-3d" style="width:' + s + 'px;height:' + s + 'px"><span>3D</span><b>' + esc(sp.zh.substr(0, 2)) + '</b></div>';
    return '<div class="xy-icon xy-icon-ph" style="width:' + s + 'px;height:' + s + 'px">' +
      '<svg viewBox="0 0 100 100" fill="none" stroke="#5a4a36" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M50 86 C50 66 50 46 50 24"/><path d="M50 66 C38 60 30 50 27 39 C39 41 47 49 50 58"/>' +
      '<path d="M50 66 C62 60 70 50 73 39 C61 41 53 49 50 58"/><circle cx="50" cy="20" r="4.5"/></svg>' +
      '<span class="ph-tag">待生成</span></div>';
  }

  /* ============================================================
     D · VIEW —— 页面骨架（页签 / 屏容器 / 样式）
     ============================================================ */
  var SCREEN_IDS = ['book', 'farm', 'market', 'cara', 'shop', 'annals', 'ach'];
  var TABS = [
    { id:'hub',      name:'书斋',   group:'香道' },
    { id:'study',    name:'读古籍', group:'' },
    { id:'garden',   name:'药圃',   group:'' },
    { id:'blend',    name:'香室',   group:'' },
    { id:'codex',    name:'香草志', group:'' },
    { id:'quiz',     name:'问答',   group:'' },
    { id:'book',     name:'号簿',   group:'商道' },
    { id:'farm',     name:'田亩',   group:'' },
    { id:'market',   name:'市集',   group:'' },
    { id:'cara',     name:'商队',   group:'' },
    { id:'shop',     name:'铺面',   group:'' },
    { id:'annals',   name:'编年',   group:'' },
    { id:'ach',      name:'成就',   group:'' }
  ];
  var HASH_NAME = { book:'haobu', farm:'tianmu', market:'shiji', cara:'shangdui', shop:'pumian', annals:'biannian', ach:'chengjiu' };

  var fmCity = 'xian', mkCity = 'xian';
  var caFrom = 'xian', caTo = 'hankou', caMode = 'tuo', caCargo = {};

  var STYLE = '\
.xy-tabs{display:flex;gap:6px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}\
.xy-tabs::-webkit-scrollbar{display:none}\
.xy-tab{flex:none;padding:5px 13px;cursor:pointer;border-radius:999px;font-size:12.5px;font-family:var(--kai);letter-spacing:1px;\
  border:1px solid var(--line);background:rgba(255,253,246,.7);color:var(--ink);transition:all .16s var(--ease)}\
.xy-tab:hover{border-color:rgba(51,39,25,.42)}\
.xy-tab.on{background:var(--seal);border-color:var(--seal);color:#faf3e6}\
.xy-group{flex:none;font-size:11px;color:var(--muted);letter-spacing:2px;padding:0 2px 0 8px;border-left:1px solid var(--line);margin-left:4px}\
.xy-spacer{flex:1}\
.xy-chip{flex:none;font-size:12px;padding:4px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,246,.8);white-space:nowrap}\
.xy-chip b{font-family:var(--serif);color:var(--seal);margin-left:3px}\
.xy-ctabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}\
.xy-ctab{padding:5px 13px;cursor:pointer;border-radius:999px;font-size:12.5px;font-family:var(--kai);letter-spacing:1px;\
  border:1px solid var(--line);background:rgba(255,253,246,.65);color:var(--ink)}\
.xy-ctab.on{background:rgba(162,62,43,.10);border-color:var(--seal);color:var(--seal)}\
.xy-ctab .st{font-size:11px;color:var(--muted);margin-left:4px}\
.xy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}\
.xy-plot{border:1px solid var(--line);border-radius:4px;padding:11px 13px;background:rgba(255,253,246,.72)}\
.xy-plot .pt{font-family:var(--kai);font-size:14px;letter-spacing:1px;display:flex;align-items:center;gap:7px}\
.xy-plot .pt .dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none}\
.xy-plot.grow .pt .dot{background:var(--gold)}\
.xy-plot.ready .pt .dot{background:var(--seal)}\
.xy-plot .pd{font-size:12px;color:var(--muted);margin:5px 0 7px;line-height:1.6}\
.xy-bar{height:6px;background:rgba(51,39,25,.1);border-radius:99px;overflow:hidden;margin:6px 0 8px}\
.xy-bar i{display:block;height:100%;background:linear-gradient(90deg,#732416,#a23e2b 45%,#c96a4e)}\
.xy-seedgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:8px}\
.xy-seed{text-align:left;padding:8px 10px;cursor:pointer;border-radius:4px;border:1px solid var(--line);background:rgba(255,253,246,.75);font-family:inherit;font-size:inherit;color:inherit}\
.xy-seed:hover{border-color:var(--seal);background:#fffdf6}\
.xy-seed .sn{font-family:var(--kai);font-size:13.5px;display:block}\
.xy-seed .sd{font-size:11.5px;color:var(--muted);display:block;margin-top:2px}\
.xy-mrow{display:grid;grid-template-columns:110px 1fr 78px 78px 66px 176px;gap:8px;align-items:center;\
  padding:6px 2px;border-bottom:1px dashed var(--line-2);font-size:12.5px}\
.xy-mrow.head{border-bottom:1px solid var(--line);font-size:11px;color:var(--muted);letter-spacing:1px}\
.xy-mrow .gname{font-family:var(--kai);font-size:13px}\
.xy-mrow .imp{font-size:10px;color:var(--gold);border:1px solid rgba(143,111,66,.5);border-radius:2px;padding:0 4px;margin-left:5px}\
.xy-num{font-family:var(--serif);font-variant-numeric:tabular-nums}\
.xy-up{color:var(--good)}.xy-down{color:var(--bad)}\
.xy-mods{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px}\
.xy-mod{font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid currentColor;white-space:nowrap}\
.xy-qty{width:58px;padding:4px 6px;font-size:12.5px;font-family:var(--serif);text-align:right;border:1px solid var(--line);border-radius:3px;background:rgba(255,253,246,.9);color:var(--ink)}\
.xy-transit{border:1px solid var(--line);border-radius:4px;padding:10px 12px;margin-bottom:9px;background:rgba(255,253,246,.72)}\
.xy-transit .th{display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-family:var(--kai);font-size:13.5px}\
.xy-transit .tb{font-size:12.5px;color:var(--ink-2);margin-top:5px;line-height:1.7}\
.xy-modes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:9px;margin:10px 0}\
.xy-mode{text-align:left;padding:10px 12px;cursor:pointer;border-radius:4px;border:1px solid var(--line);background:rgba(255,253,246,.72);font-family:inherit;color:inherit}\
.xy-mode.on{border-color:var(--seal);background:rgba(162,62,43,.08)}\
.xy-mode:disabled{opacity:.4;cursor:not-allowed}\
.xy-mode .mn{font-family:var(--kai);font-size:13.5px}\
.xy-mode .md{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.55}\
.xy-est{border:1px dashed var(--line);border-radius:4px;padding:10px 12px;margin-top:10px;background:rgba(255,253,246,.5);font-size:12.5px}\
.xy-est .kv{display:flex;gap:14px;flex-wrap:wrap}\
.xy-icon{border-radius:4px;border:1px solid var(--line-2);object-fit:cover;background:rgba(255,253,246,.7)}\
.xy-icon-3d{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--kai);color:var(--seal);background:rgba(162,62,43,.07)}\
.xy-icon-3d span{font-size:10px;letter-spacing:1px}\
.xy-icon-3d b{font-size:15px}\
.xy-icon-ph{position:relative;display:flex;align-items:center;justify-content:center;background:rgba(51,39,25,.04)}\
.xy-icon-ph svg{width:78%;height:78%}\
.xy-icon-ph .ph-tag{position:absolute;bottom:2px;right:2px;font-size:9.5px;color:var(--warn);border:1px solid currentColor;border-radius:2px;padding:0 3px}\
.xy-glyph{flex:none;vertical-align:-4px;margin-right:5px}\
.codex-smoke{position:absolute;left:0;right:0;bottom:0;height:62%;overflow:hidden;pointer-events:none;z-index:3}\
.codex-smoke i{position:absolute;bottom:-6%;width:6px;height:34%;border-radius:50%;filter:blur(5px);opacity:0;\
  background:linear-gradient(180deg,rgba(162,62,43,0),rgba(162,62,43,.18) 42%,rgba(162,62,43,0));\
  animation:xySmoke 9s linear infinite}\
.codex-smoke i:nth-child(1){left:34%;animation-delay:0s}\
.codex-smoke i:nth-child(2){left:44%;height:44%;animation-delay:1.8s}\
.codex-smoke i:nth-child(3){left:53%;animation-delay:3.4s}\
.codex-smoke i:nth-child(4){left:62%;height:30%;animation-delay:5.1s}\
.codex-smoke i:nth-child(5){left:48%;height:52%;animation-delay:6.7s;width:8px}\
@keyframes xySmoke{0%{transform:translateY(6%) scaleX(1);opacity:0}18%{opacity:.55}\
  60%{opacity:.32}100%{transform:translateY(-96%) scaleX(2.6);opacity:0}}\
.xy-goal{display:flex;gap:9px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line-2);font-size:12.5px}\
.xy-goal:last-child{border-bottom:none}\
.xy-goal .gk{flex:none;width:18px;height:18px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted)}\
.xy-goal.got .gk{border-color:var(--seal);color:var(--seal);background:rgba(162,62,43,.1)}\
.xy-tl{border-bottom:1px dashed var(--line-2)}\
.xy-tl>summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:baseline;padding:7px 0;font-size:12.5px}\
.xy-tl>summary::-webkit-details-marker{display:none}\
.xy-tl>summary::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:var(--seal);align-self:center}\
.xy-tl .y{flex:none;width:112px;font-family:var(--kai);color:var(--seal)}\
.xy-tl .t{font-family:var(--kai);letter-spacing:1px}\
.xy-tl .tag{margin-left:auto;flex:none;font-size:10.5px;color:var(--seal);border:1px solid rgba(162,62,43,.4);border-radius:2px;padding:0 5px}\
.xy-tl p{margin:0 0 9px 19px;font-size:12px;color:var(--ink-2);line-height:1.85}\
.xy-tl.yet{opacity:.62}\
.xy-tl.yet>summary{cursor:default}\
.xy-tl.yet>summary::before{background:var(--muted)}\
.xy-tl.yet .y,.xy-tl.yet .t{color:var(--muted)}\
.xy-now{display:flex;gap:10px;align-items:center;padding:7px 0;font-family:var(--kai);font-size:12.5px;color:var(--gold)}\
.xy-now::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;border:2px solid var(--gold)}\
.xy-pop{position:fixed;right:14px;bottom:20px;z-index:180;display:flex;flex-direction:column;gap:8px;max-width:min(320px,88vw);pointer-events:none}\
.xy-pop-item{background:linear-gradient(180deg,#fffdf6,#f5eeda);border:1px solid rgba(162,62,43,.36);border-radius:4px;\
  box-shadow:0 8px 26px rgba(51,39,25,.2);padding:10px 13px;animation:xyIn .3s var(--ease) both}\
.xy-pop-item .t{font-family:var(--kai);font-size:12.5px;letter-spacing:2px;color:var(--seal);margin-bottom:4px}\
.xy-pop-item .b{font-size:12.5px;color:var(--ink-2);line-height:1.7}\
@keyframes xyIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}\
.xy-ach{position:fixed;left:0;right:0;top:72px;z-index:220;display:none;justify-content:center;pointer-events:none;padding:0 14px}\
.xy-ach.on{display:flex}\
.xy-ach-card{pointer-events:auto;width:min(460px,100%);display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;\
  background:linear-gradient(180deg,#fffdf6,#f4ecd8);border:1px solid rgba(162,62,43,.42);border-radius:8px;\
  box-shadow:0 18px 46px rgba(51,39,25,.3);padding:16px 18px;animation:xyAch .42s var(--ease) both}\
@keyframes xyAch{from{opacity:0;transform:translateY(-14px) scale(.94)}to{opacity:1;transform:none}}\
.xy-ach-badge{flex:none;width:72px;height:72px}\
.xy-ach-body{flex:1;min-width:170px}\
.xy-ach-kicker{font-size:11.5px;letter-spacing:3px;color:var(--gold)}\
.xy-ach-name{font-family:var(--kai);font-size:26px;line-height:1.25;letter-spacing:2px;color:var(--seal);margin:1px 0 4px}\
.xy-ach-desc{font-size:13px;color:var(--ink-2);line-height:1.7}\
.xy-ach-reward{margin-top:7px;font-size:13px;color:var(--seal);font-family:var(--kai);letter-spacing:1px}\
.xy-ach-btns{display:flex;gap:9px;width:100%;justify-content:flex-end}\
.xy-btn{min-width:96px;min-height:44px;padding:10px 18px;cursor:pointer;border-radius:4px;font-family:inherit;font-size:13.5px;\
  border:1px solid var(--line);background:linear-gradient(180deg,#fffdf6,#f6efe0);color:var(--ink)}\
.xy-btn.primary{background:linear-gradient(180deg,#b84a33,#a23e2b 52%,#8a3120);border-color:#732416;color:#faf3e6;letter-spacing:2px}\
.xy-btn:hover{transform:translateY(-1px)}\
@media (max-width:760px){\
  .xy-ach{top:auto;bottom:0;padding:0}\
  .xy-ach-card{width:100%;border-radius:10px 10px 0 0;padding:14px 15px calc(14px + env(safe-area-inset-bottom))}\
  .xy-ach-name{font-size:22px}\
  .xy-mrow{grid-template-columns:88px 1fr 62px 62px;font-size:12px}\
  .xy-mrow .stk{display:none}\
  .xy-mrow .act{grid-column:1/-1;justify-content:flex-start}\
  .xy-pop{right:8px;left:8px;bottom:12px;max-width:none}\
}';

  function injectStyle(){
    if(document.getElementById('xyStyle')) return;
    var st = document.createElement('style');
    st.id = 'xyStyle'; st.textContent = STYLE;
    document.head.appendChild(st);
  }
  function buildChrome(){
    injectStyle();
    var wrap = document.querySelector('.wrap'), stage = document.querySelector('.stage');
    if(!wrap || !stage) return;
    /* 屏容器（可重建：扩展屏注册后重跑一次即可） */
    SCREEN_IDS.forEach(function(id){
      if(document.getElementById('sc-' + id)) return;
      var sec = document.createElement('section');
      sec.className = 'screen'; sec.id = 'sc-' + id;
      stage.appendChild(sec);
    });
    /* 页签 */
    var old = document.getElementById('xyTabs');
    if(old) old.remove();
    var nav = document.createElement('nav');
    nav.className = 'xy-tabs'; nav.id = 'xyTabs';
    nav.innerHTML = TABS.map(function(t){
      return (t.group ? '<span class="xy-group">' + t.group + '</span>' : '') +
        '<button class="xy-tab" data-sc="' + t.id + '" type="button">' + t.name + '</button>';
    }).join('') +
      '<span class="xy-spacer"></span>' +
      '<span class="xy-chip" id="xyDate">—</span>' +
      '<span class="xy-chip">声望 <b id="xyFame">0</b></span>' +
      '<button class="xy-tab" id="xyDay" type="button">推进一日</button>' +
      '<button class="xy-tab" id="xyTen" type="button">推进一旬</button>';
    wrap.insertBefore(nav, stage);
    nav.querySelectorAll('[data-sc]').forEach(function(b){
      b.onclick = function(){ HX.go(b.dataset.sc); };
    });
    document.getElementById('xyDay').onclick = function(){ commitDays(1); };
    document.getElementById('xyTen').onclick = function(){ commitDays(10); };
    /* 顶栏标签就地改写（保留 id，hexiang 渲染时仍能取到元素） */
    var mc = document.getElementById('uiMoney'), dc = document.getElementById('uiDay');
    if(mc && mc.parentNode) mc.parentNode.innerHTML = '银 <b id="uiMoney">0</b>';
    if(dc && dc.parentNode) dc.parentNode.innerHTML = '历日 <b id="uiDay">—</b>';
  }
  function fmtWallet(n){
    n = Math.round(n);
    if(n >= 100) return fmt(n);                                 /* 大数走 两/钱/分 */
    if(n >= 10) return Math.floor(n / 10) + '钱' + (n % 10) + '分';
    return n + '分';
  }
  function syncTabs(){
    if(!HX || !HX.state) return;
    var s = HX.state;
    var nav = document.getElementById('xyTabs');
    if(!nav) return;
    nav.querySelectorAll('[data-sc]').forEach(function(b){
      b.classList.toggle('on', b.dataset.sc === s.screen);
    });
    var d = document.getElementById('xyDate'), f = document.getElementById('xyFame');
    if(d) d.textContent = dateText(s);
    if(f) f.textContent = (s.co && s.co.fame) || 0;
    /* 顶栏口径：银钱按 两/钱/分，日期按农历（合并商道层后「第 N 日」已无意义） */
    var mEl = document.getElementById('uiMoney');
    if(mEl) mEl.textContent = fmtWallet(s.money);
    var dEl = document.getElementById('uiDay');
    if(dEl) dEl.textContent = dateText(s);
  }
  function renderScreen(id){
    if(!HX || !HX.state) return false;
    syncTabs();
    if(id === 'codex'){ ensureSmoke(); return false; }   /* 香草志：给展卷加一层香篆青烟 */
    if(SCREEN_IDS.indexOf(id) < 0) return false;
    if(EXT_SCREENS[id]){ EXT_SCREENS[id](); syncTabs(); return true; }
    if(id === 'book') renderBook();
    else if(id === 'farm') renderFarm();
    else if(id === 'market') renderMarket();
    else if(id === 'cara') renderCara();
    else if(id === 'shop') renderShop();
    else if(id === 'annals') renderAnnals();
    else if(id === 'ach') renderAch();
    syncTabs();
    return true;
  }
  function goInside(id){
    HX.state.screen = id;
    if(HX.hashOf(id) !== location.hash) location.hash = HX.hashOf(id);
    HX.save(); HX.render();
  }
  var el = function(id){ return document.getElementById(id); };

  /* ============================================================
     D · VIEW —— 号簿：商号概况 · 目标 · 纪事
     ============================================================ */
  function renderBook(){
    var s = HX.state, owned = ownedCities();
    var plotTotal = 0;
    CITY_IDS.forEach(function(c){ plotTotal += (s.co.plots[c] || []).length; });
    var stockVal = 0;
    CITY_IDS.forEach(function(c){
      var st = s.co.store[c] || {};
      Object.keys(st).forEach(function(id){ stockVal += st[id] * priceAt(c, id); });
    });
    var gotGoals = GOALS.filter(function(g){ try{ return !!g.chk(); }catch(e){ return false; } });
    var logs = (s.co.log || []).slice(-14).reverse();
    el('sc-book').innerHTML =
    '<div class="card">' +
      '<h2>聚香号 · 号簿</h2>' +
      '<div class="hint">乾隆四十年正月，聚香号自西安府南院门起家，泾阳两畦薄田为业。<br/>' +
        '田里出香药，行市赚差价，商队通南北——货在途中不算钱，运到价高处卖脱，才落得银两入柜。</div>' +
      '<div class="sep"></div>' +
      '<div class="row" style="font-size:12.5px">' +
        '<span class="xy-chip">分号 <b>' + owned.length + '</b> / 5</span>' +
        '<span class="xy-chip">田产 <b>' + plotTotal + '</b> 块</span>' +
        '<span class="xy-chip">在途 <b>' + s.co.transit.length + '</b> 批</span>' +
        '<span class="xy-chip">行程 <b>' + s.co.trips + '</b> 次</span>' +
        '<span class="xy-chip">存货值 <b>' + fmt(stockVal) + '</b></span>' +
        '<span class="xy-chip">香谱 <b>' + Object.keys(SPICES).length + '</b> 味</span>' +
      '</div>' +
      '<div class="sep"></div>' +
      '<div class="row">' +
        '<button class="btn primary" data-go="farm">去田亩</button>' +
        '<button class="btn" data-go="market">去市集</button>' +
        '<button class="btn" data-go="cara">去商队</button>' +
        '<button class="btn" data-go="shop">去铺面</button>' +
        '<button class="btn ghost" data-go="annals">编年</button>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>商号目标 · ' + gotGoals.length + ' / ' + GOALS.length + '</h2>' +
      GOALS.map(function(g){
        var on = false; try{ on = !!g.chk(); }catch(e){}
        return '<div class="xy-goal ' + (on ? 'got' : '') + '"><span class="gk">' + (on ? '✓' : '') + '</span>' +
          '<span>' + esc(g.name) + '<span class="hint"> · ' + esc(g.desc) + '</span></span></div>';
      }).join('') +
    '</div>' +
    '<div class="card">' +
      '<h2>大事记</h2>' +
      (logs.length ? logs.map(function(l){
        return '<div class="log-item"><b>' + esc(l.d) + '</b>' + (l.cat ? '<span class="hint">[' + esc(l.cat) + ']</span> ' : '') +
          esc(l.fr) + ' · ' + esc(l.text) + '</div>';
      }).join('') : '<div class="hint">尚无纪事。先去田亩种下第一畦香药，或往市集走走行情。</div>') +
    '</div>';
    el('sc-book').querySelectorAll('[data-go]').forEach(function(b){
      b.onclick = function(){ goInside(b.dataset.go); };
    });
  }

  /* ============================================================
     D · VIEW —— 田亩：按城置产、依农时下种
     ============================================================ */
  function renderFarm(){
    var s = HX.state, owned = ownedCities();
    if(owned.indexOf(fmCity) < 0) fmCity = owned[0];
    var C = CITIES[fmCity], plots = s.co.plots[fmCity] || [], now = abs();
    var seeds = supplyOf(fmCity).filter(function(id){ return canFarm(fmCity, id) && SPICES[id].crop; });
    el('sc-farm').innerHTML =
    '<div class="xy-ctabs">' + owned.map(function(c){
      return '<button class="xy-ctab ' + (c === fmCity ? 'on' : '') + '" data-city="' + c + '">' + CITIES[c].name +
        '<span class="st">' + CITIES[c].land + '</span></button>';
    }).join('') + '</div>' +
    '<div class="card">' +
      '<h2>' + C.name + ' · 田亩</h2>' +
      '<div class="hint">' + esc(C.intro) + '</div>' +
      '<div class="sep"></div>' +
      '<div class="xy-grid">' + plots.map(function(p, i){ return plotHTML(p, i, now); }).join('') + '</div>' +
      '<div class="sep"></div>' +
      '<div class="row">' +
        '<button class="btn" id="xyBuyPlot" ' + (plots.length >= C.maxPlots || money() < C.plotCost ? 'disabled' : '') + '>购田一块（' + fmt(C.plotCost) + '）</button>' +
        '<span class="hint">田产 ' + plots.length + ' / ' + C.maxPlots + ' 块 · 田在' + esc(C.land) +
          '　此地宜植：' + seeds.map(function(id){ return SPICES[id].zh; }).join('、') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="card flat">' +
      '<h2>本城仓廪</h2>' + storeHTML(fmCity) +
    '</div>';
    el('sc-farm').querySelectorAll('[data-city]').forEach(function(b){
      b.onclick = function(){ fmCity = b.dataset.city; renderFarm(); syncTabs(); };
    });
    el('sc-farm').querySelectorAll('[data-plant]').forEach(function(b){
      var kv = b.dataset.plant.split(':');
      b.onclick = function(){ plantCrop(fmCity, Number(kv[0]), kv[1]); };
    });
    el('sc-farm').querySelectorAll('[data-harvest]').forEach(function(b){
      b.onclick = function(){ harvest(fmCity, Number(b.dataset.harvest)); };
    });
    var bp = el('xyBuyPlot');
    if(bp) bp.onclick = function(){ buyPlot(fmCity); };
  }
  function plotHTML(p, i, now){
    var C = CITIES[fmCity];
    if(!p.crop){
      var seeds = supplyOf(fmCity).filter(function(id){ return canFarm(fmCity, id) && SPICES[id].crop; });
      return '<div class="xy-plot">' +
        '<div class="pt"><span class="dot"></span>空地 · 待种</div>' +
        '<div class="pd">此地水土宜植下列香药，苗钱一次，熟后自收。</div>' +
        '<div class="xy-seedgrid">' + seeds.map(function(id){
          var cp = SPICES[id].crop;
          return '<button class="xy-seed" data-plant="' + i + ':' + id + '">' +
            '<span class="sn">' + spiceGlyph(id, 18) + SPICES[id].zh + '</span>' +
            '<span class="sd">' + cp.d + '日熟 · 亩收约' + cp.y + '斤 · 苗钱' + fmt(cp.s) + '</span></button>';
        }).join('') + '</div></div>';
    }
    var cp = SPICES[p.crop].crop;
    var left = Math.max(0, p.ready - now);
    var pct = Math.round((cp.d - left) / cp.d * 100);
    return '<div class="xy-plot ' + (left <= 0 ? 'ready' : 'grow') + '">' +
      '<div class="pt"><span class="dot"></span>' + SPICES[p.crop].zh + (left <= 0 ? ' · 已熟' : ' · 生长中') + '</div>' +
      '<div class="pd">' + (left <= 0 ? '可以开镰了，亩收约 ' + cp.y + ' 斤上下' : '第 ' + (cp.d - left) + ' / ' + cp.d + ' 日 · 尚余 ' + left + ' 日') + '</div>' +
      '<div class="xy-bar"><i style="width:' + pct + '%"></i></div>' +
      (left <= 0 ? '<button class="btn primary sm" data-harvest="' + i + '">收获入仓</button>' : '') +
      '</div>';
  }
  function storeHTML(city){
    var st = HX.state.co.store[city] || {};
    var ids = Object.keys(st).filter(function(id){ return st[id] > 0 && !!SPICES[id]; });
    if(!ids.length) return '<div class="hint">仓中空空。收获田里的香药，或往市集买入。</div>';
    return '<div class="xy-grid">' + ids.map(function(id){
      return '<div class="xy-plot"><div class="pt"><span class="dot"></span>' + spiceGlyph(id, 18) + SPICES[id].zh + '</div>' +
        '<div class="pd">存 ' + st[id] + ' 斤 · 本城行价 ' + priceAt(city, id) + ' 分/斤 · 售价 ' + sellPrice(city, id) + ' 分/斤</div></div>';
    }).join('') + '</div>';
  }

  /* ============================================================
     D · VIEW —— 市集：行价、买卖
     ============================================================ */
  function renderMarket(){
    var s = HX.state, owned = ownedCities();
    if(owned.indexOf(mkCity) < 0) mkCity = owned[0];
    var C = CITIES[mkCity], store = s.co.store[mkCity] || {};
    var list = supplyOf(mkCity).concat(Object.keys(store).filter(function(id){ return !canBuy(mkCity, id) && store[id] > 0; }));
    list = list.filter(function(id, i){ return SPICES[id] && list.indexOf(id) === i; });   /* 剔除未知 id（旧档残留） */
    var cm = (s.co.mods || []).filter(function(m){ return m.city === '*' || m.city === mkCity; });
    el('sc-market').innerHTML =
    '<div class="xy-ctabs">' + owned.map(function(c){
      return '<button class="xy-ctab ' + (c === mkCity ? 'on' : '') + '" data-city="' + c + '">' + CITIES[c].name +
        '<span class="st">' + CITIES[c].addr + '</span></button>';
    }).join('') + '</div>' +
    '<div class="card">' +
      '<h2>' + C.name + ' · 市集</h2>' +
      '<div class="hint">' + esc(C.addr) + '前街行栈云集。买入照行价加利，卖出坐扣行用，皆为市面常例。</div>' +
      (cm.length ? '<div class="xy-mods">' + cm.map(function(m){
        return '<span class="xy-mod ' + (m.mul > 1 ? 'xy-up' : 'xy-down') + '">' + esc(m.label) +
          ' · ' + (m.mul > 1 ? '价涨' : '价跌') + Math.round(Math.abs(m.mul - 1) * 100) + '%</span>';
      }).join('') + '</div>' : '') +
      '<div class="sep"></div>' +
      '<div class="xy-mrow head"><div>货品</div><div>本城行情</div><div>购价</div><div>售价</div>' +
        '<div style="text-align:right">本城存</div><div style="text-align:right">买卖</div></div>' +
      (list.length ? list.map(function(id){ return marketRow(id, store, mkCity); }).join('') : '<div class="hint">此城行面暂无货品</div>') +
    '</div>';
    el('sc-market').querySelectorAll('[data-city]').forEach(function(b){
      b.onclick = function(){ mkCity = b.dataset.city; renderMarket(); syncTabs(); };
    });
    el('sc-market').querySelectorAll('.xy-mrow[data-good]').forEach(function(row){
      var id = row.dataset.good, qi = row.querySelector('.xy-qty');
      var read = function(){ var v = parseInt(qi.value, 10); return isNaN(v) ? 0 : v; };
      var bb = row.querySelector('[data-buy]'), sb = row.querySelector('[data-sell]');
      if(bb && !bb.disabled) bb.onclick = function(){ buyGood(mkCity, id, read()); };
      if(sb && !sb.disabled) sb.onclick = function(){ sellGood(mkCity, id, read()); };
    });
  }
  function marketRow(id, store, city){
    var canBuyHere = canBuy(city, id);
    var tag = priceTag(city, id), have = store[id] || 0, sp = SPICES[id];
    return '<div class="xy-mrow" data-good="' + id + '">' +
      '<div class="gname">' + spiceGlyph(id, 20) + sp.zh + (sp.sea ? '<span class="imp">洋货</span>' : '') + '</div>' +
      '<div class="hint" style="font-size:11.5px">行价 <span class="xy-num">' + priceAt(city, id) + '</span> 分 · 较常价 ' +
        '<span class="' + (tag[0] === 'up' ? 'xy-up' : (tag[0] === 'down' ? 'xy-down' : 'hint')) + '">' + tag[1] + '</span></div>' +
      '<div class="xy-num" style="color:var(--seal)">' + (canBuyHere ? buyPrice(city, id) : '—') + '</div>' +
      '<div class="xy-num" style="color:var(--good)">' + sellPrice(city, id) + '</div>' +
      '<div class="xy-num stk" style="text-align:right">' + have + '斤</div>' +
      '<div class="act" style="display:flex;gap:5px;align-items:center;justify-content:flex-end">' +
        '<input class="xy-qty" type="number" min="0" step="10" value="100" aria-label="数量">' +
        '<button class="btn sm ' + (canBuyHere ? 'primary' : 'ghost') + '" data-buy ' + (canBuyHere ? '' : 'disabled') + '>买入</button>' +
        '<button class="btn sm ghost" data-sell ' + (have > 0 ? '' : 'disabled') + '>卖出</button>' +
      '</div></div>';
  }

  /* ============================================================
     D · VIEW —— 商队：发运与在途
     ============================================================ */
  function renderCara(){
    var s = HX.state, owned = ownedCities();
    if(owned.indexOf(caFrom) < 0) caFrom = owned[0];
    if(owned.indexOf(caTo) < 0 || caTo === caFrom) caTo = owned.filter(function(c){ return c !== caFrom; })[0] || caFrom;
    var e = edgeOf(caFrom, caTo), store = s.co.store[caFrom] || {};
    Object.keys(caCargo).forEach(function(id){
      var have = store[id] || 0;
      if(have <= 0) delete caCargo[id];
      else caCargo[id] = Math.min(caCargo[id], have);
    });
    var est = e ? estTrip(caFrom, caTo, caMode, caCargo) : null;
    var canShip = !!(est && est.qty > 0 && est.qty <= est.cap && est.cost <= money());
    el('sc-cara').innerHTML =
    '<div class="card">' +
      '<h2>商队 · 发运</h2>' +
      '<div class="row">' +
        '<label class="hint">起运 <select id="xyFrom" class="xy-qty" style="width:auto">' +
          owned.map(function(c){ return '<option value="' + c + '" ' + (c === caFrom ? 'selected' : '') + '>' + CITIES[c].name + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="hint">到达 <select id="xyTo" class="xy-qty" style="width:auto">' +
          owned.map(function(c){ return '<option value="' + c + '" ' + (c === caTo ? 'selected' : '') + '>' + CITIES[c].name + '</option>'; }).join('') +
        '</select></label>' +
        '<span class="hint">' + (e ? e.name + ' · ' + e.li + ' 里 · ' + (e.water ? '水路，可通民船' : '陆路，驮队与镖车可行') : '两地之间暂无商路') + '</span>' +
      '</div>' +
      (e ? '<div class="xy-modes">' + Object.keys(MODES).map(function(m){
        var M = MODES[m], ok = e.water ? M.water : M.road;
        return '<button class="xy-mode ' + (m === caMode ? 'on' : '') + '" data-mode="' + m + '" ' + (ok ? '' : 'disabled') + '>' +
          '<div class="mn">' + M.name + '</div><div class="md">' + M.desc + '<br/>日行' + M.speed + '里 · 载重' + M.cap + '斤 · 每百斤百里' + M.rate + '分' +
          (M.base ? ' · 使费' + fmt(M.base) : '') + '</div></button>';
      }).join('') + '</div>' : '') +
      '<h3 style="font-family:var(--kai);font-size:14px;letter-spacing:1px;margin:12px 0 7px">货品（自' + esc(CITIES[caFrom].addr) + '起运）</h3>' +
      (Object.keys(store).filter(function(id){ return !!SPICES[id]; }).length ? '<div class="xy-seedgrid">' + Object.keys(store).filter(function(id){ return !!SPICES[id]; }).map(function(id){
        return '<label class="xy-seed" style="cursor:default">' +
          '<span class="sn">' + SPICES[id].zh + '<span class="hint"> · 存 ' + store[id] + ' 斤</span></span>' +
          '<input class="xy-qty" style="width:100%;margin-top:5px" type="number" min="0" max="' + store[id] + '" step="10" value="' +
            (caCargo[id] || 0) + '" data-cg="' + id + '"></label>';
      }).join('') + '</div>' : '<div class="hint">起运城中暂无存货。去市集买入，或先收获田里的香药。</div>') +
      '<div class="xy-est" id="xyEst">' + estHTML(est) + '</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn primary" id="xyDispatch" ' + (canShip ? '' : 'disabled') + '>发运</button>' +
        '<span class="hint">抵埠后方能入分号仓销售；途中或遇劫匪、阻道、关津抽分</span>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>在途商队 · ' + s.co.transit.length + ' 批</h2>' +
      (s.co.transit.length ? s.co.transit.map(transitHTML).join('') : '<div class="hint">眼下没有在路上的人。发一支商队试试。</div>') +
    '</div>';
    var f = el('xyFrom'), t = el('xyTo');
    if(f) f.onchange = function(ev){ caFrom = ev.target.value; caCargo = {}; renderCara(); syncTabs(); };
    if(t) t.onchange = function(ev){ caTo = ev.target.value; renderCara(); syncTabs(); };
    el('sc-cara').querySelectorAll('[data-mode]').forEach(function(b){
      b.onclick = function(){ caMode = b.dataset.mode; renderCara(); syncTabs(); };
    });
    el('sc-cara').querySelectorAll('[data-cg]').forEach(function(inp){
      inp.oninput = function(){ caCargo[inp.dataset.cg] = Math.max(0, parseInt(inp.value, 10) || 0); updateEst(); };
    });
    var db = el('xyDispatch');
    if(db) db.onclick = function(){
      var clean = {};
      Object.keys(caCargo).forEach(function(id){ if(caCargo[id] > 0) clean[id] = caCargo[id]; });
      dispatch(caFrom, caTo, caMode, clean);
      caCargo = {};
    };
  }
  function updateEst(){
    var store = HX.state.co.store[caFrom] || {};
    Object.keys(caCargo).forEach(function(id){
      var have = store[id] || 0;
      caCargo[id] = Math.min(Math.max(0, Math.floor(caCargo[id] || 0)), have);
      if(!caCargo[id]) delete caCargo[id];
    });
    var est = estTrip(caFrom, caTo, caMode, caCargo);
    var box = el('xyEst');
    if(box) box.innerHTML = estHTML(est);
    var btn = el('xyDispatch');
    if(btn) btn.disabled = !(est && est.qty > 0 && est.qty <= est.cap && est.cost <= money());
  }
  function estHTML(est){
    if(!est) return '<span class="hint">此地之间不通此路</span>';
    return '<div class="kv">' +
      '<span>商路 <b>' + est.route + '</b></span>' +
      '<span>里程 <b class="xy-num">' + est.li + '</b> 里</span>' +
      '<span>日程 <b class="xy-num">' + est.days + '</b> 日</span>' +
      '<span>运费 <b class="xy-num">' + fmt(est.cost) + '</b></span>' +
      '<span>途中风险 <b class="xy-num">' + est.riskPct.toFixed(1) + '%</b></span>' +
      '<span>载重 <b class="xy-num">' + est.qty + '</b> / ' + est.cap + ' 斤</span>' +
      '<span>预计抵达 <b>' + absToText(abs() + est.days) + '</b></span></div>';
  }
  function transitHTML(t){
    var now = abs(), total = Math.max(1, t.arrive - t.depart);
    var pct = Math.round(Math.min(total, Math.max(0, now - t.depart)) / total * 100);
    var cargo = Object.keys(t.cargo).map(function(id){ return SPICES[id].zh + ' ' + t.cargo[id] + '斤'; }).join('、') || '（货已失尽）';
    var fired = t.inc.filter(function(i){ return i.fired; }).length;
    return '<div class="xy-transit">' +
      '<div class="th"><span>' + CITIES[t.from].name + ' → ' + CITIES[t.to].name + '</span>' +
        '<span class="xy-mod" style="color:var(--seal);border-color:rgba(162,62,43,.45)">' + MODES[t.mode].name + '</span>' +
        '<span class="hint">' + esc(t.route) + '</span><span class="xy-spacer"></span>' +
        '<span class="hint">约 ' + absToText(t.arrive) + ' 抵埠</span></div>' +
      '<div class="tb">载：' + cargo + (fired ? ' · <span style="color:var(--bad)">途中变故 ' + fired + ' 起，详见大事记</span>' : '') + '</div>' +
      '<div class="xy-bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div></div>';
  }

  /* ============================================================
     D · VIEW —— 铺面：分号与田产
     ============================================================ */
  function renderShop(){
    var s = HX.state;
    el('sc-shop').innerHTML = CITY_IDS.map(function(c){
      var C = CITIES[c], owned = !!s.co.shops[c], plots = (s.co.plots[c] || []).length;
      var fameOk = !C.fame || s.co.fame >= C.fame;
      return '<div class="card">' +
        '<h2>' + C.name + ' · ' + esc(C.addr) + '</h2>' +
        '<div class="row" style="font-size:12.5px">' +
          '<span class="xy-chip">' + C.tag + '</span>' +
          '<span class="xy-chip">' + C.region + '</span>' +
          (owned ? '<span class="xy-chip" style="color:var(--seal)">已设分号</span>' : '<span class="xy-chip">未设分号</span>') +
          (owned ? '<span class="xy-chip">田产 <b>' + plots + '</b> / ' + C.maxPlots + ' 块</span>' : '') +
        '</div>' +
        '<div class="hint" style="margin-top:8px">' + esc(C.intro) + '</div>' +
        '<div class="hint">田庄：' + esc(C.land) + '　土宜：' +
          supplyOf(c).filter(function(id){ return canFarm(c, id); }).map(function(id){ return SPICES[id].zh; }).join('、') +
        (supplyOf(c).some(function(id){ return isSea(id); }) ? '　洋货：' + supplyOf(c).filter(isSea).map(function(id){ return SPICES[id].zh; }).join('、') : '') +
        '</div>' +
        '<div class="row" style="margin-top:9px">' +
          (owned
            ? '<button class="btn sm" data-plot="' + c + '" ' + (plots >= C.maxPlots || money() < C.plotCost ? 'disabled' : '') + '>购田一块（' + fmt(C.plotCost) + '）</button>' +
              '<button class="btn sm ghost" data-market="' + c + '">去市集</button>' +
              '<button class="btn sm ghost" data-farm="' + c + '">去田亩</button>'
            : '<button class="btn sm primary" data-open="' + c + '" ' + (money() < C.open || !fameOk ? 'disabled' : '') + '>开设分号（' + fmt(C.open) +
              (C.fame ? ' · 需声望 ' + C.fame : '') + '）</button>' +
              (C.fame && !fameOk ? '<span class="hint">粤中行商引荐，需声望 ' + C.fame + '（现 ' + s.co.fame + '）</span>' : '')) +
        '</div></div>';
    }).join('');
    el('sc-shop').querySelectorAll('[data-open]').forEach(function(b){ b.onclick = function(){ openShop(b.dataset.open); }; });
    el('sc-shop').querySelectorAll('[data-plot]').forEach(function(b){ b.onclick = function(){ buyPlot(b.dataset.plot); }; });
    el('sc-shop').querySelectorAll('[data-market]').forEach(function(b){ b.onclick = function(){ mkCity = b.dataset.market; goInside('market'); }; });
    el('sc-shop').querySelectorAll('[data-farm]').forEach(function(b){ b.onclick = function(){ fmCity = b.dataset.farm; goInside('farm'); }; });
  }

  /* ============================================================
     D · VIEW —— 编年：朝野大事（史笔如铁，年月一到必发）
     ============================================================ */
  function renderAnnals(){
    var now = abs(), lastSeen = -1;
    var rows = HISTORY.map(function(h, i){
      var seen = CO.histSeen.indexOf(h.id) >= 0;
      if(seen) lastSeen = i;
      var ym = absToYearMonth(h.at);
      if(!seen) return '<div class="xy-tl yet"><summary><span class="y">' + ym + '</span><span class="t">' + esc(h.title) +
        '</span><span class="tag">史载有期</span></summary></div>';
      return '<details class="xy-tl" ' + (i === lastSeen ? 'open' : '') + '><summary><span class="y">' + ym + '</span>' +
        '<span class="t">' + esc(h.title) + '</span><span class="tag">' + esc(h.cat) + '</span></summary><p>' + esc(h.text) + '</p></details>';
    });
    var cursor = 0;
    for(var i = 0; i < HISTORY.length; i++){ if(CO.histSeen.indexOf(HISTORY[i].id) < 0){ cursor = i; break; } if(i === HISTORY.length - 1) cursor = HISTORY.length; }
    rows.splice(cursor, 0, '<div class="xy-now"><span class="y">今上起居</span><span>' + dateText() + '</span></div>');
    el('sc-annals').innerHTML =
    '<div class="card">' +
      '<h2>编年 · 朝野大事</h2>' +
      '<div class="hint">史笔如铁，年月一到，大事必发。已至者展阅其详与市价之变；未至者，标题即是先机——' +
        '南巡、万寿、海疆多事之秋，皆可预为囤运之计。</div>' +
      '<div class="sep"></div>' + rows.join('') +
    '</div>' +
    '<div class="card flat">' +
      '<h2>号中大事记</h2>' +
      ((CO.log || []).length ? CO.log.slice(-20).reverse().map(function(l){
        return '<div class="log-item"><b>' + esc(l.d) + '</b>' + (l.cat ? '<span class="hint">[' + esc(l.cat) + ']</span> ' : '') +
          esc(l.fr) + ' · ' + esc(l.text) + '</div>';
      }).join('') : '<div class="hint">尚无纪事。</div>') +
    '</div>';
  }

  /* ============================================================
     D · VIEW —— 成就：香道 + 商道 总录
     ============================================================ */
  function renderAch(){
    var s = HX.state;
    var list = (HX.ACHIEVEMENTS || []).map(function(a){ return { a:a, side:'香道' }; })
      .concat(ACH_EXTRA.map(function(a){ return { a:a, side:'商道' }; }));
    var got = list.filter(function(x){ return s.ach[x.a.id]; });
    var rest = list.filter(function(x){ return !s.ach[x.a.id]; });
    var rewardOf = function(a){ return HX.rewardText ? HX.rewardText(a) : rewardLine(a.reward); };
    var item = function(x, on){
      var a = x.a;
      return '<div class="xy-plot" style="' + (on ? '' : 'opacity:.72') + '">' +
        '<div class="pt"><span class="dot" style="background:' + (on ? 'var(--seal)' : 'var(--muted)') + '"></span>' +
          (on ? '❖ ' : '○ ') + esc(a.name) + '<span class="hint" style="font-size:10.5px">' + x.side + '</span></div>' +
        '<div class="pd">' + esc(a.desc) + '</div>' +
        '<div class="hint" style="color:' + (on ? 'var(--seal)' : 'var(--muted)') + '">' +
          (on ? '已得 ' : '奖励 ') + esc(rewardOf(a)) + '</div></div>';
    };
    el('sc-ach').innerHTML =
    '<div class="card">' +
      '<h2>成就 · ' + got.length + ' / ' + list.length + '</h2>' +
      '<div class="xy-bar"><i style="width:' + Math.round(got.length / list.length * 100) + '%"></i></div>' +
      '<div class="hint">香道成就出于识草、种药、合香、读经、答题；商道成就出于置产、发运、开号、逢典。' +
        '达成即弹「成就达成」之报，赏银、赏声望、赏种子不等。</div>' +
      '<div class="hint" style="margin-top:6px">当前：识 ' + Object.keys(s.known).filter(function(k){ return s.known[k]; }).length +
        ' 味 · 合香 ' + (s.stats.blends || 0) + ' 次 · 分号 ' + ownedCities().length + ' 处 · 行程 ' + (s.co.trips || 0) +
        ' 次 · 声望 ' + (s.co.fame || 0) + '</div>' +
      '<div class="sep"></div>' +
      '<div class="xy-grid">' + got.map(function(x){ return item(x, true); }).join('') +
        rest.map(function(x){ return item(x, false); }).join('') + '</div>' +
    '</div>';
  }

  /* ============================================================
     F · API —— 与香道层对接：数据注入 / 状态树迁移 / 挂载
     ============================================================ */
  function ensureCo(s){
    if(!s.co) s.co = {};
    var d = s.co;
    if(!d.shops || !d.shops.xian) d.shops = Object.assign({ xian:true }, d.shops || {});
    if(!d.plots) d.plots = {};
    if(!d.store) d.store = {};
    if(!d.price) d.price = {};
    CITY_IDS.forEach(function(c){
      if(!Array.isArray(d.plots[c])) d.plots[c] = (c === 'xian' && !d.started) ? [{ crop:null, ready:0 }, { crop:null, ready:0 }] : [];
      if(!d.store[c]) d.store[c] = {};
      if(!d.price[c]) d.price[c] = {};
    });
    if(!Array.isArray(d.transit)) d.transit = [];
    if(!Array.isArray(d.mods)) d.mods = [];
    if(!Array.isArray(d.log)) d.log = [];
    if(!Array.isArray(d.histSeen)) d.histSeen = ['siku_open'];
    if(typeof d.seq !== 'number') d.seq = 1;
    if(typeof d.fame !== 'number') d.fame = 0;
    if(typeof d.trips !== 'number') d.trips = 0;
    if(typeof d.infl !== 'number') d.infl = 1;
    if(typeof d.lastEv !== 'number') d.lastEv = 0;
    if(typeof d.harvested !== 'number') d.harvested = 0;
    if(typeof d.bizInit !== 'number') d.bizInit = 0;
    /* 新档／旧香道存档：补足开业本钱（四百两），只补一次 */
    if(!d.bizInit){ d.bizInit = 1; s.money = Math.max(s.money, 40000); }
    /* 香料谱扩充后：补足种子/识得/存货/品质诸表 */
    Object.keys(SPICES).forEach(function(id){
      if(s.seeds[id] == null) s.seeds[id] = 0;
      if(s.known[id] == null) s.known[id] = false;
      if(s.inventory[id] == null) s.inventory[id] = 0;
    });
    /* 商道层新增香方：在香道层订单表里建条目（缺则香室渲染会取不到 .done） */
    if(!s.orders) s.orders = {};
    Object.keys(ORDERS_EXTRA).forEach(function(k){
      if(!s.orders[k]) s.orders[k] = { done:0 };
    });
    initPrices(s);
    CO = d;
  }
  function injectData(){
    Object.keys(SPICES).forEach(function(id){
      var sp = SPICES[id], a = assetOf(id);
      if(!HX.HERBS[id]){
        HX.HERBS[id] = { name:sp.zh, efficacy:sp.eff, potency:sp.pot, zone:sp.zone, aroma:sp.aroma,
          model:a.model ? id : null, modelPath:a.model, cat:sp.cat, tier:sp.tier,
          farm:sp.farm || [], sea:!!sp.sea, buy:sp.buy || null, use:sp.use, note:sp.note, assetStatus:a.status };
      }
      var h = HX.HERBS[id];
      h.cat = sp.cat; h.tier = sp.tier; h.farm = sp.farm || []; h.sea = !!sp.sea;
      h.use = sp.use; h.note = sp.note; h.assetStatus = a.status;
      if(a.model) h.modelPath = a.model;
      if(HX.HERB_BASE && HX.HERB_BASE[id] == null) HX.HERB_BASE[id] = sp.pv;
      if(!HX.CODEX[id]) HX.CODEX[id] = PROSE[id] || fallbackProse(id);
    });
    Object.keys(ORDERS_EXTRA).forEach(function(k){ if(!HX.ORDERS[k]) HX.ORDERS[k] = ORDERS_EXTRA[k]; });
    CARDS_EXTRA.forEach(function(c){
      var has = (HX.ANCIENT_CARDS || []).some(function(x){ return x.id === c.id; });
      if(!has) HX.ANCIENT_CARDS.push(c);
    });
  }
  function registerScreens(){
    SCREEN_IDS.forEach(function(id){
      if(HX.SCREENS.indexOf(id) < 0) HX.SCREENS.push(id);
      var h = '#/' + HASH_NAME[id];
      HX.HASH_OF[id] = h;
      HX.SCREEN_OF[h] = id;
    });
  }
  /* ============================================================
     F · API —— 扩展点：香料 / 屏 / 成就 / 每日钩子 / 事件 / 素材
     均可运行时调用，不必改动本文件
     ============================================================ */
  var DAILY_TICKS = [];
  var EXT_SCREENS = {};
  function registerSpice(id, d){
    if(!id || !d || !d.zh) return;
    SPICES[id] = Object.assign({ cat:'土产', tier:2, aroma:{辛:5,苦:3,甘:3,温:5,凉:2,香:8}, pot:0.9,
      zone:'干燥', eff:['辟秽'], farm:[], base:20, pv:8, use:'合香配伍', note:'' }, d);
    if(d.asset && d.asset.model) ASSETS[id] = d.asset;
    else if(d.asset && d.asset.image) ASSET_PENDING[id] = { image:d.asset.image };
    if(d.prose && root.SPICE_PROSE) root.SPICE_PROSE[id] = d.prose;
    if(HX && HX.state){ PROSE[id] = proseOf(id) || null; injectData(); ensureCo(HX.state); }
  }
  function registerScreen(id, name, renderFn, hash){
    if(!id || EXT_SCREENS[id]) return;
    EXT_SCREENS[id] = renderFn || function(){};
    SCREEN_IDS.push(id);
    TABS.push({ id:id, name:name || id, group:'' });
    if(HX && HX.state){
      if(HX.SCREENS.indexOf(id) < 0) HX.SCREENS.push(id);
      var h = '#/' + (hash || id);
      HX.HASH_OF[id] = h; HX.SCREEN_OF[h] = id;
      buildChrome();
    }
  }
  function registerAchievement(a){ if(a && a.id) ACH_EXTRA.push(a); }
  function registerDailyTick(fn){ if(typeof fn === 'function') DAILY_TICKS.push(fn); }
  function registerEventHandler(e){ if(e && e.run) EVENTS.push(e); }
  function registerAsset(id, a){
    if(!a) return;
    if(a.model) ASSETS[id] = { model:a.model, image:a.image || null };
    else if(a.image) ASSET_PENDING[id] = { image:a.image };
    if(HX && HX.state && HX.HERBS[id]){
      var h = HX.HERBS[id], st = assetOf(id);
      h.assetStatus = st.status;
      if(st.model){ h.model = id; h.modelPath = st.model; }
    }
  }

  function mount(bridge){
    HX = bridge;
    try{
      CO = HX.state.co || null;
      /* 词条：外部数据文件优先，缺者兜底 */
      Object.keys(SPICES).forEach(function(id){ PROSE[id] = proseOf(id) || null; });
      ensureCo(HX.state);
      injectData();
      registerScreens();
      buildChrome();
      HX.XiangYe = root.XiangYe;
      HX.save();
      syncTabs();
      if(SCREEN_IDS.indexOf(HX.state.screen) >= 0) renderScreen(HX.state.screen);
    }catch(e){
      /* 商道层异常不拖垮香道层：留痕、提示，香道六屏照常可玩 */
      try{ console.error('[XiangYe] mount 失败：', e); }catch(e2){}
      try{ HX.toast('商道层载入异常，香道诸屏不受影响'); }catch(e3){}
    }
  }

  /* ============================================================ */
  root.XiangYe = {
    /* 数据 */
    CITIES:CITIES, CITY_IDS:CITY_IDS, EDGES:EDGES, MODES:MODES, SPICES:SPICES, EVENTS:EVENTS,
    HISTORY:HISTORY, GOALS:GOALS, ACH_EXTRA:ACH_EXTRA, ORDERS_EXTRA:ORDERS_EXTRA,
    CARDS_EXTRA:CARDS_EXTRA, ASSETS:ASSETS, ASSET_PENDING:ASSET_PENDING,
    /* 核心 */
    abs:abs, calOf:calOf, dateText:dateText, absToText:absToText, absToYearMonth:absToYearMonth,
    eraText:eraText, cnNum:cnNum, MONTHS:MONTHS, fmt:fmt, fmtShort:fmtShort, HQ:HQ,
    drain:drain, push:push, pop:pop, showAch:showAch, playSfx:playSfx, checkAch:checkAch,
    /* 系统 */
    tick:tick, commitDays:commitDays, plantCrop:plantCrop, harvest:harvest, buyPlot:buyPlot,
    openShop:openShop, buyGood:buyGood, sellGood:sellGood, estTrip:estTrip, dispatch:dispatch,
    cargoValue:cargoValue, ownedCities:ownedCities, shipModes:MODES,
    priceS:{ anchorOf:anchorOf, curAnchor:curAnchor, priceAt:priceAt, buyPrice:buyPrice, sellPrice:sellPrice,
             priceTag:priceTag, driftPrices:driftPrices, reshapePrice:reshapePrice, addMod:addMod,
             initPrices:initPrices, freightNow:freightNow, riskNow:riskNow, yieldNow:yieldNow,
             supplyOf:supplyOf, canFarm:canFarm, canBuy:canBuy, isSea:isSea, ownedCities:ownedCities, edgeOf:edgeOf }
    /*PART2*/
    ,assetOf:assetOf, registerAsset:registerAsset, spiceOf:spiceOf, spiceIcon:spiceIcon, spiceGlyph:spiceGlyph,
    modelPathOf:modelPathOf, supplyOf:supplyOf, SCREEN_IDS:SCREEN_IDS, TABS:TABS,
    renderScreen:renderScreen, syncTabs:syncTabs, mount:mount, PROSE:PROSE,
    /* F · 扩展点 */
    registerSpice:registerSpice, registerScreen:registerScreen, registerAchievement:registerAchievement,
    registerDailyTick:registerDailyTick, registerEventHandler:registerEventHandler
  };
})(window);