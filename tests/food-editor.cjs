// Isolated HA frontend fixture; no credentials, live ledger or external network.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const www = path.join(root, 'shared/core/www');
const output = path.join(root, '.validation/food-editor');
const categories = [
  { id: 'food', name: '餐飲', type: 'expense', color: '#ee9911' },
  { id: 'shopping', name: '購物', type: 'expense', color: '#9966cc' },
  { id: 'salary', name: '薪資', type: 'income', color: '#00aa99' },
];
const tx = (id, note, category = 'food') => ({ id, date: '2026-10-17', time: '13:30', amount: 120, type: 'expense', category, note });
const data = { active_book_id: 'demo', books: { demo: { id: 'demo', name: '介面測試（假資料）', currency: 'TWD', categories,
  transactions: [tx('legacy', '晚餐 現場'), tx('structured', '午餐｜ＵＢＥＲ｜飯糰'), tx('shopping', '日用品', 'shopping')], budgets: {}, recurring: [] } } };
const bootstrap = `<home-assistant></home-assistant><script>
const fixtureData = ${JSON.stringify(data).replace(/</g, '\\u003c')};
window.__calls = [];
const fixtureHass = { language: 'zh-Hant', locale: { language: 'zh-Hant' }, states: {
  'sensor.budget_book_all_books': { attributes: { full_data: fixtureData } }
}, callService: async (domain, service, payload) => { window.__calls.push({ domain, service, payload: structuredClone(payload) }); } };
document.querySelector('home-assistant').hass = fixtureHass;
</script>`;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = path.resolve(www, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(www + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const ext = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json; charset=utf-8' };
    let body = fs.readFileSync(file);
    if (ext === '.html') body = Buffer.from(body.toString().replace('<body>', '<body>' + bootstrap));
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, locale: 'zh-TW', colorScheme: 'dark' });
    const errors = []; const dialogs = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Render error|Bootstrap fatal|bindEvents error/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const base = `http://127.0.0.1:${server.address().port}/`;
    const reset = async () => { await page.goto(base); await page.locator('#main').waitFor({ state: 'visible' }); };
    const add = async () => { await page.locator('#btn-quick-add').click(); await page.locator('#tx-amount').fill('300'); };
    const save = async () => { await page.locator('#tx-submit').click(); await page.locator('#modal-tx').waitFor({ state: 'hidden' }); return page.evaluate(() => window.__calls.at(-1)); };
    const edit = async id => { await page.locator('[data-tab="tx"]').click(); await page.locator(`#tx-tbody tr[data-tx-id="${id}"] td`).first().click(); };
    await reset(); await add();
    assert(await page.locator('#tx-food-fields').isVisible());
    assert.equal((await save()).payload.note, '');
    await reset(); await add();
    await page.locator('#tx-food-meal').selectOption('晚餐');
    await page.locator('#tx-food-channel').fill('uber');
    await page.locator('#tx-note').fill('便當，加飯');
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    const added = await save();
    assert.equal(added.service, 'add_transaction');
    assert.equal(added.payload.note, '晚餐｜Uber Eats｜便當，加飯');
    assert.equal(added.payload.category, 'food');
    await reset(); await edit('legacy');
    assert.equal(await page.locator('#tx-food-meal').inputValue(), '晚餐');
    assert.equal(await page.locator('#tx-food-channel').inputValue(), '');
    assert.equal(await page.locator('#tx-note').inputValue(), '現場');
    await page.locator('#tx-amount').fill('350');
    assert.equal((await save()).payload.note, '晚餐 現場');
    await reset(); await edit('structured');
    assert.equal(await page.locator('#tx-food-channel').inputValue(), 'Uber Eats');
    assert.equal(await page.locator('#tx-note').inputValue(), '飯糰');
    await page.locator('#tx-amount').fill('350');
    assert.equal((await save()).payload.note, '午餐｜ＵＢＥＲ｜飯糰');
    await reset(); await edit('structured');
    await page.locator('#tx-note').fill('飯糰，加蛋');
    assert.equal((await save()).payload.note, '午餐｜Uber Eats｜飯糰，加蛋');
    await reset(); await edit('structured');
    await page.locator('#tx-cat-picker [data-cat="shopping"]').click();
    assert(!(await page.locator('#tx-food-fields').isVisible()));
    assert.equal(await page.locator('#tx-note').inputValue(), '午餐｜ＵＢＥＲ｜飯糰');
    await page.locator('#tx-cat-picker [data-cat="food"]').click();
    assert.equal(await page.locator('#tx-note').inputValue(), '飯糰');
    await page.locator('#tx-food-channel').fill('現場');
    await page.locator('.tx-type-btn[data-type="income"]').click();
    assert(!(await page.locator('#tx-food-fields').isVisible()));
    assert.equal(await page.locator('#tx-note').inputValue(), '午餐｜現場｜飯糰');
    const income = await save();
    assert.equal(income.payload.type, 'income'); assert.equal(income.payload.note, '午餐｜現場｜飯糰');
    await reset(); await edit('shopping');
    assert(!(await page.locator('#tx-food-fields').isVisible()));
    await page.locator('#tx-amount').fill('200');
    assert.equal((await save()).payload.note, '日用品');
    await reset(); await add();
    await page.locator('#tx-food-channel').fill('a|b');
    await page.locator('#tx-submit').click();
    await page.waitForFunction(() => window.__calls.length === 0);
    assert(await page.locator('#modal-tx').isVisible());
    assert(dialogs.at(-1).includes('通路最多 30 字'));
    await page.locator('#tx-food-channel').fill('現場');
    await page.locator('#tx-note').fill('字'.repeat(100));
    await page.locator('#tx-submit').click();
    assert(dialogs.at(-1).includes('合計最多 100 字'));
    await page.locator('#tx-note').fill('測試備註');
    await page.locator('#tx-food-meal').selectOption('晚餐');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.locator('#tx-submit').isVisible());
    const saveBox = await page.locator('#tx-submit').boundingBox();
    assert(saveBox.y + saveBox.height <= 844, 'Mobile save button stays in view');
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    await page.locator('#modal-tx .modal-close').click();
    assert.equal(await page.evaluate(() => window.__calls.length), 0);
    await add();
    assert.equal(await page.locator('#tx-food-channel').inputValue(), '');
    assert.equal(await page.locator('#tx-food-meal').inputValue(), '一般餐飲');
    await page.locator('#modal-tx .modal-close').click();
    for (const lang of ['en', 'zh-Hans', 'zh-Hant']) {
      await page.locator('[data-tab="settings"]').click();
      await page.locator('#language-select').selectOption(lang);
      await add();
      assert(!(await page.locator('#tx-food-fields').textContent()).includes('food.'));
      await page.locator('#modal-tx .modal-close').click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: optional fields, legacy preservation, separate description edits, category/type switches, validation, cancellation, translations, desktop/mobile layout.');
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
