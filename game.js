/* 捏蛋大挑戰（網頁版）— 遊戲本體。
 * 不直接碰 DOM：由 index.html 提供 env（畫布 ctx、存檔、音效、握力球），所以也能在 Node 裡測試。
 * 為了 iPad iOS 12（Bluefy 瀏覽器）相容：不用 ?. ?? 、class 欄位、Array.at、roundRect 等新語法。
 * 邏輯座標固定 960x540，由 index.html 等比例縮放。
 */
(function (root) {
  'use strict';

  var VERSION = '2026.10.19-4';   // 每次發佈都改，選單右下角會顯示，方便確認拿到的是不是最新版
  var W = 960, H = 540, GROUND_Y = 450, EGG_X = 400;
  // 三種難度：握力門檻倍率、要撐住幾秒、每關幾次機會
  var MODES = {
    kids:   { label: '兒童模式', short: '兒童', ratio: 0.6,  hold: 0.5, attempts: 5, color: [96, 220, 150] },
    normal: { label: '一般模式', short: '一般', ratio: 1.0,  hold: 0.5, attempts: 5, color: [240, 238, 245] },
    hard:   { label: '困難模式', short: '困難', ratio: 1.25, hold: 0.5, attempts: 5, color: [255, 90, 90] }
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
    { name: '恐龍蛋', px: 330, aspect: 0.72, k: 0.10, base: [142, 122, 100], pattern: 'fossil', spot: [104, 88, 72], crack: [255, 170, 60], size: '大的超過 40 公分', fact: '恐龍蛋化石在世界各地都有發現，有些裡面還保存著小恐龍胚胎。' }
  ];
  var LEVELS = EGGS.length;
  var SKIES = [[[150, 200, 240], [215, 235, 250]], [[140, 190, 235], [210, 232, 245]], [[130, 180, 230], [205, 225, 240]],
    [[120, 170, 225], [230, 215, 200]], [[110, 150, 210], [240, 200, 170]], [[95, 125, 190], [240, 180, 150]],
    [[70, 90, 150], [225, 150, 130]], [[55, 65, 120], [215, 130, 100]], [[50, 40, 80], [200, 100, 70]], [[40, 22, 40], [230, 90, 40]]];
  var GROUNDS = [[150, 118, 88], [145, 112, 84], [140, 108, 80], [132, 100, 76], [124, 94, 72],
    [116, 88, 68], [104, 80, 64], [92, 72, 60], [80, 62, 54], [64, 46, 42]];

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
  EggArt.prototype.draw = function (ctx, cx, ground, height, squash, crack, locked) {
    var k = this.d.k, g = this.geometry(ground, height, squash || 0), rw = g.rw, rh = g.rh, cy = g.cy;
    var base = locked ? [48, 46, 60] : this.d.base;
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
    if (crack > 0) this.drawCracks(ctx, cx, cy, rw, rh, crack);
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
  function drawDino(ctx, x, baseY, s, t, capColor) {
    var g = 'rgb(122,206,112)', gd = 'rgb(78,156,80)', belly = 'rgb(228,242,176)', spike = 'rgb(255,150,70)';
    var bob = Math.sin(t * 4) * 3 * s, wave = Math.sin(t * 8) * 10 * s;
    ellipse(ctx, x, baseY - 125 * s + bob + 70 * s, 58 * s, 70 * s, g);
    ellipse(ctx, x, baseY - 95 * s + bob + 50 * s, 36 * s, 50 * s, belly);
    [-1, 1].forEach(function (side) {
      ellipse(ctx, x + side * 52 * s, baseY - 92 * s + bob - (side > 0 ? wave : 0) + 18 * s, 12 * s, 18 * s, gd);
    });
    var hx = x, hy = baseY - 150 * s + bob, hr = 56 * s;
    [-26, 0, 26].forEach(function (dx, i) {
      var tip = hy - hr - (i === 1 ? 16 : 10) * s;
      polygon(ctx, [[hx + (dx - 12) * s, hy - hr * 0.8], [hx + (dx + 12) * s, hy - hr * 0.8], [hx + dx * s, tip]], spike);
    });
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = gd; ctx.lineWidth = Math.max(1, 3 * s); ctx.stroke();
    var blink = (t % 3.2) < 0.12;
    [-1, 1].forEach(function (side) {
      var ex = hx + side * 22 * s, ey = hy - 6 * s;
      if (blink) {
        ctx.beginPath(); ctx.moveTo(ex - 10 * s, ey); ctx.lineTo(ex + 10 * s, ey);
        ctx.strokeStyle = 'rgb(30,30,30)'; ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
      } else {
        ellipse(ctx, ex, ey, 14 * s, 14 * s, '#fff');
        ellipse(ctx, ex + 2 * s, ey + 2 * s, 8 * s, 8 * s, 'rgb(25,25,30)');
        ellipse(ctx, ex + 5 * s, ey - 2 * s, 3 * s, 3 * s, '#fff');
      }
      ellipse(ctx, ex + side * 6 * s - s, ey + 18.5 * s, 9 * s, 4.5 * s, 'rgb(255,150,150)');
    });
    ctx.beginPath(); ctx.ellipse(hx, hy + 17 * s, 16 * s, 11 * s, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = 'rgb(40,70,40)'; ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
    var cap = [[hx - 46 * s, hy - hr * 0.62]];
    for (var i = 1; i < 8; i++) cap.push([hx - 46 * s + i * 92 * s / 8, hy - hr * 0.62 + (i % 2 ? 8 : -4) * s]);
    cap.push([hx + 46 * s, hy - hr * 0.62], [hx + 30 * s, hy - hr * 1.25], [hx - 30 * s, hy - hr * 1.25]);
    polygon(ctx, cap, rgb(capColor), rgb(shade(capColor, -0.4)), 2);
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
    if (on) { this.next = t + 0.1; }
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
  Music.prototype.tick = function () {   // 每幀呼叫：預先排好接下來 0.2 秒內的音符
    if (!this.enabled) return;
    var now = this.ac.currentTime, eighth = 60 / BPM / 2;
    if (this.next < now - 0.3) this.next = now + 0.05;   // 分頁在背景太久，重新對時
    while (this.next < now + 0.2) {
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
    this.menuArts = EGGS.map(function (_, i) { return new EggArt(i + 1); });
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
        MODE_ORDER.forEach(function (m) {
          if (d.unlocked && d.unlocked[m]) s.unlocked[m] = d.unlocked[m];
          if (d.best && d.best[m]) s.best[m] = d.best[m];
        });
      }
    } catch (e) { /* 沒有存檔或格式錯誤 */ }
    return s;
  };
  G.saveData = function () { this.save.mode = this.modeName; try { this.env.storage.set(JSON.stringify(this.save)); } catch (e) { } };
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
    this.state = 'smash'; this.smashT = 0; this.animT = 0;
    this.screenShake = 0.45; this.flash = 0.18;
    this.sfx.play('smash');
    if (this.music) this.music.duck(this.level === LEVELS ? 3.0 : 1.6);
    this.clearTime = this.time - (this.levelStart === null ? this.time : this.levelStart);
    var g = this.art.geometry(GROUND_Y, d.px, 1.0);
    this.smashGeom = g;
    var final = this.level === LEVELS, n = 26 + this.level * 3;
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
    if (final) { this.burst(EGG_X, g.cy, ORANGE, 60, 520, 5); this.burst(EGG_X, g.cy, GOLD, 40, 380, 5); }
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
    this.state = this.level === LEVELS ? 'ending' : 'clear';
    this.sfx.play('win');
  };

  // ---- 特效 ----
  G.floatText = function (s, color, x, y, size, life) {
    life = life || 1.4;
    this.texts.push({ s: s, color: color, x: x, y: y, life: life, max: life, size: size || 26 });
  };
  G.burst = function (x, y, color, n, speed, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * speed, life = 0.5 + Math.random() * 0.5;
      this.particles.push([x, y, Math.cos(a) * v, Math.sin(a) * v - 150, life, life, rgb(color), size || 5]);
    }
  };
  G.confetti = function () {
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
    if (this.music) this.music.tick();
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
      if (this.level === LEVELS && this.smashT > 0.55 && !this.pipped) { this.pipped = true; this.sfx.play('pip'); }
      if (this.smashT > (this.level === LEVELS ? 3.0 : 2.3)) { this.pipped = false; this.finishLevel(); }
    } else if (this.state === 'ending') {
      this.animT += dt; this.confetti();
    }
  };

  G.gripConfirm = function (force) {
    // 捏一下握力球＝按「下一步」。要先放開過 (armed) 才算新的一下
    if (force < START_FORCE) this.btnArmed = true;
    else if (this.btnArmed && force >= CONFIRM_FORCE) {
      this.btnArmed = false;
      if (['menu', 'intro', 'clear', 'fail', 'ending'].indexOf(this.state) >= 0 && this.stateT > CONFIRM_DELAY) this.confirm();
    }
  };
  G.confirm = function () {   // 每個畫面的「預設動作」
    var s = this.state;
    if (s === 'menu') this.startLevel(1);   // 一律從第 1 關開始（不能選關）
    else if (s === 'intro') this.state = 'play';
    else if (s === 'clear') this.startLevel(this.level + 1);
    else if (s === 'fail') this.startLevel(this.level);
    else if (s === 'ending') this.toMenu();
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
    if (!this.inAttempt && force >= START_FORCE) {
      this.inAttempt = true; this.attemptPeak = 0;
      if (this.levelStart === null) this.levelStart = this.time;
    }
    if (this.inAttempt) {
      this.attemptPeak = Math.max(this.attemptPeak, force);
      this.levelPeak = Math.max(this.levelPeak, force);
      var letGo = Math.max(2, thr * 0.3);
      if (force <= RELEASE_FORCE || (this.attemptPeak > letGo * 1.3 && force < letGo)) { this.inAttempt = false; peakEnd = this.attemptPeak; }
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
    return { x: x, y: y, w: w, h: h, label: label, primary: opts.primary, on: opts.on };
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
    if (id === 'grip') this.env.connectGrip(false);
    else if (id === 'gripall') this.env.connectGrip(true);
    else if (id === 'mode') this.cycleMode();
    else if (id === 'music') this.toggleMusic();
    else if (id === 'start' || id === 'next' || id === 'retry' || id === 'go' || id === 'tomenu-end') this.confirm();
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
    ctx.fillStyle = b.primary ? 'rgb(79,140,255)' : b.on ? 'rgba(255,205,70,0.9)' : 'rgba(40,36,58,0.92)';
    ctx.fill();
    ctx.strokeStyle = b.primary ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    this.text(ctx, b.label, 20, b.on ? [30, 26, 20] : TEXT, b.x + b.w / 2, b.y + b.h / 2 + 1, { shadow: false });
  };
  G.drawSky = function (ctx, level) {
    var sk = SKIES[level - 1], grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, rgb(sk[0])); grad.addColorStop(1, rgb(sk[1]));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, GROUND_Y);
    var gr = GROUNDS[level - 1];
    ctx.fillStyle = rgb(gr); ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = rgb(shade(gr, 0.25)); ctx.fillRect(0, GROUND_Y - 1, W, 3);
    if (level === LEVELS) {   // 史前火山
      polygon(ctx, [[620, GROUND_Y], [760, 250], [820, 250], [960, GROUND_Y]], 'rgb(60,30,35)');
      polygon(ctx, [[760, 250], [820, 250], [800, 275], [775, 270]], 'rgb(255,110,40)');
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
    var d = this.art.d, g = this.smashGeom, t = this.animT, final = this.level === LEVELS, i;
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
      if (pop > 0) drawDino(ctx, EGG_X, cupTop + 45 + (1 - pop) * 160, 1.3 * Math.max(0.01, pop), this.time, d.base);
      drawCup(ctx, this.art, EGG_X, GROUND_Y, d.px);
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
    this.text(ctx, '第 ' + this.level + ' 關　' + d.name, 26, TEXT, EGG_X, 30);
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
    this.text(ctx, furthest === LEVELS ? '已經全部捏破過了！再挑戰一次？'
      : furthest ? '最遠破到第 ' + furthest + ' 關（' + EGGS[furthest - 1].name + '）' : '還沒挑戰過', 16, furthest === LEVELS ? GOLD : DIM, W / 2, 244);
    var g = this.env.grip, bw = 230, gap = 16, x0 = (W - (bw * 3 + gap * 2)) / 2, by = GROUND_Y + 20;
    this.drawButton(ctx, this.button('mode', x0, by, bw, 46, '難度：' + this.cfg().short + '（點我切換）', { on: this.modeName !== 'normal' }));
    this.drawButton(ctx, this.button('start', x0 + bw + gap, by, bw, 46, '從第 1 關開始', { primary: true }));
    var gl = g.connected ? '✔ 已連線握力球' : this.env.bluetoothSupported ? '連接握力球' : '此瀏覽器不支援藍牙';
    this.drawButton(ctx, this.button('grip', x0 + (bw + gap) * 2, by, bw, 46, gl, { on: g.connected }));
    if (!g.connected && this.env.bluetoothSupported) {   // 名稱篩選找不到時，列出全部藍牙裝置讓使用者自己挑
      this.text(ctx, '找不到握力球？', 15, DIM, W - 80, 196);
      this.drawButton(ctx, this.button('gripall', W - 150, 210, 140, 44, '列出所有裝置'));
    }
  };
  G.drawIntro = function (ctx) {
    var d = this.art.d, g = this.art.geometry(GROUND_Y, d.px, 0);
    this.drawShadow(ctx, EGG_X, g.rw);
    this.art.draw(ctx, EGG_X, GROUND_Y, Math.max(2, d.px * easeOutBack(clamp(this.introT / 0.5))), 0, 0, false);
    this.panel(ctx, W / 2 - 330, 40, 660, 170);
    this.text(ctx, '第 ' + this.level + ' 關　' + d.name, 48, GOLD, W / 2, 82);
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
        this.text(ctx, '孵出小恐龍了！', 26, GREEN, rx + 170, 178);
        this.text(ctx, '10 關最佳時間合計 ' + total.toFixed(1) + ' 秒', 18, TEXT, rx + 170, 222);
        this.text(ctx, '最強握力 ' + maxPeak.toFixed(1), 18, TEXT, rx + 170, 252);
        this.drawButton(ctx, this.button('tomenu-end', rx + 70, 310, 200, 46, '回選單', { primary: true }));
      }
    }
    this.drawStatus(ctx);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.86 * this.flash / 0.18) + ')'; ctx.fillRect(0, 0, W, H); }
  };

  var api = { VERSION: VERSION, Game: Game, W: W, H: H, EGGS: EGGS, threshold: threshold, LEVELS: LEVELS };
  root.EggGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
