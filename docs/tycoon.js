// 麦当劳大亨 · Web 经营引擎（game/engine.py + customers.py + events.py + advisor.py 的忠实移植）
// 零依赖，浏览器 / Node 双端可用（Node 端用于回归测试）。
(function (root, factory) {
  var DATA = (typeof module === 'object' && module.exports) ? require('./data.js') : root.MCD_DATA;
  var api = factory(DATA);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MCD = api; }
})(typeof self !== 'undefined' ? self : this, function (DATA) {

  // ---------- 随机数：mulberry32（与 Python 版算法不同，分布一致） ----------
  function makeRng(seed) {
    var s = (seed === undefined || seed === null) ? (Date.now() % 2147483647) : seed;
    var a = s >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 常量（与 Python 版一致） ----------
  var MARKETING = { 0: [0, 1.0], 1: [150, 1.15], 2: [350, 1.35], 3: [700, 1.60] };
  var WASTE_RATE = { burger: 0.3, side: 0.3, breakfast: 0.3, dessert: 0.1, drink: 0.1 };
  var CATEGORY_WEIGHTS = { burger: 0.42, side: 0.28, drink: 0.16, dessert: 0.09, breakfast: 0.05 };
  var CATEGORY_LABEL = { burger: '汉堡', side: '小食', drink: '饮品', dessert: '甜品', breakfast: '早餐' };
  var START_CASH = 5000, RENT = 200, BASE_TRAFFIC = 160, DAILY_CAPACITY = 190, CHALLENGE_DAYS = 7;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------- 经营引擎 ----------
  function Tycoon(menu, seed) {
    this.rng = makeRng(seed);
    this.items = menu ? menu.map(function (i) {
      return { id: i.id, name: i.name, category: i.category, cost: i.cost, market: i.market, tags: i.tags || [] };
    }) : DATA.menu.map(function (i) {
      return { id: i.id, name: i.name, category: i.category, cost: i.cost, market: i.market, tags: i.tags || [] };
    });
    this.by_cat = {};
    var self = this;
    this.items.forEach(function (it) {
      (self.by_cat[it.category] = self.by_cat[it.category] || []).push(it);
    });
    this.taunts = DATA.taunts;
    this.day = 0;
    this.cash = START_CASH;
    this.reputation = 70;
    this.stock = {};
    Object.keys(this.by_cat).forEach(function (c) { self.stock[c] = 0; });
    this.prices = {};
    this.items.forEach(function (it) { self.prices[it.id] = it.market; });
    this.history = [];
  }
  Tycoon.prototype.START_CASH = START_CASH;
  Tycoon.prototype.RENT = RENT;
  Tycoon.prototype.BASE_TRAFFIC = BASE_TRAFFIC;
  Tycoon.prototype.DAILY_CAPACITY = DAILY_CAPACITY;
  Tycoon.prototype.CHALLENGE_DAYS = CHALLENGE_DAYS;

  Tycoon.prototype.set_price = function (item_id, price) {
    if (item_id in this.prices) this.prices[item_id] = Math.max(1, Math.round(price * 10) / 10);
  };
  Tycoon.prototype.set_stock = function (cat, qty) {
    if (cat in this.stock) this.stock[cat] = Math.max(0, Math.floor(qty));
  };
  Tycoon.prototype.reset_prices_to_market = function () {
    var self = this;
    this.items.forEach(function (it) { self.prices[it.id] = it.market; });
  };

  Tycoon.prototype.price_attractiveness = function () {
    var vals = [];
    for (var id in this.prices) {
      var it = this._item(id);
      if (!it) continue;
      var ratio = this.prices[id] / it.market;
      vals.push(clamp(1 - 1.2 * (ratio - 1), 0.25, 1.3));
    }
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  };

  Tycoon.prototype.suggest_stock = function () {
    var last = this.history.length ? this.history[this.history.length - 1].served : Math.floor(BASE_TRAFFIC * 0.65);
    var out = {}, self = this;
    Object.keys(this.by_cat).forEach(function (c) {
      out[c] = Math.max(2, Math.floor(last * (CATEGORY_WEIGHTS[c] || 0.1) * 1.6));
    });
    return out;
  };

  Tycoon.prototype._item = function (id) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].id === id) return this.items[i];
    return null;
  };
  Tycoon.prototype._cat_avg_cost = function (cat) {
    var items = this.by_cat[cat] || [];
    if (!items.length) return 0;
    return items.reduce(function (a, it) { return a + it.cost; }, 0) / items.length;
  };
  Tycoon.prototype._item_name = function (id) {
    var it = this._item(id);
    return it ? it.name : '—';
  };

  // ---------- 一天 ----------
  Tycoon.prototype.run_day = function (marketing) {
    this.day += 1;
    marketing = clamp(Math.floor(marketing || 0), 0, 3);
    var mkt = MARKETING[marketing], mkt_cost = mkt[0], mkt_mult = mkt[1];

    var events = roll_events(this.rng);
    var eff = combine(events);

    var attr = this.price_attractiveness();
    var rep_factor = clamp(this.reputation / 70, 0.4, 1.6);
    var traffic = Math.floor(BASE_TRAFFIC * attr * rep_factor * eff.traffic * mkt_mult * this.rng.uniform(0.85, 1.15));
    traffic = clamp(traffic, 5, 400);

    var cust = run_customers(this, traffic, eff, this.rng);

    var cogs = cust.cogs * eff.cost;
    var waste = 0, self = this;
    Object.keys(this.stock).forEach(function (c) {
      waste += self.stock[c] * self._cat_avg_cost(c) * (WASTE_RATE[c] || 0.15) * eff.cost;
    });
    var revenue = cust.revenue;
    var profit = revenue - cogs - waste - mkt_cost - RENT;

    var rep_before = this.reputation;
    var rep_delta = eff.reputation + 0.05 * cust.praises - 0.12 * cust.angries
      - 0.10 * cust.stockouts - 0.08 * cust.queue_angry;
    var satisfaction = cust.praises / Math.max(1, cust.praises + cust.angries);
    var target = 55 + 40 * satisfaction;
    var rep_after = clamp(this.reputation + 0.12 * (target - this.reputation) + rep_delta, 0, 100);
    this.reputation = rep_after;
    this.cash += profit;

    var best = { id: '—', n: 0 };
    for (var id in cust.sold) if (cust.sold[id] > best.n) best = { id: id, n: cust.sold[id] };

    var report = {
      day: this.day, traffic: traffic, served: cust.served,
      stockouts: cust.stockouts, queue_angry: cust.queue_angry,
      praises: cust.praises, angries: cust.angries,
      revenue: Math.round(revenue * 10) / 10, cogs: Math.round(cogs * 10) / 10,
      waste: Math.round(waste * 10) / 10, marketing_cost: mkt_cost, rent: RENT,
      profit: Math.round(profit * 10) / 10,
      rep_before: Math.round(rep_before * 10) / 10, rep_after: Math.round(rep_after * 10) / 10,
      events: events, samples: cust.samples,
      best_seller: this._item_name(best.id),
      cash_after: Math.round(this.cash * 10) / 10,
    };
    this.history.push(report);
    return report;
  };

  // ---------- 顾客模拟（customers.py 移植） ----------
  function _pick(taunts, key, rng) {
    var pool = taunts[key] || ['（这位顾客选择了沉默）'];
    return pool[Math.floor(rng() * pool.length)];
  }
  function _weighted_cat(rng) {
    var r = rng(), acc = 0;
    for (var cat in CATEGORY_WEIGHTS) {
      acc += CATEGORY_WEIGHTS[cat];
      if (r <= acc) return cat;
    }
    return 'burger';
  }

  function run_customers(game, traffic, eff, rng) {
    var prices = game.prices, stock = game.stock, taunts = game.taunts;
    var market_mult = eff.market || 1.0;
    var rage = !!eff.coupon_rage;
    var rep = game.reputation;

    var tolerance_base = 0.72 + rep / 220;
    if (rage) tolerance_base -= 0.12;

    var served = 0, praises = 0, angries = 0, stockouts = 0, queue_angry = 0;
    var revenue = 0, cogs = 0;
    var sold = {}, samples = [];

    for (var i = 0; i < traffic; i++) {
      if (i >= game.DAILY_CAPACITY) {
        queue_angry++;
        if (rng() < 0.3) samples.push(['angry', _pick(taunts, 'queue', rng)]);
        continue;
      }
      var cat = _weighted_cat(rng);
      var options = (game.by_cat[cat] || []).filter(function (it) { return (stock[cat] || 0) > 0; });
      if (!options.length) {
        cat = _weighted_cat(rng);
        options = (game.by_cat[cat] || []).filter(function (it) { return (stock[cat] || 0) > 0; });
        if (!options.length) {
          stockouts++;
          if (rng() < 0.4) samples.push(['angry', _pick(taunts, 'stockout', rng)]);
          continue;
        }
      }
      var item = options[Math.floor(rng() * options.length)];
      var total = prices[item.id];
      var extra = null, extra_cat = null;
      if (rng() < 0.4) {
        extra_cat = _weighted_cat(rng);
        var opts = (game.by_cat[extra_cat] || []).filter(function (it) {
          return (stock[extra_cat] || 0) > 0 && it.id !== item.id;
        });
        if (opts.length) {
          extra = opts[Math.floor(rng() * opts.length)];
          total += prices[extra.id];
        }
      }
      var budget = 16 + rng() * 52;
      if (total <= budget * tolerance_base) {
        served++;
        revenue += total;
        cogs += item.cost;
        stock[cat] -= 1;
        sold[item.id] = (sold[item.id] || 0) + 1;
        if (extra) {
          cogs += extra.cost;
          stock[extra_cat] -= 1;
          sold[extra.id] = (sold[extra.id] || 0) + 1;
        }
        var ratio = prices[item.id] / (item.market * market_mult);
        if (ratio <= 0.92 && rng() < 0.4) {
          praises++;
          samples.push(['happy', _pick(taunts, 'good_value', rng)]);
        } else if (ratio <= 1.0 && rng() < 0.15) {
          praises++;
          samples.push(['happy', _pick(taunts, 'good_value', rng)]);
        }
      } else {
        var ratio2 = prices[item.id] / (item.market * market_mult);
        if (ratio2 > 1.08) {
          angries++;
          if (rng() < 0.3) samples.push(['angry', _pick(taunts, 'high_price', rng)]);
        } else if (rng() < 0.25) {
          samples.push(['neutral', _pick(taunts, 'high_price', rng)]);
        }
      }
    }

    if (game.reputation < 55 && rng() < 0.3) samples.push(['angry', _pick(taunts, 'rep_low', rng)]);
    else if (game.reputation > 85 && rng() < 0.3) samples.push(['happy', _pick(taunts, 'rep_high', rng)]);

    // Python rng.sample(samples, min(6, len)) 的等价物：洗牌取前 6
    var out = samples.slice();
    for (var j = out.length - 1; j > 0; j--) {
      var k = Math.floor(rng() * (j + 1));
      var tmp = out[j]; out[j] = out[k]; out[k] = tmp;
    }
    out = out.slice(0, Math.min(6, out.length));

    return {
      served: served, revenue: revenue, cogs: cogs, praises: praises, angries: angries,
      stockouts: stockouts, queue_angry: queue_angry, sold: sold, samples: out,
    };
  }

  // ---------- 事件系统（events.py 移植） ----------
  var EVENT_POOL = DATA.events;
  var EVENT_TOTAL = EVENT_POOL.reduce(function (a, e) { return a + e.weight; }, 0);

  function roll_events(rng, count_max) {
    count_max = count_max || 2;
    var picked = [];
    var n = Math.floor(rng() * (count_max + 1)); // Python randint(0, count_max)
    for (var i = 0; i < n; i++) {
      var r = rng() * EVENT_TOTAL, acc = 0;
      for (var j = 0; j < EVENT_POOL.length; j++) {
        acc += EVENT_POOL[j].weight;
        if (r <= acc) {
          if (picked.indexOf(EVENT_POOL[j]) < 0) picked.push(EVENT_POOL[j]);
          break;
        }
      }
    }
    return picked;
  }

  function combine(events) {
    var eff = { traffic: 1.0, reputation: 0, cost: 1.0, market: 1.0, coupon_rage: false };
    events.forEach(function (ev) {
      var e = ev.effects || {};
      for (var k in e) {
        if (k === 'traffic') eff.traffic *= e[k];
        else if (k === 'reputation') eff.reputation += e[k];
        else if (k === 'cost') eff.cost *= e[k];
        else if (k === 'market') eff.market *= e[k];
        else if (k === 'coupon_rage') eff.coupon_rage = true;
      }
    });
    return eff;
  }

  // ---------- 省钱攻略（advisor.py 移植） ----------
  function _apply(coupon, basket) {
    var total = basket.reduce(function (a, b) { return a + b[1]; }, 0);
    if (total < coupon.threshold) return null;
    if (coupon.kind === 'full_reduction') return Math.max(0, Math.round((total - coupon.off) * 10) / 10);
    if (coupon.kind === 'percent_all') return Math.round(total * (1 - coupon.off) * 10) / 10;
    if (coupon.kind === 'fixed_combo') {
      if (coupon.id === 'breakfast-card') {
        if (basket.filter(function (b) { return b[2] === 'breakfast'; }).length < 2) return null;
      }
      if (basket.length < 2) return null;
      var prices = basket.map(function (b) { return b[1]; }).sort(function (a, b) { return b - a; });
      var rest = prices.slice(2).reduce(function (a, b) { return a + b; }, 0);
      return Math.round((coupon.off + rest) * 10) / 10;
    }
    if (coupon.kind === 'percent_second') {
      var by_cat = {};
      basket.forEach(function (b) { (by_cat[b[2]] = by_cat[b[2]] || []).push(b[1]); });
      var discount = 0;
      for (var c in by_cat) {
        if (by_cat[c].length >= 2) { discount += Math.min.apply(null, by_cat[c]) * coupon.off; break; }
      }
      if (!discount) return null;
      return Math.round((total - discount) * 10) / 10;
    }
    if (coupon.kind === 'free_upgrade') {
      if (!basket.some(function (b) { return b[2] === 'drink'; })) return null;
      return Math.round((total - coupon.off) * 10) / 10;
    }
    return null;
  }

  function best_combo(basket, coupons) {
    var base = basket.reduce(function (a, b) { return a + b[1]; }, 0);
    var best = { total: base, saving: 0, used: [], label: '不用券直购' };
    var candidates = [];
    coupons.forEach(function (c) {
      var t = _apply(c, basket);
      if (t !== null) candidates.push([t, [c]]);
    });
    for (var i = 0; i < coupons.length; i++) {
      for (var j = i + 1; j < coupons.length; j++) {
        var t1 = _apply(coupons[i], basket);
        if (t1 === null) continue;
        var t;
        if (coupons[j].kind === 'full_reduction' || coupons[j].kind === 'percent_all') {
          t = _apply(coupons[j], [['x', t1, 'burger']]);
        } else {
          t = _apply(coupons[j], basket);
        }
        if (t !== null) candidates.push([Math.round(t * 10) / 10, [coupons[i], coupons[j]]]);
      }
    }
    candidates.forEach(function (pair) {
      if (pair[0] < best.total) {
        best = {
          total: Math.round(pair[0] * 10) / 10,
          saving: Math.round((base - pair[0]) * 10) / 10,
          used: pair[1],
          label: pair[1].map(function (c) { return c.name; }).join(' + '),
        };
      }
    });
    return best;
  }

  function generate_plan(game) {
    var priced = game.items.filter(function (it) { return game.prices[it.id] !== it.market; })
      .sort(function (a, b) { return a.cost - b.cost; });
    var picks = priced.slice(0, 3);
    if (picks.length < 3) {
      var fillers = game.items.slice().sort(function (a, b) { return a.market - b.market; });
      for (var i = 0; i < fillers.length && picks.length < 3; i++) {
        var it = fillers[i];
        if (picks.indexOf(it) < 0 && (!picks.length || it.category !== picks[0].category)) picks.push(it);
      }
    }
    var basket = picks.map(function (it) { return [it.name, it.market, it.category]; });
    var coupons = DATA.coupons;
    var combo = best_combo(basket, coupons);

    var avg = game.price_attractiveness();
    var pitfall;
    if (avg < 0.85) pitfall = '你店里定价普遍低于市场价——顾客省了，但你在给用户做慈善。';
    else if (avg > 1.05) pitfall = '定价高于市场价时顾客会暴走：先看券，再定价。';
    else pitfall = '定价贴近市场价，顾客无感——省钱的感知来自券，不是涨价。';

    return {
      basket: basket,
      base: Math.round(basket.reduce(function (a, b) { return a + b[1]; }, 0) * 10) / 10,
      combo: combo,
      pitfall: pitfall,
      actions: [
        '先领券再点餐（麦麦省一键领券，游戏内 auto-bind-coupons 同款操作）',
        '组合用券：' + combo.label,
        '凑单前先算净变化：为满减而加购常常是坑',
      ],
      source: DATA.menuSource || '演示券池（mock）',
    };
  }

  // ---------- 战报 ----------
  function _grade(profit, rep) {
    if (profit >= 8000 && rep >= 85) return ['S', '麦门之星 · 顾客排队到马路对面'];
    if (profit >= 5000 && rep >= 75) return ['A', '金牌店长 · 营收口碑双丰收'];
    if (profit >= 2500 && rep >= 60) return ['B', '稳扎稳打 · 差点意思'];
    return ['C', '再练练 · 麦当劳教我做汉堡'];
  }

  function final_report(game) {
    var total_profit = game.history.reduce(function (a, r) { return a + r.profit; }, 0);
    var avg_rep = game.history.reduce(function (a, r) { return a + r.rep_after; }, 0) / Math.max(1, game.history.length);
    var g = _grade(total_profit, avg_rep);
    var worst = null, best = null;
    game.history.forEach(function (r) {
      if (!worst || r.stockouts > worst.stockouts) worst = r;
      if (!best || r.profit > best.profit) best = r;
    });
    var savage = 0;
    game.history.forEach(function (r) { r.samples.forEach(function (s) { if (s[0] === 'angry') savage++; }); });
    return {
      total_profit: Math.round(total_profit * 10) / 10,
      cash: game.cash, avg_rep: avg_rep,
      grade: g[0], grade_title: g[1],
      worst: worst, best: best, savage: savage,
      history: game.history,
    };
  }

  // rng.uniform 挂到函数对象上方便移植代码照抄
  makeRng.uniform = function (rng, lo, hi) { return lo + rng() * (hi - lo); };
  // 兼容：给 rng 函数加 uniform 方法
  function wrapUniform(rng) { rng.uniform = function (lo, hi) { return lo + rng() * (hi - lo); }; return rng; }
  var _origMake = makeRng;
  makeRng = function (seed) { return wrapUniform(_origMake(seed)); };

  return {
    Tycoon: Tycoon, MARKETING: MARKETING, WASTE_RATE: WASTE_RATE,
    CATEGORY_WEIGHTS: CATEGORY_WEIGHTS, CATEGORY_LABEL: CATEGORY_LABEL,
    START_CASH: START_CASH, RENT: RENT, BASE_TRAFFIC: BASE_TRAFFIC,
    DAILY_CAPACITY: DAILY_CAPACITY, CHALLENGE_DAYS: CHALLENGE_DAYS,
    roll_events: roll_events, combine: combine, run_customers: run_customers,
    best_combo: best_combo, generate_plan: generate_plan, final_report: final_report,
    makeRng: makeRng,
  };
});
