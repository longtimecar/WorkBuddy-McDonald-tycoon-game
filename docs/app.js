/* 麦当劳大亨 · Web UI 控制器（依赖 data.js + tycoon.js） */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var game = null;
  var setup = { marketing: 0 };
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------- 工具 ----------
  function fmt(n) { return '¥' + (Math.round(n * 10) / 10).toLocaleString('zh-CN'); }
  function fmt0(n) { return '¥' + Math.round(n).toLocaleString('zh-CN'); }
  function show(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $(id).classList.add('active');
    window.scrollTo(0, 0);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* Toast 轻提示 */
  function toast(text) {
    var root = $('toast-root');
    if (!root) return;
    var t = el('div', 'toast', text);
    root.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 1900);
  }

  /* 数字滚动动画 */
  function countUp(elm, target, duration, prefix) {
    if (!elm) return;
    if (reduceMotion) { elm.textContent = (prefix || '') + Math.round(target).toLocaleString('zh-CN'); return; }
    var t0 = null;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / (duration || 700));
      var eased = 1 - Math.pow(1 - p, 3);
      elm.textContent = (prefix || '') + Math.round(target * eased).toLocaleString('zh-CN');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* 滚动揭示（首页特性卡） */
  function initReveal() {
    if (typeof IntersectionObserver === 'undefined') {
      var all = document.querySelectorAll('.reveal');
      for (var i = 0; i < all.length; i++) all[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (n) { io.observe(n); });
  }

  /* 按钮按下反馈 */
  function bindPress(btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.classList.remove('pressed');
      void btn.offsetWidth;
      btn.classList.add('pressed');
    });
  }

  // ---------- 首页 ----------
  function urlSeed() {
    try {
      var m = /[?&]seed=(\d+)/.exec(window.location.search);
      return m ? parseInt(m[1], 10) : null;
    } catch (e) { return null; }
  }

  function initHome() {
    var n = MCD_DATA.menu.length;
    $('home-menu-badge').textContent = '真实菜单 ' + n + ' 款';
    $('btn-start').addEventListener('click', function () {
      game = new MCD.Tycoon(null, urlSeed());
      setup = { marketing: 0 };
      renderDay();
      show('screen-day');
    });
    initReveal();
  }

  // ---------- 每日备战 ----------
  function renderDay() {
    clearDanmaku();
    var d = game.day + 1;
    $('day-title').textContent = '第 ' + d + ' / ' + MCD.CHALLENGE_DAYS + ' 天';
    $('day-source').textContent = MCD_DATA.menuSource || '演示菜单';
    countUp($('day-cash'), game.cash, 600, '¥');
    $('day-rep').textContent = Math.round(game.reputation);
    var bar = $('day-rep-bar');
    bar.style.width = game.reputation + '%';
    bar.className = game.reputation < 60 ? 'low' : (game.reputation < 80 ? 'mid' : 'high');

    renderPrices();
    renderStock();
    renderMarketing();
    updateAttr();
  }

  function renderPrices() {
    var box = $('price-list');
    box.innerHTML = '';
    var cats = ['burger', 'side', 'drink', 'dessert', 'breakfast'];
    cats.forEach(function (cat) {
      var items = game.by_cat[cat];
      if (!items || !items.length) return;
      var head = el('div', 'cat-head', MCD.CATEGORY_LABEL[cat] + '（' + items.length + ' 款）');
      box.appendChild(head);
      items.forEach(function (it) {
        var row = el('div', 'price-row');
        var nm = el('div', 'nm');
        nm.appendChild(el('span', null, it.name));
        var mk = el('span', 'mk');
        var mkText = '市场价 ' + fmt(it.market);
        if (it.tags && it.tags.length) mkText += ' · ' + it.tags[0];
        mk.textContent = mkText;
        nm.appendChild(mk);
        var input = document.createElement('input');
        input.type = 'number'; input.step = '0.5'; input.min = '1';
        input.value = game.prices[it.id];
        input.dataset.id = it.id;
        var pct = el('span', 'pct');
        function paintPct(v) {
          var r = v / it.market;
          pct.textContent = (r <= 1 ? '' : '+') + Math.round((r - 1) * 100) + '%';
          pct.className = 'pct ' + (r < 1 ? 'down' : 'up');
        }
        paintPct(game.prices[it.id]);
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          if (!isNaN(v)) {
            game.set_price(it.id, v);
            paintPct(v);
            row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
            pct.classList.remove('bump'); void pct.offsetWidth; pct.classList.add('bump');
            updateAttr(true);
          }
        });
        row.appendChild(nm); row.appendChild(input); row.appendChild(pct);
        box.appendChild(row);
      });
    });
  }

  function renderStock() {
    var box = $('stock-list');
    box.innerHTML = '';
    var cats = ['burger', 'side', 'drink', 'dessert', 'breakfast'];
    cats.forEach(function (cat) {
      if (!game.by_cat[cat] || !game.by_cat[cat].length) return;
      var row = el('div', 'stock-row');
      row.appendChild(el('div', 'nm', MCD.CATEGORY_LABEL[cat]));
      var input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.step = '5';
      input.value = game.stock[cat];
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        if (!isNaN(v)) game.set_stock(cat, v);
      });
      row.appendChild(input);
      box.appendChild(row);
    });
  }

  function renderMarketing() {
    var box = $('mkt-list');
    box.innerHTML = '';
    var labels = { 0: '不投营销', 1: '发传单', 2: '本地生活推广', 3: '全城广告' };
    [0, 1, 2, 3].forEach(function (lv) {
      var m = MCD.MARKETING[lv];
      var row = el('div', 'mkt-row' + (setup.marketing === lv ? ' sel' : ''));
      row.appendChild(el('div', 'radio'));
      row.appendChild(el('div', 'nm', labels[lv]));
      row.appendChild(el('div', 'cost', m[0] === 0 ? '免费' : fmt0(m[0]) + ' · 客流×' + m[1]));
      row.addEventListener('click', function () {
        if (setup.marketing !== lv) toast('已选：' + labels[lv]);
        setup.marketing = lv;
        renderMarketing();
      });
      box.appendChild(row);
    });
  }

  function updateAttr(pulse) {
    var elm = $('attr-value');
    elm.textContent = game.price_attractiveness().toFixed(2);
    if (pulse && !reduceMotion) {
      elm.classList.remove('pulse'); void elm.offsetWidth; elm.classList.add('pulse');
    }
  }

  function bindToolbar() {
    bindPress($('btn-reset-price'));
    bindPress($('btn-suggest-stock'));
    bindPress($('btn-run-day'));
    $('btn-reset-price').addEventListener('click', function () {
      game.reset_prices_to_market();
      renderPrices(); updateAttr();
      toast('已恢复市场价');
    });
    $('btn-discount10').addEventListener('click', function () {
      game.items.forEach(function (it) {
        game.set_price(it.id, Math.round(it.market * 0.9 * 10) / 10);
      });
      renderPrices(); updateAttr(true);
      toast('全场 9 折，顾客钱包在笑');
    });
    $('btn-fries99').addEventListener('click', function () {
      var hit = 0;
      game.items.forEach(function (it) {
        if (it.name.indexOf('薯') >= 0) { game.set_price(it.id, 99); hit++; }
      });
      renderPrices(); updateAttr(true);
      if (hit) toast('已把 ' + hit + ' 款薯制品定价 99 元，祝你好运 🍟');
      else toast('这家店没有薯制品可祸祸');
    });
    $('btn-suggest-stock').addEventListener('click', function () {
      var sug = game.suggest_stock();
      for (var c in sug) game.set_stock(c, sug[c]);
      renderStock();
      toast('已按昨日成交推荐备货');
    });
    $('btn-run-day').addEventListener('click', runDay);
  }

  // ---------- 弹幕系统 ----------
  var dmTimers = [];
  var dmCombo = 0;

  function buildDanmakuPlan(report) {
    var plan = [];
    report.samples.forEach(function (s) { plan.push({ text: s[1], mood: s[0] }); });
    var angryPool = (MCD_DATA.taunts.high_price || []).concat(MCD_DATA.taunts.queue || [], MCD_DATA.taunts.stockout || []);
    var happyPool = (MCD_DATA.taunts.good_value || []).concat(MCD_DATA.taunts.rep_high || [], MCD_DATA.taunts.craving || []);
    var neutralPool = MCD_DATA.taunts.high_price || [];
    var total = Math.max(1, report.praises + report.angries);
    var angryRatio = report.angries / total;
    var TOTAL = 28;
    for (var i = 0; i < TOTAL; i++) {
      var r = Math.random();
      if (r < angryRatio) plan.push({ text: pick(angryPool), mood: 'angry' });
      else if (r < angryRatio + (1 - angryRatio) * 0.7) plan.push({ text: pick(happyPool), mood: 'happy' });
      else plan.push({ text: pick(neutralPool), mood: 'neutral' });
    }
    for (var j = plan.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = plan[j]; plan[j] = plan[k]; plan[k] = tmp;
    }
    return plan;
  }
  function pick(pool) { return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '（沉默）'; }

  function spawnDanmaku(item, opts) {
    opts = opts || {};
    var layer = $('danmaku-layer');
    if (!layer) return null;
    var d = el('div', 'danmaku ' + (item.mood === 'happy' ? 'happy' : item.mood === 'angry' ? 'angry' : 'neutral') + (opts.vip ? ' vip' : ''));
    d.appendChild(el('span', 'm', item.mood === 'happy' ? '😍' : item.mood === 'angry' ? '😡' : '💬'));
    d.appendChild(document.createTextNode(' ' + item.text));
    var lanes = opts.lanes || 8;
    var lane = Math.floor(Math.random() * lanes);
    d.style.top = (12 + lane * (78 / lanes) + (Math.random() - 0.5) * 2.2) + '%';
    d.style.animationDuration = (opts.duration || (3.2 + Math.random() * 2.2)) + 's';
    layer.appendChild(d);
    d.addEventListener('animationend', function () { if (d.parentNode) d.parentNode.removeChild(d); });
    return d;
  }

  function updateCombo(mood) {
    if (mood !== 'angry') return;
    dmCombo++;
    var badge = $('combo-badge');
    if (!badge) return;
    badge.textContent = '😡 暴走 ×' + dmCombo;
    badge.classList.add('show');
    badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
  }

  function clearDanmaku() {
    dmTimers.forEach(clearTimeout); dmTimers = [];
    dmCombo = 0;
    var layer = $('danmaku-layer');
    if (layer) layer.innerHTML = '';
    var badge = $('combo-badge');
    if (badge) badge.classList.remove('show');
    var vg = $('rage-vignette');
    if (vg) vg.classList.remove('on');
    var app = document.getElementById('app');
    if (app) app.classList.remove('shake');
  }

  function launchDanmakuStorm(report) {
    clearDanmaku();
    if (reduceMotion) return;
    var plan = buildDanmakuPlan(report);
    var angryCount = plan.filter(function (p) { return p.mood === 'angry'; }).length;
    var vg = $('rage-vignette');
    if (vg && angryCount >= plan.length * 0.45) vg.classList.add('on');
    var app = document.getElementById('app');
    plan.forEach(function (item, i) {
      var vip = (i % 5 === 2);
      dmTimers.push(setTimeout(function () {
        spawnDanmaku(item, { vip: vip });
        updateCombo(item.mood);
        // 暴走高峰：两次微震
        if (app && angryCount >= 10 && (i === Math.floor(plan.length * 0.45) || i === Math.floor(plan.length * 0.8))) {
          app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
        }
      }, 320 + i * 90));
    });
  }

  // 终局战报：金色弹幕谢幕（只飞顶部航道，不挡阅读）
  function launchEncoreDanmaku(fr) {
    if (reduceMotion) return;
    var pool = [];
    fr.history.forEach(function (r) {
      r.samples.forEach(function (s) { pool.push(s); });
    });
    if (!pool.length) return;
    var golden = pool.slice(0, 6);
    golden.forEach(function (s, i) {
      setTimeout(function () {
        var layer = $('danmaku-layer');
        if (!layer || !$('screen-final').classList.contains('active')) return;
        var d = el('div', 'danmaku vip ' + (s[0] === 'happy' ? 'happy' : 'angry'));
        d.appendChild(el('span', 'm', s[0] === 'happy' ? '😍' : '😡'));
        d.appendChild(document.createTextNode(' ' + s[1]));
        d.style.top = (8 + Math.random() * 14) + '%';
        d.style.animationDuration = '5.2s';
        layer.appendChild(d);
        d.addEventListener('animationend', function () { if (d.parentNode) d.parentNode.removeChild(d); });
      }, 600 + i * 650);
    });
  }

  // ---------- 营业动画 → 日报 ----------
  function runDay() {
    var report = game.run_day(setup.marketing);
    clearDanmaku();
    show('screen-run');
    $('run-sub').textContent = report.events.length
      ? '今日事件：' + report.events.map(function (e) { return e.name; }).join('、')
      : '平平无奇的一天';
    $('run-bubbles').innerHTML = '';
    var counter = $('run-counter'), bar = $('run-progress');
    counter.textContent = '0'; bar.style.width = '0%';
    var t0 = null, DUR = reduceMotion ? 200 : 1400;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      counter.textContent = Math.round(report.traffic * p).toLocaleString('zh-CN');
      bar.style.width = (p * 100) + '%';
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    launchDanmakuStorm(report);
    setTimeout(function () { renderReport(report); show('screen-report'); }, DUR + 400);
  }

  function spawnBubble(sample) {
    var wrap = $('run-bubbles');
    if (!wrap) return;
    var b = el('div', 'bubble ' + (sample[0] === 'happy' ? 'happy' : 'angry'));
    b.appendChild(el('span', 'm', sample[0] === 'happy' ? '😍' : '😡'));
    b.appendChild(document.createTextNode(sample[1]));
    var jitter = (Math.random() - 0.5) * 30;
    b.style.marginLeft = jitter + 'px';
    wrap.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2400);
  }

  function renderReport(r) {
    var badge = $('combo-badge');
    if (badge) badge.classList.remove('show');
    $('report-day-title').textContent = '第 ' + r.day + ' 天 · 日报';
    countUp($('report-cash'), game.cash, 700, '¥');
    countUp($('r-traffic'), r.traffic, 600);
    countUp($('r-served'), r.served, 600);
    countUp($('r-stockout'), r.stockouts, 600);
    countUp($('r-queue'), r.queue_angry, 600);
    countUp($('r-praise'), r.praises, 600);
    countUp($('r-angry'), r.angries, 600);
    var pv = $('r-profit');
    pv.textContent = (r.profit >= 0 ? '+' : '') + fmt(r.profit);
    pv.className = 'v' + (r.profit < 0 ? ' neg' : '') + (reduceMotion ? '' : ' pop');
    $('r-detail').textContent = '营收 ' + fmt(r.revenue) + ' ｜ 食材 ' + fmt(r.cogs)
      + ' ｜ 报废 ' + fmt(r.waste) + ' ｜ 营销 ' + fmt0(r.marketing_cost);
    $('r-rep').textContent = '口碑 ' + r.rep_before.toFixed(1) + ' → ' + r.rep_after.toFixed(1)
      + '（' + (r.rep_after >= r.rep_before ? '+' : '') + (r.rep_after - r.rep_before).toFixed(1) + '）';
    $('r-best').textContent = '今日销冠：' + r.best_seller;

    var ev = $('report-events');
    ev.innerHTML = '';
    if (r.events.length) {
      var box = el('div', 'report-event');
      r.events.forEach(function (e, i) {
        if (i) box.appendChild(el('br'));
        box.appendChild(el('span', 'ev', '📢 ' + e.name));
        box.appendChild(document.createTextNode('：' + e.desc));
      });
      ev.appendChild(box);
    }

    var ql = $('quote-list');
    ql.innerHTML = '';
    var card = $('quotes-card');
    if (!r.samples.length) card.style.display = 'none';
    else {
      card.style.display = '';
      r.samples.forEach(function (s, i) {
        var q = el('div', 'quote ' + (s[0] === 'happy' ? 'happy' : 'angry'));
        q.style.animationDelay = (0.1 + i * 0.12) + 's';
        q.appendChild(el('span', 'mood', s[0] === 'happy' ? '😍' : '😡'));
        q.appendChild(el('span', null, s[1]));
        ql.appendChild(q);
      });
    }

    $('btn-next-day').textContent = (r.day >= MCD.CHALLENGE_DAYS) ? '查看 7 天战报' : '下一天';
  }

  // ---------- 终局战报 ----------
  function renderFinal() {
    var fr = MCD.final_report(game);
    var badge = $('final-grade');
    badge.textContent = fr.grade;
    badge.className = 'grade-badge ' + fr.grade.toLowerCase();
    $('final-title').textContent = fr.grade_title;
    countUp($('final-profit'), fr.total_profit, 900, fr.total_profit >= 0 ? '+¥' : '-¥');
    countUp($('final-cash'), fr.cash, 900, '¥');
    countUp($('final-rep'), fr.avg_rep, 900);

    var chart = $('final-chart');
    chart.innerHTML = '';
    var peak = 1;
    fr.history.forEach(function (r) { peak = Math.max(peak, Math.abs(r.revenue)); });
    fr.history.forEach(function (r, i) {
      var row = el('div', 'chart-row');
      row.appendChild(el('div', 'd', 'Day' + r.day));
      var bar = el('div', 'bar' + (r.profit < 0 ? ' neg' : ''));
      row.appendChild(bar);
      row.appendChild(el('div', 'v', fmt0(r.revenue)));
      chart.appendChild(row);
      var target = Math.max(2, Math.abs(r.revenue) / peak * 100);
      setTimeout(function () { bar.style.width = target + '%'; }, reduceMotion ? 0 : 200 + i * 90);
    });

    var hl = [];
    if (fr.best) hl.push('🏆 最佳单日：第 ' + fr.best.day + ' 天利润 ' + (fr.best.profit >= 0 ? '+' : '') + fmt(fr.best.profit));
    if (fr.worst && fr.worst.stockouts > 0) hl.push('😱 最大翻车：第 ' + fr.worst.day + ' 天缺货流失 ' + fr.worst.stockouts + ' 人');
    if (fr.savage) hl.push('🔥 名场面：' + fr.savage + ' 条顾客暴走瞬间（截图即素材）');
    $('final-highlights').innerHTML = hl.join('<br>');

    var plan = MCD.generate_plan(game);
    var pb = $('final-plan');
    pb.innerHTML = '';
    pb.appendChild(el('div', 'plan-basket',
      '根据你这局的表现，典型一单：' + plan.basket.map(function (b) {
        return b[0] + ' ' + fmt(b[1]);
      }).join(' + ') + ' = ' + fmt(plan.base)));
    pb.appendChild(el('div', 'plan-combo',
      '最优组合：' + plan.combo.label + ' → ' + fmt(plan.combo.total) + '（省 ' + fmt(plan.combo.saving) + '）'));
    var ul = document.createElement('ul');
    ul.className = 'plan-actions';
    plan.actions.forEach(function (a) { ul.appendChild(el('li', null, a)); });
    pb.appendChild(ul);
    pb.appendChild(el('p', 'muted', '⚠️ 避坑：' + plan.pitfall));

    var savageBest = '';
    fr.history.forEach(function (r) {
      r.samples.forEach(function (s) { if (s[0] === 'angry' && !savageBest) savageBest = s[1]; });
    });
    var lines = [
      '🍔 我在《麦当劳大亨》开了 7 天店',
      '总利润 ' + (fr.total_profit >= 0 ? '+' : '') + fmt0(fr.total_profit) + ' ｜ 评级 ' + fr.grade + ' · ' + fr.grade_title,
      '平均口碑 ' + fr.avg_rep.toFixed(0) + ' ｜ 终局现金 ' + fmt0(fr.cash),
    ];
    if (savageBest) lines.push('顾客名场面：“' + savageBest + '”');
    lines.push('菜单来自麦当劳 MCP 真实数据，来试试你能开成什么样 →');
    lines.push('https://github.com/longtimecar/WorkBuddy-McDonald-tycoon-game');
    $('share-text').textContent = lines.join('\n');

    show('screen-final');
    launchEncoreDanmaku(fr);
  }

  function bindFinal() {
    bindPress($('btn-next-day'));
    bindPress($('btn-restart'));
    bindPress($('btn-copy'));
    $('btn-next-day').addEventListener('click', function () {
      if (game.day >= MCD.CHALLENGE_DAYS) renderFinal();
      else { renderDay(); show('screen-day'); }
    });
    $('btn-restart').addEventListener('click', function () {
      var seed = urlSeed();
      game = new MCD.Tycoon(null, seed !== null ? seed : Math.floor(Math.random() * 1e9));
      setup = { marketing: 0 };
      renderDay();
      show('screen-day');
      toast(seed !== null ? '同一剧本重开（seed ' + seed + '）' : '新的一局，祝你好运');
    });
    $('btn-copy').addEventListener('click', function () {
      var text = $('share-text').textContent;
      function done() { toast('战绩文案已复制，去粘贴吧'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---------- 启动 ----------
  initHome();
  bindToolbar();
  bindFinal();
})();
