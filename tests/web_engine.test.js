const MCD = require('../docs/tycoon.js');
console.log('menu items:', MCD.Tycoon.prototype ? 'ok' : 'fail');
for (const seed of [7, 42, 1024, 555, 888]) {
  const g = new MCD.Tycoon(null, seed);
  for (let d = 0; d < MCD.CHALLENGE_DAYS; d++) {
    const sug = g.suggest_stock();
    for (const c in sug) g.set_stock(c, sug[c]);
    g.run_day(d === 2 ? 1 : 0);
  }
  const fr = MCD.final_report(g);
  const waste = g.history.reduce((a, r) => a + r.waste, 0);
  const so = g.history.reduce((a, r) => a + r.stockouts, 0);
  console.log(`seed ${seed}: 利润 ¥${fr.total_profit} 口碑 ${fr.avg_rep.toFixed(0)} 评级 ${fr.grade} 报废 ¥${waste.toFixed(0)} 缺货 ${so} 现金 ¥${fr.cash.toFixed(0)}`);
}
// 攻略测试
const g2 = new MCD.Tycoon(null, 7);
g2.set_price(g2.items[0].id, g2.items[0].market * 0.8);
g2.run_day(0);
const plan = MCD.generate_plan(g2);
console.log('攻略:', plan.basket.map(b => b[0] + ' ¥' + b[1]).join(' + '), '→', plan.combo.label, '省 ¥' + plan.combo.saving);
// 确定性测试
const a = new MCD.Tycoon(null, 42), b = new MCD.Tycoon(null, 42);
a.run_day(0); b.run_day(0);
console.log('同 seed 确定性:', JSON.stringify(a.history[0]) === JSON.stringify(b.history[0]) ? 'PASS' : 'FAIL');
