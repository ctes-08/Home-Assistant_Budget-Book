// Render the real homepage with a disposable ledger and controlled browser clock.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const www = path.resolve(__dirname, '../shared/core/www');
const locale = JSON.parse(fs.readFileSync(path.join(www, 'locales/zh-Hant.json'), 'utf8'));
const cases = [
  { now: '2026-10-17T12:00:00+08:00', day: 17, expected: '2026-10-17', days: 0 },
  { now: '2026-10-17T12:00:00+08:00', day: 20, expected: '2026-10-20', days: 3 },
  { now: '2026-04-29T12:00:00+08:00', day: 31, expected: '2026-04-30', days: 1 },
  { now: '2026-02-27T12:00:00+08:00', day: 31, expected: '2026-02-28', days: 1 },
  { now: '2028-02-28T12:00:00+08:00', day: 31, expected: '2028-02-29', days: 1 },
  { now: '2026-12-31T12:00:00+08:00', day: 30, expected: '2027-01-30', days: 30 },
];
function fixture(day) {
  const rule = { id: 'fixture', name: '測試固定支出', amount: 99, day_of_month: day, type: 'expense', category: 'food', active: true };
  const book = { id: 'demo', name: '日期測試（假資料）', currency: 'TWD', categories: [{ id: 'food', name: '餐飲', type: 'expense', color: '#ffaa00' }], transactions: [], budgets: {}, recurring: [rule] };
  const states = {
    'sensor.budget_book_all_books': { attributes: { full_data: { active_book_id: 'demo', books: { demo: book } } } },
    'sensor.budget_book_month_expense': { state: 0, attributes: {} },
  };
  return '<home-assistant></home-assistant><script>document.querySelector("home-assistant").hass = '
    + JSON.stringify({ language: 'zh-Hant', locale: { language: 'zh-Hant' }, states }) + ';</script>';
}
(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = path.resolve(www, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(www + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const ext = path.extname(file), types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css' };
    let body = fs.readFileSync(file);
    if (ext === '.html') body = Buffer.from(body.toString().replace('<body>', '<body>' + fixture(Number(url.searchParams.get('day') || 17))));
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }).end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const adapter of ['hacs', 'addon']) {
      const context = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
      try {
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.hostname !== '127.0.0.1') return route.abort();
          if (adapter === 'addon' && url.pathname === '/app.js') {
            return route.fulfill({ path: path.resolve(__dirname, '../budget_book/rootfs/app/www/app.js'), contentType: 'text/javascript' });
          }
          if (adapter === 'addon' && url.pathname === '/api/states') {
            const day = Number(new URL(route.request().headers().referer).searchParams.get('day'));
            const html = fixture(day), json = html.slice(html.indexOf(' = ') + 3, html.lastIndexOf(';</script>'));
            return route.fulfill({ json: JSON.parse(json).states });
          }
          return route.continue();
        });
        for (const test of cases) {
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', msg => { if (/Render error|Bootstrap fatal|bindEvents error/.test(msg.text())) errors.push(msg.text()); });
          try {
            await page.clock.install({ time: new Date(test.now) });
            await page.goto(`http://127.0.0.1:${server.address().port}/?day=${test.day}`);
            await page.locator('#main').waitFor({ state: 'visible' });
            const row = page.locator('#home-upcoming .upcoming-row');
            await row.waitFor();
            assert((await row.locator('.upcoming-meta').textContent()).includes(test.expected), adapter + ' date ' + test.expected);
            const expectedBadge = test.days === 0 ? locale['date.today'] : locale['date.days_later'].replace('{days}', test.days);
            assert.equal((await row.locator('.badge').textContent()).trim(), expectedBadge);
            assert.deepEqual(errors, []);
          } finally { await page.close(); }
        }
      } finally { await context.close(); }
    }
    console.log('PASS: both adapters render correct local dates and badges for today, future, short months, leap years and year rollover (12 cases).');
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
