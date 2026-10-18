/* 麦当劳大亨 · Web UI 控制器（依赖 data.js + tycoon.js） */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var game = null;
  var setup = { marketing: 0 };

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

  // ---------- 首页 ----------
  function initHome() {
    var n = MCD_DATA.menu.length;
    $('home-menu-badge').textContent = '真实菜单 ' + n + ' 款';
    $('btn-start').addEventListener('click', function () {
      game = new MCD.Tycoon();
      setup = { marketing: 0 };
      renderDay();
      show('screen-day');
    });
  }

  // ---------- 每日备战 ----------
  function renderDay() {
    var d = game.day + 1;
    $('day-title').textContent = '第 ' + d + ' / ' + MCD.CHALLENGE_DAYS + ' 天';
    $('day-source').textContent = MCD_DATA.menuSource || '演示菜单';
    $('day-cash').textContent = fmt0(game.cash);
    $('day-rep').textContent = Math.round(game.reputation);
    $('day-rep-bar').style.width = game.reputation + '%';

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
      var head = el('div', 'cat-head',
        MCD.CATEGORY_LABEL[cat] + '（' + items.length + ' 款）');
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
        function refresh() {
          var v = parseFloat(input.value);
          if (!isNaN(v)) {
            game.set_price(it.id, v);
            var r = v / it.market;
            pct.textContent = (r <= 1 ? '' : '+') + Math.round((r - 1) * 100) + '%';
            pct.className = 'pct ' + (r < 1 ? 'down' : 'up');
            updateAttr();
          }
        }
        input.addEventListener('input', refresh);
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
      row.appendChild(el('div', 'nm', labels[lv]));
      row.appendChild(el('div', 'cost', m[0] === 0 ? '免费' : fmt0(m[0]) + ' · 客流×' + m[1]));
      row.addEventListener('click', function () {
        setup.marketing = lv;
        renderMarketing();
      });
      box.appendChild(row);
    });
  }

  function updateAttr() {
    $('attr-value').textContent = game.price_attractiveness().toFixed(2);
  }

  function bindToolbar() {
    $('btn-reset-price').addEventListener('click', function () {
      game.reset_prices_to_market();
      renderPrices(); updateAttr();
    });
    $('btn-discount10').addEventListener('click', function () {
      game.items.forEach(function (it) {
        game.set_price(it.id, Math.round(it.market * 0.9 * 10) / 10);
      });
      renderPrices(); updateAttr();
    });
    $('btn-fries99').addEventListener('click', function () {
      var hit = 0;
      game.items.forEach(function (it) {
        if (it.name.indexOf('薯') >= 0) { game.set_price(it.id, 99); hit++; }
      });
      renderPrices(); updateAttr();
      if (hit) flashTip('已把 ' + hit + ' 款薯制品定价 99 元，祝你好运 🍟');
    });
    $('btn-suggest-stock').addEventListener('click', function () {
      var sug = game.suggest_stock();
      for (var c in sug) game.set_stock(c, sug[c]);
      renderStock();
      flashTip('已按昨日成交推荐备货');
    });
    $('btn-run-day').addEventListener('click', runDay);
  }

  var tipTimer = null;
  function flashTip(text) {
    var tip = $('day-source');
    tip.textContent = text;
    tip.style.color = 'var(--mcd-red)';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () {
      tip.textContent = MCD_DATA.menuSource || '演示菜单';
      tip.style.color = '';
    }, 2200);
  }

  // ---------- 营业动画 → 日报 ----------
  function runDay() {
    var report = game.run_day(setup.marketing);
    show('screen-run');
    $('run-sub').textContent = report.events.length
      ? '今日事件：' + report.events.map(function (e) { return e.name; }).join('、')
      : '平平无奇的一天';
    var counter = $('run-counter'), bar = $('run-progress');
    counter.textContent = '0'; bar.style.width = '0%';
    var t0 = null, DUR = 1300;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      counter.textContent = Math.round(report.traffic * p);
      bar.style.width = (p * 100) + '%';
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(function () { renderReport(report); show('screen-report'); }, 180);
    }
    requestAnimationFrame(tick);
  }

  function renderReport(r) {
    $('report-day-title').textContent = '第 ' + r.day + ' 天 · 日报';
    $('report-cash').textContent = fmt0(game.cash);
    $('r-traffic').textContent = r.traffic;
    $('r-served').textContent = r.served;
    $('r-stockout').textContent = r.stockouts;
    $('r-queue').textContent = r.queue_angry;
    $('r-praise').textContent = r.praises;
    $('r-angry').textContent = r.angries;
    var pv = $('r-profit');
    pv.textContent = (r.profit >= 0 ? '+' : '') + fmt(r.profit);
    pv.className = 'v' + (r.profit < 0 ? ' neg' : '');
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
        var s = el('span', 'ev', '📢 ' + e.name);
        box.appendChild(s);
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
      r.samples.forEach(function (s) {
        var q = el('div', 'quote ' + (s[0] === 'happy' ? 'happy' : 'angry'));
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
    $('final-profit').textContent = (fr.total_profit >= 0 ? '+' : '') + fmt0(fr.total_profit);
    $('final-cash').textContent = fmt0(fr.cash);
    $('final-rep').textContent = fr.avg_rep.toFixed(0);

    var chart = $('final-chart');
    chart.innerHTML = '';
    var peak = 1;
    fr.history.forEach(function (r) { peak = Math.max(peak, Math.abs(r.revenue)); });
    fr.history.forEach(function (r) {
      var row = el('div', 'chart-row');
      row.appendChild(el('div', 'd', 'Day' + r.day));
      var bar = el('div', 'bar' + (r.profit < 0 ? ' neg' : ''));
      bar.style.width = Math.max(2, Math.abs(r.revenue) / peak * 100) + '%';
      row.appendChild(bar);
      row.appendChild(el('div', 'v', fmt0(r.revenue)));
      chart.appendChild(row);
    });

    var hl = [];
    if (fr.best) hl.push('🏆 最佳单日：第 ' + fr.best.day + ' 天利润 ' + (fr.best.profit >= 0 ? '+' : '') + fmt(fr.best.profit));
    if (fr.worst && fr.worst.stockouts > 0) hl.push('😱 最大翻车：第 ' + fr.worst.day + ' 天缺货流失 ' + fr.worst.stockouts + ' 人');
    if (fr.savage) hl.push('🔥 名场面：' + fr.savage + ' 条顾客暴走瞬间（截图即素材）');
    $('final-highlights').innerHTML = hl.join('<br>');

    var plan = MCD.generate_plan(game);
    var pb = $('final-plan');
    pb.innerHTML = '';
    var basket = el('div', 'plan-basket',
      '根据你这局的表现，典型一单：' + plan.basket.map(function (b) {
        return b[0] + ' ' + fmt(b[1]);
      }).join(' + ') + ' = ' + fmt(plan.base));
    pb.appendChild(basket);
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
  }

  function bindFinal() {
    $('btn-next-day').addEventListener('click', function () {
      if (game.day >= MCD.CHALLENGE_DAYS) renderFinal();
      else { renderDay(); show('screen-day'); }
    });
    $('btn-restart').addEventListener('click', function () {
      game = new MCD.Tycoon(null, Math.floor(Math.random() * 1e9));
      setup = { marketing: 0 };
      renderDay();
      show('screen-day');
    });
    $('btn-copy').addEventListener('click', function () {
      var text = $('share-text').textContent;
      function done() { $('btn-copy').textContent = '已复制 ✓'; setTimeout(function () { $('btn-copy').textContent = '复制战绩文案'; }, 1500); }
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
