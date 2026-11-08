/* =============================================================
 * InkFX · 动态特效层
 * -------------------------------------------------------------
 * 组件原型：CodePen 热门作品「30,000 Particles」 by soulwire
 *          https://codepen.io/soulwire/pen/DdGRYG
 *          核心算法：粒子网格 + 鼠标斥力场 + 阻尼(DRAG) + 弹性归位(EASE)
 * 本站适配：
 *   1) 原作黑色背景 / 30,000 白点 → 宣纸墨尘：赭金、朱砂、竹青三色微点，
 *      密度随视口自适应（上限约 1300 点），并随页面明暗区自动调节亮度；
 *   2) 增加缓慢漂浮、近邻牵引线、点击/操作成功的墨晕冲击波 burst()；
 *   3) 页面切换水墨晕染转场、按钮墨晕涟漪、滚动渐显、数字滚动；
 *   4) 触摸支持、DPR 适配、后台标签页暂停、prefers-reduced-motion 降级。
 * ============================================================= */
(function (global) {
  'use strict';

  var reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('ink-canvas');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var W = 0, H = 0, DPR = 1, spacing = 34, cols = 0, rows = 0;
  var particles = [], raf = 0, running = false, t0 = Date.now();
  var mouse = { x: -9999, y: -9999, px: -9999, py: -9999, active: false, vx: 0, vy: 0 };
  var THICK = 145 * 145, DRAG = 0.92, EASE = 0.055;
  var theme = 1;

  var PALETTE = [
    [196, 164, 106],  // 赭金
    [158, 59, 50],    // 朱砂
    [63, 91, 76],     // 竹青
    [232, 214, 176]   // 纸光
  ];

  function resize() {
    if (!ctx) return;
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    W = global.innerWidth; H = global.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    spacing = W < 600 ? 44 : W < 1100 ? 38 : 34;
    // 控制总点数，保证低端设备也能流畅运行
    while ((Math.ceil(W / spacing) + 2) * (Math.ceil(H / spacing) + 2) > 1300) spacing += 4;
    cols = Math.ceil(W / spacing) + 2;
    rows = Math.ceil(H / spacing) + 2;
    particles = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ox = (c - 1) * spacing + (Math.random() - .5) * spacing * .55;
        var oy = (r - 1) * spacing + (Math.random() - .5) * spacing * .55;
        particles.push({
          ox: ox, oy: oy, x: ox, y: oy, vx: 0, vy: 0,
          size: .7 + Math.random() * 1.5,
          col: PALETTE[(Math.random() * PALETTE.length) | 0],
          alpha: .18 + Math.random() * .42,
          phase: Math.random() * Math.PI * 2,
          amp: .3 + Math.random() * .9
        });
      }
    }
  }

  function frame() {
    if (!running) return;
    var now = Date.now(), t = (now - t0) * .001;
    ctx.clearRect(0, 0, W, H);

    // 依据滚动位置估算当前视口明暗：深色 hero 区更亮，浅色纸面区更淡
    var hero = document.querySelector('.hero');
    var darkRatio = 0;
    if (hero && document.getElementById('page-home').classList.contains('is-active')) {
      var rect = hero.getBoundingClientRect();
      darkRatio = Math.max(0, Math.min(1, (Math.min(rect.bottom, H) - Math.max(rect.top, 0)) / H));
    }
    theme += (darkRatio - theme) * .06;

    var i, p, d, dx, dy, f, ang;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      if (mouse.active) {
        dx = mouse.x - p.x; dy = mouse.y - p.y;
        d = dx * dx + dy * dy;
        if (d < THICK && d > 1) {
          f = -THICK / d;
          ang = Math.atan2(dy, dx);
          p.vx += f * Math.cos(ang) * .55 + mouse.vx * .012;
          p.vy += f * Math.sin(ang) * .55 + mouse.vy * .012;
        }
      }
      p.vx *= DRAG; p.vy *= DRAG;
      p.x += p.vx + (p.ox - p.x) * EASE;
      p.y += p.vy + (p.oy - p.y) * EASE;

      var fx = p.x + Math.sin(t * .42 + p.phase) * p.amp;
      var fy = p.y + Math.cos(t * .33 + p.phase) * p.amp;
      var glow = .25 + theme * .75;
      var a = p.alpha * glow * (.75 + .25 * Math.sin(t * 1.15 + p.phase));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ',' + a.toFixed(3) + ')';
      ctx.arc(fx, fy, p.size, 0, 6.2832);
      ctx.fill();
    }

    // 近邻牵引线：只取部分粒子，营造纸上墨丝的呼吸感
    if (theme > .18) {
      ctx.lineWidth = .5;
      for (i = 0; i < particles.length; i += 3) {
        p = particles[i];
        var q = particles[i + 1];
        if (!q || (i + 1) % cols === 0) continue;
        var dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist < spacing * 1.35) {
          ctx.strokeStyle = 'rgba(196,164,106,' + (.055 * theme * (1 - dist / (spacing * 1.35))).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }

    mouse.vx *= .82; mouse.vy *= .82;
    raf = requestAnimationFrame(frame);
  }

  function start() { if (running || !ctx || reduce) return; running = true; t0 = Date.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function bind() {
    global.addEventListener('resize', function () { resize(); }, { passive: true });
    global.addEventListener('mousemove', function (e) {
      mouse.vx = e.clientX - (mouse.px === -9999 ? e.clientX : mouse.px);
      mouse.vy = e.clientY - (mouse.py === -9999 ? e.clientY : mouse.py);
      mouse.px = e.clientX; mouse.py = e.clientY;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    global.addEventListener('mouseout', function () { mouse.active = false; }, { passive: true });
    global.addEventListener('touchmove', function (e) {
      var t = e.touches[0]; if (!t) return;
      mouse.x = t.clientX; mouse.y = t.clientY; mouse.active = true;
    }, { passive: true });
    global.addEventListener('touchend', function () { mouse.active = false; }, { passive: true });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  }

  /* 墨晕冲击波：交互成功时从某点向外推开粒子 */
  function burst(x, y, power) {
    if (!particles.length) return;
    power = power || 16;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], dx = p.ox - x, dy = p.oy - y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 320) {
        var k = (1 - d / 320) * power;
        p.vx += dx / d * k; p.vy += dy / d * k;
      }
    }
  }

  /* 水墨晕染转场 */
  var wipe = document.getElementById('ink-wipe');
  function transition() {
    if (!wipe || reduce) return;
    wipe.classList.remove('run'); void wipe.offsetWidth; wipe.classList.add('run');
  }

  /* 按钮墨晕涟漪 */
  function rippleAt(btn, e) {
    if (reduce) return;
    var r = document.createElement('span');
    r.className = 'ink-ripple';
    var box = btn.getBoundingClientRect();
    r.style.left = ((e && e.clientX ? e.clientX - box.left : box.width / 2)) + 'px';
    r.style.top = ((e && e.clientY ? e.clientY - box.top : box.height / 2)) + 'px';
    r.style.width = r.style.height = Math.max(box.width, box.height) / 4 + 'px';
    btn.appendChild(r);
    setTimeout(function () { r.remove(); }, 640);
  }

  /* 滚动渐显 */
  function observeReveal(root) {
    var scope = root || document;
    var els = Array.prototype.slice.call(scope.querySelectorAll('.reveal:not(.in)'));
    if (!els.length) return;
    // 兜底：任何情况下 1.4s 后都保证内容可见，避免白屏
    var bail = setTimeout(function () { els.forEach(function (el) { el.classList.add('in'); }); }, 1400);
    if (!('IntersectionObserver' in global)) {
      els.forEach(function (el) { el.classList.add('in'); }); clearTimeout(bail); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (el, i) {
      var box = el.getBoundingClientRect();
      if (box.top < global.innerHeight * .96 && box.bottom > 0) {
        // 首屏内元素用短延迟错峰渐显，仍然保持动效
        setTimeout(function () { el.classList.add('in'); }, 70 + i * 55);
      } else io.observe(el);
    });
  }

  /* 数字滚动 */
  function countTo(el, target, dur) {
    if (reduce) { el.textContent = target; return; }
    dur = dur || 900;
    var from = parseInt(el.textContent, 10) || 0, s = performance.now();
    function tick(now) {
      var k = Math.min(1, (now - s) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (target - from) * e);
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* 签到码：确定性点阵（含定位角），由文本哈希生成，无需外部依赖 */
  function qr(el, text) {
    if (!el) return;
    var n = 25, cells = [], h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    var rnd = function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    for (var y = 0; y < n; y++) { cells[y] = []; for (var x = 0; x < n; x++) cells[y][x] = rnd() > .52 ? 1 : 0; }
    function finder(ox, oy) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
        cells[oy + y][ox + x] = (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) ? 1 : 0;
      }
      for (var y2 = -1; y2 <= 7; y2++) for (var x2 = -1; x2 <= 7; x2++) {
        var yy = oy + y2, xx = ox + x2;
        if (yy >= 0 && yy < n && xx >= 0 && xx < n && (y2 === -1 || y2 === 7 || x2 === -1 || x2 === 7)) cells[yy][xx] = 0;
      }
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    var rects = '';
    for (var y3 = 0; y3 < n; y3++) for (var x3 = 0; x3 < n; x3++) {
      if (cells[y3][x3]) rects += '<rect x="' + x3 + '" y="' + y3 + '" width="1" height="1"/>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="签到二维码"><rect width="' + n + '" height="' + n + '" fill="#fff"/><g fill="#2A2620">' + rects + '</g></svg>';
  }

  /* 启动 */
  if (ctx) { resize(); bind(); start(); }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.btn');
    if (btn && !btn.disabled) rippleAt(btn, e);
  }, true);

  global.InkFX = {
    burst: burst, transition: transition, reveal: observeReveal,
    countTo: countTo, qr: qr, reduced: reduce
  };
})(window);
