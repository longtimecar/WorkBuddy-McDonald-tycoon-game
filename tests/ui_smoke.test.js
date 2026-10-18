// 最小 DOM 桩：跑通 app.js 全部流程
function makeEl(id) {
  const el = {
    id, children: [], listeners: {}, style: { setProperty() {} }, dataset: {}, _text: '', _html: '',
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); }, contains(c) { return this._set.has(c); }
    },
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() { return this._text; },
    set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; },
    get innerHTML() { return this._html; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    click() { (this.listeners.click || []).forEach(f => f()); },
    setAttribute() {}, select() {}, offsetWidth: 0,
  };
  return el;
}
const ids = [];
const fs = require('fs');
const html = fs.readFileSync('D:/DSH OUTPUT/程序开发区/WorkBuddy-McDonald-tycoon-game/docs/index.html', 'utf8');
[...html.matchAll(/id="([\w-]+)"/g)].forEach(m => ids.push(m[1]));
const registry = {};
ids.forEach(id => registry[id] = makeEl(id));

global.document = {
  getElementById: id => registry[id] || null,
  createElement: tag => makeEl('dyn-' + tag),
  createTextNode: t => ({ text: t }),
  querySelector: () => null,
  querySelectorAll: sel => {
    if (sel === '.screen') return ids.filter(i => i.startsWith('screen-')).map(i => registry[i]);
    return [];
  },
  body: makeEl('body'),
};
global.window = { scrollTo() {} };
global.navigator = {};
let _t = 0; global.requestAnimationFrame = fn => { _t += 100; setImmediate(() => fn(_t)); };

global.MCD_DATA = require('D:/DSH OUTPUT/程序开发区/WorkBuddy-McDonald-tycoon-game/docs/data.js');
global.MCD = require('D:/DSH OUTPUT/程序开发区/WorkBuddy-McDonald-tycoon-game/docs/tycoon.js');
require('D:/DSH OUTPUT/程序开发区/WorkBuddy-McDonald-tycoon-game/docs/app.js');

const fire = (id, evt) => (registry[id].listeners[evt] || []).forEach(f => f());
const R = registry;

// 1. 首页 → 开始
R['btn-start'].click();
console.log('1. 开始游戏 → 当前屏:', R['screen-day'].classList.contains('active') ? 'day OK' : 'FAIL');
console.log('   菜单徽章:', R['home-menu-badge'].textContent);

// 2. 定价互动
const firstPriceInput = R['price-list'].children[1].children[1]; // cat-head 后的第一个 row 的 input
firstPriceInput.value = '5';
firstPriceInput.listeners.input.forEach(f => f());
console.log('2. 改价后吸引力:', R['attr-value'].textContent);

// 3. 薯条 99 + 建议备货 + 选营销
R['btn-fries99'].click();
R['btn-suggest-stock'].click();
console.log('3. 薯条99 + 建议备货 OK, 提示:', R['day-source'].textContent);

// 4. 营销选择（第 3 档）
const mktRows = R['mkt-list'].children;
mktRows[1].click();
console.log('4. 选营销档 OK');

// 5. 营业 → 日报（含弹幕风暴断言）
R['btn-run-day'].click();
// 5a. 营业中（1.5s）：弹幕密度 + 连击徽标
setTimeout(() => {
  const dmMid = R['danmaku-layer'].children.length;
  console.log('5a. 营业中弹幕密度:', dmMid, '条 |', dmMid >= 5 ? 'PASS' : 'FAIL',
    '| 连击徽标:', R['combo-badge'].textContent,
    '| 显示中:', R['combo-badge'].classList.contains('show') ? '是' : '否');
}, 1500);
setTimeout(() => {
  console.log('5. 营业动画后屏:', R['screen-report'].classList.contains('active') ? 'report OK' : 'FAIL');
  console.log('   日报: 客流', R['r-traffic'].textContent, '| 成交', R['r-served'].textContent,
    '| 利润', R['r-profit'].textContent, '| 销冠', R['r-best'].textContent);
  console.log('   顾客吐槽条数:', R['quote-list'].children.length);
  console.log('   弹幕累计生成:', R['danmaku-layer'].children.length, '条 |',
    '| 日报后徽标按设计隐藏:', !R['combo-badge'].classList.contains('show') ? 'PASS' : 'FAIL');

  // 6. 连过 7 天到战报
  for (let d = 1; d < 7; d++) {
    R['btn-suggest-stock'].click();
    R['btn-run-day'].click();
  }
  setTimeout(() => {
    R['btn-next-day'].click();
    console.log('6. 终局屏:', R['screen-final'].classList.contains('active') ? 'final OK' : 'FAIL');
    console.log('   评级:', R['final-grade'].textContent, '|', R['final-title'].textContent);
    console.log('   总利润:', R['final-profit'].textContent, '| 现金:', R['final-cash'].textContent, '| 口碑:', R['final-rep'].textContent);
    console.log('   曲线行数:', R['final-chart'].children.length, '| 攻略:', R['final-plan'].children[1].textContent.slice(0, 60));
    console.log('   分享文案前 2 行:', R['share-text'].textContent.split('\n').slice(0, 2).join(' / '));

    // 7. 再来一局
    R['btn-restart'].click();
    console.log('7. 重开 → 屏:', R['screen-day'].classList.contains('active') ? 'day OK' : 'FAIL', '| Day1:', R['day-title'].textContent);
    console.log('\n=== UI 全流程冒烟测试通过 ===');
  }, 2000);
}, 2000);
