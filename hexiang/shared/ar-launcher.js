/* ============================================================
   香料科普游戏 · 多浏览器 AR 启动器
   从 香料3D展示/aicao/index.html 第 447–637 行移植，改为可配置模块。
   调用：window.initSpiceAR({ viewer, els:{...}, primary, usdz, toast, restoreShadow })
   依赖页面提供 #camAR / #arSheet 等节点，样式由游戏页负责。
   ============================================================ */
(function (global) {
  'use strict';

  function uaStr() { return navigator.userAgent || ''; }
  function isIOSUA(ua) { return /iPhone|iPad|iPod/i.test(ua); }
  function isAndroidUA(ua) { return /Android/i.test(ua); }
  function isMobileUA(ua) { return isIOSUA(ua) || isAndroidUA(ua); }
  function isWeChatUA(ua) { return /MicroMessenger/i.test(ua); }
  function isIOSSafari(ua) {
    if (!isIOSUA(ua)) { return false; }
    return /Safari/i.test(ua) && !/(CriOS|EdgiOS|FxiOS|MicroMessenger|MQQBrowser|UCBrowser|Quark|baidubrowser|BIDUBrowser|HeyTapBrowser|MiuiBrowser|HuaweiBrowser|VivoBrowser)/i.test(ua);
  }
  function browserName(ua) {
    var m = [
      [/MicroMessenger/i, '微信内置浏览器'],
      [/MQQBrowser/i, 'QQ 浏览器'],
      [/Quark/i, '夸克浏览器'],
      [/baidubrowser|BIDUBrowser/i, '百度浏览器'],
      [/UCBrowser|UBrowser/i, 'UC 浏览器'],
      [/360 Aroha|QihooBrowser/i, '360 浏览器'],
      [/VivoBrowser/i, 'vivo 浏览器'],
      [/HeyTapBrowser/i, 'OPPO 浏览器'],
      [/MiuiBrowser/i, '小米浏览器'],
      [/HonorBrowser/i, '荣耀浏览器'],
      [/HuaweiBrowser/i, '华为浏览器'],
      [/SamsungBrowser/i, '三星浏览器'],
      [/EdgA|Edg/i, 'Edge 浏览器'],
      [/Firefox|FxiOS/i, 'Firefox 浏览器'],
      [/iPhone|iPad|iPod/i, 'Safari 浏览器'],
      [/CriOS|Chrome/i, 'Chrome 浏览器']
    ];
    for (var i = 0; i < m.length; i++) { if (m[i][0].test(ua)) { return m[i][1]; } }
    return '系统自带浏览器';
  }

  function initSpiceAR(cfg) {
    var viewer = cfg.viewer;
    var els = cfg.els || {};
    var toast = cfg.toast || function () {};
    var restoreShadow = cfg.restoreShadow || '0.35';
    var primary = cfg.primary;
    var usdz = cfg.usdz;

    var btnAR = els.btnAR, arSheet = els.arSheet, arBrowserEl = els.arBrowser;
    var arLaunch = els.arLaunch, arAdvice = els.arAdvice, arCopy = els.arCopy;
    var arClose = els.arClose, arSceneBtn = els.arScene;
    var camAR = els.camAR, camVideo = els.camVideo, camStage = els.camStage, camExit = els.camExit;
    var hostEl = els.host; // 摄像头模式下把 viewer 移到哪个容器

    var camStream = null;
    var sheetMode = 'cam';
    var webxrOK = false;

    function checkWebXR() {
      if (navigator.xr && navigator.xr.isSessionSupported) {
        return navigator.xr.isSessionSupported('immersive-ar')
          .then(function (ok) { webxrOK = !!ok; })
          .catch(function () { webxrOK = false; });
      }
      return Promise.resolve();
    }

    function openSheet(mode) {
      var ua = uaStr();
      sheetMode = mode;
      arBrowserEl.textContent = '当前环境 · ' + browserName(ua);
      arLaunch.style.display = '';
      arSceneBtn.style.display = 'none';
      if (mode === 'wechat') {
        arLaunch.textContent = '启动实景模式（摄像头）';
        arAdvice.innerHTML = '将调用手机<b>后置摄像头</b>，把香草标本叠加在真实环境中查看，无需谷歌服务。<br/>请在弹窗中<b>允许使用摄像头</b>；若被微信拦截，请点右上角 <b>···</b> →「在浏览器打开」。';
      } else if (mode === 'iosother') {
        arLaunch.textContent = '启动实景模式（摄像头）';
        arAdvice.innerHTML = '将调用后置摄像头叠加显示标本。<br/>如需真正的平面 AR，请用 <b>Safari</b> 打开本页。';
      } else if (mode === 'webxr') {
        arLaunch.textContent = '启动 AR 真景';
        arAdvice.innerHTML = '你的浏览器支持网页 AR（ARCore），将进入摄像头实景并把标本<b>放置在平面上</b>。';
      } else if (mode === 'camfail') {
        arLaunch.textContent = '重试实景模式';
        arAdvice.innerHTML = '摄像头启动失败。请确认已授予摄像头权限，或改用系统 Chrome 浏览器打开。';
      } else {
        arLaunch.textContent = '启动实景模式（摄像头）';
        arAdvice.innerHTML = '无需谷歌服务：调用<b>后置摄像头</b>，把标本叠加在真实环境中，双指缩放、拖动旋转。<br/>说明：这是摄像头实景模式，模型不会自动锚定地面。';
        arSceneBtn.style.display = '';
      }
      arSheet.hidden = false;
    }
    function closeSheet() { arSheet.hidden = true; }

    function moveViewerToCam() {
      viewer.setAttribute('shadow-intensity', '0');
      camStage.appendChild(viewer);
    }
    function restoreViewer() {
      viewer.setAttribute('shadow-intensity', restoreShadow);
      if (hostEl && viewer.parentNode !== hostEl) { hostEl.appendChild(viewer); }
    }
    function stopCam() {
      if (camStream) {
        camStream.getTracks().forEach(function (t) { t.stop(); });
        camStream = null;
      }
      try { camVideo.pause(); } catch (e) {}
      camVideo.srcObject = null;
    }
    function exitCamMode() {
      camAR.hidden = true;
      stopCam();
      restoreViewer();
    }
    function camDenied(msg) {
      exitCamMode();
      toast(msg);
      openSheet(isWeChatUA(uaStr()) ? 'wechat' : 'camfail');
    }
    function enterCamMode() {
      arSheet.hidden = true;
      camAR.hidden = false;
      moveViewerToCam();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        camDenied('当前浏览器不支持调用摄像头');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
        .then(function (stream) {
          camStream = stream;
          camVideo.srcObject = stream;
          var pr = camVideo.play();
          if (pr && pr.catch) { pr.catch(function () {}); }
        })
        .catch(function (err) {
          var name = err && (err.name || '');
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            camDenied('摄像头权限被拒绝，请在浏览器设置中允许后重试');
          } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            camDenied('未检测到可用摄像头');
          } else {
            camDenied('无法启动摄像头（' + name + '）');
          }
        });
    }

    function launchSceneViewer() {
      var modelUrl = encodeURIComponent(new URL(primary, location.href).href);
      var fallback = encodeURIComponent(location.href.split('#')[0] + '#arfb=1');
      var intent = 'intent://arvr.google.com/scene-viewer/1.0?file=' + modelUrl +
        '&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;' +
        'action=android.intent.action.VIEW;S.browser_fallback_url=' + fallback + ';end';
      location.href = intent;
    }

    if (camExit) { camExit.addEventListener('click', exitCamMode); }

    if (btnAR) {
      btnAR.addEventListener('click', function () {
        var ua = uaStr();
        if (isIOSUA(ua)) {
          if (isIOSSafari(ua)) { location.href = usdz; return; }
          openSheet('iosother'); return;
        }
        if (webxrOK) { openSheet('webxr'); return; }
        openSheet(isWeChatUA(ua) ? 'wechat' : 'cam');
      });
    }

    if (arLaunch) {
      arLaunch.addEventListener('click', function () {
        if (sheetMode === 'webxr') {
          arSheet.hidden = true;
          try { viewer.activateAR(); return; } catch (e) {}
        }
        enterCamMode();
      });
    }
    if (arSceneBtn) {
      arSceneBtn.addEventListener('click', function () { arSheet.hidden = true; launchSceneViewer(); });
    }
    if (arClose) { arClose.addEventListener('click', closeSheet); }
    if (arSheet) {
      arSheet.addEventListener('click', function (e) { if (e.target === arSheet) { closeSheet(); } });
    }
    if (arCopy) {
      arCopy.addEventListener('click', function () {
        var t = location.href.split('#')[0];
        function ok() { toast('链接已复制，粘贴到 Chrome 浏览器打开'); }
        function fail() {
          var ta = document.createElement('textarea');
          ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); ok(); } catch (e) { toast('请手动复制地址栏链接'); }
          document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(ok, fail);
        } else { fail(); }
      });
    }

    var uaInit = uaStr();
    if (isMobileUA(uaInit) && btnAR) { btnAR.hidden = false; checkWebXR(); }

    if (location.hash.indexOf('arfb=') === 1) {
      setTimeout(function () {
        toast('谷歌 AR 组件不可用，已切换为摄像头实景模式');
        openSheet(isWeChatUA(uaStr()) ? 'wechat' : 'cam');
      }, 400);
    }

    if (viewer) {
      viewer.addEventListener('ar-status', function (e) {
        var s = e.detail && e.detail.status;
        if (s === 'session-started') { toast('AR 已启动，移动手机寻找平面'); }
        if (s === 'object-placed') { toast('标本已放置，可走动观察'); }
      });
    }

    return {
      isMobile: isMobileUA(uaInit),
      browserName: browserName(uaInit),
      exitCamMode: exitCamMode,
      openSheet: openSheet
    };
  }

  global.initSpiceAR = initSpiceAR;
})(window);
