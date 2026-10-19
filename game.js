/* 捏蛋大挑戰（網頁版）— 遊戲本體。
 * 不直接碰 DOM：由 index.html 提供 env（畫布 ctx、存檔、音效、握力球），所以也能在 Node 裡測試。
 * 為了 iPad iOS 12（Bluefy 瀏覽器）相容：不用 ?. ?? 、class 欄位、Array.at、roundRect 等新語法。
 * 邏輯座標固定 960x540，由 index.html 等比例縮放。
 */
(function (root) {
  'use strict';

  var VERSION = '2026.10.19-15';   // 每次發佈都改，選單右下角會顯示，方便確認拿到的是不是最新版
  var W = 960, H = 540, GROUND_Y = 450, EGG_X = 400;
  // 三種難度：握力門檻倍率、要撐住幾秒、每關幾次機會
  var MODES = {
    // color：文字顏色；fill / ink：難度按鈕的底色與字色（兒童綠、一般橘黃、困難紅）
    kids:   { label: '兒童模式', short: '兒童', ratio: 0.6,  hold: 0.5, attempts: 5, color: [96, 220, 150], fill: [40, 160, 95], ink: [255, 255, 255] },
    normal: { label: '一般模式', short: '一般', ratio: 1.0,  hold: 0.5, attempts: 5, color: [255, 190, 70], fill: [240, 165, 40], ink: [40, 26, 10] },
    hard:   { label: '困難模式', short: '困難', ratio: 1.25, hold: 0.5, attempts: 5, color: [255, 90, 90], fill: [215, 55, 60], ink: [255, 255, 255] }
  };
  var MODE_ORDER = ['kids', 'normal', 'hard'];
  var CONTACT_FORCE = 3.0;   // 握力到這個值蛋才開始變形
  var START_FORCE = 3.0;     // 超過這個值開始算一次捏
  var RELEASE_FORCE = 1.5;   // 低於這個值算完全放開
  var CONFIRM_FORCE = 5.0;   // 選單/結算畫面「捏一下＝下一步」所需的握力
  var CONFIRM_DELAY = 0.8;   // 畫面出現多久之後才接受捏一下
  var FONT = '"PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

  var TEXT = [240, 238, 245], DIM = [150, 146, 165], GOLD = [255, 205, 70], GREEN = [96, 220, 150];
  var RED = [255, 90, 90], ORANGE = [255, 150, 60], YOLK = [255, 188, 40], WHITE_GOO = [250, 248, 232];

  var EGGS = [
    { name: '麻雀蛋', px: 72, aspect: 0.74, k: 0.16, base: [234, 228, 214], pattern: 'speckle', spot: [125, 95, 70], crack: [70, 55, 45], size: '約 2 公分', fact: '麻雀蛋只有約 2 公分，比一顆葡萄還小。' },
    { name: '鵪鶉蛋', px: 90, aspect: 0.78, k: 0.14, base: [224, 206, 170], pattern: 'blotch', spot: [62, 46, 36], crack: [60, 45, 35], size: '約 3.5 公分', fact: '鵪鶉蛋的斑點是天然迷彩，放在地上很難被發現。' },
    { name: '鴿子蛋', px: 100, aspect: 0.74, k: 0.15, base: [250, 250, 246], pattern: 'plain', spot: [0, 0, 0], crack: [90, 90, 95], size: '約 4 公分', fact: '鴿子通常一次只生兩顆蛋，由爸爸媽媽輪流孵。' },
    { name: '雞蛋', px: 128, aspect: 0.77, k: 0.14, base: [214, 160, 112], pattern: 'faint', spot: [188, 132, 88], crack: [90, 55, 35], size: '約 6 公分', fact: '蛋殼上有幾千個小氣孔，讓裡面的小雞可以呼吸。' },
    { name: '鴨蛋', px: 142, aspect: 0.74, k: 0.14, base: [198, 228, 214], pattern: 'plain', spot: [0, 0, 0], crack: [70, 100, 90], size: '約 6.5 公分', fact: '鹹鴨蛋和皮蛋，大多是用鴨蛋做的。' },
    { name: '鵝蛋', px: 168, aspect: 0.70, k: 0.15, base: [246, 243, 232], pattern: 'plain', spot: [0, 0, 0], crack: [100, 95, 85], size: '約 9 公分', fact: '一顆鵝蛋大約等於三顆雞蛋。' },
    { name: '鴯鶓蛋', px: 198, aspect: 0.68, k: 0.10, base: [36, 78, 62], pattern: 'grain', spot: [62, 108, 88], crack: [226, 232, 212], size: '約 13 公分', fact: '鴯鶓蛋是深綠色的，而且是鴯鶓爸爸負責孵蛋。' },
    { name: '鴕鳥蛋', px: 228, aspect: 0.82, k: 0.06, base: [240, 228, 196], pattern: 'pits', spot: [200, 184, 148], crack: [110, 95, 70], size: '約 15 公分', fact: '鴕鳥蛋是現存鳥類最大的蛋，一顆約等於 24 顆雞蛋。' },
    { name: '象鳥蛋', px: 288, aspect: 0.76, k: 0.08, base: [236, 222, 196], pattern: 'stain', spot: [214, 196, 160], crack: [105, 90, 70], size: '約 30 公分', fact: '象鳥是已滅絕的馬達加斯加巨鳥，一顆蛋約等於 150 顆雞蛋。' },
    { name: '恐龍蛋', px: 330, aspect: 0.72, k: 0.10, base: [142, 122, 100], pattern: 'fossil', spot: [104, 88, 72], crack: [255, 170, 60], size: '大的超過 40 公分', fact: '恐龍蛋化石在世界各地都有發現，有些裡面還保存著小恐龍胚胎。' },
    // 特別關：破完 10 關才會出現
    { name: '奇異鳥蛋', px: 250, aspect: 0.64, k: 0.07, base: [240, 241, 230], pattern: 'faint', spot: [222, 226, 210], crack: [110, 120, 100], size: '約 12 公分', fact: '奇異鳥蛋大約是媽媽體重的 1/5，以身體比例來說是最大的鳥蛋。' }
  ];
  var LEVELS = 10, SPECIAL = 11;   // 一般 10 關；第 11 關是特別關（握力 60）
  var SKIES = [[[150, 200, 240], [215, 235, 250]], [[140, 190, 235], [210, 232, 245]], [[130, 180, 230], [205, 225, 240]],
    [[120, 170, 225], [230, 215, 200]], [[110, 150, 210], [240, 200, 170]], [[95, 125, 190], [240, 180, 150]],
    [[70, 90, 150], [225, 150, 130]], [[55, 65, 120], [215, 130, 100]], [[50, 40, 80], [200, 100, 70]], [[40, 22, 40], [230, 90, 40]],
    [[8, 14, 38], [36, 58, 96]]];   // 特別關：紐西蘭的夜晚（奇異鳥是夜行性）
  var GROUNDS = [[150, 118, 88], [145, 112, 84], [140, 108, 80], [132, 100, 76], [124, 94, 72],
    [116, 88, 68], [104, 80, 64], [92, 72, 60], [80, 62, 54], [64, 46, 42], [34, 48, 36]];
  function levelLabel(level) { return level === SPECIAL ? '特別關' : '第 ' + level + ' 關'; }

  // ---------- 小工具 ----------
  function threshold(level, mode) {
    var base = 10 + 5 * (level - 1);
    return Math.round(base * MODES[mode || 'normal'].ratio);   // 四捨五入成整數（困難 ×1.25 才不會出現 12.5）
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, lo, hi) { if (lo === undefined) { lo = 0; hi = 1; } return Math.max(lo, Math.min(hi, x)); }
  function lerpColor(a, b, t) { return [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0]; }
  function shade(c, amt) { return lerpColor(c, amt < 0 ? [0, 0, 0] : [255, 255, 255], Math.abs(amt)); }
  function rgb(c, a) { return a === undefined ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function halfWidth(v, k) { return Math.sqrt(Math.max(0, 1 - v * v)) * (1 + k * v); }
  function fmt(x) { return (Math.round(x * 10) / 10).toString(); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function uniform(rng, a, b) { return a + (b - a) * rng(); }
  function randint(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

  function eggPath(ctx, cx, cy, rw, rh, k) {
    var n = 36, i, th, v, pts = [];
    for (i = 0; i <= n; i++) {
      th = Math.PI * i / n; v = -Math.cos(th);
      pts.push([cx + Math.sin(th) * (1 + k * v) * rw, cy + v * rh]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    for (i = pts.length - 2; i >= 1; i--) ctx.lineTo(2 * cx - pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function ellipse(ctx, cx, cy, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function polygon(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  // ---------- 蛋的外觀 ----------
  function EggArt(level, seed) {
    this.d = EGGS[level - 1];
    this.level = level;
    var rng = mulberry32(level * 1000 + (seed || 0));
    this.spots = this.makeSpots(rng);
    this.cracks = this.makeCracks(rng);
  }
  EggArt.prototype.makeSpots = function (rng) {
    var d = this.d, spots = [];
    function add(n, rmin, rmax, color, bias, jitter) {
      for (var i = 0; i < n; i++) {
        var v = clamp(uniform(rng, -0.95, 0.95) + (bias || 0) * rng(), -0.95, 0.95);
        var c = jitter ? shade(color, uniform(rng, -jitter, jitter)) : color;
        spots.push([uniform(rng, -0.95, 0.95), v, uniform(rng, rmin, rmax), rgb(c)]);
      }
    }
    var p = d.pattern;
    if (p === 'speckle') add(70, 0.010, 0.028, d.spot, 0.6, 0.2);
    else if (p === 'blotch') { add(22, 0.035, 0.085, d.spot, 0, 0.15); add(40, 0.010, 0.025, d.spot, 0, 0.2); }
    else if (p === 'faint') add(25, 0.008, 0.02, d.spot, 0, 0.1);
    else if (p === 'grain') add(160, 0.005, 0.012, d.spot, 0, 0.3);
    else if (p === 'pits') add(220, 0.003, 0.007, d.spot, 0, 0.1);
    else if (p === 'stain') { add(14, 0.05, 0.12, d.spot, 0, 0.05); add(120, 0.003, 0.006, shade(d.spot, -0.1)); }
    else if (p === 'fossil') { add(30, 0.04, 0.10, d.spot, 0, 0.25); add(26, 0.03, 0.07, shade(d.base, 0.15), 0, 0.1); add(140, 0.004, 0.01, shade(d.spot, -0.2)); }
    return spots;
  };
  EggArt.prototype.makeCracks = function (rng) {
    var cracks = [];
    // 先從左右兩側（手指施力處）裂開，再擴散到其他地方
    var seeds = [[-0.92, uniform(rng, 0, 0.2)], [0.92, uniform(rng, 0, 0.2)]];
    for (var s = 0; s < 4; s++) seeds.push([uniform(rng, -0.6, 0.6), uniform(rng, -0.6, 0.6)]);
    seeds.forEach(function (sd) {
      var su = sd[0], sv = sd[1], nb = randint(rng, 1, 2);
      for (var b = 0; b < nb; b++) {
        var pts = [[su, sv]];
        var ang = Math.abs(su) > 0.8 ? Math.atan2(-sv, -su) + uniform(rng, -0.9, 0.9) : uniform(rng, 0, Math.PI * 2);
        var steps = randint(rng, 5, 9);
        for (var i = 0; i < steps; i++) {
          ang += uniform(rng, -0.7, 0.7);
          var last = pts[pts.length - 1];
          pts.push([clamp(last[0] + Math.cos(ang) * 0.14, -0.97, 0.97), clamp(last[1] + Math.sin(ang) * 0.11, -0.95, 0.95)]);
        }
        cracks.push(pts);
      }
    });
    return cracks;
  };
  EggArt.prototype.geometry = function (ground, height, squash) {
    var rh = height / 2 * (1 + 0.035 * squash);
    var rw = height / 2 * this.d.aspect * (1 - 0.12 * squash);
    return { rw: rw, rh: rh, cy: ground - rh };
  };
  // 畫圖快取：Game 每幀設定像素倍率與建立畫布的方法；沒有（例如 Node 測試）就每次直接畫
  var RENDER = { ps: 1, make: null };

  // 蛋本體（底色、花紋、亮光、外框）。很花時間（大蛋有兩百多個斑點），所以先畫成圖存起來
  EggArt.prototype.drawBody = function (ctx, cx, cy, rw, rh, locked) {
    var k = this.d.k, base = locked ? [48, 46, 60] : this.d.base;
    ctx.save();
    eggPath(ctx, cx, cy, rw, rh, k); ctx.clip();
    ctx.fillStyle = rgb(shade(base, -0.3));
    ctx.fillRect(cx - rw * 1.4, cy - rh - 2, rw * 2.8, rh * 2 + 4);
    eggPath(ctx, cx - rw * 0.07, cy - rh * 0.05, rw * 0.95, rh * 0.96, k);
    ctx.fillStyle = rgb(base); ctx.fill();
    if (!locked) {
      for (var i = 0; i < this.spots.length; i++) {
        var s = this.spots[i];
        ctx.beginPath();
        ctx.arc(cx + s[0] * halfWidth(s[1], k) * rw, cy + s[1] * rh, Math.max(0.6, s[2] * rh * 2), 0, Math.PI * 2);
        ctx.fillStyle = s[3]; ctx.fill();
      }
      ellipse(ctx, cx - rw * 0.345, cy - rh * 0.47, rw * 0.275, rh * 0.25, 'rgba(255,255,255,0.31)');
      ellipse(ctx, cx - rw * 0.39, cy - rh * 0.53, rw * 0.11, rh * 0.09, 'rgba(255,255,255,0.24)');
    }
    ctx.restore();
    eggPath(ctx, cx, cy, rw, rh, k);
    ctx.strokeStyle = rgb(shade(base, -0.45)); ctx.lineWidth = 1.2; ctx.stroke();
  };
  EggArt.prototype.sprite = function (height, locked) {
    if (!RENDER.make) return null;
    var key = height.toFixed(1) + (locked ? 'L' : '') + '@' + RENDER.ps.toFixed(2);
    this.cache = this.cache || {};
    if (this.cache[key]) return this.cache[key];
    var g = this.geometry(0, height, 0), w = 2 * g.rw * (1 + this.d.k) + 8, h = 2 * g.rh + 8, ps = RENDER.ps;
    var c = RENDER.make(Math.ceil(w * ps), Math.ceil(h * ps)), x = c.getContext('2d');
    x.scale(ps, ps);
    this.drawBody(x, w / 2, h / 2, g.rw, g.rh, locked);
    var keys = Object.keys(this.cache);
    if (keys.length > 6) delete this.cache[keys[0]];
    return (this.cache[key] = { c: c, w: w, h: h });
  };
  // pop：整顆蛋以底部為中心縮放（關卡開場的彈出動畫），用同一張快取圖，不必每幀重畫
  EggArt.prototype.draw = function (ctx, cx, ground, height, squash, crack, locked, pop) {
    var g = this.geometry(ground, height, squash || 0), sp = this.sprite(height, locked);
    pop = pop === undefined ? 1 : Math.max(0.02, pop);
    if (sp) {   // 壓扁＝把圖橫向縮、縱向拉（蛋形本來就是線性跟著 rw、rh 走）
      var g0 = this.geometry(ground, height, 0), sx = g.rw / g0.rw * pop, sy = g.rh / g0.rh * pop;
      // 快取圖中蛋的底部在 y = 2*rh0 + 4（圖高 2*rh0 + 8、蛋置中），縮放後要對齊地面
      ctx.drawImage(sp.c, cx - sp.w / 2 * sx, ground - (2 * g0.rh + 4) * sy, sp.w * sx, sp.h * sy);
    } else {
      this.drawBody(ctx, cx, ground - g.rh * pop, g.rw * pop, g.rh * pop, locked);
    }
    if (crack > 0) this.drawCracks(ctx, cx, g.cy, g.rw, g.rh, crack);
    return g;
  };
  EggArt.prototype.drawCracks = function (ctx, cx, cy, rw, rh, level) {
    var k = this.d.k, n = this.cracks.length, width = Math.max(1, Math.floor(rh / 55));
    var glow = this.d.pattern === 'fossil';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var pts = this.cracks[i], f = clamp((level - i / n * 0.75) / 0.25);
      if (f <= 0) continue;
      var segs = (pts.length - 1) * f, full = Math.floor(segs), sp = [];
      for (var j = 0; j <= full && j < pts.length; j++) sp.push([cx + pts[j][0] * halfWidth(pts[j][1], k) * rw, cy + pts[j][1] * rh]);
      if (full < pts.length - 1) {
        var t = segs - full, u = lerp(pts[full][0], pts[full + 1][0], t), v = lerp(pts[full][1], pts[full + 1][1], t);
        sp.push([cx + u * halfWidth(v, k) * rw, cy + v * rh]);
      }
      if (sp.length < 2) continue;
      var passes = glow ? [['rgb(255,110,30)', width + 4], ['rgb(255,230,140)', width]] : [[rgb(this.d.crack), width]];
      for (var p = 0; p < passes.length; p++) {
        ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]);
        for (j = 1; j < sp.length; j++) ctx.lineTo(sp[j][0], sp[j][1]);
        ctx.strokeStyle = passes[p][0]; ctx.lineWidth = passes[p][1]; ctx.stroke();
      }
    }
  };

  // ---------- 小恐龍與蛋殼 ----------
  // 扁平風的藍色小暴龍（側面朝右）：大方頭、笑嘴小白牙、背上深色條紋、淺色肚子。
  // 在 800x700 的設計座標裡畫，再縮放到畫面；下半身會被蛋殼擋住。
  function drawDino(ctx, x, baseY, s, t, capColor, clipY) {   // clipY：只畫到這條線以上（下半身藏在蛋殼裡）
    var BODY = 'rgb(96,158,214)', DARK = 'rgb(64,122,180)', BELLY = 'rgb(166,208,236)', INK = 'rgb(28,30,36)';
    var bob = Math.sin(t * 4) * 3 * s, wave = Math.sin(t * 7);
    var k = 0.34 * s, i;
    ctx.save();
    if (clipY !== undefined) { ctx.beginPath(); ctx.rect(x - 2000, clipY - 4000, 4000, 4000); ctx.clip(); }
    ctx.translate(x - 34 * s, baseY + 27 * s + bob); ctx.scale(k, k); ctx.translate(-420, -700);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    function bodyPath() {
      ctx.beginPath();
      ctx.moveTo(92, 362);
      ctx.quadraticCurveTo(150, 440, 250, 420);
      ctx.bezierCurveTo(330, 405, 380, 350, 392, 270);
      ctx.bezierCurveTo(398, 200, 395, 130, 440, 100);
      ctx.bezierCurveTo(480, 75, 560, 80, 640, 92);
      ctx.bezierCurveTo(700, 100, 722, 120, 720, 170);
      ctx.lineTo(718, 235);
      ctx.bezierCurveTo(716, 290, 680, 312, 600, 318);
      ctx.bezierCurveTo(550, 322, 520, 325, 505, 335);
      ctx.bezierCurveTo(540, 380, 560, 450, 548, 520);
      ctx.bezierCurveTo(540, 580, 500, 600, 440, 610);
      ctx.lineTo(300, 600);
      ctx.bezierCurveTo(220, 580, 140, 480, 92, 362);
      ctx.closePath();
    }
    // 遠側的腳（深色，在身體後面）
    ctx.beginPath();
    ctx.moveTo(425, 560); ctx.bezierCurveTo(470, 540, 520, 538, 532, 565); ctx.lineTo(532, 650);
    ctx.lineTo(548, 668); ctx.quadraticCurveTo(556, 690, 535, 692); ctx.lineTo(430, 692); ctx.quadraticCurveTo(410, 692, 414, 672); ctx.lineTo(420, 600); ctx.closePath();
    ctx.fillStyle = DARK; ctx.fill();
    ellipse(ctx, 556, 94, 34, 18, DARK);   // 頭頂的小突起

    // 身體
    bodyPath(); ctx.fillStyle = BODY; ctx.fill();
    ctx.save(); bodyPath(); ctx.clip();
    ctx.beginPath();   // 肚子
    ctx.moveTo(505, 335); ctx.bezierCurveTo(540, 380, 560, 450, 548, 520); ctx.bezierCurveTo(540, 580, 500, 600, 440, 610);
    ctx.lineTo(395, 606); ctx.bezierCurveTo(425, 520, 455, 420, 488, 330); ctx.closePath();
    ctx.fillStyle = BELLY; ctx.fill();
    ctx.beginPath();   // 尾巴下緣
    ctx.moveTo(92, 362); ctx.bezierCurveTo(140, 480, 220, 580, 300, 600); ctx.lineTo(330, 604);
    ctx.bezierCurveTo(240, 560, 160, 480, 92, 362); ctx.closePath();
    ctx.fillStyle = BELLY; ctx.fill();
    // 背上的深色條紋：從背脊往身體裡的圓頭短筆觸（被身體輪廓裁切，所以外緣貼齊背脊）
    var stripes = [[392, 172, 1, 0.15, 46], [390, 236, 1, 0.3, 48], [384, 300, 1, 0.55, 46],
                   [346, 376, 0.55, 1, 44], [296, 402, 0.3, 1, 42], [244, 420, 0.2, 1, 40], [192, 424, 0.35, 1, 36], [146, 410, 0.55, 1, 30]];
    ctx.strokeStyle = DARK; ctx.lineCap = 'round';
    for (i = 0; i < stripes.length; i++) {
      var q = stripes[i], n = Math.sqrt(q[2] * q[2] + q[3] * q[3]), ux = q[2] / n, uy = q[3] / n;
      ctx.lineWidth = q[4] * 0.42;
      ctx.beginPath(); ctx.moveTo(q[0] - ux * 20, q[1] - uy * 20); ctx.lineTo(q[0] + ux * q[4], q[1] + uy * q[4]); ctx.stroke();
    }
    ctx.restore();

    // 近側的腳
    ctx.beginPath();
    ctx.moveTo(262, 560); ctx.bezierCurveTo(300, 520, 392, 535, 402, 600); ctx.lineTo(396, 662);
    ctx.lineTo(410, 676); ctx.quadraticCurveTo(418, 698, 396, 700); ctx.lineTo(282, 700); ctx.quadraticCurveTo(262, 700, 268, 680);
    ctx.lineTo(286, 632); ctx.bezierCurveTo(266, 620, 254, 592, 262, 560); ctx.closePath();
    ctx.fillStyle = BODY; ctx.fill();

    // 小手：遠側深色、近側揮手
    function arm(pts, w, col, claws) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
      var e = pts[pts.length - 1];
      ctx.lineWidth = w * 0.5;
      for (j = 0; j < claws.length; j++) { ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0] + claws[j][0], e[1] + claws[j][1]); ctx.stroke(); }
    }
    arm([[548, 408], [586, 416], [600, 442]], 28, DARK, [[-10, 16], [8, 16]]);
    var wy = wave * 10;
    arm([[450, 392], [496, 414], [510 + wave * 4, 448 - wy]], 38, 'rgb(78,138,196)', [[-12, 18], [6, 20], [18, 8]]);

    // 臉
    var blink = (t % 3.4) < 0.12;
    if (blink) {
      ctx.beginPath(); ctx.arc(505, 140, 20, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
    } else {
      ellipse(ctx, 505, 145, 28, 28, '#fff');
      ellipse(ctx, 513, 142, 18, 18, INK);
      ellipse(ctx, 519, 135, 5.5, 5.5, '#fff');
    }
    ellipse(ctx, 470, 188, 23, 13, 'rgb(244,152,150)');   // 腮紅
    ellipse(ctx, 658, 166, 6, 9, DARK); ellipse(ctx, 694, 160, 5, 8, DARK);   // 鼻孔
    // 笑嘴＋一排小白牙
    ctx.beginPath(); ctx.moveTo(503, 207); ctx.quadraticCurveTo(504, 226, 524, 228);
    ctx.bezierCurveTo(600, 250, 676, 250, 716, 238);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = '#fff';
    for (i = 0; i < 6; i++) {
      var tx = 548 + i * 30, ty = 236 + 10 * Math.sin((i + 0.5) / 6 * Math.PI) - i * 0.6;
      ctx.beginPath(); ctx.moveTo(tx - 9, ty + 3); ctx.lineTo(tx + 9, ty + 3); ctx.lineTo(tx, ty + 19); ctx.closePath(); ctx.fill();
    }

    // 頭頂的蛋殼帽：鋸齒邊＋淡淡的斑點
    ctx.translate(520, 92); ctx.rotate(-0.18);
    ctx.beginPath(); ctx.moveTo(-92, 14);
    for (i = 1; i < 10; i++) ctx.lineTo(-92 + i * 184 / 10, (i % 2 ? -8 : 20));
    ctx.lineTo(92, 14);
    ctx.bezierCurveTo(92, -60, 50, -100, 0, -100); ctx.bezierCurveTo(-50, -100, -92, -60, -92, 14);
    ctx.closePath();
    ctx.fillStyle = rgb(capColor); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-70, -30); ctx.bezierCurveTo(-60, -80, -20, -92, 10, -90);   // 亮面
    ctx.strokeStyle = rgb(shade(capColor, 0.35)); ctx.lineWidth = 12; ctx.stroke();
    var sp = [[-30, -50, 9], [24, -66, 7], [48, -24, 10], [-10, -16, 6], [-60, -4, 7]];
    for (i = 0; i < sp.length; i++) ellipse(ctx, sp[i][0], sp[i][1], sp[i][2], sp[i][2] * 0.8, rgb(shade(capColor, -0.25)));
    ctx.restore();
  }
  function drawCup(ctx, art, cx, ground, height) {
    var g = art.geometry(ground, height, 0), k = art.d.k, topV = 0.2, pts = [], i, v;
    for (i = 0; i <= 18; i++) { v = lerp(topV, 1, i / 18); pts.push([cx + halfWidth(v, k) * g.rw, g.cy + v * g.rh]); }
    for (i = 18; i >= 0; i--) { v = lerp(topV, 1, i / 18); pts.push([cx - halfWidth(v, k) * g.rw, g.cy + v * g.rh]); }
    var xl = cx - halfWidth(topV, k) * g.rw, xr = cx + halfWidth(topV, k) * g.rw;
    for (i = 1; i < 12; i++) pts.push([lerp(xl, xr, i / 12), g.cy + topV * g.rh + (i % 2 ? -14 : 10)]);
    polygon(ctx, pts, rgb(art.d.base), rgb(shade(art.d.base, -0.45)), 3);
  }

  // ---------- 音效（WebAudio 合成；沒有音效裝置就靜音） ----------
  function Sfx(audio) {
    this.ac = audio || null;
    this.buf = {};
    if (!this.ac) return;
    var rate = this.ac.sampleRate, self = this;
    function noise(dur, decay, vol) { var o = []; for (var i = 0; i < rate * dur; i++) o.push((Math.random() * 2 - 1) * vol * Math.exp(-decay * i / rate)); return o; }
    function tone(dur, f, decay, vol) { var o = []; for (var i = 0; i < rate * dur; i++) o.push(Math.sin(2 * Math.PI * f * i / rate) * vol * Math.exp(-decay * i / rate)); return o; }
    function chirp(dur, f0, f1, vol) { var o = [], ph = 0, n = rate * dur; for (var i = 0; i < n; i++) { ph += 2 * Math.PI * lerp(f0, f1, i / n) / rate; o.push(Math.sin(ph) * vol * (1 - i / n)); } return o; }
    function melody(notes, dur, vol) { var o = []; notes.forEach(function (f) { o = o.concat(tone(dur, f, 6, vol)); }); return o; }
    function make(samples) {
      var b = self.ac.createBuffer(1, samples.length, rate), d = b.getChannelData(0);
      for (var i = 0; i < samples.length; i++) d[i] = clamp(samples[i], -1, 1);
      return b;
    }
    var smash = noise(0.5, 8, 0.75), thump = tone(0.5, 70, 10, 0.6);
    this.buf.crack = make(noise(0.05, 60, 0.35));
    this.buf.smash = make(smash.map(function (v, i) { return v + thump[i]; }));
    this.buf.pip = make(chirp(0.12, 600, 1200, 0.35).concat(chirp(0.12, 700, 1400, 0.35)));
    this.buf.win = make(melody([523, 659, 784, 1047], 0.12, 0.3));
    this.buf.lose = make(melody([392, 330, 262], 0.18, 0.3));
    this.buf.miss = make(melody([330, 294], 0.09, 0.2));
  }
  Sfx.prototype.play = function (name) {
    if (!this.ac || !this.buf[name]) return;
    try {
      var src = this.ac.createBufferSource();
      src.buffer = this.buf[name]; src.connect(this.ac.destination); src.start(0);
    } catch (e) { /* 忽略 */ }
  };

  // ---------- 背景音樂（程式合成的 8 小節循環，C → Am → F → G） ----------
  // 旋律以八分音符為單位，null = 延長前一個音
  var MELODY = [
    72, null, 76, null, 79, null, 76, 74,   72, null, 69, null, 72, 76, null, null,
    77, null, 76, 74, 72, null, 69, null,   71, null, 74, null, 79, null, 77, 74,
    76, null, 79, null, 84, null, 79, null, 81, null, 79, 76, 72, null, 76, null,
    77, 79, 81, null, 79, 77, 76, 74,       74, null, 71, null, 74, null, 67, null
  ];
  var BASS = [48, 45, 41, 43, 48, 45, 41, 43];   // 每小節的根音（每拍彈根音與五度）
  var BPM = 128;

  function Music(ac) {
    this.ac = ac;
    this.enabled = false;
    this.step = 0;
    this.next = 0;
    this.master = ac.createGain();
    this.master.gain.value = 0;
    this.master.connect(ac.destination);
    var n = Math.floor(ac.sampleRate * 0.05), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 6));
    this.noise = buf;
  }
  Music.VOLUME = 0.13;
  Music.prototype.setEnabled = function (on) {
    this.enabled = on;
    var t = this.ac.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? Music.VOLUME : 0, t, 0.2);
    clearInterval(this.timer); this.timer = null;
    if (on) {   // 用自己的計時器排程，不跟畫面更新綁在一起：畫面卡一下，音樂也不會斷
      var self = this;
      this.next = t + 0.1;
      this.timer = setInterval(function () { self.tick(); }, 50);
    }
  };
  Music.prototype.duck = function (seconds) {   // 捏破時讓音樂暫時變小聲
    if (!this.enabled) return;
    var t = this.ac.currentTime, g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(Music.VOLUME * 0.2, t, 0.03);
    g.setTargetAtTime(Music.VOLUME, t + seconds, 0.4);
  };
  Music.prototype.note = function (type, midi, t, dur, vol) {
    var o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  Music.prototype.kick = function (t) {
    var o = this.ac.createOscillator(), g = this.ac.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.2);
  };
  Music.prototype.hat = function (t, vol) {
    var s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  };
  Music.prototype.tick = function () {   // 計時器每 50ms 呼叫：預先排好接下來 0.5 秒內的音符
    if (!this.enabled) return;
    var now = this.ac.currentTime, eighth = 60 / BPM / 2;
    if (this.next < now - 0.3) this.next = now + 0.05;   // 分頁在背景太久，重新對時
    while (this.next < now + 0.5) {
      var t = this.next, st = this.step, bar = Math.floor(st / 8) % 8, inBar = st % 8;
      var m = MELODY[st];
      if (m !== null) {
        var len = 1;
        while (len < 4 && MELODY[(st + len) % MELODY.length] === null) len++;
        this.note('square', m, t, eighth * len * 0.9, 0.16);
      }
      if (inBar % 2 === 0) {   // 低音：每拍，根音與五度交替
        var root = BASS[bar];
        this.note('triangle', inBar % 4 === 0 ? root : root + 7, t, eighth * 1.8, 0.5);
      }
      if (inBar === 0 || inBar === 4) this.kick(t);
      this.hat(t, inBar % 2 ? 0.25 : 0.12);
      this.step = (st + 1) % MELODY.length;
      this.next += eighth;
    }
  };

  // ---------- 遊戲 ----------
  function Game(env) {
    this.env = env;           // { grip:{force,rising,connected,status}, storage, audio, connectGrip(), bluetoothSupported }
    this.sfx = new Sfx(env.audio);
    this.save = this.loadSave();
    this.modeName = this.save.mode;
    this.time = 0;
    this.sim = 0;
    this.held = false;        // 按住螢幕 / 滑鼠 / 空白鍵（模擬握力）
    this.texts = []; this.particles = [];
    this.screenShake = 0; this.flash = 0;
    this.lastState = 'menu'; this.stateT = 0; this.btnArmed = false;
    this.menuArts = EGGS.slice(0, LEVELS).map(function (_, i) { return new EggArt(i + 1); });
    this.miniArt = new EggArt(3);
    this.buttons = [];
    this.startLevel(1, false);
    this.state = 'menu';
  }
  var G = Game.prototype;

  // iOS 要在使用者第一次觸碰後才能建立/啟動音效，所以音效可以晚一點才接上
  G.setAudio = function (ac) {
    this.sfx = new Sfx(ac);
    try {
      this.music = new Music(ac);
      this.music.setEnabled(this.save.music);
    } catch (e) { this.music = null; }
  };

  // ---- 存檔 ----
  G.loadSave = function () {
    var s = { mode: 'normal', music: true, unlocked: { normal: 1, kids: 1, hard: 1 }, best: { normal: {}, kids: {}, hard: {} } };
    try {
      var d = JSON.parse(this.env.storage.get() || 'null');
      if (d) {
        s.mode = MODES[d.mode] ? d.mode : d.kids ? 'kids' : 'normal';   // 舊存檔只有 kids 開關
        s.music = d.music !== false;
        // 過關進度與最佳成績刻意不讀回：重新整理後一律從零開始（只記住難度與音樂設定）
      }
    } catch (e) { /* 沒有存檔或格式錯誤 */ }
    return s;
  };
  G.saveData = function () {   // 只存偏好設定；進度只留在這次遊玩的記憶體裡
    this.save.mode = this.modeName;
    try { this.env.storage.set(JSON.stringify({ mode: this.save.mode, music: this.save.music })); } catch (e) { }
  };
  G.mode = function () { return this.modeName; };
  G.cfg = function () { return MODES[this.modeName]; };
  G.unlocked = function () { return Math.min(LEVELS, this.save.unlocked[this.mode()]); };

  // ---- 輸入 ----
  G.readInput = function (dt) {
    var cap = this.thr * 1.2;
    var held = this.held && this.state === 'play' || this.keyHeld;
    if (held) this.sim = Math.min(cap, this.sim + cap * 0.9 * dt);
    else this.sim = Math.max(0, this.sim - cap * 4 * dt);
    var g = this.env.grip;
    return g.force >= this.sim ? g.force : this.sim;
  };

  // ---- 關卡流程 ----
  G.startLevel = function (level, intro) {
    this.level = level;
    this.thr = threshold(level, this.modeName);
    this.holdTime = this.cfg().hold;
    this.maxAttempts = this.cfg().attempts;
    this.art = new EggArt(level, Math.floor(Math.random() * 9999));
    this.attempts = this.maxAttempts;
    this.inAttempt = false;
    this.waitRelease = false;   // 一次捏結束後，要等握力真正放開才算下一次
    this.hold = 0; this.crack = 0; this.visForce = 0;
    this.attemptPeak = 0; this.levelPeak = 0; this.levelStart = null;
    this.failTimer = null;
    this.shards = []; this.smashT = 0; this.animT = 0;
    this.texts = []; this.particles = [];
    this.state = intro === false ? 'play' : 'intro';
    this.introT = 0;
  };
  G.startSmash = function () {
    var d = this.art.d;
    this.state = 'smash'; this.smashT = 0; this.animT = 0; this.kiwiLanded = false;
    this.screenShake = 0.45; this.flash = 0.18;
    this.sfx.play('smash');
    if (this.music) this.music.duck(this.level >= LEVELS ? 3.0 : 1.6);
    this.clearTime = this.time - (this.levelStart === null ? this.time : this.levelStart);
    var g = this.art.geometry(GROUND_Y, d.px, 1.0);
    this.smashGeom = g;
    var final = this.level >= LEVELS, n = 26 + Math.min(this.level, LEVELS) * 3;
    for (var i = 0; i < n; i++) {
      var v = uniform(Math.random, -0.95, final ? 0.2 : 0.95), u = uniform(Math.random, -0.9, 0.9);
      var x = EGG_X + u * halfWidth(v, d.k) * g.rw, y = g.cy + v * g.rh;
      var ang = Math.atan2(y - g.cy, x - EGG_X) + uniform(Math.random, -0.4, 0.4);
      var speed = uniform(Math.random, 180, 520) * (0.7 + d.px / 330), size = d.px * uniform(Math.random, 0.05, 0.11);
      var nv = randint(Math.random, 3, 5), angs = [];
      for (var j = 0; j < nv; j++) angs.push(uniform(Math.random, 0, Math.PI * 2));
      angs.sort(function (a, b) { return a - b; });
      this.shards.push({
        x: x, y: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - uniform(Math.random, 150, 350),
        rot: uniform(Math.random, 0, Math.PI * 2), vr: uniform(Math.random, -9, 9),
        verts: angs.map(function (a) { return [Math.cos(a) * size * uniform(Math.random, 0.6, 1), Math.sin(a) * size * uniform(Math.random, 0.6, 1)]; }),
        color: rgb(shade(d.base, uniform(Math.random, -0.15, 0.1))), edge: rgb(shade(d.base, -0.55))
      });
    }
    if (this.level === SPECIAL) { this.burst(EGG_X, g.cy, [255, 240, 170], 60, 520, 5); this.burst(EGG_X, g.cy, [140, 220, 255], 40, 380, 5); }
    else if (final) { this.burst(EGG_X, g.cy, ORANGE, 60, 520, 5); this.burst(EGG_X, g.cy, GOLD, 40, 380, 5); }
    else { this.burst(EGG_X, g.cy, YOLK, 26, 420, 7); this.burst(EGG_X, g.cy, WHITE_GOO, 26, 380, 6); }
    this.splat = [];
    for (i = 0; i < 24; i++) this.splat.push([i / 24 * Math.PI * 2, uniform(Math.random, 0.75, 1.15)]);
  };
  G.finishLevel = function () {
    var key = String(this.level), best = this.save.best[this.mode()][key];
    var record = { peak: Math.round(this.levelPeak * 10) / 10, time: Math.round(this.clearTime * 100) / 100, tries: this.maxAttempts - this.attempts + 1 };
    this.newBest = !best || record.time < best.time;
    if (this.newBest) this.save.best[this.mode()][key] = record;
    this.save.unlocked[this.mode()] = Math.max(this.save.unlocked[this.mode()], Math.min(LEVELS, this.level + 1));
    this.saveData();
    this.state = this.level === SPECIAL ? 'ending2' : this.level === LEVELS ? 'ending' : 'clear';
    this.sfx.play('win');
  };

  // ---- 特效 ----
  G.floatText = function (s, color, x, y, size, life) {
    life = life || 1.4;
    this.texts.push({ s: s, color: color, x: x, y: y, life: life, max: life, size: size || 26 });
  };
  var MAX_PARTICLES = 300;   // iPad Air 2 同時畫太多粒子會卡
  G.burst = function (x, y, color, n, speed, size) {
    n = Math.min(n, MAX_PARTICLES - this.particles.length);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * speed, life = 0.5 + Math.random() * 0.5;
      this.particles.push([x, y, Math.cos(a) * v, Math.sin(a) * v - 150, life, life, rgb(color), size || 5]);
    }
  };
  G.confetti = function () {
    if (this.particles.length > MAX_PARTICLES - 4) return;
    var cs = [GOLD, GREEN, RED, [120, 180, 255], [255, 140, 220]];
    for (var i = 0; i < 4; i++) {
      var life = 1.5 + Math.random();
      this.particles.push([Math.random() * W, -10, uniform(Math.random, -60, 60), uniform(Math.random, 60, 160), life, life, rgb(cs[i % 5]), 5]);
    }
  };

  // ---- 更新 ----
  G.update = function (dt) {
    var force = this.readInput(dt);
    this.force = force;
    this.time += dt;
    if (this.state !== this.lastState) { this.lastState = this.state; this.stateT = 0; }
    this.stateT += dt;
    this.gripConfirm(this.env.grip.force);
    this.screenShake = Math.max(0, this.screenShake - dt);
    this.flash = Math.max(0, this.flash - dt);
    var slow = this.state === 'smash' && this.smashT < 0.3 ? 0.35 : 1, pdt = dt * slow, i;
    for (i = 0; i < this.texts.length; i++) { this.texts[i].life -= dt; this.texts[i].y -= 40 * dt; }
    this.texts = this.texts.filter(function (t) { return t.life > 0; });
    for (i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p[0] += p[2] * pdt; p[1] += p[3] * pdt; p[3] += (p[5] > 1.4 ? 60 : 900) * pdt; p[4] -= pdt;
    }
    this.particles = this.particles.filter(function (p) { return p[4] > 0; });

    if (this.state === 'intro') {
      this.introT += dt;
      if (this.introT > 2.8) this.state = 'play';
    } else if (this.state === 'play') {
      this.updatePlay(dt, force);
    } else if (this.state === 'smash') {
      this.smashT += dt; this.animT += pdt;
      for (i = 0; i < this.shards.length; i++) {
        var s = this.shards[i];
        s.x += s.vx * pdt; s.y += s.vy * pdt; s.vy += 1400 * pdt; s.rot += s.vr * pdt;
        if (s.y > GROUND_Y - 4) { s.y = GROUND_Y - 4; s.vy = -s.vy * 0.25; s.vx *= 0.6; s.vr *= 0.5; }
      }
      if (this.level >= LEVELS && this.smashT > 0.55 && !this.pipped) { this.pipped = true; this.sfx.play('pip'); }
      if (this.level === SPECIAL && !this.kiwiLanded && this.animT >= KIWI_LAND) { this.kiwiLanded = true; this.kiwiLanding(); }
      if (this.smashT > (this.level >= LEVELS ? 3.0 : 2.3)) { this.pipped = false; this.finishLevel(); }
    } else if (this.state === 'ending' || this.state === 'ending2') {
      this.animT += dt; this.confetti();
    }
  };

  G.gripConfirm = function (force) {
    // 捏一下握力球＝按「下一步」。要先放開過 (armed) 才算新的一下
    if (force < START_FORCE) this.btnArmed = true;
    else if (this.btnArmed && force >= CONFIRM_FORCE) {
      this.btnArmed = false;
      if (['menu', 'intro', 'clear', 'fail', 'ending', 'ending2'].indexOf(this.state) >= 0 && this.stateT > CONFIRM_DELAY) this.confirm();
    }
  };
  G.confirm = function () {   // 每個畫面的「預設動作」
    var s = this.state;
    if (s === 'menu') this.startLevel(1);   // 一律從第 1 關開始（不能選關）
    else if (s === 'intro') this.state = 'play';
    else if (s === 'clear') this.startLevel(this.level + 1);
    else if (s === 'fail') this.startLevel(this.level);
    else if (s === 'ending') this.startLevel(SPECIAL);   // 破完 10 關：捏一下挑戰特別關
    else if (s === 'ending2') this.toMenu();
  };
  G.toMenu = function () { this.startLevel(1, false); this.state = 'menu'; };

  G.updatePlay = function (dt, force) {
    var thr = this.thr;
    this.visForce += (force - this.visForce) * Math.min(1, dt * 18);
    if (this.failTimer !== null) {
      this.failTimer -= dt;
      if (this.failTimer <= 0) { this.state = 'fail'; this.sfx.play('lose'); }
      return;
    }
    // 只看握力數值切出「一次捏」：超過 START_FORCE 開始；完全放開，或從高處明顯鬆手才算結束
    var peakEnd = null;
    // 從高處鬆手時，握力降到門檻 30% 就判定這次結束，但那時通常還在 3 以上；
    // 若不等完全放開，同一次放手會被當成「又捏了一次」再扣一次機會
    if (this.waitRelease && force <= RELEASE_FORCE) this.waitRelease = false;
    if (!this.inAttempt && !this.waitRelease && force >= START_FORCE) {
      this.inAttempt = true; this.attemptPeak = 0;
      if (this.levelStart === null) this.levelStart = this.time;
    }
    if (this.inAttempt) {
      this.attemptPeak = Math.max(this.attemptPeak, force);
      this.levelPeak = Math.max(this.levelPeak, force);
      var letGo = Math.max(2, thr * 0.3);
      if (force <= RELEASE_FORCE || (this.attemptPeak > letGo * 1.3 && force < letGo)) { this.inAttempt = false; this.waitRelease = true; peakEnd = this.attemptPeak; }
    }
    // 在門檻以上累積撐住的時間；稍微掉下來時慢慢退
    if (this.inAttempt && force >= thr) this.hold += dt;
    else this.hold = Math.max(0, this.hold - dt * 3);
    var p = force / thr, cNow = clamp((p - 0.5) / 0.5) * 0.7 + clamp(this.hold / this.holdTime) * 0.3;
    if (cNow > this.crack) {
      if (Math.floor(cNow * 8) > Math.floor(this.crack * 8)) this.sfx.play('crack');
      this.crack = cNow;
    }
    if (this.hold >= this.holdTime) { this.levelPeak = Math.max(this.levelPeak, force); this.startSmash(); return; }
    if (peakEnd !== null) {
      this.attempts -= 1; this.hold = 0;
      var y = GROUND_Y - this.art.d.px - 40;
      if (peakEnd >= thr) this.floatText('到了！但要撐住 ' + this.holdTime + ' 秒', GOLD, EGG_X, y);
      else this.floatText('最高 ' + peakEnd.toFixed(1) + '，還差 ' + (thr - peakEnd).toFixed(1) + '！', TEXT, EGG_X, y);
      this.sfx.play('miss');
      if (this.attempts <= 0) this.failTimer = 1.3;
    }
  };

  // ---- 觸控 / 按鍵 ----
  G.button = function (id, x, y, w, h, label, opts) {
    opts = opts || {};
    this.buttons.push({ id: id, x: x, y: y, w: w, h: h });
    return { x: x, y: y, w: w, h: h, label: label, primary: opts.primary, on: opts.on, fill: opts.fill, ink: opts.ink };
  };
  G.hit = function (x, y) {
    for (var i = this.buttons.length - 1; i >= 0; i--) {
      var b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  };
  G.tap = function (x, y) {   // 點一下（click）。回傳 true 表示有按到按鈕
    var id = this.hit(x, y);
    if (!id) {
      return false;
    }
    if (id === 'grip') this.env.connectGrip();
    else if (id === 'mode') this.cycleMode();
    else if (id === 'music') this.toggleMusic();
    else if (id === 'start' || id === 'next' || id === 'retry' || id === 'go' || id === 'special') this.confirm();
    else if (id === 'tomenu-end') this.toMenu();
    else if (id === 'menu') this.toMenu();
    return true;
  };
  G.pointerInPlayArea = function (x, y) { return this.state === 'play' && !this.hit(x, y); };
  G.key = function (code, down) {
    if (code === 'Space') { this.keyHeld = down; return; }
    if (!down) return;
    var s = this.state;
    if (code === 'Escape') { if (s !== 'menu') this.toMenu(); }
    else if (code === 'Enter') this.confirm();
    else if (s === 'menu' && code === 'KeyK') this.cycleMode();
    else if (code === 'KeyM') this.toggleMusic();
  };
  G.cycleMode = function () {
    this.modeName = MODE_ORDER[(MODE_ORDER.indexOf(this.modeName) + 1) % MODE_ORDER.length];
    this.saveData(); this.startLevel(1, false); this.state = 'menu';
  };
  G.toggleMusic = function () {
    this.save.music = !this.save.music; this.saveData();
    if (this.music) this.music.setEnabled(this.save.music);
  };

  // ---------- 繪圖 ----------
  G.text = function (ctx, s, size, color, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(x, y);
    if (o.angle) ctx.rotate(o.angle);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.shadow !== false) { ctx.fillStyle = o.shadowColor || 'rgb(20,16,26)'; var off = o.shadowOff || 2; ctx.fillText(s, off, off); }
    ctx.fillStyle = typeof color === 'string' ? color : rgb(color);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  };
  G.panel = function (ctx, x, y, w, h, alpha) {
    roundRect(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(16,14,26,' + (alpha === undefined ? 0.78 : alpha) + ')'; ctx.fill();
  };
  G.drawButton = function (ctx, b) {
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = b.fill ? rgb(b.fill) : b.primary ? 'rgb(79,140,255)' : b.on ? 'rgba(255,205,70,0.9)' : 'rgba(40,36,58,0.92)';
    ctx.fill();
    ctx.strokeStyle = b.primary ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    this.text(ctx, b.label, 20, b.ink || (b.on ? [30, 26, 20] : TEXT), b.x + b.w / 2, b.y + b.h / 2 + 1, { shadow: false });
  };
  G.drawSky = function (ctx, level) {   // 天空與地面每關固定，畫一次存起來
    if (RENDER.make) {
      var key = level + '@' + RENDER.ps.toFixed(2);
      if (!this.skyCache || this.skyCache.key !== key) {
        var c = RENDER.make(Math.ceil(W * RENDER.ps), Math.ceil(H * RENDER.ps)), x = c.getContext('2d');
        x.scale(RENDER.ps, RENDER.ps);
        this.paintSky(x, level);
        this.skyCache = { key: key, c: c };
      }
      ctx.drawImage(this.skyCache.c, 0, 0, W, H);
      return;
    }
    this.paintSky(ctx, level);
  };
  G.paintSky = function (ctx, level) {
    var sk = SKIES[level - 1], grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, rgb(sk[0])); grad.addColorStop(1, rgb(sk[1]));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, GROUND_Y);
    var gr = GROUNDS[level - 1];
    ctx.fillStyle = rgb(gr); ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = rgb(shade(gr, 0.25)); ctx.fillRect(0, GROUND_Y - 1, W, 3);
    if (level === SPECIAL) this.paintNight(ctx);
    if (level === LEVELS) {   // 史前火山
      polygon(ctx, [[620, GROUND_Y], [760, 250], [820, 250], [960, GROUND_Y]], 'rgb(60,30,35)');
      polygon(ctx, [[760, 250], [820, 250], [800, 275], [775, 270]], 'rgb(255,110,40)');
    }
  };
  G.paintNight = function (ctx) {   // 紐西蘭夜晚：星空、月亮、遠山、樹蕨剪影
    var r = mulberry32(2024), i;
    for (i = 0; i < 160; i++) {
      var sx = r() * W, sy = r() * (GROUND_Y - 120), sr = r() < 0.1 ? 1.6 : 0.5 + r() * 0.8;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + r() * 0.6).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    var mg = ctx.createRadialGradient(790, 90, 0, 790, 90, 90);
    mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = mg; ctx.fillRect(700, 0, 180, 180);
    ellipse(ctx, 790, 90, 30, 30, 'rgb(250,246,225)'); ellipse(ctx, 780, 84, 6, 6, 'rgb(230,226,205)'); ellipse(ctx, 800, 100, 4, 4, 'rgb(230,226,205)');
    polygon(ctx, [[0, GROUND_Y], [0, 330], [120, 290], [260, 320], [380, 270], [520, 315], [660, 280], [820, 310], [960, 285], [960, GROUND_Y]], 'rgb(22,34,46)');
    var self = this;
    [[60, 1.0], [170, 0.75], [640, 0.85], [760, 1.1], [900, 0.8]].forEach(function (f) { self.treeFern(ctx, f[0], GROUND_Y, f[1]); });
  };
  G.treeFern = function (ctx, x, gy, k) {   // 樹蕨剪影：細長樹幹＋往下彎的葉子
    var top = gy - 170 * k;
    ctx.strokeStyle = 'rgb(14,22,20)'; ctx.lineCap = 'round';
    ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + 8 * k, gy - 90 * k, x, top); ctx.stroke();
    ctx.lineWidth = 4 * k;
    for (var i = 0; i < 9; i++) {
      var a = -Math.PI / 2 + (i - 4) * 0.42, len = 80 * k;
      var ex = x + Math.cos(a) * len, ey = top + Math.sin(a) * len * 0.5 + 34 * k;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.6, top + Math.sin(a) * len * 0.75, ex, ey); ctx.stroke();
    }
  };
  G.drawShadow = function (ctx, cx, rw) { ellipse(ctx, cx, GROUND_Y + 2, rw * 1.3, 12, 'rgba(0,0,0,0.27)'); };

  G.drawEggPlay = function (ctx) {
    var d = this.art.d, f = this.visForce;
    var squash = f > CONTACT_FORCE ? clamp((f - CONTACT_FORCE) / Math.max(1, this.thr - CONTACT_FORCE), 0, 1.15) : 0;
    var p = f / this.thr, amp = clamp((p - 0.9) / 0.2) * 5 + (this.hold > 0 ? 2 : 0);
    var cx = EGG_X + uniform(Math.random, -amp, amp);
    var g = this.art.geometry(GROUND_Y, d.px, squash);
    this.drawShadow(ctx, EGG_X, g.rw);
    this.art.draw(ctx, cx, GROUND_Y, d.px, squash, this.crack, false);
  };
  G.drawSmash = function (ctx) {
    var d = this.art.d, g = this.smashGeom, t = this.animT, final = this.level >= LEVELS, i;
    if (!final) {   // 蛋白與蛋黃濺在地上
      var grow = 1 - Math.pow(1 - clamp(t / 0.35), 3), r = g.rw * 2.4 * grow;
      if (r > 2) {
        polygon(ctx, this.splat.map(function (s) { return [EGG_X + Math.cos(s[0]) * r * s[1], GROUND_Y - 6 + Math.sin(s[0]) * r * s[1] * 0.28]; }), rgb(WHITE_GOO, 0.84));
      }
      var drop = clamp(t / 0.3), yy = lerp(g.cy, GROUND_Y - g.rw * 0.18, drop * drop);
      var bounce = t > 0.3 ? Math.sin(clamp((t - 0.3) / 0.4) * Math.PI) * g.rw * 0.12 : 0, yr = g.rw * 0.65;
      ellipse(ctx, EGG_X, yy - bounce, yr, yr * 0.55, rgb(YOLK));
      ellipse(ctx, EGG_X - yr * 0.25, yy - yr * 0.25 - bounce, yr * 0.25, yr * 0.15, rgb(shade(YOLK, 0.5)));
    } else {        // 小恐龍孵出來
      this.drawShadow(ctx, EGG_X, g.rw);
      var g0 = this.art.geometry(GROUND_Y, d.px, 0), cupTop = g0.cy + 0.2 * g0.rh;
      var pop = t > 0.45 ? easeOutBack(clamp((t - 0.45) / 0.5)) : 0;
      if (this.level === SPECIAL) this.drawKiwiHatch(ctx, t, cupTop);
      else {
        if (pop > 0) drawDino(ctx, EGG_X, cupTop + 45 + (1 - pop) * 160, 1.3 * Math.max(0.01, pop), this.time, d.base, cupTop + 40);
        drawCup(ctx, this.art, EGG_X, GROUND_Y, d.px);
      }
    }
    for (i = 0; i < this.shards.length; i++) {
      var s = this.shards[i], c = Math.cos(s.rot), si = Math.sin(s.rot);
      polygon(ctx, s.verts.map(function (v) { return [s.x + v[0] * c - v[1] * si, s.y + v[0] * si + v[1] * c]; }), s.color, s.edge, 1);
    }
    if (this.smashT > 0.05 && this.smashT < 1.6) {   // 狀聲詞
      var k = easeOutBack(clamp(this.smashT / 0.25));
      this.text(ctx, final ? '喀啦！' : '啪嚓！', 80, GOLD, EGG_X + 150, g.cy - g.rh * 0.6 - 30,
        { angle: 8 * Math.PI / 180, scale: Math.max(0.05, k), shadowColor: 'rgb(60,30,20)', shadowOff: 4 });
    }
  };
  // Kiwi（Kiwi Trip 的角色正面圖）：從蛋殼衝上天、在空中變大，再「碰」一聲重重落地（壓扁再彈回），之後輕輕彈跳
  var KIWI_H = 380, KIWI_UP = 0.45, KIWI_TOP = 0.78, KIWI_LAND = 1.08;
  G.drawKiwiHatch = function (ctx, t, cupTop) {
    var landX = EGG_X - 20, landY = GROUND_Y + 12;
    drawCup(ctx, this.art, EGG_X, GROUND_Y, this.art.d.px);
    if (t < KIWI_UP) return;
    var x, y, h = KIWI_H, sx = 1, sy = 1;
    if (t < KIWI_TOP) {   // 衝出來：由小變大往上飛
      var u = easeOutCubic(clamp((t - KIWI_UP) / (KIWI_TOP - KIWI_UP)));
      x = lerp(EGG_X, landX, u * 0.5); y = lerp(cupTop + 40, 420, u); h = KIWI_H * lerp(0.25, 1.05, u);
    } else if (t < KIWI_LAND) {   // 落下（加速）
      var v = clamp((t - KIWI_TOP) / (KIWI_LAND - KIWI_TOP));
      x = lerp(EGG_X, landX, 0.5 + v * 0.5); y = lerp(420, landY, v * v); h = KIWI_H * lerp(1.05, 1, v);
      sy = 1 + v * v * 0.08; sx = 1 - v * v * 0.05;   // 往下衝時稍微拉長
    } else {   // 落地：先壓扁再彈回，之後輕輕彈跳
      var a = t - KIWI_LAND, k = Math.exp(-a * 6) * Math.cos(a * 22);
      x = landX; y = landY; sy = 1 - 0.22 * k; sx = 1 + 0.18 * k;
      if (a > 0.8) y -= Math.abs(Math.sin((a - 0.8) * 3.2)) * 18;
    }
    var shadowK = clamp(1 - (landY - y) / 200);
    ellipse(ctx, x, GROUND_Y + 10, 150 * sx * (0.4 + 0.6 * shadowK), 22 * (0.4 + 0.6 * shadowK), 'rgba(0,0,0,' + (0.35 * shadowK).toFixed(2) + ')');
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    this.drawKiwi(ctx, 0, 0, h);
    ctx.restore();
  };
  G.kiwiLanding = function () {   // 落地瞬間：震動、塵土、碰一聲
    this.screenShake = 0.4; this.flash = 0.08;
    this.sfx.play('smash');
    var gy = GROUND_Y + 4, x = EGG_X - 20;
    this.burst(x - 110, gy, [190, 200, 170], 22, 300, 6); this.burst(x + 110, gy, [190, 200, 170], 22, 300, 6);
    this.burst(x, gy - 40, [255, 240, 170], 30, 420, 4);
    this.floatText('碰！', GOLD, x - 250, GROUND_Y - 200, 64, 1.2);
  };
  G.drawKiwi = function (ctx, x, footY, h, clipY) {
    var img = this.env.kiwiImage;
    ctx.save();
    if (clipY !== undefined) { ctx.beginPath(); ctx.rect(x - 400, clipY - 800, 800, 800); ctx.clip(); }
    if (img && (img.naturalWidth || img.width)) {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, w = h * iw / ih;
      ctx.drawImage(img, x - w / 2, footY - h, w, h);
    } else {   // 圖還沒載入：先畫一個簡單的 Kiwi
      ellipse(ctx, x, footY - h * 0.45, h * 0.42, h * 0.45, 'rgb(170,118,82)');
      ellipse(ctx, x, footY - h * 0.38, h * 0.3, h * 0.3, 'rgb(205,170,135)');
      ellipse(ctx, x - h * 0.15, footY - h * 0.62, h * 0.025, h * 0.025, 'rgb(20,20,20)');
      ellipse(ctx, x + h * 0.15, footY - h * 0.62, h * 0.025, h * 0.025, 'rgb(20,20,20)');
      polygon(ctx, [[x - h * 0.05, footY - h * 0.66], [x + h * 0.05, footY - h * 0.66], [x, footY - h * 0.48]], 'rgb(235,232,222)');
    }
    ctx.restore();
  };
  G.drawGauge = function (ctx, force) {
    var thr = this.thr, x = W - 110, y = 90, w = 40, h = 300, top = thr * 1.4;
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 14); ctx.fillStyle = 'rgb(30,26,40)'; ctx.fill();
    var fill = clamp(force / top) * h, p = force / thr;
    var color = p < 0.7 ? GREEN : p < 1 ? GOLD : ORANGE;
    if (fill > 0) { roundRect(ctx, x, y + h - fill, w, fill, 10); ctx.fillStyle = rgb(color); ctx.fill(); }
    var ty = y + h - thr / top * h;
    ctx.fillStyle = rgb(RED); ctx.fillRect(x - 14, ty - 1.5, w + 28, 3);
    this.text(ctx, fmt(thr), 18, RED, x - 34, ty);
    if (this.attemptPeak > 0 && this.inAttempt) {
      var py = y + h - clamp(this.attemptPeak / top) * h;
      polygon(ctx, [[x + w + 4, py], [x + w + 16, py - 7], [x + w + 16, py + 7]], rgb(TEXT));
    }
    this.text(ctx, force.toFixed(1), 48, color, x + w / 2, y - 40);
    var by = y + h + 26, hp = clamp(this.hold / this.holdTime);
    roundRect(ctx, x - 40, by, w + 80, 14, 7); ctx.fillStyle = 'rgb(30,26,40)'; ctx.fill();
    if (hp > 0) {
      roundRect(ctx, x - 40, by, (w + 80) * hp, 14, 7); ctx.fillStyle = rgb(ORANGE); ctx.fill();
      this.text(ctx, '撐住！', 26, ORANGE, x + w / 2, by + 36);
    } else this.text(ctx, '撐住 ' + this.holdTime + ' 秒', 18, DIM, x + w / 2, by + 30);
  };
  G.drawHud = function (ctx) {
    var d = this.art.d;
    this.text(ctx, levelLabel(this.level) + '　' + d.name, 26, this.level === SPECIAL ? GOLD : TEXT, EGG_X, 30);
    if (this.modeName !== 'normal') this.text(ctx, this.cfg().label, 18, this.cfg().color, EGG_X, 58);
    this.text(ctx, '機會', 18, TEXT, 36, 30);
    for (var i = 0; i < this.maxAttempts; i++) this.miniArt.draw(ctx, 78 + i * 30, 44, 28, 0, 0, i >= this.attempts);
    this.text(ctx, '實際大小 ' + d.size, 18, TEXT, EGG_X, GROUND_Y + 30);
    if (this.state === 'play' || this.state === 'fail') {
      var how = this.env.grip.connected ? '握力到 ' + fmt(this.thr) + ' 以上並撐住 ' + this.holdTime + ' 秒就能捏破！'
        : '沒有握力球時，按住畫面也可以捏';
      this.text(ctx, how, 18, DIM, EGG_X, GROUND_Y + 56);
    }
    if (this.state === 'play' || this.state === 'smash') this.drawButton(ctx, this.button('menu', W - 100, H - 54, 88, 40, '選單'));
  };
  G.drawStatus = function (ctx) {
    var g = this.env.grip, msg = g.status;
    this.text(ctx, msg, 16, g.connected ? GREEN : DIM, 14, H - 18, { align: 'left', shadow: false });
    if (this.state === 'menu') this.text(ctx, '版本 ' + VERSION, 14, DIM, W - 14, H - 18, { align: 'right', shadow: false });
  };
  G.drawEffects = function (ctx) {
    var i;
    for (i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1, p[7] * Math.min(1, p[4] / p[5] * 1.5)), 0, Math.PI * 2);
      ctx.fillStyle = p[6]; ctx.fill();
    }
    for (i = 0; i < this.texts.length; i++) {
      var t = this.texts[i];
      this.text(ctx, t.s, t.size, t.color, t.x, t.y, { shadow: false, alpha: Math.min(1, t.life / t.max * 2) });
    }
  };
  G.drawMenu = function (ctx) {
    var self = this;
    this.drawSky(ctx, 1);
    this.panel(ctx, 40, 18, W - 80, 170, 0.66);
    this.text(ctx, '捏蛋大挑戰', 72, GOLD, W / 2, 70);
    var c = this.cfg();
    this.text(ctx, '握力超過門檻、撐住 ' + c.hold + ' 秒，就能把蛋捏破！每關 ' + c.attempts + ' 次機會', 24, TEXT, W / 2, 135);
    this.text(ctx, c.label + (c.ratio !== 1 ? '：握力門檻 ×' + c.ratio : ''), 17, c.color, W / 2, 168);
    this.drawButton(ctx, this.button('music', W - 200, 30, 148, 40, this.save.music ? '♪ 音樂：開' : '♪ 音樂：關', { on: this.save.music }));
    this.menuArts.forEach(function (art, i) {
      var lv = i + 1, x = 70 + i * 91, h = 24 + art.d.px * 0.32, locked = lv > self.unlocked();
      art.draw(ctx, x, GROUND_Y, h, 0, 0, locked);
      if (locked) self.text(ctx, '?', 26, DIM, x, GROUND_Y - h / 2);
      if (self.save.best[self.mode()][String(lv)]) self.text(ctx, '★', 20, GOLD, x, GROUND_Y - h - 14);   // 破過的關卡
    });
    var furthest = 0;   // 這個難度最遠破到第幾關（選單上的蛋只是進度展示，不能點選）
    for (var lv = 1; lv <= LEVELS; lv++) if (this.save.best[this.mode()][String(lv)]) furthest = lv;
    this.panel(ctx, 140, 200, W - 280, 58, 0.66);
    this.text(ctx, '從第 1 關麻雀蛋開始，一路挑戰到恐龍蛋', 24, TEXT, W / 2, 218);
    var sp = this.save.best[this.mode()][String(SPECIAL)];
    this.text(ctx, sp ? '連特別關的奇異鳥蛋都捏破了！再挑戰一次？' : furthest === LEVELS ? '已經全部捏破過了！再挑戰一次？'
      : furthest ? '最遠破到第 ' + furthest + ' 關（' + EGGS[furthest - 1].name + '）' : '還沒挑戰過', 16, furthest === LEVELS ? GOLD : DIM, W / 2, 244);
    var g = this.env.grip, bw = 230, gap = 16, x0 = (W - (bw * 3 + gap * 2)) / 2, by = GROUND_Y + 20;
    this.drawButton(ctx, this.button('mode', x0, by, bw, 46, '難度：' + this.cfg().short + '（點我切換）', { fill: this.cfg().fill, ink: this.cfg().ink }));
    this.drawButton(ctx, this.button('start', x0 + bw + gap, by, bw, 46, '從第 1 關開始', { primary: true }));
    var gl = g.connected ? '✔ 已連線（點此重連）' : this.env.bluetoothSupported ? '連接握力球' : '此瀏覽器不支援藍牙';
    this.drawButton(ctx, this.button('grip', x0 + (bw + gap) * 2, by, bw, 46, gl, g.connected ? { ink: GREEN } : {}));   // 已連線：深底綠字，避免和難度按鈕的顏色混淆
  };
  G.drawIntro = function (ctx) {
    var d = this.art.d, g = this.art.geometry(GROUND_Y, d.px, 0);
    this.drawShadow(ctx, EGG_X, g.rw);
    this.art.draw(ctx, EGG_X, GROUND_Y, d.px, 0, 0, false, easeOutBack(clamp(this.introT / 0.5)));
    this.panel(ctx, W / 2 - 330, 40, 660, 170);
    this.text(ctx, levelLabel(this.level) + '　' + d.name, 48, GOLD, W / 2, 82);
    this.text(ctx, '需要握力 ' + fmt(this.thr) + '，撐住 ' + this.holdTime + ' 秒', 26, TEXT, W / 2, 135);
    this.text(ctx, d.fact, 18, DIM, W / 2, 178);
    if (this.introT > 1.0) this.drawButton(ctx, this.button('go', W / 2 - 110, GROUND_Y + 30, 220, 46, '開始（或直接捏下去）', { primary: true }));
  };
  G.drawResult = function (ctx, title, color, lines, buttons) {
    var self = this;
    this.panel(ctx, W / 2 - 330, 60, 660, 300, 0.86);
    this.text(ctx, title, 48, color, W / 2, 112);
    lines.forEach(function (l, i) { self.text(ctx, l[0], 24, l[1], W / 2, 175 + i * 40); });
    var bw = 180, gap = 14, x0 = W / 2 - (bw * buttons.length + gap * (buttons.length - 1)) / 2;
    buttons.forEach(function (b, i) { self.drawButton(ctx, self.button(b[0], x0 + i * (bw + gap), 296, bw, 46, b[1], { primary: i === 0 })); });
  };

  G.draw = function (ctx) {
    this.buttons = [];
    RENDER.ps = this.pixelScale || 1;
    RENDER.make = this.env.makeCanvas || null;
    ctx.save();
    if (this.screenShake > 0) { var k = this.screenShake * 30; ctx.translate(uniform(Math.random, -k, k), uniform(Math.random, -k, k)); }
    if (this.state === 'menu') this.drawMenu(ctx);
    else {
      this.drawSky(ctx, this.level);
      if (this.state === 'intro') this.drawIntro(ctx);
      else if (this.state === 'play' || this.state === 'fail') { this.drawEggPlay(ctx); this.drawHud(ctx); this.drawGauge(ctx, this.force || 0); }
      else { this.drawSmash(ctx); this.drawHud(ctx); }
      this.drawEffects(ctx);
      var d = this.art.d;
      if (this.state === 'clear') {
        this.drawResult(ctx, d.name + ' 捏破了！', GOLD, [
          ['用時 ' + this.clearTime.toFixed(2) + ' 秒' + (this.newBest ? '　新紀錄！' : ''), TEXT],
          ['最高握力 ' + this.levelPeak.toFixed(1) + '　·　第 ' + (this.maxAttempts - this.attempts + 1) + ' 次成功', TEXT],
          ['下一關：' + EGGS[this.level].name + '（需要 ' + fmt(threshold(this.level + 1, this.modeName)) + '）', DIM]],
          [['next', '下一關'], ['menu', '選單']]);
      } else if (this.state === 'fail') {
        this.drawResult(ctx, '蛋還完好如初…', RED, [
          ['這關最高握力 ' + this.levelPeak.toFixed(1) + '　/　需要 ' + fmt(this.thr), TEXT],
          ['提示：用力捏到門檻以上，再撐住 ' + this.holdTime + ' 秒', DIM],
          [{ kids: '多練習幾次，握力會越來越強！', normal: '太難的話，可以在選單切換成兒童模式',
             hard: '困難模式的門檻比較高，可以先在一般模式練習' }[this.modeName], DIM]],
          [['retry', '再挑戰'], ['menu', '選單']]);
      } else if (this.state === 'ending') {
        var rx = W - 380, bests = this.save.best[this.mode()], total = 0, maxPeak = 0;
        for (var lv = 1; lv <= LEVELS; lv++) { var b = bests[String(lv)]; if (b) { total += b.time; maxPeak = Math.max(maxPeak, b.peak); } }
        this.panel(ctx, rx, 90, 340, 300, 0.8);
        this.text(ctx, '全部捏破！', 48, GOLD, rx + 170, 130);
        this.text(ctx, '孵出小恐龍了！', 26, GREEN, rx + 170, 172);
        this.text(ctx, '10 關最佳時間合計 ' + total.toFixed(1) + ' 秒・最強握力 ' + maxPeak.toFixed(1), 16, TEXT, rx + 170, 208);
        this.text(ctx, '★ 特別關出現了：奇異鳥蛋', 20, GOLD, rx + 170, 246);
        this.text(ctx, '需要握力 ' + fmt(threshold(SPECIAL, this.modeName)) + '，敢挑戰嗎？（捏一下開始）', 15, DIM, rx + 170, 274);
        this.drawButton(ctx, this.button('special', rx + 14, 318, 172, 46, '挑戰特別關', { primary: true }));
        this.drawButton(ctx, this.button('tomenu-end', rx + 196, 318, 130, 46, '回選單'));
      } else if (this.state === 'ending2') {
        var rx2 = W - 380;
        this.panel(ctx, rx2, 90, 340, 300, 0.8);
        this.text(ctx, '特別關完成！', 44, GOLD, rx2 + 170, 132);
        this.text(ctx, '孵出奇異鳥 Kiwi 了！', 26, GREEN, rx2 + 170, 180);
        this.text(ctx, '用時 ' + this.clearTime.toFixed(2) + ' 秒・最高握力 ' + this.levelPeak.toFixed(1), 18, TEXT, rx2 + 170, 226);
        this.text(ctx, '你的握力是真正的大力士！', 18, DIM, rx2 + 170, 260);
        this.drawButton(ctx, this.button('tomenu-end', rx2 + 70, 318, 200, 46, '回選單', { primary: true }));
      }
    }
    this.drawStatus(ctx);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.86 * this.flash / 0.18) + ')'; ctx.fillRect(0, 0, W, H); }
  };

  var api = { VERSION: VERSION, Game: Game, W: W, H: H, EGGS: EGGS, threshold: threshold, LEVELS: LEVELS, SPECIAL: SPECIAL };
  root.EggGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
