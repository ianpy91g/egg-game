/* 捏蛋大挑戰（網頁版）— 頁面啟動：畫面縮放、觸控、Web Bluetooth 握力球、存檔。 */
(function () {
  'use strict';
  var SERVICE = '0000ffb0-0000-1000-8000-00805f9b34fb';
  var FORCE_CHAR = '0000ffb2-0000-1000-8000-00805f9b34fb';
  var W = EggGame.W, H = EggGame.H;
  var canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  var scale = 1, dpr = 1;

  var grip = { force: 0, rising: false, connected: false, status: '' };
  var bt = !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  grip.status = bt ? '尚未連接握力球　·　沒有握力球時按住畫面也能玩'
                   : '這個瀏覽器不支援藍牙（iPad 請用 Bluefy 開啟）　·　按住畫面也能玩';

  var storage = {
    get: function () { try { return localStorage.getItem('eggGame.v1'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem('eggGame.v1', v); } catch (e) { } }
  };

  // ---------- 握力球（Web Bluetooth） ----------
  var device = null, retryTimer = null;
  function parse(dv) {
    var s = '';
    for (var i = 0; i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(i));
    s = s.trim();
    // 格式："19" + 方向(1=用力/0=放鬆) + 握力值，例如 "19128.0"
    if (s.length < 4 || s.slice(0, 2) !== '19') return;
    var v = parseFloat(s.slice(3));
    if (!isNaN(v)) { grip.rising = s.charAt(2) === '1'; grip.force = v; }
  }
  function attach(dev) {
    grip.status = '連線中…';
    return dev.gatt.connect()
      .then(function (server) { return server.getPrimaryService(SERVICE); })
      .then(function (svc) { return svc.getCharacteristic(FORCE_CHAR); })
      .then(function (ch) {
        ch.addEventListener('characteristicvaluechanged', function (e) { parse(e.target.value); });
        return ch.startNotifications();
      })
      .then(function () {
        grip.connected = true;
        grip.status = '已連線 ' + (dev.name || '握力球');
      });
  }
  function reconnect() {
    clearTimeout(retryTimer);
    if (!device) return;
    attach(device).catch(function () {
      grip.status = '握力球斷線，重新連線中…（捏一下喚醒它）';
      retryTimer = setTimeout(reconnect, 3000);
    });
  }
  function connectGrip(showAll) {   // 必須在使用者觸碰的事件裡呼叫
    if (!bt) { grip.status = '這個瀏覽器不支援藍牙：iPad 請安裝 Bluefy 並用它開啟本網址'; return; }
    if (grip.connected) return;
    grip.status = '請在跳出的清單選擇 weixin- 開頭的握力球…';
    // 名稱 或 廣播中的服務代碼 任一符合就列出；showAll 時完全不篩選
    var opts = showAll ? { acceptAllDevices: true, optionalServices: [SERVICE] }
                       : { filters: [{ namePrefix: 'weixin' }, { services: [SERVICE] }], optionalServices: [SERVICE] };
    navigator.bluetooth.requestDevice(opts)
      .then(function (dev) {
        device = dev;
        dev.addEventListener('gattserverdisconnected', function () {
          grip.connected = false; grip.force = 0;
          grip.status = '握力球斷線，重新連線中…（捏一下喚醒它）';
          retryTimer = setTimeout(reconnect, 1500);
        });
        return attach(dev);
      })
      .catch(function (e) {
        var why = e ? (e.name || '') + ' ' + (e.message || e) : '未知錯誤';
        grip.status = e && e.name === 'NotFoundError'
          ? '沒有選到握力球（' + why + '）：捏一下喚醒它，或按「列出所有裝置」'
          : '連線失敗：' + why;
      });
  }

  var game = new EggGame.Game({ grip: grip, storage: storage, audio: null, connectGrip: connectGrip, bluetoothSupported: bt });

  // ---------- 音效：iOS 要在第一次觸碰時建立 ----------
  var audioReady = false;
  function unlockAudio() {
    if (audioReady) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ac = new AC();
      var b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
      s.buffer = b; s.connect(ac.destination); s.start(0);
      if (ac.resume) ac.resume();
      game.setAudio(ac);
      audioReady = true;
    } catch (e) { }
  }

  // ---------- 畫面縮放（等比例，文字依實際解析度繪製所以清晰） ----------
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H);
    dpr = window.devicePixelRatio || 1;
    var cw = Math.round(W * scale), ch = Math.round(H * scale);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.style.marginLeft = (-cw / 2) + 'px'; canvas.style.marginTop = (-ch / 2) + 'px';
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    document.getElementById('rotate').style.display = vh > vw * 1.1 && !resize.dismissed ? 'flex' : 'none';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 300); });
  document.getElementById('rotate').addEventListener('click', function () { resize.dismissed = true; resize(); });
  resize();

  function toLogical(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  }

  // ---------- 觸控：遊戲中按住畫面＝握住；其他畫面點按鈕 ----------
  var holdTouches = {};
  function updateHeld() { game.held = Object.keys(holdTouches).length > 0; }
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    unlockAudio();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = toLogical(t.clientX, t.clientY);
      if (game.pointerInPlayArea(p.x, p.y)) holdTouches[t.identifier] = true;
    }
    updateHeld();
  }, { passive: false });
  function touchEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = toLogical(t.clientX, t.clientY);
      if (holdTouches[t.identifier]) delete holdTouches[t.identifier];
      else if (e.type === 'touchend') game.tap(p.x, p.y);   // 觸控事件本身就算使用者手勢，可以在這裡要求藍牙
    }
    updateHeld();
  }
  canvas.addEventListener('touchend', touchEnd, { passive: false });
  canvas.addEventListener('touchcancel', touchEnd, { passive: false });

  // 滑鼠（電腦上測試用）
  var mouseHold = false;
  canvas.addEventListener('mousedown', function (e) {
    unlockAudio();
    var p = toLogical(e.clientX, e.clientY);
    if (game.pointerInPlayArea(p.x, p.y)) { mouseHold = true; game.held = true; }
  });
  window.addEventListener('mouseup', function (e) {
    if (mouseHold) { mouseHold = false; game.held = false; return; }
    if (e.target === canvas) { var p = toLogical(e.clientX, e.clientY); game.tap(p.x, p.y); }
  });
  window.addEventListener('keydown', function (e) {
    unlockAudio();
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) game.key(e.code, true);
  });
  window.addEventListener('keyup', function (e) { game.key(e.code, false); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });   // 防止雙指縮放

  // ---------- 主迴圈 ----------
  var last = 0;
  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
    last = t;
    game.update(dt);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    game.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
