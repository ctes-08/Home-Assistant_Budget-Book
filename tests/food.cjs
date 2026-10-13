const assert = require('node:assert/strict');
const food = require('../shared/core/www/food.js');
const samples = [
  ['早餐', { meal: '早餐', channel: '', description: '' }],
  ['午餐 飯糰', { meal: '午餐', channel: '', description: '飯糰' }],
  ['早餐店採買', { meal: '一般餐飲', channel: '', description: '早餐店採買' }],
  ['午餐｜ＵＢＥＲ', { meal: '午餐', channel: 'Uber Eats', description: '' }],
  ['晚餐｜熊貓｜加蛋｜加飯', { meal: '晚餐', channel: 'foodpanda', description: '加蛋|加飯' }],
  ['咖啡｜門市', { meal: '一般餐飲', channel: '現場', description: '咖啡' }],
  ['宵夜｜｜飯糰', { meal: '宵夜', channel: '', description: '飯糰' }],
  ['午餐｜' + 'x'.repeat(31), { meal: '一般餐飲', channel: '', description: '午餐|' + 'x'.repeat(31) }],
];
for (const [note, expected] of samples) assert.deepEqual(food.decodeNote(note), expected);
const tx = (amount, note, extra = {}) => ({ amount, note, date: '2026-10-13', type: 'expense', category: 'food', ...extra });
const book = { categories: [{ id: 'food', type: 'expense', name: '餐飲' }], transactions: [
  tx(.1, '午餐｜Uber'), tx(.2, '午餐｜Uber Eats'), tx(80, '晚餐｜門市'), tx(40, '咖啡'),
  tx(999, '午餐', { type: 'income' }), tx(999, '午餐', { category: 'other' }), tx(999, '午餐', { date: '2026-09-01' }),
] };
const before = JSON.stringify(book);
assert.equal(food.summarize(book, '2026-10').total, 120.3);
assert.equal(food.summarize(book, '2026-10', '午餐', 'uber').total, .3);
assert.equal(food.summarize(book, '2026-10', null, '未指定通路').total, 40);
assert.equal(food.summarize(book, '2026-10', '點心').count, 0);
assert.equal(food.summarize(book, '2026-09').total, 999);
assert.equal(JSON.stringify(book), before);
for (const amount of [NaN, Infinity, -1]) assert.throws(() => food.summarize({ ...book, transactions: [tx(amount, '午餐')] }, '2026-10'));
// User channel names must stay ordinary own keys, even when they resemble JS prototype properties.
assert.equal(food.summarize({ ...book, transactions: [tx(1, '午餐｜__proto__')] }, '2026-10').channels.__proto__, 1);
assert.equal(food.summarize({ categories: book.categories, transactions: [] }, '2026-10').count, 0);
console.log('Dining codec and aggregation checks passed.');
module.exports = { samples, book };
